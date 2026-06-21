import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const semanticTypeEnum = z.enum([
  "MAIN_PRODUCT", "REFERENCE", "DETAIL", "SCENARIO",
  "MATERIAL", "PACKAGING", "COMPARISON", "OTHER",
]);

export const editImageTool = createTool({
  id: "edit-image",
  description:
    "整体重绘或增强已生成的图片。当用户说「不好看」「重做」「不够清晰」「不够精致」时用这个。editMode: repaint（整体重绘，构图打散重来）或 enhance（增强清晰度/鲜艳度/质感）。不处理具体修改指令（比如「把背景改成红色」这种请用 refineImageTool）。需要有已生成的底图。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    sectionId: z.string().describe("模块 ID"),
    editMode: z
      .enum(["repaint", "enhance"])
      .default("repaint")
      .describe("编辑模式：repaint=重绘，enhance=增强"),
    referenceSemanticTypes: z
      .array(semanticTypeEnum)
      .optional()
      .describe("按语义类型筛选参考图（如 MAIN_PRODUCT、PACKAGING、MATERIAL 等），所有匹配类型的资产将作为视觉参考传入编辑。必须传入以确保编辑后的图片中商品外观与用户上传的图片一致"),
    heroImageSize: z
      .string()
      .optional()
      .describe("主图尺寸（如 \"1440x1440\"、\"800x800\"、\"750x1000\"）。不传或传 \"auto\" 时使用智能默认：头图1:1，详情图9:16。仅对 HERO 模块有效"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    imageAssetId: z.string().optional(),
    imageUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData, toolCtx) => {
    const { editSectionImage } = await import(
      "@/lib/services/generation-service"
    );
    const { prisma } = await import("@/lib/db/prisma");

    // 优先使用工具输入参数，兼容 requestContext（旧版前端仍会通过上下文传）
    let heroImageSize = inputData.heroImageSize;
    if (heroImageSize === "auto") heroImageSize = undefined;
    if (!heroImageSize) {
      const requestCtx = toolCtx?.requestContext as
        | Record<string, unknown>
        | { get: (key: string) => unknown }
        | undefined;
      heroImageSize =
        typeof (requestCtx as Record<string, unknown>)?.heroImageSize === "string"
          ? ((requestCtx as Record<string, unknown>).heroImageSize as string)
          : typeof requestCtx?.get === "function"
            ? (requestCtx as { get: (key: string) => unknown }).get("heroImageSize") as string | undefined
            : undefined;
    }

    try {
      // Resolve reference asset IDs by semantic type
      let referenceAssetIds: string[] | undefined;

      if (inputData.referenceSemanticTypes?.length) {
        const assets = await prisma.productAsset.findMany({
          where: { projectId: inputData.projectId },
          select: { id: true, metadata: true },
        });
        const matchedIds = new Set<string>();
        const types = new Set(inputData.referenceSemanticTypes);
        for (const a of assets) {
          const meta = a.metadata as Record<string, unknown> | null;
          const st = typeof meta?.semanticType === "string" ? meta.semanticType : "";
          if (types.has(st as never)) {
            matchedIds.add(a.id);
          }
        }
        if (matchedIds.size > 0) {
          referenceAssetIds = Array.from(matchedIds);
        }
      }

      // 参考图≥5张时自动切换 wan2.7-image-pro（wan2.7-image 不支持5张及以上参考图）
      const preferredModelId = (referenceAssetIds?.length ?? 0) >= 5 ? "wan2.7-image-pro" : undefined;

      const result = await editSectionImage(
        inputData.projectId,
        inputData.sectionId,
        { editMode: inputData.editMode, preferredModelId, agentMode: true, heroImageSize, referenceAssetIds },
      );
      const imageUrl = `/api/files/${result.imageAsset.filePath.replace(/\\/g, "/")}`;
      return { success: true, imageAssetId: result.imageAsset.id, imageUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "图像编辑失败",
      };
    }
  },
});
