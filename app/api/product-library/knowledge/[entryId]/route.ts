import { NextRequest } from "next/server";

import {
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
} from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  try {
    const { entryId } = await params;
    const body = await request.json();
    const { category, title, content, metadata } = body;

    const entry = await updateKnowledgeEntry(entryId, {
      category,
      title,
      content,
      metadata,
    });

    return ok(entry);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  try {
    const { entryId } = await params;
    await deleteKnowledgeEntry(entryId);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
