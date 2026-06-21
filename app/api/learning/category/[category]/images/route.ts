/**
 * 分类学习库图片管理 API
 * /api/learning/category/[category]/images
 */

import { NextResponse } from "next/server";

import {
  ensureCategorySession,
  addLearningImage,
  removeLearningImage,
} from "@/lib/services/image-learning-service";

interface RouteParams {
  params: Promise<{
    category: string;
  }>;
}

// POST /api/learning/category/[category]/images - 添加图片
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { category } = await params;
    const normalized = category.toUpperCase();

    if (normalized !== "HERO" && normalized !== "DETAIL") {
      return NextResponse.json(
        { error: "Invalid category. Use 'hero' or 'detail'." },
        { status: 400 }
      );
    }

    // 确保会话存在
    const session = await ensureCategorySession(normalized as "HERO" | "DETAIL");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Missing required field: file" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const image = await addLearningImage({
      sessionId: session.id,
      file: buffer,
      fileName: file.name,
      mimeType: file.type,
      category: normalized as "HERO" | "DETAIL",
      sourceType: "upload",
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to upload image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/learning/category/[category]/images?imageId=xxx - 删除图片
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { category } = await params;
    const normalized = category.toUpperCase();

    if (normalized !== "HERO" && normalized !== "DETAIL") {
      return NextResponse.json(
        { error: "Invalid category." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Missing required parameter: imageId" },
        { status: 400 }
      );
    }

    await removeLearningImage(imageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
