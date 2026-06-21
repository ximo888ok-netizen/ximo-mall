import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const semanticTypeEnum = z.enum([
  "MAIN_PRODUCT", "REFERENCE", "DETAIL", "SCENARIO",
  "MATERIAL", "PACKAGING", "COMPARISON", "OTHER",
]);

function isPlanningReviewApproved(snapshot: unknown) {
  const review = ((snapshot as Record<string, unknown> | null) ?? {}).agentPlanningReview as Record<string, unknown> | null;
  return review?.status === "APPROVED";
}

export const generateDetailImageTool = createTool({
  id: "generate-detail-image",
  description: "为详情页详情模块生成商品图片。需要先完成页面规划以获取详情模块 ID。必须传入 referenceSemanticTypes 或 referenceAssetLabels 确保生成的图片以用户上传的商品图作为视觉参考。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    sectionId: z.string().describe("详情模块 ID"),
    searchContext: z
      .string()
      .optional()
      .describe("联网搜索结果中与视觉设计相关的参考信息，将注入生成 prompt"),
    referenceAssetLabels: z
      .array(z.string())
      .optional()
      .describe("按 label 标记查找的参考图名称列表，将转为 referenceAssetIds 传入生成"),
    referenceSemanticTypes: z
      .array(semanticTypeEnum)
      .optional()
      .describe("按语义类型筛选参考图（如 REFERENCE、PACKAGING、MATERIAL 等），所有匹配类型的资产将作为视觉参考传入生成。必须传入以确保生成图片中的商品外观与用户上传的图片一致"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    imageAssetId: z.string().optional(),
    imageUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { generateSectionImage } = await import(
      "@/lib/services/generation-service"
    );
    const { prisma } = await import("@/lib/db/prisma");

    // Resolve reference asset IDs by label and/or semantic type
    let referenceAssetIds: string[] | undefined;

    const project = await prisma.project.findUnique({
      where: { id: inputData.projectId },
      select: { modelSnapshot: true },
    });

    if (!project || !isPlanningReviewApproved(project.modelSnapshot)) {
      return {
        success: false,
        error: "规划尚未通过用户审查。请先把审核修正后的每条规划简介展示给用户，并在用户明确确认继续生成后调用 approvePlanningReviewTool。",
      };
    }

    const assets = await prisma.productAsset.findMany({
      where: { projectId: inputData.projectId },
      select: { id: true, metadata: true },
    });

    const matchedIds = new Set<string>();

    // Match by label
    if (inputData.referenceAssetLabels?.length) {
      const labels = inputData.referenceAssetLabels.map((l: string) => l.trim().toLowerCase());
      for (const a of assets) {
        const meta = a.metadata as Record<string, unknown> | null;
        const label = typeof meta?.label === "string" ? meta.label.toLowerCase() : "";
        if (labels.some((l: string) => label.includes(l) || l.includes(label))) {
          matchedIds.add(a.id);
        }
      }
    }

    // Match by semantic type (stored in metadata.semanticType by createProjectTool)
    if (inputData.referenceSemanticTypes?.length) {
      const types = new Set(inputData.referenceSemanticTypes);
      for (const a of assets) {
        const meta = a.metadata as Record<string, unknown> | null;
        const st = typeof meta?.semanticType === "string" ? meta.semanticType : "";
        if (types.has(st as never)) {
          matchedIds.add(a.id);
        }
      }
    }

    if (matchedIds.size > 0) {
      referenceAssetIds = Array.from(matchedIds);
    }

    // 参考图≥5张时自动切换 wan2.7-image-pro（wan2.7-image 不支持5张及以上参考图）
    const preferredModelId = (referenceAssetIds?.length ?? 0) >= 5 ? "wan2.7-image-pro" : undefined;

    try {
      const result = await generateSectionImage(
        inputData.projectId,
        inputData.sectionId,
        preferredModelId,
        referenceAssetIds,
        undefined, // customMode
        inputData.searchContext,
        true, // agentMode
      );
      const imageUrl = `/api/files/${result.imageAsset.filePath.replace(/\\/g, "/")}`;
      return { success: true, imageAssetId: result.imageAsset.id, imageUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "详情图生成失败",
      };
    }
  },
});
