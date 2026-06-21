import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { handleRouteError, ok } from "@/lib/utils/route";

const reorderSchema = z.object({
  sortOrder: z.number().int().min(0),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const input = reorderSchema.parse(await request.json());
    const { id } = await context.params;
    const asset = await prisma.productAsset.update({
      where: { id },
      data: { sortOrder: input.sortOrder },
    });
    return ok(asset);
  } catch (error) {
    return handleRouteError(error);
  }
}
