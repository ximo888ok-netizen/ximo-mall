import { NextRequest } from "next/server";

import { getProviderAdapter } from "@/lib/services/provider-service";
import { handleRouteError, ok, fail } from "@/lib/utils/route";
import { z } from "zod";

const upscaleSchema = z.object({
  image: z.string().describe("图片 URL 或 base64 data URL"),
  upscaleFactor: z.number().int().min(1).max(4).optional().describe("放大倍数，1-4，默认 2"),
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = upscaleSchema.parse(body);

    const adapterCtx = await getProviderAdapter("image");

    const result = await adapterCtx.adapter.upscaleImage({
      model: "wanx2.1-imageedit",
      image: input.image,
      upscaleFactor: input.upscaleFactor ?? 2,
      monitor: {
        projectId: input.projectId,
        operation: "image_upscale",
      },
    });

    return ok(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("VALIDATION_ERROR", "请求参数错误", error.flatten(), 400);
    }
    return handleRouteError(error);
  }
}
