import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBaseBySlug } from "@/lib/services/knowledge-base-service";
import {
  generateKnowledgeBaseSummary,
  getKnowledgeBaseSummary,
} from "@/lib/services/kb-summary-service";
import { handleRouteError, ok } from "@/lib/utils/route";

// GET /api/knowledge-base/[slug]/summary - 获取知识库总结
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const summary = await getKnowledgeBaseSummary(kb.id, category);
    return ok({ summary });
  } catch (error) {
    return handleRouteError(error);
  }
}

// POST /api/knowledge-base/[slug]/summary - 生成知识库总结
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const summary = await generateKnowledgeBaseSummary(kb.id, category);
    return ok({ summary });
  } catch (error) {
    return handleRouteError(error);
  }
}
