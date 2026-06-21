import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "./provider-service";
import { readStorageFile } from "../storage/asset-manager";
import { updateKnowledgeBaseStats } from "./knowledge-base-service";
import {
  kbHeroAnalysisSystemPrompt,
  kbDetailAnalysisSystemPrompt,
  buildKBHeroAnalysisPrompt,
  buildKBDetailAnalysisPrompt,
  kbKnowledgeExtractionPrompt,
  buildKBKnowledgeExtractionPrompt,
  kbImageAnalysisResultSchema,
} from "../ai/prompts/kb-analysis";
import { knowledgeExtractionResultSchema } from "../ai/schemas/image-learning";

// ==================== 类型定义 ====================

export interface AddImageInput {
  kbId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: "HERO" | "DETAIL";
}

// ==================== 图片管理 ====================

// 添加图片到知识库
export async function addImageToKB(input: AddImageInput) {
  const image = await prisma.noodleKBImage.create({
    data: {
      kbId: input.kbId,
      filePath: input.filePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      category: input.category,
    },
  });

  // 更新统计
  await updateKnowledgeBaseStats(input.kbId);

  return image;
}

// 获取知识库图片列表
export async function listKBImages(kbId: string, category?: string) {
  return prisma.noodleKBImage.findMany({
    where: {
      kbId,
      ...(category ? { category: category as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

// 删除知识库图片
export async function removeKBImage(imageId: string) {
  const image = await prisma.noodleKBImage.findUnique({
    where: { id: imageId },
  });

  if (!image) throw new Error("Image not found");

  await prisma.noodleKBImage.delete({ where: { id: imageId } });
  await updateKnowledgeBaseStats(image.kbId);

  return image;
}

// ==================== 图片分析 ====================

// 分析单张图片
async function analyzeImage(image: {
  id: string;
  filePath: string;
  fileName: string;
  category: string;
}): Promise<any> {
  const { adapter } = await getProviderAdapter();

  // 读取图片
  const imageBuffer = await readStorageFile(image.filePath);
  const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  // 根据分类选择不同的提示词
  const isHero = image.category === "HERO";
  const systemPrompt = isHero ? kbHeroAnalysisSystemPrompt : kbDetailAnalysisSystemPrompt;
  const userPrompt = isHero
    ? buildKBHeroAnalysisPrompt({ fileName: image.fileName })
    : buildKBDetailAnalysisPrompt({ fileName: image.fileName });

  // 选择视觉模型
  const visionModel = await selectVisionModel();

  const result = await adapter.generateStructured({
    model: visionModel,
    systemPrompt,
    userPrompt,
    schema: kbImageAnalysisResultSchema,
    images: [imageDataUrl],
    timeoutMs: 120000,
    monitor: { operation: "kb_image_analysis" },
  });

  return result.parsed;
}

// 选择视觉模型
async function selectVisionModel(): Promise<string> {
  const { provider } = await getProviderAdapter();
  const allModels = provider.models.filter((m) => !m.modelId.includes("embedding"));

  // 无条件优先使用用户在 AI 配置中设定的商品分析模型
  const defaultAnalysisModel = allModels.find((m) => m.isDefaultAnalysis);
  if (defaultAnalysisModel) {
    return defaultAnalysisModel.modelId;
  }

  // 兜底：从具备视觉能力的模型中选取
  const visionModels = allModels.filter((m) => {
    const caps = m.capabilities as Record<string, boolean>;
    return caps.vision === true && caps.text === true;
  });

  const knownWorkingModels = [
    "doubao-1-5-vision-pro-32k-250115",
    "doubao-1.5-vision-pro-250328",
    "doubao-1-5-thinking-vision-pro-250428",
    "doubao-seed-1-6-vision-250815",
  ];

  const preferred =
    knownWorkingModels.find((known) => visionModels.some((m) => m.modelId === known)) ||
    visionModels.find((m) => /gemini|gpt-4o|qwen-vl/i.test(m.modelId))?.modelId ||
    visionModels[0]?.modelId;

  if (!preferred) throw new Error("没有可用的视觉模型，请配置支持图像识别的 AI 模型");
  return preferred;
}

// ==================== 训练流程 ====================

// 训练单张图片（分析 + 提取知识）
export async function trainSingleImage(imageId: string) {
  const image = await prisma.noodleKBImage.findUnique({
    where: { id: imageId },
  });

  if (!image) throw new Error("Image not found");

  // 更新状态为分析中
  await prisma.noodleKBImage.update({
    where: { id: imageId },
    data: { status: "PENDING" },
  });

  try {
    // 1. 分析图片
    const analysisResult = await analyzeImage(image);

    // 2. 保存分析结果
    await prisma.noodleKBImage.update({
      where: { id: imageId },
      data: {
        analysisResult,
        status: "ANALYZED",
        analyzedAt: new Date(),
      },
    });

    // 3. 提取知识
    const knowledges = await extractKnowledge(image.kbId, imageId, analysisResult);

    // 4. 更新统计
    await updateKnowledgeBaseStats(image.kbId);

    return {
      success: true,
      imageId,
      analysisResult,
      knowledgesCount: knowledges.length,
    };
  } catch (error) {
    // 更新状态为失败
    await prisma.noodleKBImage.update({
      where: { id: imageId },
      data: { status: "FAILED" },
    });

    throw error;
  }
}

// 提取知识
async function extractKnowledge(kbId: string, imageId: string, analysisResult: any) {
  const { adapter } = await getProviderAdapter();

  const systemPrompt = kbKnowledgeExtractionPrompt;
  const userPrompt = buildKBKnowledgeExtractionPrompt(analysisResult);

  const result = await adapter.generateStructured({
    model: await selectTextModel(),
    systemPrompt,
    userPrompt,
    schema: knowledgeExtractionResultSchema,
    timeoutMs: 60000,
    monitor: { operation: "kb_knowledge_extraction" },
  });

  const extractedKnowledges = result.parsed.knowledges || [];

  // 知识类型映射（将新的6种类型映射到数据库存储）
  const typeMapping: Record<string, string> = {
    LAYOUT: "LAYOUT",
    TYPOGRAPHY: "TYPOGRAPHY",
    COLOR: "STYLE",
    APPETITE: "APPETITE",
    MARKETING: "CONTENT",
    DECORATION: "STYLE",
  };

  // 保存知识到数据库
  const savedKnowledges = [];
  for (const k of extractedKnowledges) {
    const saved = await prisma.noodleKBKnowledge.create({
      data: {
        kbId,
        type: typeMapping[k.type] || k.type,
        name: k.name,
        description: k.description,
        attributes: k.attributes,
        confidence: k.confidence,
        sourceImageIds: [imageId],
      },
    });
    savedKnowledges.push(saved);
  }

  return savedKnowledges;
}

// 选择文本模型
async function selectTextModel(): Promise<string> {
  const { provider } = await getProviderAdapter();
  const textModels = provider.models.filter((m) => {
    const caps = m.capabilities as Record<string, boolean>;
    return caps.text === true && !m.modelId.includes("embedding");
  });

  const preferred = textModels.find((m) => m.isDefaultAnalysis)?.modelId || textModels[0]?.modelId;
  if (!preferred) throw new Error("没有可用的文本模型");
  return preferred;
}

// 批量训练知识库中的所有待处理图片
export async function trainAllPendingImages(kbId: string) {
  const pendingImages = await prisma.noodleKBImage.findMany({
    where: { kbId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const image of pendingImages) {
    try {
      const result = await trainSingleImage(image.id);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        imageId: image.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    total: pendingImages.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
