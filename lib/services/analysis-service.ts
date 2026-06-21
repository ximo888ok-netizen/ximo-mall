import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { buildProductAnalysisPrompt, buildProductAnalysisRepairPrompt, buildKnowledgeConstrainedAnalysisPrompt } from "@/lib/ai/prompts";
import { listKnowledgeEntries } from "@/lib/services/product-library-service";
import { productAnalysisOutputSchema } from "@/lib/ai/schemas/product-analysis";
import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { completeTask, createTask, failTask, findRecentRunningTask } from "@/lib/services/task-service";
import { readStorageFile } from "@/lib/storage/asset-manager";

function normalizeModelId(value: string) {
  return value.toLowerCase();
}

function hasCapability(model: { capabilities: unknown }, key: string) {
  const capabilities = (model.capabilities ?? {}) as Record<string, boolean>;
  return Boolean(capabilities[key]);
}

function isPreviewLike(modelId: string) {
  return /(preview|experimental|beta|test)/i.test(modelId);
}

function isLiteLike(modelId: string) {
  return /(lite|flash-lite)/i.test(modelId);
}

function isImageSpecialized(modelId: string) {
  return /(image|imagen|recraft|flux|canvas)/i.test(modelId);
}

function isStableAnalysisCandidate(modelId: string) {
  return !isPreviewLike(modelId) && !isLiteLike(modelId) && !isImageSpecialized(modelId);
}

function extractJsonBlock(raw: string) {
  const direct = raw.trim();
  if (direct.startsWith("{") || direct.startsWith("[")) {
    return direct;
  }

  const fencedMatch = direct.match(/```json([\s\S]*?)```/i) || direct.match(/```([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return direct.slice(firstBrace, lastBrace + 1);
  }

  return direct;
}

function shouldAttemptRepair(error: unknown) {
  return (
    error instanceof ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && /json|schema|parse/i.test(error.message))
  );
}

function buildAnalysisModelCandidates(
  provider: Awaited<ReturnType<typeof getProviderAdapter>>["provider"],
  preferredModelId?: string | null,
): string[] {
  const models = provider.models;
  const textVisionModels = models.filter(
    (item) => hasCapability(item, "text") && hasCapability(item, "vision"),
  );
  const textModels = models.filter((item) => hasCapability(item, "text"));

  // 硬编码首选分析模型（火山引擎）
  const PRIMARY_ANALYSIS_MODEL = "doubao-seed-2-0-lite-260428";
  const primaryModel = models.find((item) => item.modelId === PRIMARY_ANALYSIS_MODEL);

  // 明确查找 isDefaultAnalysis 标记的模型
  const defaultAnalysisModel = models.find((item) => item.isDefaultAnalysis);

  const priorityMatches: (string | null)[] = [
    preferredModelId
      ? models.find((item) => item.modelId === preferredModelId && hasCapability(item, "text"))?.modelId ?? null
      : null,
    // 最优先：硬编码的首选分析模型
    primaryModel?.modelId ?? null,
    // 其次：用户在 UI 中标记的默认分析模型
    defaultAnalysisModel?.modelId ?? null,
    // 其次：稳定的视觉文本模型
    textVisionModels.find((item) => isStableAnalysisCandidate(item.modelId) && /gemini/i.test(normalizeModelId(item.modelId)))?.modelId ?? null,
    textVisionModels.find((item) => isStableAnalysisCandidate(item.modelId) && /qwen-vl|doubao-vision|glm-4v/i.test(normalizeModelId(item.modelId)))?.modelId ?? null,
    textVisionModels.find((item) => isStableAnalysisCandidate(item.modelId) && /gpt-4o|claude/i.test(normalizeModelId(item.modelId)))?.modelId ?? null,
  ];

  const seen = new Set(priorityMatches.filter(Boolean) as string[]);

  const rest = [
    ...textVisionModels
      .filter((item) => isStableAnalysisCandidate(item.modelId) && !seen.has(item.modelId))
      .map((item) => item.modelId),
    ...textVisionModels
      .filter((item) => !seen.has(item.modelId))
      .map((item) => item.modelId),
    ...textModels
      .filter((item) => isStableAnalysisCandidate(item.modelId) && !seen.has(item.modelId))
      .map((item) => item.modelId),
    ...textModels
      .filter((item) => !seen.has(item.modelId))
      .map((item) => item.modelId),
  ];

  return [...(priorityMatches.filter(Boolean) as string[]), ...rest];
}

async function assetToDataUrl(asset: { filePath: string; mimeType: string | null }) {
  const buffer = await readStorageFile(asset.filePath);
  const mimeType = asset.mimeType ?? "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function repairAnalysisOutput(input: {
  adapter: Awaited<ReturnType<typeof getProviderAdapter>>["adapter"];
  model: string;
  raw: string;
}) {
  const repaired = await input.adapter.generateText({
    model: input.model,
    systemPrompt: "Return one strict JSON object only.",
    userPrompt: buildProductAnalysisRepairPrompt(input.raw),
    monitor: {
      operation: "analysis_output_repair",
    },
  });

  const parsed = productAnalysisOutputSchema.parse(JSON.parse(extractJsonBlock(repaired.text)));
  return {
    parsed,
    repairedRaw: repaired.text,
  };
}

function isModelNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    /404|does not exist|not found for model|InvalidEndpointOrModel|model.*not found/i.test(error.message)
  );
}

function normalizeAnalysisProviderError(error: unknown): never {
  const detail = error instanceof Error ? error.message : "Unknown analysis error";

  if (/monthly spending limit|spending limit|billing|quota|insufficient_quota/i.test(detail)) {
    throw new Error("当前 API Key 的分析额度已用尽。请前往代理商控制台提高或移除月度限额，或更换可用的 API Key。");
  }

  if (/429|rate limit|限流/i.test(detail)) {
    throw new Error("当前分析请求触发了限流。请稍后重试，或降低调用频率。");
  }

  if (/invalid token|unauthorized|forbidden/i.test(detail)) {
    throw new Error("当前 Provider 鉴权失败。请检查 baseURL、API Key 或代理商权限配置。");
  }

  if (/timed out|aborterror|network error|fetch failed/i.test(detail)) {
    throw new Error("当前 Provider 请求超时或网络异常，请稍后重试。");
  }

  if (isModelNotFoundError(error)) {
    throw new Error("当前模型在该 Provider 中不可用，请重新发现模型并确保所选模型在该代理商中确实存在。");
  }

  throw error instanceof Error ? error : new Error(detail);
}

/** 知识库约束分析：仅使用主体图，以产品知识库为地面真相 */
async function analyzeWithKnowledgeConstraint(
  projectId: string,
  project: { id: string; modelSnapshot: unknown },
  productLibraryId: string,
  preferredModelId?: string | null,
) {
  const { provider, adapter } = await getProviderAdapter("analysis");

  // 使用产品外包装或主体图（快速开始上传 PACKAGING，其他入口可能上传 MAIN）
  const mainAssets = (
    await prisma.productAsset.findMany({
      where: { projectId, type: { in: ["PACKAGING", "MAIN"] } },
      orderBy: { sortOrder: "asc" },
      take: 1,
    })
  );
  const imageUrls = await Promise.all(mainAssets.map((asset) => assetToDataUrl(asset)));

  // 从产品知识库获取全部知识条目
  const knowledgeEntries = await listKnowledgeEntries(productLibraryId);
  const knowledgeSummaries = knowledgeEntries.map((entry) => ({
    category: entry.category,
    title: entry.title,
    content: entry.content,
  }));

  const prompt = buildKnowledgeConstrainedAnalysisPrompt(mainAssets, knowledgeSummaries);
  const modelCandidates = buildAnalysisModelCandidates(provider, preferredModelId);

  if (!modelCandidates.length) {
    throw new Error("No analysis model available.");
  }

  const existingTask = await findRecentRunningTask({
    projectId,
    taskType: "ANALYZE",
    maxAgeMinutes: 10,
  });
  if (existingTask) {
    throw new Error("当前商品分析仍在进行中，请等待这一轮完成后再试。");
  }

  for (const model of modelCandidates) {
    const task = await createTask({
      projectId,
      taskType: "ANALYZE",
      inputPayload: { model, candidates: modelCandidates, knowledgeConstrained: true, productLibraryId },
    });

    try {
      const structured = await adapter.generateStructured({
        model,
        systemPrompt: "Return one strict JSON object only. No markdown.",
        userPrompt: prompt,
        schema: productAnalysisOutputSchema,
        images: imageUrls,
        monitor: {
          projectId,
          operation: "project_analysis_knowledge_constrained",
        },
      });

      const parsedResult = structured.parsed as Prisma.JsonObject;
      const rawResult: Prisma.JsonObject = {
        mode: "knowledge_constrained",
        model,
        productLibraryId,
        knowledgeEntryCount: knowledgeEntries.length,
        raw: structured.raw,
      };

      const saved = await prisma.productAnalysis.upsert({
        where: { projectId },
        update: { rawResult, normalizedResult: parsedResult },
        create: { projectId, rawResult, normalizedResult: parsedResult },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: "ANALYZED",
          modelSnapshot: {
            ...(project.modelSnapshot as Record<string, unknown> | null),
            analysisModelId: model,
            providerConfigId: provider.id,
            analysisMode: "knowledge_constrained",
            productLibraryId,
          },
        },
      });

      await completeTask(task.id, saved.normalizedResult);
      return saved;
    } catch (error) {
      if (isModelNotFoundError(error)) {
        await completeTask(task.id, { skipped: true, model, reason: error instanceof Error ? error.message : "Model not found" });
        continue;
      }
      await failTask(task.id, error instanceof Error ? error.message : "Knowledge-constrained analysis failed");
      normalizeAnalysisProviderError(error);
    }
  }

  throw new Error("所有分析模型均已尝试但均不可用。请前往 Provider 设置重新发现模型。");
}

export async function analyzeProject(
  projectId: string,
  preferredModelId?: string | null,
  hasAssociatedImages = false,
  productLibraryId?: string,
  restrictToAssetTypes?: string[],
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assets: { orderBy: { sortOrder: "asc" } } },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  // ========== 知识库约束分支：仅分析主体图，以知识库为地面真相 ==========
  if (productLibraryId) {
    return analyzeWithKnowledgeConstraint(projectId, project, productLibraryId, preferredModelId);
  }

  // ========== 原有分支：全量图片分析 ==========
  const { provider, adapter } = await getProviderAdapter("analysis");
  const modelCandidates = buildAnalysisModelCandidates({ ...provider, models: provider.models }, preferredModelId);

  if (!modelCandidates.length) {
    throw new Error("No analysis model available.");
  }

  const existingTask = await findRecentRunningTask({
    projectId,
    taskType: "ANALYZE",
    maxAgeMinutes: 10,
  });
  if (existingTask) {
    throw new Error("当前商品分析仍在进行中，请等待这一轮完成后再试。");
  }

  // 单会话串联：所有图片（主体+关联）一起发送给视觉模型
  const rawAssets = project.assets;
  const analysisAssets = restrictToAssetTypes?.length
    ? rawAssets.filter((a) => restrictToAssetTypes.includes(a.type))
    : rawAssets;
  const imageUrls = await Promise.all(analysisAssets.slice(0, 6).map((asset) => assetToDataUrl(asset)));
  const prompt = buildProductAnalysisPrompt(analysisAssets, hasAssociatedImages);
  const skippedModels: string[] = [];

  for (const model of modelCandidates) {
    const task = await createTask({
      projectId,
      taskType: "ANALYZE",
      inputPayload: { model, candidates: modelCandidates },
    });

    try {
      let parsedResult: Prisma.JsonObject;
      let rawResult: Prisma.JsonObject;

      try {
        const structured = await adapter.generateStructured({
          model,
          systemPrompt: "Return one strict JSON object only. No markdown.",
          userPrompt: prompt,
          schema: productAnalysisOutputSchema,
          images: imageUrls,
          monitor: {
            projectId,
            operation: "project_analysis",
          },
        });

        parsedResult = structured.parsed as Prisma.JsonObject;
        rawResult = {
          mode: "structured",
          model,
          raw: structured.raw,
        };
      } catch (structuredError) {
        if (isModelNotFoundError(structuredError)) {
          skippedModels.push(model);
          await completeTask(task.id, { skipped: true, model, reason: structuredError instanceof Error ? structuredError.message : "Model not found" });
          continue;
        }

        console.error(`[Analysis] generateStructured failed for ${model}:`, structuredError instanceof Error ? structuredError.message : structuredError);

        let fallbackText;
        try {
          fallbackText = await adapter.generateText({
            model,
            systemPrompt: "Return one strict JSON object only. No markdown.",
            userPrompt: prompt,
            images: imageUrls,
            monitor: {
              projectId,
              operation: "project_analysis_fallback",
            },
          });
        } catch (textError) {
          console.error(`[Analysis] generateText also failed for ${model}:`, textError instanceof Error ? textError.message : textError);
          normalizeAnalysisProviderError(textError);
        }

        try {
          const directParsed = productAnalysisOutputSchema.parse(JSON.parse(extractJsonBlock(fallbackText!.text)));
          parsedResult = directParsed as Prisma.JsonObject;
          rawResult = {
            mode: "text_fallback",
            model,
            initialError:
              structuredError instanceof ZodError
                ? structuredError.flatten()
                : structuredError instanceof Error
                  ? structuredError.message
                  : "Unknown analysis error",
            fallbackRaw: fallbackText!.text,
          };
        } catch (parseError) {
          console.error(`[Analysis] JSON parse failed for ${model}:`, parseError instanceof Error ? parseError.message : parseError);
          if (shouldAttemptRepair(parseError)) {
            try {
              const repaired = await repairAnalysisOutput({
                adapter,
                model,
                raw: fallbackText!.text,
              });

              parsedResult = repaired.parsed as Prisma.JsonObject;
              rawResult = {
                mode: "text_repair",
                model,
                initialError:
                  structuredError instanceof ZodError
                    ? structuredError.flatten()
                    : structuredError instanceof Error
                      ? structuredError.message
                      : "Unknown analysis error",
                fallbackRaw: fallbackText!.text,
                repairedRaw: repaired.repairedRaw,
              };
            } catch (repairError) {
              console.error(`[Analysis] repair also failed for ${model}:`, repairError instanceof Error ? repairError.message : repairError);
              normalizeAnalysisProviderError(repairError);
            }
          } else {
            normalizeAnalysisProviderError(parseError);
          }
        }
      }

      const saved = await prisma.productAnalysis.upsert({
        where: { projectId },
        update: {
          rawResult,
          normalizedResult: parsedResult,
        },
        create: {
          projectId,
          rawResult,
          normalizedResult: parsedResult,
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: "ANALYZED",
          modelSnapshot: {
            ...(project.modelSnapshot as Record<string, unknown> | null),
            analysisModelId: model,
            providerConfigId: provider.id,
          },
        },
      });

      await completeTask(task.id, saved.normalizedResult);
      return saved;
    } catch (error) {
      if (isModelNotFoundError(error)) {
        skippedModels.push(model);
        await completeTask(task.id, { skipped: true, model, reason: error instanceof Error ? error.message : "Model not found" });
        continue;
      }
      await failTask(task.id, error instanceof Error ? error.message : "Analysis failed");
      throw error;
    }
  }

  throw new Error(
    `所有分析模型均已尝试但均不可用。已跳过：${skippedModels.join("、")}。请前往 Provider 设置重新发现模型。`,
  );
}

export async function updateAnalysis(projectId: string, normalizedResult: unknown) {
  const jsonValue = normalizedResult as Prisma.InputJsonValue;
  return prisma.productAnalysis.upsert({
    where: { projectId },
    update: { normalizedResult: jsonValue },
    create: {
      projectId,
      rawResult: jsonValue,
      normalizedResult: jsonValue,
    },
  });
}
