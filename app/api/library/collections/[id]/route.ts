import { NextRequest } from "next/server";
import {
  getCollection,
  updateCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
  reorderCollectionItems,
} from "@/lib/services/image-library-service";
import { imageCollectionSchema } from "@/types/image-library";
import { handleRouteError, ok, fail } from "@/lib/utils/route";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const collection = await getCollection(id);
    return ok(collection);
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
    const { searchParams } = request.nextUrl;
    const action = searchParams.get("action");

    if (action === "addItem") {
      const body = await request.json();
      const collection = await addToCollection(id, body.itemId);
      return ok(collection);
    }

    if (action === "removeItem") {
      const body = await request.json();
      const collection = await removeFromCollection(id, body.itemId);
      return ok(collection);
    }

    if (action === "reorder") {
      const body = await request.json();
      const collection = await reorderCollectionItems(id, body.itemIds);
      return ok(collection);
    }

    const input = imageCollectionSchema.partial().parse(await request.json());
    const collection = await updateCollection(id, input);
    return ok(collection);
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
    await deleteCollection(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
