import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const planSectionsTool = createTool({
  id: "plan-sections",
  description:
    "基于商品分析结果，规划详情页各个模块（头图、卖点、场景、细节等）的文案和视觉方向。需要先完成商品分析。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    searchContext: z
      .string()
      .optional()
      .describe("联网搜索结果的提炼摘要（竞品视觉参考、行业趋势），将注入规划 prompt 影响构图/配色/文案策略"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    heroSectionIds: z.array(z.string()).optional(),
    detailSectionIds: z.array(z.string()).optional(),
    heroCount: z.number().optional(),
    detailCount: z.number().optional(),
    sections: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      goal: z.string(),
      copy: z.string(),
      visualPrompt: z.string(),
      order: z.number(),
    })).optional().describe("所有模块的完整数据（含 title/goal/copy/visualPrompt），用于审核微调"),
    error: z.string().optional(),
  }),
  execute: async (inputData, toolCtx) => {
    const { planSections } = await import("@/lib/services/planner-service");

    const requestCtx = toolCtx?.requestContext as Record<string, unknown> | undefined;

    // Try direct property access first (matching generate-hero-image pattern), then .get()
    const readFromCtx = (k: string): string | undefined => {
      if (!requestCtx) return undefined;
      const direct = (requestCtx as Record<string, unknown>)[k];
      if (typeof direct === "string") return direct;
      const viaGet =
        typeof (requestCtx as { get?: unknown }).get === "function"
          ? (requestCtx as { get: (key: string) => unknown }).get(k)
          : undefined;
      return typeof viaGet === "string" ? viaGet : undefined;
    };

    const rawHero = Number(readFromCtx("heroCount") || 3);
    const rawDetail = Number(readFromCtx("detailCount") || 6);

    const heroImageCount = Math.max(0, Math.min(9, rawHero));
    const detailSectionCount = Math.max(0, Math.min(12, rawDetail));

    try {
      const result = await planSections(inputData.projectId, {
        previewConfig: {
          heroImageCount,
          detailSectionCount,
          imageAspectRatio: "9:16",
          contentLanguage: "zh-CN",
        },
        searchContext: inputData.searchContext,
        agentMode: true,
      });
      const allSections = (result.sections as Array<{ id: string; type: string }>) ?? [];
      const heroSections = allSections.filter((s) => s.type === "HERO");
      const detailSections = allSections.filter((s) => s.type !== "HERO");
      return {
        success: true,
        heroSectionIds: heroSections.map((s) => s.id),
        detailSectionIds: detailSections.map((s) => s.id),
        heroCount: heroSections.length,
        detailCount: detailSections.length,
        sections: allSections,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "规划失败",
      };
    }
  },
});
