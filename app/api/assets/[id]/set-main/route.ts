import { prisma } from "@/lib/db/prisma";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const asset = await prisma.productAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new Error("Asset not found.");
    }

    await prisma.productAsset.updateMany({
      where: {
        projectId: asset.projectId,
        type: "MAIN",
      },
      data: { isMain: false, type: "ANGLE" },
    });

    const updated = await prisma.productAsset.update({
      where: { id },
      data: {
        isMain: true,
        type: "MAIN",
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
