import { NextRequest } from "next/server";
import { updateTag, deleteTag } from "@/lib/services/image-library-service";
import { imageTagSchema } from "@/types/image-library";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = imageTagSchema.partial().parse(await request.json());
    const tag = await updateTag(id, input);
    return ok(tag);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteTag(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
