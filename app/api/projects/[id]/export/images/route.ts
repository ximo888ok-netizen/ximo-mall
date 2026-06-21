import { buildImageArchive } from "@/lib/services/export-service";
import { handleRouteError } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const stream = await buildImageArchive(id);
    return new Response(stream as never, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${id}-detail-page-images.zip"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
