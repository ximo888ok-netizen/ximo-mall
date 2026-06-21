import { NextRequest } from "next/server";
import {
  getCollections,
  createCollection,
} from "@/lib/services/image-library-service";
import { imageCollectionSchema } from "@/types/image-library";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    const collections = await getCollections();
    return ok(collections);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = imageCollectionSchema.parse(await request.json());
    const collection = await createCollection(input);
    return ok(collection, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
