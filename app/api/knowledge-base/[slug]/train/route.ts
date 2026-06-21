import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBaseBySlug } from "@/lib/services/knowledge-base-service";
import {
  trainSingleImage,
  trainAllPendingImages,
} from "@/lib/services/kb-training-service";
import { handleRouteError, ok } from "@/lib/utils/route";

// POST /api/knowledge-base/[slug]/train - 训练知识库
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { imageId } = body;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    // 如果指定了图片ID，只训练该图片
    if (imageId) {
      const result = await trainSingleImage(imageId);
      return ok(result);
    }

    // 否则训练所有待处理图片
    const result = await trainAllPendingImages(kb.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
