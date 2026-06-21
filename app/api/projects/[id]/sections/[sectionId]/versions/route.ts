import { listSectionVersions } from "@/lib/services/generation-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId } = await context.params;
    const versions = await listSectionVersions(sectionId);
    return ok(versions);
  } catch (error) {
    return handleRouteError(error);
  }
}
