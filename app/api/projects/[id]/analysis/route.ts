import { NextRequest } from "next/server";

import { updateAnalysis } from "@/lib/services/analysis-service";
import { analysisPatchSchema } from "@/lib/validations/analysis";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = analysisPatchSchema.parse(await request.json());
    const analysis = await updateAnalysis(id, input.normalizedResult);
    return ok(analysis);
  } catch (error) {
    return handleRouteError(error);
  }
}
