import { NextRequest } from "next/server";
import {
  getLibraryItems,
  uploadLibraryImage,
  bulkUpdateLibraryItems,
  getLibraryStats,
} from "@/lib/services/image-library-service";
import { imageLibrarySearchSchema, imageLibraryBulkSchema } from "@/types/image-library";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const input = imageLibrarySearchSchema.parse({
      query: searchParams.get("query") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      tagIds: searchParams.getAll("tagIds"),
      mimeTypes: searchParams.getAll("mimeTypes"),
      isPublic: searchParams.has("isPublic") ? searchParams.get("isPublic") === "true" : undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "20",
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const result = await getLibraryItems(input);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return handleRouteError(new Error("请上传一个图片文件"));
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadLibraryImage({
        fileBuffer: buffer,
        fileName: file.name,
        mimeType: file.type || null,
        title: (formData.get("title") as string) || null,
        description: (formData.get("description") as string) || null,
        categoryId: (formData.get("categoryId") as string) || null,
        tagIds: formData.getAll("tagIds") as string[],
        isPublic: formData.has("isPublic") ? formData.get("isPublic") === "true" : undefined,
      });

      return ok(result, { status: 201 });
    }

    return handleRouteError(new Error("请使用 multipart/form-data 格式上传文件"));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = imageLibraryBulkSchema.parse(await request.json());
    const result = await bulkUpdateLibraryItems(input);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
