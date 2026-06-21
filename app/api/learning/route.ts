/**
 * 图片学习 Agent API 路由
 * /api/learning
 */

import { NextResponse } from "next/server";

import {
  createLearningSession,
  listLearningSessions,
  getLearningSession,
  updateLearningSession,
  deleteLearningSession,
  startLearning,
  getLearningProgress,
  addLearningImage,
  removeLearningImage,
  getActiveKnowledges,
  toggleKnowledgeActive,
} from "@/lib/services/image-learning-service";
import { getKnowledgeStats } from "@/lib/services/knowledge-sharing-service";

// GET /api/learning - 获取学习会话列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const stats = searchParams.get("stats");

    if (stats) {
      const knowledgeStats = await getKnowledgeStats();
      return NextResponse.json(knowledgeStats);
    }

    if (sessionId) {
      const session = await getLearningSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json(session);
    }

    const sessions = await listLearningSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[API] Failed to get learning sessions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/learning - 创建学习会话
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, autoApply } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const session = await createLearningSession({
      name,
      description,
      autoApply,
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create learning session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/learning - 更新学习会话
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, ...updates } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required field: sessionId" },
        { status: 400 }
      );
    }

    const session = await updateLearningSession(sessionId, updates);
    return NextResponse.json(session);
  } catch (error) {
    console.error("[API] Failed to update learning session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/learning - 删除学习会话
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required parameter: sessionId" },
        { status: 400 }
      );
    }

    await deleteLearningSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete learning session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
