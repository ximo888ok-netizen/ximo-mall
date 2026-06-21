import { prisma } from "@/lib/db/prisma";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    const task = await prisma.generationTask.findUnique({
      where: { id: taskId },
    });
    return ok(task);
  } catch (error) {
    return handleRouteError(error);
  }
}
