/**
 * 图片学习 Agent 核心服务
 * 分类版：头图/详情图分开投喂和分析，支持增量学习，知识融合积累
 */

import { type KnowledgeType, type LearningImageCategory, Prisma, LearningStatus } from "@prisma/client";
import { z } from "zod";

import {
  buildHeroAnalysisPrompt,
  heroAnalysisSystemPrompt,
  buildDetailAnalysisPrompt,
  detailAnalysisSystemPrompt,
  knowledgeExtractionSystemPrompt,
  buildKnowledgeExtractionPrompt,
} from "@/lib/ai/prompts/image-learning";
import {
  imageAnalysisResultSchema,
  knowledgeExtractionResultSchema,
  type ImageAnalysisResult,
  type KnowledgeExtractionResult,
} from "@/lib/ai/schemas/image-learning";
import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { readStorageFile, saveLearningImage } from "@/lib/storage/asset-manager";

// ==================== 学习会话管理 ====================

export async function createLearningSession(input: {
  name: string;
  description?: string;
  autoApply?: boolean;
}) {
  return prisma.learningSession.create({
    data: {
      name: input.name,
      description: input.description,
      targetTypes: ["STYLE", "LAYOUT", "TYPOGRAPHY"] as Prisma.InputJsonValue,
      autoApply: input.autoApply ?? true,
      status: LearningStatus.PENDING,
    },
  });
}

export async function getLearningSession(sessionId: string) {
  return prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: {
      images: {
        orderBy: { createdAt: "asc" },
      },
      knowledges: {
        include: {
          sources: {
            include: {
              image: true,
            },
          },
        },
      },
    },
  });
}

export async function listLearningSessions() {
  return prisma.learningSession.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          images: true,
          knowledges: true,
        },
      },
    },
  });
}

export async function updateLearningSession(
  sessionId: string,
  input: Partial<{
    name: string;
    description: string;
    autoApply: boolean;
    status: LearningStatus;
  }>
) {
  const data: Prisma.LearningSessionUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.autoApply !== undefined) data.autoApply = input.autoApply;
  if (input.status !== undefined) data.status = input.status;
  return prisma.learningSession.update({ where: { id: sessionId }, data });
}

export async function deleteLearningSession(sessionId: string) {
  return prisma.learningSession.delete({ where: { id: sessionId } });
}

// ==================== 分类学习库（固定入口） ====================

const CATEGORY_SESSION_NAMES: Record<string, string> = {
  HERO: "头图学习库",
  DETAIL: "详情图学习库",
};

/**
 * 确保分类学习库会话存在（不存在则自动创建）
 * 每个分类只有一个固定的会话，按名称查找
 */
export async function ensureCategorySession(category: "HERO" | "DETAIL") {
  const sessionName = CATEGORY_SESSION_NAMES[category];

  // 按固定名称查找会话（比 metadata 匹配更可靠）
  const existing = await prisma.learningSession.findFirst({
    where: { name: sessionName },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      knowledges: {
        include: {
          sources: { include: { image: true } },
        },
        orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (existing) return existing;

  // 不存在则创建
  return prisma.learningSession.create({
    data: {
      name: CATEGORY_SESSION_NAMES[category],
      description: `专用于学习${CATEGORY_SESSION_NAMES[category]}的模板布局、视觉风格和文案排版`,
      targetTypes: ["STYLE", "LAYOUT", "TYPOGRAPHY"] as Prisma.InputJsonValue,
      autoApply: true,
      status: LearningStatus.PENDING,
      metadata: { category },
    },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      knowledges: {
        include: {
          sources: {
            include: { image: true },
          },
        },
        orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}

// ==================== 学习图片管理 ====================

export async function addLearningImage(input: {
  sessionId: string;
  file: Buffer;
  fileName: string;
  mimeType: string;
  category: "HERO" | "DETAIL";
  sourceType: "upload" | "library" | "project";
  sourceId?: string;
  userTags?: string;
  userNotes?: string;
}) {
  // 保存图片文件
  const savedPath = await saveLearningImage({
    sessionId: input.sessionId,
    file: input.file,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });

  // 创建数据库记录
  const image = await prisma.learningImage.create({
    data: {
      sessionId: input.sessionId,
      filePath: savedPath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      category: input.category,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      userTags: input.userTags,
      userNotes: input.userNotes,
      status: LearningStatus.PENDING,
    },
  });

  // 更新会话图片计数
  await prisma.learningSession.update({
    where: { id: input.sessionId },
    data: { imageCount: { increment: 1 } },
  });

  return image;
}

export async function removeLearningImage(imageId: string) {
  const image = await prisma.learningImage.findUnique({ where: { id: imageId } });
  if (!image) throw new Error("Learning image not found");

  await prisma.learningImage.delete({ where: { id: imageId } });
  await prisma.learningSession.update({
    where: { id: image.sessionId },
    data: { imageCount: { decrement: 1 } },
  });
  return image;
}

// ==================== 图片分析核心功能 ====================

async function analyzeSingleImage(image: {
  id: string;
  filePath: string;
  fileName: string;
  category: string | null;
  userTags?: string | null;
  userNotes?: string | null;
}): Promise<ImageAnalysisResult> {
  const { adapter } = await getProviderAdapter();

  // 读取图片
  const imageBuffer = await readStorageFile(image.filePath);
  const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  // 根据分类选择不同的系统提示词和用户提示词
  const isHero = image.category === "HERO";
  const systemPrompt = isHero ? heroAnalysisSystemPrompt : detailAnalysisSystemPrompt;
  const userPrompt = isHero
    ? buildHeroAnalysisPrompt({ fileName: image.fileName, userTags: image.userTags, userNotes: image.userNotes })
    : buildDetailAnalysisPrompt({ fileName: image.fileName, userTags: image.userTags, userNotes: image.userNotes });

  const result = await adapter.generateStructured({
    model: await selectVisionModel(),
    systemPrompt,
    userPrompt,
    schema: imageAnalysisResultSchema,
    images: [imageDataUrl],
    timeoutMs: 120000,
    monitor: { operation: "image_learning_analysis" },
  });

  return result.parsed;
}

async function selectVisionModel(): Promise<string> {
  const { provider } = await getProviderAdapter();
  const visionModels = provider.models.filter((m) => {
    const caps = m.capabilities as Record<string, boolean>;
    return caps.vision === true && caps.text === true;
  });
  const chatVisionModels = visionModels.filter((m) => !m.modelId.includes("embedding"));

  const knownWorkingModels = [
    "doubao-1-5-vision-pro-32k-250115",
    "doubao-1.5-vision-pro-250328",
    "doubao-1-5-thinking-vision-pro-250428",
    "doubao-seed-1-6-vision-250815",
  ];

  const defaultAnalysisModel = chatVisionModels.find((m) => m.isDefaultAnalysis);
  const isDefaultWorking = defaultAnalysisModel && knownWorkingModels.includes(defaultAnalysisModel.modelId);

  const preferred =
    (isDefaultWorking ? defaultAnalysisModel?.modelId : null) ||
    knownWorkingModels.find((known) => chatVisionModels.some((m) => m.modelId === known)) ||
    chatVisionModels.find((m) => /gemini|gpt-4o|qwen-vl/i.test(m.modelId))?.modelId ||
    chatVisionModels[0]?.modelId;

  if (!preferred) throw new Error("没有可用的视觉模型，请配置支持图像识别的 AI 模型");
  return preferred;
}

// ==================== 学习流程控制 ====================

export async function startLearning(sessionId: string) {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: { images: true },
  });

  if (!session) throw new Error("Learning session not found");
  if (session.images.length === 0) throw new Error("请先添加学习图片");

  const pendingImages = session.images.filter((img) => img.status === LearningStatus.PENDING);
  if (pendingImages.length === 0) {
    // 所有图片已分析过，直接重新提取知识即可
    return { success: true, message: "没有新增图片，已有知识已可用" };
  }

  await prisma.learningSession.update({
    where: { id: sessionId },
    data: { status: LearningStatus.LEARNING },
  });

  // 异步执行增量学习流程
  executeIncrementalLearningFlow(sessionId, pendingImages).catch(console.error);
  return { success: true, message: "学习已开始" };
}

// 停止学习 - 将进行中的图片重置为待分析，会话回到待学习状态
export async function stopLearning(sessionId: string) {
  const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Learning session not found");
  if (session.status !== LearningStatus.LEARNING) throw new Error("会话不在学习中");

  // 将 LEARNING 状态的图片重置为 PENDING
  await prisma.learningImage.updateMany({
    where: { sessionId, status: LearningStatus.LEARNING },
    data: { status: LearningStatus.PENDING },
  });

  // 会话回退到待学习
  await prisma.learningSession.update({
    where: { id: sessionId },
    data: { status: LearningStatus.PENDING, updatedAt: new Date() },
  });

  return { success: true, message: "学习已停止" };
}

// 重试失败的图片 - 将 FAILED 的图片重置为 PENDING 并重新开始分析
export async function retryFailedImages(sessionId: string) {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: { images: true },
  });
  if (!session) throw new Error("Learning session not found");

  const failedImages = session.images.filter((img) => img.status === LearningStatus.FAILED);
  if (failedImages.length === 0) {
    return { success: true, message: "没有失败图片需要重试" };
  }

  // 将 FAILED 图片重置为 PENDING
  await prisma.learningImage.updateMany({
    where: { sessionId, status: LearningStatus.FAILED },
    data: { status: LearningStatus.PENDING },
  });

  // 重新开始学习
  return startLearning(sessionId);
}

/**
 * 增量学习流程：
 * 1. 只分析 PENDING 的新图片
 * 2. 按分类（HERO / DETAIL）分别提取新知识
 * 3. 新知识与已有的旧知识融合累加
 */
async function executeIncrementalLearningFlow(sessionId: string, pendingImages: Array<{
  id: string; filePath: string; fileName: string;
  category: string | null; userTags?: string | null; userNotes?: string | null;
}>) {
  try {
    // 阶段 1: 只分析新增图片（PENDING 状态）
    await analyzeImages(pendingImages);

    // 阶段 2: 按分类提取新知识，并与已有知识融合
    await extractAndMergeKnowledges(sessionId);

    // 阶段 3: 进入待审查
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: { status: LearningStatus.REVIEW_PENDING, updatedAt: new Date() },
    });

    console.log(`[ImageLearning] Session ${sessionId} ready for review (incremental)`);
  } catch (error) {
    console.error(`[ImageLearning] Session ${sessionId} failed:`, error);
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: { status: LearningStatus.FAILED, updatedAt: new Date() },
    });
  }
}

async function analyzeImages(images: Array<{ id: string; filePath: string; fileName: string; category: string | null; userTags?: string | null; userNotes?: string | null }>) {
  for (const image of images) {
    try {
      await prisma.learningImage.update({
        where: { id: image.id },
        data: { status: LearningStatus.LEARNING },
      });

      const analysisResult = await analyzeSingleImage(image);

      await prisma.learningImage.update({
        where: { id: image.id },
        data: {
          status: LearningStatus.COMPLETED,
          analyzedAt: new Date(),
          analysisResult: analysisResult as Prisma.InputJsonValue,
        },
      });

      console.log(`[ImageLearning] Analyzed image ${image.id} (${image.category})`);
    } catch (error) {
      console.error(`[ImageLearning] Failed to analyze image ${image.id}:`, error);
      await prisma.learningImage.update({
        where: { id: image.id },
        data: { status: LearningStatus.FAILED },
      });
    }
  }
}

async function extractAndMergeKnowledges(sessionId: string) {
  // 获取所有已完成的图片，按分类分组
  const completedImages = await prisma.learningImage.findMany({
    where: {
      sessionId,
      status: LearningStatus.COMPLETED,
      analysisResult: { not: Prisma.DbNull },
    },
  });

  if (completedImages.length === 0) return;

  const heroImages = completedImages.filter((img) => img.category === "HERO");
  const detailImages = completedImages.filter((img) => img.category === "DETAIL");

  // 分别提取头图知识和详情图知识
  if (heroImages.length > 0) {
    await extractCategoryKnowledges(sessionId, "HERO", heroImages);
  }
  if (detailImages.length > 0) {
    await extractCategoryKnowledges(sessionId, "DETAIL", detailImages);
  }

  // 更新知识总数
  const totalKnowledges = await prisma.styleKnowledge.count({ where: { sessionId } });
  await prisma.learningSession.update({
    where: { id: sessionId },
    data: { knowledgeCount: totalKnowledges },
  });
}

async function extractCategoryKnowledges(
  sessionId: string,
  category: "HERO" | "DETAIL",
  images: Array<{ id: string; fileName: string; analysisResult: Prisma.JsonValue }>
) {
  const imageResults = images.map((img) => ({
    fileName: img.fileName,
    analysisResult: img.analysisResult as ImageAnalysisResult,
  }));

  try {
    const { adapter } = await getProviderAdapter();
    const extractionPrompt = buildKnowledgeExtractionPrompt(category, imageResults);

    console.log(`[ImageLearning] Extracting ${category} knowledges from ${imageResults.length} images...`);

    const result = await adapter.generateStructured({
      model: await selectTextModel(),
      systemPrompt: knowledgeExtractionSystemPrompt,
      userPrompt: extractionPrompt,
      schema: knowledgeExtractionResultSchema,
      timeoutMs: 180000,
      monitor: { operation: "knowledge_extraction" },
    });

    const knowledges = result.parsed?.knowledges || [];
    if (knowledges.length === 0) {
      console.warn(`[ImageLearning] No ${category} knowledges extracted`);
      return;
    }

    // 新知识合并到已有的知识库中（不删除旧知识，累加）
    for (const knowledge of knowledges) {
      await createOrUpdateKnowledge(sessionId, category, knowledge, images);
    }

    console.log(`[ImageLearning] Extracted ${knowledges.length} ${category} knowledges for session ${sessionId}`);
  } catch (error) {
    console.error(`[ImageLearning] Failed to extract ${category} knowledges:`, error);
    throw error;
  }
}

async function createOrUpdateKnowledge(
  sessionId: string,
  category: "HERO" | "DETAIL",
  knowledge: KnowledgeExtractionResult["knowledges"][0],
  images: Array<{ id: string; analysisResult: Prisma.JsonValue }>
) {
  // 检查是否已有相似知识（同分类 + 同类型 + 名称相似）
  const existingSimilar = await prisma.styleKnowledge.findFirst({
    where: {
      sessionId,
      category,
      type: knowledge.type as KnowledgeType,
      isActive: true,
    },
    orderBy: { confidence: "desc" },
  });

  if (existingSimilar) {
    // 融合：提升置信度、合并样本数、更新描述
    const updatedConfidence = Math.min((existingSimilar.confidence + (knowledge.confidence ?? 0.8)) / 1.5, 1.0);
    const updatedSampleCount = existingSimilar.sampleCount + (knowledge.sampleCount ?? images.length);

    await prisma.styleKnowledge.update({
      where: { id: existingSimilar.id },
      data: {
        confidence: updatedConfidence,
        sampleCount: updatedSampleCount,
        description: knowledge.description || existingSimilar.description,
        promptSnippet: knowledge.promptSnippet || existingSimilar.promptSnippet,
        negativePrompt: knowledge.negativePrompt || existingSimilar.negativePrompt,
        attributes: knowledge.attributes as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // 为新图片创建来源关联
    for (const image of images) {
      const existingSource = await prisma.knowledgeSource.findUnique({
        where: { knowledgeId_imageId: { knowledgeId: existingSimilar.id, imageId: image.id } },
      });
      if (!existingSource) {
        await prisma.knowledgeSource.create({
          data: {
            knowledgeId: existingSimilar.id,
            imageId: image.id,
            weight: calculateKnowledgeWeight(knowledge, image.analysisResult as ImageAnalysisResult),
          },
        });
      }
    }

    return existingSimilar;
  }

  // 没有相似的，创建新知识
  const created = await prisma.styleKnowledge.create({
    data: {
      sessionId,
      category,
      type: knowledge.type as KnowledgeType,
      name: knowledge.name,
      description: knowledge.description,
      attributes: knowledge.attributes as Prisma.InputJsonValue,
      promptSnippet: knowledge.promptSnippet,
      negativePrompt: knowledge.negativePrompt,
      confidence: knowledge.confidence ?? 0.8,
      sampleCount: knowledge.sampleCount ?? images.length,
      isActive: true,
    },
  });

  for (const image of images) {
    await prisma.knowledgeSource.create({
      data: {
        knowledgeId: created.id,
        imageId: image.id,
        weight: calculateKnowledgeWeight(knowledge, image.analysisResult as ImageAnalysisResult),
      },
    });
  }

  return created;
}

function calculateKnowledgeWeight(
  knowledge: KnowledgeExtractionResult["knowledges"][0],
  _analysisResult: ImageAnalysisResult
): number {
  return knowledge.confidence ?? 0.8;
}

async function selectTextModel(): Promise<string> {
  const { provider } = await getProviderAdapter();
  const knownWorkingModels = [
    "doubao-1-5-pro-32k-250115",
    "doubao-1.5-pro-250328",
    "doubao-1-5-lite-32k-250115",
  ];

  const textModels = provider.models.filter((m) => {
    const caps = m.capabilities as Record<string, boolean>;
    return caps.text === true && !m.modelId.includes("vision") && !m.modelId.includes("embedding");
  });

  const defaultPlanning = textModels.find((m) => m.isDefaultPlanning);
  const isDefaultWorking = defaultPlanning && knownWorkingModels.includes(defaultPlanning.modelId);

  const preferred =
    (isDefaultWorking ? defaultPlanning?.modelId : null) ||
    knownWorkingModels.find((known) => textModels.some((m) => m.modelId === known)) ||
    textModels.find((m) => {
      const caps = m.capabilities as Record<string, boolean>;
      return caps.structured_output === true;
    })?.modelId ||
    textModels.find((m) => /gemini|gpt-4o|qwen/i.test(m.modelId))?.modelId ||
    textModels[0]?.modelId;

  if (!preferred) throw new Error("没有可用的文本模型");
  return preferred;
}

// ==================== 用户审查 ====================

export async function approveSessionKnowledges(
  sessionId: string,
  approvedKnowledgeIds?: string[]
) {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: { knowledges: true },
  });

  if (!session) throw new Error("学习会话不存在");
  if (session.status !== LearningStatus.REVIEW_PENDING) throw new Error("会话不在待审查状态");

  if (approvedKnowledgeIds && approvedKnowledgeIds.length > 0) {
    const knowledgeIdsToDisable = session.knowledges
      .filter((k) => !approvedKnowledgeIds.includes(k.id))
      .map((k) => k.id);
    if (knowledgeIdsToDisable.length > 0) {
      await prisma.styleKnowledge.updateMany({
        where: { id: { in: knowledgeIdsToDisable } },
        data: { isActive: false },
      });
    }
  }

  await prisma.learningSession.update({
    where: { id: sessionId },
    data: { status: LearningStatus.APPROVED, updatedAt: new Date() },
  });

  // 异步浓缩已批准的知识描述
  condenseApprovedKnowledges(sessionId).catch(console.error);

  return { success: true, approvedCount: approvedKnowledgeIds?.length || session.knowledges.length };
}

const condenseSchema = z.object({
  description: z.string().describe("压缩冗余后的知识描述，去除重复内容，保留所有不同特征"),
  promptSnippet: z.string().optional().describe("压缩后的提示词"),
});

const compareSchema = z.object({
  isDuplicate: z.boolean().describe("两条知识是否描述同一类特征（仅是表述不同）：true=同一类/ false=不同特征"),
  reason: z.string().describe("判断理由"),
  mergedDescription: z.string().describe("如果重复，这是合并后的描述（去重同类特征，保留所有不同特征）；如果不重复，这是保留原描述"),
  mergedPrompt: z.string().optional().describe("合并后的提示词"),
});

interface ComparisonResult {
  isDuplicate: boolean;
  reason: string;
  mergedDescription: string;
  mergedPrompt?: string;
}

/** 压缩单条知识的冗余描述：去重同类描述，保留所有不同特征 */
async function condenseSingleKnowledge(adapter: { generateStructured: Function }, knowledge: { id: string; type: string; name: string; description: string; promptSnippet: string | null }) {
  try {
    const result = await adapter.generateStructured({
      model: await selectTextModel(),
      systemPrompt: "你是电商视觉知识编辑助手。压缩知识描述的冗余内容：合并同类特征描述，保留每条不同的特征。不丢失任何独特信息。",
      userPrompt: JSON.stringify({
        type: knowledge.type,
        name: knowledge.name,
        description: knowledge.description,
        promptSnippet: knowledge.promptSnippet || "",
      }),
      schema: condenseSchema,
      timeoutMs: 30000,
      monitor: { operation: "knowledge_condense" },
    });

    const condensed = result.parsed as z.infer<typeof condenseSchema>;

    await prisma.styleKnowledge.update({
      where: { id: knowledge.id },
      data: {
        description: condensed.description,
        ...(condensed.promptSnippet ? { promptSnippet: condensed.promptSnippet } : {}),
      },
    });
  } catch (error) {
    console.error(`[ImageLearning] Failed to condense knowledge ${knowledge.id}:`, error);
  }
}

/** LLM 对比两条同类知识，判断是否重复并合并 */
async function compareAndMergeKnowledges(
  adapter: { generateStructured: Function },
  existing: { name: string; description: string; promptSnippet: string | null; sampleCount: number },
  incoming: { name: string; description: string; promptSnippet: string | null }
): Promise<ComparisonResult> {
  try {
    const result = await adapter.generateStructured({
      model: await selectTextModel(),
      systemPrompt: "你是电商视觉知识对比合并助手。判断两条相同类型的知识是否描述同一类特征（仅是表述不同），还是不同的特征。如果是同一类特征，合并它们——去除重复描述，保留所有不同特征。",
      userPrompt: JSON.stringify({
        existingKnowledge: {
          name: existing.name,
          description: existing.description,
          promptSnippet: existing.promptSnippet,
        },
        incomingKnowledge: {
          name: incoming.name,
          description: incoming.description,
          promptSnippet: incoming.promptSnippet,
        },
      }),
      schema: compareSchema,
      timeoutMs: 30000,
      monitor: { operation: "knowledge_compare" },
    });

    return result.parsed as ComparisonResult;
  } catch (error) {
    console.error("[ImageLearning] Failed to compare knowledges:", error);
    // 失败时默认不是重复，保留两条
    return {
      isDuplicate: false,
      reason: "comparison failed, keeping both",
      mergedDescription: incoming.description,
    };
  }
}

/** 浓缩已批准的知识：去重合并同类特征，保留所有新特征 */
async function condenseApprovedKnowledges(sessionId: string) {
  try {
    const approvedKnowledges = await prisma.styleKnowledge.findMany({
      where: { sessionId, isActive: true },
    });
    if (approvedKnowledges.length === 0) return;

    const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    const category = session?.metadata ? (session.metadata as Record<string, unknown>).category as string : null;

    const { adapter } = await getProviderAdapter();

    for (const knowledge of approvedKnowledges) {
      // 查找该分类+类型中已有的同类知识（排除自己）
      const existingSimilar = await prisma.styleKnowledge.findFirst({
        where: {
          id: { not: knowledge.id },
          type: knowledge.type,
          category: knowledge.category,
          isActive: true,
          sessionId: { not: sessionId },
        },
        orderBy: { sampleCount: "desc" },
      });

      if (existingSimilar) {
        // 有已有同类知识 → LLM 判断是否重复
        const comparisonResult = await compareAndMergeKnowledges(
          adapter,
          existingSimilar,
          knowledge
        );

        if (comparisonResult.isDuplicate) {
          // 是重复 → 合并：累积样本数，合并特征到已有知识
          await prisma.styleKnowledge.update({
            where: { id: existingSimilar.id },
            data: {
              description: comparisonResult.mergedDescription,
              promptSnippet: comparisonResult.mergedPrompt || existingSimilar.promptSnippet,
              sampleCount: { increment: 1 },
              confidence: Math.min(1, existingSimilar.confidence + 0.05),
            },
          });

          // 删除当前这条重复的知识
          await prisma.styleKnowledge.update({
            where: { id: knowledge.id },
            data: { isActive: false },
          });
        } else {
          // 不是重复 → 保留为新特征，只压缩自身冗余描述
          await condenseSingleKnowledge(adapter, knowledge);
        }
      } else {
        // 没有同类知识 → 新特征，只压缩自身冗余描述
        await condenseSingleKnowledge(adapter, knowledge);
      }
    }

    console.log(`[ImageLearning] Condensed knowledge for session ${sessionId}`);
  } catch (error) {
    console.error("[ImageLearning] Failed to condense knowledges:", error);
  }
}

export async function rejectSessionKnowledges(sessionId: string, reason?: string) {
  const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("学习会话不存在");
  if (session.status !== LearningStatus.REVIEW_PENDING) throw new Error("会话不在待审查状态");

  await prisma.styleKnowledge.updateMany({
    where: { sessionId },
    data: { isActive: false },
  });

  await prisma.learningSession.update({
    where: { id: sessionId },
    data: {
      status: LearningStatus.REJECTED,
      updatedAt: new Date(),
      metadata: { ...(session.metadata as object || {}), rejectReason: reason },
    },
  });

  return { success: true };
}

// ==================== 知识查询 ====================

export async function getActiveKnowledges(category?: "HERO" | "DETAIL", sessionId?: string) {
  const where: Prisma.StyleKnowledgeWhereInput = { isActive: true };
  if (category) where.category = category;
  if (sessionId) where.sessionId = sessionId;

  return prisma.styleKnowledge.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { applyCount: "desc" }],
    include: {
      session: { select: { name: true } },
      sources: {
        include: {
          image: { select: { filePath: true, fileName: true } },
        },
      },
    },
  });
}

export async function getKnowledgeByType(type: KnowledgeType, category?: "HERO" | "DETAIL", sessionId?: string) {
  const where: Prisma.StyleKnowledgeWhereInput = { type, isActive: true };
  if (category) where.category = category;
  if (sessionId) where.sessionId = sessionId;

  return prisma.styleKnowledge.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
  });
}

// ==================== 学习进度 ====================

export async function getLearningProgress(sessionId: string) {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: { images: true, knowledges: true },
  });

  if (!session) throw new Error("Learning session not found");

  const analyzedImages = session.images.filter((img) => img.status === LearningStatus.COMPLETED).length;
  const pendingImages = session.images.filter((img) => img.status === LearningStatus.PENDING).length;
  const heroImages = session.images.filter((img) => img.category === "HERO").length;
  const detailImages = session.images.filter((img) => img.category === "DETAIL").length;
  const heroKnowledges = session.knowledges.filter((k) => k.category === "HERO").length;
  const detailKnowledges = session.knowledges.filter((k) => k.category === "DETAIL").length;

  let currentStage = "等待开始";
  if (session.status === LearningStatus.LEARNING) {
    currentStage = pendingImages > 0 ? "正在分析图片" : "正在提取知识";
  } else if (session.status === LearningStatus.REVIEW_PENDING) {
    currentStage = "待审查";
  } else if (session.status === LearningStatus.APPROVED) {
    currentStage = "已批准";
  } else if (session.status === LearningStatus.REJECTED) {
    currentStage = "已拒绝";
  } else if (session.status === LearningStatus.FAILED) {
    currentStage = "学习失败";
  }

  return {
    sessionId,
    totalImages: session.images.length,
    analyzedImages,
    pendingImages,
    heroImageCount: heroImages,
    detailImageCount: detailImages,
    heroKnowledges,
    detailKnowledges,
    status: session.status,
    currentStage,
  };
}

// ==================== 知识应用记录 ====================

export async function recordKnowledgeApply(input: {
  knowledgeId: string;
  agentType: string;
  projectId?: string;
  sectionId?: string;
  applyMethod: "prompt_injection" | "reference_image" | "parameter_adjust";
  applyDetails: Record<string, unknown>;
}) {
  await prisma.agentKnowledgeApply.create({
    data: {
      knowledgeId: input.knowledgeId,
      agentType: input.agentType,
      projectId: input.projectId,
      sectionId: input.sectionId,
      applyMethod: input.applyMethod,
      applyDetails: input.applyDetails as Prisma.InputJsonValue,
    },
  });

  await prisma.styleKnowledge.update({
    where: { id: input.knowledgeId },
    data: { applyCount: { increment: 1 }, lastAppliedAt: new Date() },
  });
}

export async function toggleKnowledgeActive(knowledgeId: string, isActive: boolean) {
  return prisma.styleKnowledge.update({ where: { id: knowledgeId }, data: { isActive } });
}

// ==================== 兼容导出 ====================

export async function buildEnhancedPrompt(
  context: { sectionType: string; sectionTitle: string; productCategory?: string },
  sessionId?: string
): Promise<{ enhancement: string; knowledges: Array<{ id: string; type: string; name: string; promptSnippet: string | null }> }> {
  const knowledges = await getActiveKnowledges(undefined, sessionId);
  if (knowledges.length === 0) return { enhancement: "", knowledges: [] };

  const snippets = knowledges.map((k) => k.promptSnippet).filter(Boolean).join("；");
  return {
    enhancement: snippets,
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
      promptSnippet: k.promptSnippet,
    })),
  };
}

export async function recordKnowledgeFeedback(
  applyId: string,
  feedback: { rating: number; comment?: string }
) {
  return prisma.agentKnowledgeApply.update({
    where: { id: applyId },
    data: { userRating: feedback.rating, userFeedback: feedback.comment },
  });
}
