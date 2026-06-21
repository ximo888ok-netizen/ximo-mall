import { deleteAssetRecord } from "@/lib/storage/asset-manager";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const asset = await deleteAssetRecord(id);
    return ok(asset);
  } catch (error) {
    return handleRouteError(error);
  }
}
