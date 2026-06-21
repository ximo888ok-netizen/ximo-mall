import { NextRequest } from "next/server";

import { editSectionImage } from "@/lib/services/generation-service";
import { generationRequestSchema } from "@/lib/validations/generation";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const { id, sectionId } = await context.params;
    const input = generationRequestSchema.parse(await request.json().catch(() => ({})));
    const result = await editSectionImage(id, sectionId, {
      preferredModelId: input.modelId,
      referenceAssetIds: input.referenceAssetIds,
      editMode: input.editMode,
      customMode: input.customMode,
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
