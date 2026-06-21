import { NextRequest } from "next/server";

import { deleteProject, getProjectDetail, updateProject } from "@/lib/services/project-service";
import { projectUpdateSchema } from "@/lib/validations/project";
import { fail, handleRouteError, ok } from "@/lib/utils/route";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const project = await getProjectDetail(id);
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", null, 404);
    }
    return ok(project);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = projectUpdateSchema.parse(await request.json());
    const project = await updateProject(id, input);
    return ok(project);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const project = await deleteProject(id);
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", null, 404);
    }
    return ok(project);
  } catch (error) {
    return handleRouteError(error);
  }
}
