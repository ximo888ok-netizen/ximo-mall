import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBaseBySlug } from "@/lib/services/knowledge-base-service";
import { removeKBImage } from "@/lib/services/kb-training-service";
import { handleRouteError, ok } from "@/lib/utils/route";

// DELETE /api/knowledge-base/[slug]/images/[imageId] - 删除知识库图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; imageId: string }> }
) {
  try {
    const { slug, imageId } = await params;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    await removeKBImage(imageId);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
