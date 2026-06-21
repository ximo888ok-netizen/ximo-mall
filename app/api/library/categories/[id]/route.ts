import { NextRequest } from "next/server";
import { updateCategory, deleteCategory } from "@/lib/services/image-library-service";
import { imageCategorySchema } from "@/types/image-library";
import { handleRouteError, ok, fail } from "@/lib/utils/route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = imageCategorySchema.partial().parse(await request.json());
    const category = await updateCategory(id, input);
    return ok(category);
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
    await deleteCategory(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
