import { NextRequest } from "next/server";
import {
  getLibraryItem,
  updateLibraryItem,
  removeLibraryItem,
} from "@/lib/services/image-library-service";
import { imageLibraryItemSchema } from "@/types/image-library";
import { handleRouteError, ok, fail } from "@/lib/utils/route";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await getLibraryItem(id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = imageLibraryItemSchema.parse(await request.json());
    const result = await updateLibraryItem(id, input);
    return ok(result);
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
    const result = await removeLibraryItem(id);
    if (!result) {
      return fail("NOT_FOUND", "素材未找到", null, 404);
    }
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
