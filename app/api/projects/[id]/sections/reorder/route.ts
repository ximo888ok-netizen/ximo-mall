import { NextRequest } from "next/server";

import { reorderSections } from "@/lib/services/planner-service";
import { sectionReorderSchema } from "@/lib/validations/section";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = sectionReorderSchema.parse(await request.json());
    const sections = await reorderSections(id, input.orderedSectionIds);
    return ok(sections);
  } catch (error) {
    return handleRouteError(error);
  }
}
