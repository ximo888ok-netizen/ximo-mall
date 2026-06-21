import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const analyzeProductTool = createTool({
  id: "analyze-product",
  description:
    "分析商品图片，提取商品名称、类目、材质、卖点、目标人群、使用场景等结构化信息。projectId 来自 createProjectTool 的返回值。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    analysis: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { analyzeProject } = await import("@/lib/services/analysis-service");
    try {
      const result = await analyzeProject(inputData.projectId);
      return { success: true, analysis: result.normalizedResult };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "分析失败",
      };
    }
  },
});
