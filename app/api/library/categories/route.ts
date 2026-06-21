import { NextRequest } from "next/server";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/services/image-library-service";
import { imageCategorySchema } from "@/types/image-library";
import { handleRouteError, ok, fail } from "@/lib/utils/route";

export async function GET() {
  try {
    const categories = await getCategories();
    return ok(categories);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = imageCategorySchema.parse(await request.json());
    const category = await createCategory(input);
    return ok(category, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
