import { NextRequest } from "next/server";
import { z } from "zod";

import { planSections } from "@/lib/services/planner-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export const maxDuration = 300;

const planRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
  autoDecideCounts: z.boolean().optional(),
  previewConfig: z
    .object({
      heroImageCount: z.number().int().min(3).max(5),
      detailSectionCount: z.number().int().min(4).max(10),
      imageAspectRatio: z.enum(["3:4", "9:16"]),
      contentLanguage: z.enum(["zh-CN", "en-US", "ja-JP", "ko-KR"]),
    })
    .optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = planRequestSchema.parse(await request.json().catch(() => ({})));
    const result = await planSections(id, {
      modelId: input.modelId,
      autoDecideCounts: input.autoDecideCounts,
      previewConfig: input.previewConfig,
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
