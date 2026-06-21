import { NextRequest, NextResponse } from "next/server";
import {
  listKnowledgeBases,
  createKnowledgeBase,
} from "@/lib/services/knowledge-base-service";
import { handleRouteError, ok } from "@/lib/utils/route";

// GET /api/knowledge-base - 获取所有知识库列表
export async function GET() {
  try {
    const knowledgeBases = await listKnowledgeBases();
    return ok({ items: knowledgeBases });
  } catch (error) {
    return handleRouteError(error);
  }
}

// POST /api/knowledge-base - 创建新知识库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, description } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { error: "slug and name are required" },
        { status: 400 }
      );
    }

    const kb = await createKnowledgeBase({ slug, name, description });
    return ok(kb, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
