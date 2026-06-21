/**
 * 分类学习库 API
 * /api/learning/category/[category]
 * category: hero | detail
 */

import { NextResponse } from "next/server";

import {
  ensureCategorySession,
  startLearning,
  stopLearning,
  retryFailedImages,
  approveSessionKnowledges,
  rejectSessionKnowledges,
  getLearningProgress,
} from "@/lib/services/image-learning-service";

interface RouteParams {
  params: Promise<{
    category: string;
  }>;
}

// GET /api/learning/category/[category] - 获取分类学习库详情
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { category } = await params;
    const normalized = category.toUpperCase();

    if (normalized !== "HERO" && normalized !== "DETAIL") {
      return NextResponse.json(
        { error: "Invalid category. Use 'hero' or 'detail'." },
        { status: 400 }
      );
    }

    const session = await ensureCategorySession(normalized as "HERO" | "DETAIL");

    // 同时返回进度
    const progress = await getLearningProgress(session.id);

    return NextResponse.json({ session, progress });
  } catch (error) {
    console.error("[API] Failed to get category session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/learning/category/[category] - 控制学习流程
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

    const session = await ensureCategorySession(normalized as "HERO" | "DETAIL");

    // 解析 action 参数
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "start";

    let result;
    switch (action) {
      case "stop":
        result = await stopLearning(session.id);
        break;
      case "retry":
        result = await retryFailedImages(session.id);
        break;
      default:
        result = await startLearning(session.id);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to control learning:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/learning/category/[category] - 审查知识
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { category } = await params;
    const normalized = category.toUpperCase();

    if (normalized !== "HERO" && normalized !== "DETAIL") {
      return NextResponse.json(
        { error: "Invalid category." },
        { status: 400 }
      );
    }

    const session = await ensureCategorySession(normalized as "HERO" | "DETAIL");

    const body = await request.json();
    const { action, approvedKnowledgeIds, rejectReason } = body;

    if (action === "approve") {
      const result = await approveSessionKnowledges(session.id, approvedKnowledgeIds);
      return NextResponse.json(result);
    }

    if (action === "reject") {
      const result = await rejectSessionKnowledges(session.id, rejectReason);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'approve' or 'reject'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Failed to review knowledges:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
