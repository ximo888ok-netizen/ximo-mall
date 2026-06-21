import { activateSectionVersion } from "@/lib/services/generation-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ sectionId: string; versionId: string }> },
) {
  try {
    const { sectionId, versionId } = await context.params;
    const version = await activateSectionVersion(sectionId, versionId);
    return ok(version);
  } catch (error) {
    return handleRouteError(error);
  }
}
