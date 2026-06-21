import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { saveUploadAsset } from "@/lib/storage/asset-manager";
import { handleRouteError, ok } from "@/lib/utils/route";

const uploadAssetSchema = z.object({
  type: z.enum(["MAIN", "ANGLE", "DETAIL", "REFERENCE", "PACKAGING", "PRODUCT", "INGREDIENT", "INFO_CARD"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
  metadata: z.any().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = uploadAssetSchema.parse(await request.json());
    const existingCount = await prisma.productAsset.count({
      where: { projectId: id },
    });

    const asset = await saveUploadAsset({
      projectId: id,
      type: input.type,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileBuffer: Buffer.from(input.base64Data, "base64"),
      sortOrder: existingCount,
      isMain: input.type === "MAIN",
      extraMetadata: input.metadata,
    });

    return ok(asset, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
