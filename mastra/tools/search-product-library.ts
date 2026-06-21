import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const searchProductLibraryTool = createTool({
  id: "search-product-library",
  description:
    "查询产品知识库中是否有匹配的产品资料。传入从商品图片视觉识别到的产品名称、品类、关键特征等关键词，工具会在产品库中搜索匹配的产品，并返回每个匹配产品的知识条目摘要（使用场景、核心卖点、规格参数等）。如果命中，后续调用 createProjectTool 时应传入 productLibraryId 以启用知识库约束。",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "搜索关键词，由你对商品图片的视觉分析结果提炼而成，可包含产品名、品类、关键特征，多个词用空格分隔",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    matches: z
      .array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          slug: z.string(),
          knowledgeCount: z.number(),
          knowledgeSummary: z.string().describe("知识条目摘要，按类别组织（使用场景/核心卖点/规格/材质/人群/品牌等）"),
        }),
      )
      .optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { prisma } = await import("@/lib/db/prisma");

    // 1. 搜索产品库 — 按产品名模糊匹配
    const products = await prisma.productLibrary.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: inputData.query } },
          { description: { contains: inputData.query } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    if (products.length === 0) {
      // 2. 如果产品名没命中，再尝试跨产品搜索知识条目
      const entries = await prisma.productKnowledgeEntry.findMany({
        where: {
          OR: [
            { title: { contains: inputData.query } },
            { content: { contains: inputData.query } },
          ],
        },
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      if (entries.length === 0) {
        return {
          success: true,
          matches: [],
          message: "产品库中未找到匹配的产品，将按自由模式生成。",
        };
      }

      // Deduplicate by productId
      const seen = new Map<string, typeof entries[0]>();
      for (const e of entries) {
        if (!seen.has(e.product.id)) seen.set(e.product.id, e);
      }

      const matches = await buildMatches(Array.from(seen.values()).map((e) => e.product.id));
      return { success: true, matches };
    }

    // 3. 产品名命中 — 构建匹配结果
    const matches = await buildMatches(products.map((p) => p.id));
    return { success: true, matches };
  },
});

/** 根据产品 ID 列表构建匹配结果（含知识条目摘要） */
async function buildMatches(productIds: string[]): Promise<
  Array<{
    productId: string;
    productName: string;
    slug: string;
    knowledgeCount: number;
    knowledgeSummary: string;
  }>
> {
  const { prisma } = await import("@/lib/db/prisma");

  const results: Array<{
    productId: string;
    productName: string;
    slug: string;
    knowledgeCount: number;
    knowledgeSummary: string;
  }> = [];

  for (const pid of productIds) {
    const product = await prisma.productLibrary.findUnique({
      where: { id: pid },
      select: { id: true, name: true, slug: true },
    });
    if (!product) continue;

    const entries = await prisma.productKnowledgeEntry.findMany({
      where: { productId: pid },
      select: { category: true, title: true, content: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 按 category 分组摘要
    const categoryMap: Record<string, string[]> = {};
    for (const e of entries) {
      const cat = CATEGORY_LABELS[e.category] ?? e.category;
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(e.title);
    }

    const summaryParts = Object.entries(categoryMap).map(
      ([cat, titles]) => `${cat}: ${titles.slice(0, 3).join("；")}`,
    );

    results.push({
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      knowledgeCount: entries.length,
      knowledgeSummary: summaryParts.join(" | ") || "（暂无知识条目）",
    });
  }

  return results;
}

const CATEGORY_LABELS: Record<string, string> = {
  USAGE_SCENARIO: "使用场景",
  SELLING_POINT: "核心卖点",
  SPECIFICATION: "产品规格",
  MATERIAL: "材质/原料",
  TARGET_AUDIENCE: "目标人群",
  BRAND_INFO: "品牌信息",
  OTHER: "其他",
};
