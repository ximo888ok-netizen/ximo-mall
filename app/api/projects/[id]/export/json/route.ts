import { buildProjectJson } from "@/lib/services/export-service";
import { handleRouteError } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await buildProjectJson(id);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}.json"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
