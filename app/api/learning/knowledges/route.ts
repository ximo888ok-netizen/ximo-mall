/**
 * 知识库管理 API
 * /api/learning/knowledges
 */

import { NextResponse } from "next/server";
import { KnowledgeType } from "@prisma/client";

import {
  getActiveKnowledges,
  toggleKnowledgeActive,
  recordKnowledgeFeedback,
} from "@/lib/services/image-learning-service";
import { getKnowledgeStats } from "@/lib/services/knowledge-sharing-service";

// GET /api/learning/knowledges - 获取知识列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const type = searchParams.get("type") as KnowledgeType | null;
    const stats = searchParams.get("stats");

    if (stats) {
      const knowledgeStats = await getKnowledgeStats(sessionId || undefined);
      return NextResponse.json(knowledgeStats);
    }

    let knowledges;
    if (type) {
      // 按类型筛选
      const { getKnowledgeByType } = await import("@/lib/services/image-learning-service");
      knowledges = await getKnowledgeByType(type as any, undefined, sessionId || undefined);
    } else {
      knowledges = await getActiveKnowledges(undefined, sessionId || undefined);
    }

    return NextResponse.json(knowledges);
  } catch (error) {
    console.error("[API] Failed to get knowledges:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/learning/knowledges - 更新知识状态
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { knowledgeId, isActive } = body;

    if (!knowledgeId || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: knowledgeId, isActive" },
        { status: 400 }
      );
    }

    const knowledge = await toggleKnowledgeActive(knowledgeId, isActive);
    return NextResponse.json(knowledge);
  } catch (error) {
    console.error("[API] Failed to update knowledge:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/learning/knowledges/feedback - 提交知识反馈
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applyId, rating, comment } = body;

    if (!applyId || typeof rating !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: applyId, rating" },
        { status: 400 }
      );
    }

    const feedback = await recordKnowledgeFeedback(applyId, { rating, comment });
    return NextResponse.json(feedback);
  } catch (error) {
    console.error("[API] Failed to record feedback:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
