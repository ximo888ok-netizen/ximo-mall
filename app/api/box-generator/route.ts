import { NextRequest, NextResponse } from "next/server";

import { getProviderAdapter } from "@/lib/services/provider-service";
import { buildBoxDielinePrompt, type BoxPromptParams } from "@/lib/ai/prompts/box-generation";
import { boxGenerateSchema, type BoxGenerateInput } from "@/lib/validations/box-generator";

function isPreferredImageModel(modelId: string) {
  return /(banana|nano-banana|nano banana|imagen|recraft|flux|gemini|gpt-image|gpt-image-1|seedream|seededit|qwen-image|cogview)/i.test(modelId);
}

function isStableImageModel(modelId: string) {
  return !/(preview|experimental|beta|test)/i.test(modelId);
}

function canGenerateImage(model: { capabilities: unknown; modelId?: string }) {
  const capabilities = (model.capabilities as Record<string, boolean> | null) ?? {};
  const modelId = (model as { modelId?: string }).modelId ?? "";
  return Boolean(capabilities.image_gen) && (
    capabilities.real_image_gen !== false || /gemini.*image|nano-banana|banana/i.test(modelId)
  );
}

function buildImageModelCandidates(
  provider: { models: Array<{ modelId: string; capabilities: unknown; isDefaultHeroImage?: boolean; isDefaultDetailImage?: boolean }> },
  options?: { preferredModelId?: string | null; asHero?: boolean },
) {
  const candidatePool = provider.models.filter((item) => canGenerateImage(item));

  const candidates = [
    options?.preferredModelId ?? null,
    candidatePool.find((item) =>
      options?.asHero ? item.isDefaultHeroImage : item.isDefaultDetailImage,
    )?.modelId ?? null,
    candidatePool.find((item) => item.isDefaultHeroImage)?.modelId ?? null,
    candidatePool.find((item) => item.isDefaultDetailImage)?.modelId ?? null,
    ...candidatePool
      .filter((item) => isStableImageModel(item.modelId) && isPreferredImageModel(item.modelId))
      .map((item) => item.modelId),
    ...candidatePool.filter((item) => isStableImageModel(item.modelId)).map((item) => item.modelId),
    ...candidatePool.filter((item) => isPreferredImageModel(item.modelId)).map((item) => item.modelId),
    ...candidatePool.map((item) => item.modelId),
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

function toPromptParams(input: BoxGenerateInput): BoxPromptParams {
  const plannedVisualPrompt = input.plannedFaces?.[0]?.visualPrompt ?? "";

  return {
    productName: input.productName,
    brandName: input.brandName,
    productCategory: input.productCategory,
    productDimensions: undefined,
    boxType: input.boxType,
    boxDimensions: input.boxDimensions,
    material: input.material,
    finish: input.finish,
    style: input.style,
    primaryColor: input.primaryColor,
    secondaryColors: input.secondaryColors,
    fontStyle: input.fontStyle,
    slogan: plannedVisualPrompt || "",
    sellingPoints: [],
    productDescription: "",
    specifications: "",
    customInstruction: input.customInstruction,
  };
}

export async function POST(request: NextRequest) {
  const input = boxGenerateSchema.parse(await request.json().catch(() => ({})));

  const { provider: boxProvider, adapter: boxAdapter } = await getProviderAdapter("box");
  const { provider: imageProvider } = await getProviderAdapter("image");

  const boxCandidates = buildImageModelCandidates(boxProvider, { asHero: true, preferredModelId: "wan2.7-image" });
  const imageCandidates = buildImageModelCandidates(imageProvider, { asHero: true });
  const imageDetailCandidates = buildImageModelCandidates(imageProvider, { asHero: false });

  if (!boxCandidates.length && !imageCandidates.length && !imageDetailCandidates.length) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "当前 Provider 没有探测到可用于图片生成的模型。请前往 AI 配置页面检查模型服务配置。" } },
      { status: 500 },
    );
  }

  const productImageDataUrl = input.productImageBase64.startsWith("data:")
    ? input.productImageBase64
    : `data:image/jpeg;base64,${input.productImageBase64}`;

  // 使用规划层的 visualPrompt 或自动生成
  const usePlannedPrompts = !!input.plannedFaces && input.plannedFaces.length > 0;
  const prompt = usePlannedPrompts
    ? input.plannedFaces![0].visualPrompt
    : buildBoxDielinePrompt(toPromptParams(input));

  // 刀版图尺寸：根据盒型尺寸计算展开图的宽高比
  const w = input.boxDimensions.width;
  const h = input.boxDimensions.height;
  const d = input.boxDimensions.depth;

  // 展开图大致布局：顶面(w×d) + 正面(w×h) + 底面(w×d) + 背面(w×h) 纵向排列
  // 宽度方向：粘口(1.5) + 侧面(d) + 正面(w) + 侧面(d) + 粘口(1.5) = 2d + w + 3
  // 高度方向：顶面(d) + 正面(h) + 底面(d) + 背面(h) = 2d + 2h
  const dielineWidth = 2 * d + w + 3;
  const dielineHeight = 2 * d + 2 * h;
  const ratio = dielineWidth / dielineHeight;

  let viewSize: string;
  if (ratio >= 1.6) {
    viewSize = "1536x864";
  } else if (ratio >= 1.2) {
    viewSize = "1280x960";
  } else if (ratio >= 0.9) {
    viewSize = "1024x1024";
  } else if (ratio >= 0.65) {
    viewSize = "960x1280";
  } else {
    viewSize = "864x1536";
  }

  const allCandidates = [...new Set([...boxCandidates, ...imageCandidates, ...imageDetailCandidates])];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送开始生成信号
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "progress",
          view: "dieline",
          label: "刀版图",
          status: "generating",
        }) + "\n"));

        let generated = false;
        const errors: string[] = [];

        for (const model of allCandidates) {
          try {
            const result = await boxAdapter.generateImage({
              model,
              prompt,
              size: viewSize,
              referenceImages: [], // 刀版图不传参考图，避免被带偏
              monitor: {
                operation: "box_generate_dieline",
              },
            });

            let base64Data = result.b64Json ?? null;
            if (!base64Data && result.url) {
              const urlResponse = await fetch(result.url);
              if (!urlResponse.ok) {
                throw new Error(`无法下载生成结果 (${urlResponse.status})`);
              }
              const buffer = Buffer.from(await urlResponse.arrayBuffer());
              base64Data = buffer.toString("base64");
            }

            if (!base64Data) {
              throw new Error("AI 未返回有效的图片数据");
            }

            // 发送生成结果
            controller.enqueue(encoder.encode(JSON.stringify({
              type: "result",
              view: "dieline",
              label: "刀版图",
              base64Data,
              usedModel: model,
            }) + "\n"));

            generated = true;
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown generation error";
            errors.push(`${model}: ${message}`);

            if (!/404|405|429|no available endpoint|unsupported|not implemented|does not exist|invalid_value/i.test(message)) {
              throw error;
            }
          }
        }

        if (!generated) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "error",
            view: "dieline",
            label: "刀版图",
            message: `所有可用模型生成均失败：${errors.join(" | ")}`,
          }) + "\n"));
        }

        // 发送完成信号
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "done",
          totalGenerated: generated ? 1 : 0,
        }) + "\n"));

        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "fatal",
          message: error instanceof Error ? error.message : "生成过程发生未知错误",
        }) + "\n"));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
