import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const semanticTypeEnum = z.enum([
  "MAIN_PRODUCT", "REFERENCE", "DETAIL", "SCENARIO",
  "MATERIAL", "PACKAGING", "COMPARISON", "OTHER",
]);

export const refineImageTool = createTool({
  id: "refine-image",
  description:
    "定向微调已生成的图片（P图/修图）。当用户说了具体怎么改时调用此工具，如「把背景换成红色」「产品放大」「色调暖一些」「去掉水印」「加蒸汽效果」。instruction 参数必须传用户的完整修改指令。\n\n前置条件：\n1. sectionId 必须来自 planSectionsTool 返回的模块 ID 列表\n2. 该模块必须先通过 generateHeroImageTool / generateDetailImageTool 生成了底图\n\n与 editImageTool 的区别：editImageTool 整体重绘或增强，不保留原构图；refineImageTool 保留大部分，只按 instruction 定向修改。\n\n常见错误处理：若提示「Section not found」→ 先调用 planSectionsTool 创建模块；若提示「还没有可编辑的底图」→ 先调用对应的 generate 工具生成图片。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    sectionId: z.string().describe("模块 ID（要微调哪个模块的图片）"),
    instruction: z
      .string()
      .describe("微调说明文字，描述用户希望怎样修改图片（如：「把背景改成渐变的暖橙色」「产品主体放大20%」「增加蒸汽效果」）"),
    referenceSemanticTypes: z
      .array(semanticTypeEnum)
      .optional()
      .describe("按语义类型筛选参考图（如 MAIN_PRODUCT、PACKAGING、MATERIAL 等），所有匹配类型的资产将作为视觉参考传入微调。必须传入以确保微调后的图片中商品外观与用户上传的图片一致"),
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
    const { refineSectionImage } = await import(
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

      const result = await refineSectionImage(
        inputData.projectId,
        inputData.sectionId,
        {
          instruction: inputData.instruction,
          preferredModelId,
          agentMode: true,
          heroImageSize,
          referenceAssetIds,
        },
      );
      const imageUrl = `/api/files/${result.imageAsset.filePath.replace(/\\/g, "/")}`;
      return { success: true, imageAssetId: result.imageAsset.id, imageUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "图片微调失败";
      // 把服务层的原始错误透传给 Agent，Agent 根据错误类型决定怎么处理
      if (msg.includes("Section not found")) {
        return {
          success: false,
          error: `未找到模块（sectionId: ${inputData.sectionId}）。请确认 sectionId 是否正确，或先调用 planSectionsTool 创建页面模块后再试。`,
        };
      }
      if (msg.includes("还没有可编辑的底图")) {
        return {
          success: false,
          error: `模块 ${inputData.sectionId} 还没有已生成的底图，请先调用 generateHeroImageTool / generateDetailImageTool 生成图片后再微调。`,
        };
      }
      return { success: false, error: msg };
    }
  },
});
