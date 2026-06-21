import { NextRequest } from "next/server";

import { removeProductImage } from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; imageId: string }> },
) {
  try {
    const { imageId } = await params;
    await removeProductImage(imageId);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
