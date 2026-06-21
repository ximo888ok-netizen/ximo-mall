import { getLibraryStats } from "@/lib/services/image-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    const stats = await getLibraryStats();
    return ok(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
