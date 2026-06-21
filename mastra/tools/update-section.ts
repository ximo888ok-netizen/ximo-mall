import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const updateSectionTool = createTool({
  id: "update-section",
  description:
    "修改单个页面模块的文案或视觉描写（title/goal/copy/visualPrompt）。用于规划完成后审核微调：纠正与用户信息不符的内容、修正产品描写真实性、调整视觉方向。只需传入需要修改的字段，未传入的字段保持不变。",
  inputSchema: z.object({
    sectionId: z.string().describe("要修改的模块 ID（来自 planSectionsTool 返回的 heroSectionIds 或 detailSectionIds）"),
    title: z.string().optional().describe("模块标题（4-10字中文标题，如'深夜食堂·一碗入魂'）"),
    goal: z.string().optional().describe("模块目标（一句话说明这个模块要传达什么信息）"),
    copy: z.string().optional().describe("模块文案（图片内要渲染的文字内容）"),
    visualPrompt: z.string().optional().describe("视觉提示词（描述图片的构图、色调、氛围、产品位置等视觉要素）"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    section: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { updateSection } = await import("@/lib/services/planner-service");

    const patch: Record<string, unknown> = {};
    if (inputData.title !== undefined) patch.title = inputData.title;
    if (inputData.goal !== undefined) patch.goal = inputData.goal;
    if (inputData.copy !== undefined) patch.copy = inputData.copy;
    if (inputData.visualPrompt !== undefined) patch.visualPrompt = inputData.visualPrompt;

    if (Object.keys(patch).length === 0) {
      return { success: false, error: "至少需要传入一个要修改的字段" };
    }

    try {
      const section = await updateSection(inputData.sectionId, patch);
      return { success: true, section };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "模块更新失败",
      };
    }
  },
});
