import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const approvePlanningReviewTool = createTool({
  id: "approve-planning-review",
  description:
    "用户明确确认规划简介后，标记规划已通过用户审查，解锁后续图片生成。只有用户明确表示继续生成、确认无误、按此生成时才调用；如果用户要求修改，不要调用此工具，先用 updateSectionTool 修改。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    reviewSummary: z.string().describe("本次给用户审查的规划摘要和用户确认结果"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { prisma } = await import("@/lib/db/prisma");

    const project = await prisma.project.findUnique({
      where: { id: inputData.projectId },
      select: { modelSnapshot: true },
    });

    if (!project) {
      return { success: false, error: "项目不存在" };
    }

    const snapshot = (project.modelSnapshot as Record<string, unknown> | null) ?? {};

    await prisma.project.update({
      where: { id: inputData.projectId },
      data: {
        modelSnapshot: {
          ...snapshot,
          agentPlanningReview: {
            status: "APPROVED",
            approvedAt: new Date().toISOString(),
            reviewSummary: inputData.reviewSummary,
          },
        },
      },
    });

    return { success: true, message: "规划已通过用户审查，可以开始生成图片" };
  },
});
