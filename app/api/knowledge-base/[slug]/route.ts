import { NextRequest, NextResponse } from "next/server";
import {
  getKnowledgeBaseBySlug,
  updateKnowledgeBase,
  deleteKnowledgeBase,
} from "@/lib/services/knowledge-base-service";
import { handleRouteError, ok } from "@/lib/utils/route";

// GET /api/knowledge-base/[slug] - 获取知识库详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const kb = await getKnowledgeBaseBySlug(slug);

    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    return ok(kb);
  } catch (error) {
    return handleRouteError(error);
  }
}

// PUT /api/knowledge-base/[slug] - 更新知识库
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const existing = await getKnowledgeBaseBySlug(slug);
    if (!existing) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const updated = await updateKnowledgeBase(existing.id, body);
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

// DELETE /api/knowledge-base/[slug] - 删除知识库
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const existing = await getKnowledgeBaseBySlug(slug);
    if (!existing) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    await deleteKnowledgeBase(existing.id);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
