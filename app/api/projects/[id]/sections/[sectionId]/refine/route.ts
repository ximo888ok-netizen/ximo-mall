import { NextRequest } from "next/server";

import { refineSectionImage } from "@/lib/services/generation-service";
import { refineRequestSchema } from "@/lib/validations/generation";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const { id, sectionId } = await context.params;
    const input = refineRequestSchema.parse(await request.json().catch(() => ({})));
    const result = await refineSectionImage(id, sectionId, {
      preferredModelId: input.modelId,
      referenceAssetIds: input.referenceAssetIds,
      instruction: input.instruction,
      customMode: input.customMode,
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
