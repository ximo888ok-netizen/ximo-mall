// ==================== 产品知识库服务层 ====================

import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { readStorageFile } from "@/lib/storage/asset-manager";
import {
  productInfoAnalysisSystemPrompt,
  buildProductInfoAnalysisPrompt,
  type KnowledgeEntryOutput,
} from "@/lib/ai/prompts/product-library";
import type { KnowledgeCategory } from "@prisma/client";

// ==================== 类型 ====================

export interface CreateProductInput {
  name: string;
  description?: string;
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  imageCount: number;
  knowledgeCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddProductImageInput {
  productId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface AddManualKnowledgeEntryInput {
  productId: string;
  category: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ==================== 硬编码模型 ====================

/** 商品分析模型 — 逐张分析图片 */
const ANALYSIS_MODEL = "doubao-seed-2-0-lite-260428";


// ==================== 产品 CRUD ====================

/** 生成产品 slug */
function generateSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    || "product";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/** 获取产品库列表 */
export async function listProducts(): Promise<ProductListItem[]> {
  return prisma.productLibrary.findMany({
    orderBy: { createdAt: "desc" },
  }) as Promise<ProductListItem[]>;
}

/** 根据 slug 获取产品 */
export async function getProductBySlug(slug: string) {
  return prisma.productLibrary.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      knowledgeEntries: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** 根据 id 获取产品 */
export async function getProductById(id: string) {
  return prisma.productLibrary.findUnique({
    where: { id },
    include: {
      images: { orderBy: { createdAt: "asc" } },
      knowledgeEntries: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** 创建产品 */
export async function createProduct(input: CreateProductInput) {
  const slug = generateSlug(input.name);
  return prisma.productLibrary.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
    },
  });
}

/** 更新产品 */
export async function updateProduct(
  id: string,
  input: { name?: string; description?: string; coverImage?: string },
) {
  return prisma.productLibrary.update({
    where: { id },
    data: input,
  });
}

/** 删除产品 */
export async function deleteProduct(id: string) {
  return prisma.productLibrary.delete({ where: { id } });
}

/** 更新产品统计 */
async function updateProductStats(productId: string) {
  const [imageCount, knowledgeCount] = await Promise.all([
    prisma.productLibraryImage.count({ where: { productId } }),
    prisma.productKnowledgeEntry.count({ where: { productId } }),
  ]);
  return prisma.productLibrary.update({
    where: { id: productId },
    data: { imageCount, knowledgeCount },
  });
}

// ==================== 图片管理 ====================

/** 添加图片 */
export async function addProductImage(input: AddProductImageInput) {
  const image = await prisma.productLibraryImage.create({
    data: {
      productId: input.productId,
      filePath: input.filePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
    },
  });
  await updateProductStats(input.productId);
  return image;
}

/** 获取产品图片列表 */
export async function listProductImages(productId: string) {
  return prisma.productLibraryImage.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
  });
}

/** 删除图片 */
export async function removeProductImage(imageId: string) {
  const image = await prisma.productLibraryImage.findUnique({
    where: { id: imageId },
  });
  if (!image) throw new Error("图片不存在");
  await prisma.productLibraryImage.delete({ where: { id: imageId } });
  await updateProductStats(image.productId);
  return image;
}

// ==================== 单张图片分析 ====================

/** 分析单张产品图片（使用 doubao-seed-2-0-lite-260428） */
async function analyzeProductImage(image: {
  id: string;
  filePath: string;
  fileName: string;
}) {
  const { adapter } = await getProviderAdapter("analysis");

  // 读取图片
  const imageBuffer = await readStorageFile(image.filePath);
  const mimeType = image.fileName.endsWith(".png") ? "image/png" : "image/jpeg";
  const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

  const userPrompt = buildProductInfoAnalysisPrompt({
    fileName: image.fileName,
  });

  const textResult = await adapter.generateText({
    model: ANALYSIS_MODEL,
    systemPrompt: productInfoAnalysisSystemPrompt + "\n\nCRITICAL: You MUST return ONLY valid JSON. No markdown fences, no explanations.",
    userPrompt,
    images: [imageDataUrl],
    timeoutMs: 180000,
    monitor: { operation: "product_info_analysis" },
  });

  // 手动解析 JSON（与 analysis-service extractJsonBlock 相同逻辑）
  const raw = textResult.text.trim();
  let jsonStr: string;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    jsonStr = raw;
  } else {
    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenced?.[1]) {
      jsonStr = fenced[1].trim();
    } else {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      jsonStr = first >= 0 && last > first ? raw.slice(first, last + 1) : raw;
    }
  }

  const parsed = JSON.parse(jsonStr);
  // AI 直接输出 knowledgeEntries 数组
  if (Array.isArray(parsed?.knowledgeEntries)) {
    return parsed.knowledgeEntries as KnowledgeEntryOutput[];
  }
  if (Array.isArray(parsed)) {
    return parsed as KnowledgeEntryOutput[];
  }
  return [] as KnowledgeEntryOutput[];
}

// ==================== 知识条目存储 ====================

/** 直接存储 AI 返回的知识条目，不做加工 */
async function storeKnowledgeEntries(
  productId: string,
  imageId: string,
  entries: KnowledgeEntryOutput[],
) {
  const valid = entries.filter((e) => e.category && e.title && e.content);
  if (valid.length === 0) return { count: 0 };

  const created = await prisma.productKnowledgeEntry.createMany({
    data: valid.map((e) => ({
      productId,
      sourceImageId: imageId,
      category: e.category as KnowledgeCategory,
      title: e.title,
      content: e.content,
    })),
  });
  return { count: created.count };
}

// ==================== Embedding 生成（已禁用） ====================

/** 为单条知识条目生成 embedding — 已禁用 */
export async function generateEmbeddingForEntry(entryId: string) {
  return null;
}

/** 批量生成产品下所有缺少 embedding 的知识条目 — 已禁用 */
export async function generateEmbeddingsForProduct(productId: string) {
  return { total: 0, success: 0, failed: 0 };
}

// ==================== 训练（逐张分析 + 知识条目生成） ====================

/** 训练单张图片：分析 → 生成知识条目 */
export async function trainProductImage(imageId: string) {
  const image = await prisma.productLibraryImage.findUnique({
    where: { id: imageId },
  });
  if (!image) throw new Error("图片不存在");

  // 标记为分析中
  await prisma.productLibraryImage.update({
    where: { id: imageId },
    data: { analysisStatus: "ANALYZING" },
  });

  try {
    // 调用分析模型
    const analysisResult = await analyzeProductImage(image);

    // 保存分析结果
    await prisma.productLibraryImage.update({
      where: { id: imageId },
      data: {
        analysisStatus: "ANALYZED",
        analyzedAt: new Date(),
        rawAnalysisResult: analysisResult as any,
      },
    });

    // 直接存储 AI 返回的知识条目
    const knowledgeResult = await storeKnowledgeEntries(
      image.productId,
      imageId,
      analysisResult,
    );

    // 更新产品统计
    await updateProductStats(image.productId);

    return { success: true, imageId, analysisResult, knowledgeCount: knowledgeResult.count };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(
      `[trainProductImage] 失败 imageId=${imageId} productId=${image.productId}\n` +
      `错误信息: ${errorMessage}\n` +
      `错误堆栈: ${errorStack}`,
    );
    await prisma.productLibraryImage.update({
      where: { id: imageId },
      data: { analysisStatus: "FAILED" },
    });
    throw error;
  }
}

/** 批量训练产品的所有待分析图片 */
export async function trainAllProductImages(productId: string) {
  const pendingImages = await prisma.productLibraryImage.findMany({
    where: { productId, analysisStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (pendingImages.length === 0) {
    return { total: 0, success: 0, failed: 0, results: [] };
  }

  const results = [];
  for (const image of pendingImages) {
    try {
      const result = await trainProductImage(image.id);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        imageId: image.id,
        error: error instanceof Error ? error.message : "分析失败",
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

// ==================== 知识条目管理 ====================

/** 列出产品的知识条目 */
export async function listKnowledgeEntries(
  productId: string,
  category?: string,
) {
  return prisma.productKnowledgeEntry.findMany({
    where: {
      productId,
      ...(category ? { category: category as KnowledgeCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/** 删除知识条目 */
export async function deleteKnowledgeEntry(entryId: string) {
  const entry = await prisma.productKnowledgeEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry) throw new Error("知识条目不存在");

  await prisma.productKnowledgeEntry.delete({ where: { id: entryId } });
  await updateProductStats(entry.productId);
  return entry;
}

/** 手动添加知识条目 */
export async function addManualKnowledgeEntry(input: AddManualKnowledgeEntryInput) {
  const entry = await prisma.productKnowledgeEntry.create({
    data: {
      productId: input.productId,
      category: input.category as KnowledgeCategory,
      title: input.title,
      content: input.content,
      metadata: input.metadata as any,
    },
  });

  // 更新统计
  await updateProductStats(input.productId);

  return entry;
}

/** 更新知识条目 */
export async function updateKnowledgeEntry(
  entryId: string,
  input: { category?: string; title?: string; content?: string; metadata?: Record<string, unknown> },
) {
  const entry = await prisma.productKnowledgeEntry.update({
    where: { id: entryId },
    data: {
      ...(input.category ? { category: input.category as KnowledgeCategory } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.content ? { content: input.content } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata as any } : {}),
    },
  });

  return entry;
}

// ==================== RAG 检索 ====================

/** RAG 知识检索（向量检索已禁用，使用关键词搜索） */
export async function searchKnowledge(
  query: string,
  options: {
    productId?: string;
    category?: string;
    topK?: number;
    minScore?: number;
  } = {},
) {
  const { productId, category, topK = 10 } = options;
  return keywordSearch(query, { productId, category, topK });
}

/** 关键词搜索（embedding 不可用时的回退方案） */
async function keywordSearch(
  query: string,
  options: {
    productId?: string;
    category?: string;
    topK?: number;
  } = {},
) {
  const { productId, category, topK = 10 } = options;

  const entries = await prisma.productKnowledgeEntry.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(category ? { category: category as KnowledgeCategory } : {}),
      OR: [
        { title: { contains: query } },
        { content: { contains: query } },
      ],
    },
    take: topK,
    orderBy: { createdAt: "desc" },
  });

  return entries.map((e) => ({
    id: e.id,
    productId: e.productId,
    sourceImageId: e.sourceImageId,
    category: e.category,
    title: e.title,
    content: e.content,
    metadata: e.metadata,
    score: 0.5, // 关键词搜索固定分数
    createdAt: e.createdAt,
  }));
}
