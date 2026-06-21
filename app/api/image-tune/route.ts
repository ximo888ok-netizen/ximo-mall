import { z } from "zod";
import { NextRequest } from "next/server";

import { getProviderAdapter } from "@/lib/services/provider-service";
import { handleRouteError, ok } from "@/lib/utils/route";

const imageTuneSchema = z.object({
  imageBase64: z.string().min(1, "请上传需要微调的图片"),
  instruction: z.string().min(1, "请输入微调说明"),
  referenceBase64: z.string().optional(),
  aspectRatio: z.string().optional(),
  mimeType: z.string().optional().default("image/png"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

function isPreferredImageModel(modelId: string) {
  return /(banana|nano-banana|nano banana|imagen|recraft|flux|gemini|gpt-image|gpt-image-1|seedream|seededit|qwen-image|cogview)/i.test(modelId);
}

function isStableImageModel(modelId: string) {
  return !/(preview|experimental|beta|test)/i.test(modelId);
}

function canEditRealImage(model: { capabilities: unknown }) {
  const capabilities = (model.capabilities as Record<string, boolean> | null) ?? {};
  const modelId = (model as { modelId?: string }).modelId ?? "";
  return (
    (Boolean(capabilities.image_edit) && capabilities.real_image_edit !== false) ||
    (Boolean(capabilities.image_gen) &&
      (capabilities.real_image_gen !== false || /gemini.*image|nano-banana|banana/i.test(modelId)))
  );
}

function findVisionModel(models: Array<{ modelId: string; capabilities: unknown }>) {
  const visionModels = models.filter((item) => {
    const caps = item.capabilities as Record<string, boolean> | null;
    return caps?.text && caps?.vision;
  });
  if (!visionModels.length) return null;
  const preferred = visionModels.find(
    (item) => /(gemini|gpt-4o|gpt-4\.1|claude|qwen-vl|vision)/i.test(item.modelId)
  );
  return preferred ?? visionModels[0];
}

function buildImageTunePrompt(instruction: string, width?: number, height?: number) {
  const sizeInfo = width && height
    ? [
        "",
        "=== 原始图片尺寸（必须严格遵守）===",
        `原始宽度：${width}px`,
        `原始高度：${height}px`,
        `宽高比：${(width / height).toFixed(4)}`,
        `规则 #6：【保持原图尺寸】输出的图片尺寸必须与原始尺寸完全一致（${width}x${height}），严禁放大、缩小、裁剪或更改分辨率。如果 AI 模型不支持精确像素尺寸输出，也必须尽可能保持宽高比一致，不要随意改变。`,
      ].join("\n")
    : "";

  return [
    "你是一个专业的图片编辑助手。你的任务是根据用户的具体指令来修改图片。",
    "",
    "=== ⚠️ 核心约束（违反以下规则视为任务失败）===",
    "规则 #1：用户指令是你的最高优先级。你必须严格、逐字地实现用户描述的内容。",
    "规则 #2：【严禁随意改动】只调整用户明确描述要修改的部分，其他未提及的内容（背景、颜色、构图、物体、文字、光影等）必须保持完全不变。",
    "规则 #3：如果你不确定某个元素是否需要修改，默认不要修改它。",
    "规则 #4：修改效果必须看起来自然、专业，与图片原有的风格、光影、色调融为一体。",
    "规则 #5：不要添加用户未要求的新元素，不要删除用户未提及的现有元素。",
    sizeInfo,
    "",
    "=== 用户指令 ===",
    `用户说："${instruction}"`,
    "",
    "你的任务：精确执行上述指令。只修改用户描述的部分，其余保持原样。",
    "",
    "=== 技术要求 ===",
    "- 输出必须是高质量的图片",
    "- 修改部分必须与原始图片的风格保持一致",
    "- 光影方向和色调必须与原始图片协调",
    "- 不要输出任何文字说明，只输出编辑后的图片",
    "",
    "=== 负面约束（严禁出现以下情况）===",
    "- 严禁修改用户未提及的任何元素",
    "- 严禁添加用户未要求的新物体、文字或装饰",
    "- 严禁删除用户未明确要求删除的现有元素",
    "- 严禁改变整体色调或风格（除非用户明确要求）",
    "- 严禁出现变形、模糊、低质量的效果",
    "- 严禁出现与原始图片不协调的拼贴感",
  ].join("\n");
}

function buildImageModelCandidates(provider: {
  models: Array<{ modelId: string; capabilities: unknown; isDefaultImageEdit?: boolean }>;
}) {
  const candidatePool = provider.models.filter((item) => canEditRealImage(item));

  const candidates = [
    candidatePool.find((item) => item.isDefaultImageEdit)?.modelId ?? null,
    candidatePool.find((item) => item.isDefaultImageEdit || item.isDefaultImageEdit)?.modelId ?? null,
    ...candidatePool
      .filter((item) => isStableImageModel(item.modelId) && isPreferredImageModel(item.modelId))
      .map((item) => item.modelId),
    ...candidatePool.filter((item) => isStableImageModel(item.modelId)).map((item) => item.modelId),
    ...candidatePool.filter((item) => isPreferredImageModel(item.modelId)).map((item) => item.modelId),
    ...candidatePool.map((item) => item.modelId),
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

async function runVisionAnalysis(
  adapter: import("@/lib/ai/adapters/openai-compatible").OpenAICompatibleAdapter,
  visionModel: { modelId: string },
  mainImageUrl: string,
  referenceImageUrl: string,
) {
  const result = await adapter.generateText({
    model: visionModel.modelId,
    systemPrompt: "You are a precise visual analysis assistant. Output ONLY valid JSON.",
    userPrompt: [
      "请分析以下两张图片并输出纯 JSON：",
      "",
      "【图片1 - 主图（将被修改的产品图）】",
      "这是需要保留主要产品/内容，只进行局部调整的原图。",
      "",
      "【图片2 - 参考图（提供风格/元素/场景的模板图）】",
      "这是提供风格、元素或场景布局的参考图。",
      "",
      "请输出以下 JSON 格式：",
      `{`,
      `  "main_image_description": "描述主图中的产品外观、主要内容、颜色、构图等关键特征"`,
      `  "reference_style_description": "描述参考图中的风格特点、场景布局、色调、光影等"`,
      `  "transfer_instructions": "描述应该如何将主图的产品融入到参考图的场景/风格中"`,
      `}`,
    ].join("\n"),
    images: [mainImageUrl, referenceImageUrl],
    timeoutMs: 90000,
    monitor: { operation: "image_tune_vision" },
  });

  const cleaned = result.text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("视觉分析未返回有效的 JSON 结果");
  }

  const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  return {
    mainImageDescription: parsed.main_image_description || "",
    referenceStyleDescription: parsed.reference_style_description || "",
    transferInstructions: parsed.transfer_instructions || "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = imageTuneSchema.parse(await request.json().catch(() => ({})));

    const { provider, adapter } = await getProviderAdapter();
    const modelCandidates = buildImageModelCandidates(provider);

    if (!modelCandidates.length) {
      return handleRouteError(new Error("当前 Provider 没有探测到可用于图片编辑的模型。请前往 AI 配置页面检查模型服务配置。"));
    }

    const imageDataUrl = input.imageBase64.startsWith("data:")
      ? input.imageBase64
      : `data:${input.mimeType};base64,${input.imageBase64}`;

    const refDataUrl = input.referenceBase64
      ? (input.referenceBase64.startsWith("data:") ? input.referenceBase64 : `data:${input.mimeType};base64,${input.referenceBase64}`)
      : null;

    // 当用户选择了自定义宽高比时，使用 aspectRatio 而非原图尺寸
    // 当用户选择"原图比例"时，根据原图宽高比计算 DashScope 兼容的尺寸
    // DashScope 不支持任意像素尺寸，只支持特定尺寸（如 1024x1024, 1024x1536 等）
    const hasCustomAspectRatio = !!input.aspectRatio;
    let size: string | undefined;
    let aspectRatio: string | undefined;

    if (hasCustomAspectRatio) {
      aspectRatio = input.aspectRatio;
    } else if (input.width && input.height) {
      // 根据原图宽高比计算兼容尺寸
      const ratio = input.width / input.height;
      if (ratio > 1.4) {
        size = "1536x1024"; // 横版
      } else if (ratio > 1.1) {
        size = "1024x1024"; // 接近正方
      } else if (ratio > 0.75) {
        size = "1024x1024"; // 接近正方
      } else {
        size = "1024x1536"; // 竖版
      }
    }

    const hasReference = !!refDataUrl;

    if (hasReference) {
      const visionModel = findVisionModel(provider.models);
      if (!visionModel) {
        return handleRouteError(new Error("当前 Provider 没有探测到支持视觉分析的模型，无法自动识别图片内容。"));
      }

      let visionResult: Awaited<ReturnType<typeof runVisionAnalysis>>;

      try {
        visionResult = await runVisionAnalysis(adapter, visionModel, imageDataUrl, refDataUrl!);
      } catch (error) {
        return handleRouteError(new Error(`视觉分析失败：${error instanceof Error ? error.message : "未知错误"}`));
      }

      const mainImageDesc = visionResult.mainImageDescription;
      const referenceStyleDesc = visionResult.referenceStyleDescription;
      const transferInstructions = visionResult.transferInstructions;

      // 构建编辑 prompt：以主图为底图，参考图仅提供风格参考
      const editPrompt = [
        "你是一个专业的图片编辑助手。你的任务是根据用户的指令修改【主图】。",
        "",
        "=== 核心约束 ===",
        "规则 #1：主图是你的修改基础，最终输出必须以主图内容为主体。",
        "规则 #2：参考图仅提供风格、色调、光影、构图等参考，不要把主图变成参考图。",
        "规则 #3：只修改用户明确描述要修改的部分，其他未提及的内容必须保持完全不变。",
        "规则 #4：修改效果必须与主图原有的风格自然融合。",
        "",
        "=== 主图特征 ===",
        mainImageDesc || "主图中的主要产品外观和内容",
        "",
        "=== 参考图风格（仅供参考） ===",
        referenceStyleDesc || "参考图的场景布局、色调、光影等风格特点",
        "",
        "=== 用户指令 ===",
        `用户说："${input.instruction}"`,
        "",
        "=== 严格执行 ===",
        "- 以主图为底图进行修改",
        "- 参考图的风格仅作为灵感参考，不要覆盖主图内容",
        "- 只修改用户指令中明确提到的部分",
        "- 保持主图中未提及的所有元素不变",
        "- 最终输出必须看起来像是主图的自然延伸，而非参考图的复制",
      ].join("\n");

      const errors: string[] = [];
      for (const model of modelCandidates) {
        try {
          // 使用 editImage 而非 generateImage，确保以主图为底图
          const result = await adapter.editImage({
            model,
            prompt: editPrompt,
            image: imageDataUrl,
            referenceImages: [refDataUrl!],
            size,
            aspectRatio,
            monitor: { operation: "image_tune_reference" },
          });

          let base64Data = result.b64Json ?? null;
          if (!base64Data && result.url) {
            const urlResponse = await fetch(result.url);
            if (!urlResponse.ok) {
              throw new Error(`无法下载结果图片 (${urlResponse.status})`);
            }
            const buffer = Buffer.from(await urlResponse.arrayBuffer());
            base64Data = buffer.toString("base64");
          }

          if (!base64Data) {
            throw new Error("AI 未返回有效的图片数据");
          }

          return ok({
            base64Data,
            url: result.url ?? null,
            revisedPrompt: result.revisedPrompt ?? null,
            usedModel: model,
            usedVisionModel: visionModel.modelId,
            originalWidth: input.width ?? null,
            originalHeight: input.height ?? null,
            analysis: {
              mainImageDescription: visionResult.mainImageDescription,
              referenceStyleDescription: visionResult.referenceStyleDescription,
              transferInstructions: visionResult.transferInstructions,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown image generation error";
          errors.push(`${model}: ${message}`);

          if (!/404|405|429|no available endpoint|unsupported|not implemented|does not exist|invalid_value/i.test(message)) {
            return handleRouteError(error);
          }
        }
      }

      return handleRouteError(new Error(`所有可用图片生成模型都处理失败：${errors.join(" | ")}`));
    }

    const prompt = buildImageTunePrompt(input.instruction, input.width, input.height);

    const errors: string[] = [];

    for (const model of modelCandidates) {
      try {
        const result = await adapter.editImage({
          model,
          prompt,
          image: imageDataUrl,
          size,
          aspectRatio,
          monitor: { operation: "image_tune" },
        });

        let base64Data = result.b64Json ?? null;
        if (!base64Data && result.url) {
          const urlResponse = await fetch(result.url);
          if (!urlResponse.ok) {
            throw new Error(`无法下载微调结果图片 (${urlResponse.status})`);
          }
          const buffer = Buffer.from(await urlResponse.arrayBuffer());
          base64Data = buffer.toString("base64");
        }

        if (!base64Data) {
          throw new Error("AI 微调未返回有效的图片数据");
        }

        return ok({
          base64Data,
          url: result.url ?? null,
          revisedPrompt: result.revisedPrompt ?? null,
          usedModel: model,
          originalWidth: input.width ?? null,
          originalHeight: input.height ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown image edit error";
        errors.push(`${model}: ${message}`);

        if (!/404|405|429|no available endpoint|unsupported|not implemented|does not exist|invalid_value/i.test(message)) {
          return handleRouteError(error);
        }
      }
    }

    return handleRouteError(new Error(`所有可用图片编辑模型都处理失败：${errors.join(" | ")}`));
  } catch (error) {
    return handleRouteError(error);
  }
}
