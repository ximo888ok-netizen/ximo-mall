import { NextRequest } from "next/server";
import { z } from "zod";

import { analyzeProject } from "@/lib/services/analysis-service";
import { handleRouteError, ok } from "@/lib/utils/route";

const analyzeRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
  hasAssociatedImages: z.boolean().optional().default(false),
  associatedImageCount: z.number().int().min(0).optional().default(0),
  productLibraryId: z.string().optional().nullable(),
  restrictToAssetTypes: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = analyzeRequestSchema.parse(await request.json().catch(() => ({})));
    const analysis = await analyzeProject(
      id,
      input.modelId,
      input.hasAssociatedImages,
      input.productLibraryId ?? undefined,
      input.restrictToAssetTypes,
    );
    return ok(analysis);
  } catch (error) {
    return handleRouteError(error);
  }
}
