import { NextRequest } from "next/server";
import {
  getTags,
  createTag,
} from "@/lib/services/image-library-service";
import { imageTagSchema } from "@/types/image-library";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    const tags = await getTags();
    return ok(tags);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = imageTagSchema.parse(await request.json());
    const tag = await createTag(input);
    return ok(tag, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
