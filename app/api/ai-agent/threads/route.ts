import { NextRequest } from "next/server";
import { ok, fail, handleRouteError } from "@/lib/utils/route";
import { mastra } from "@/mastra";

const AGENT_ID = "ximoMallAgent";
const DEFAULT_RESOURCE_ID = "ximo-mall-user";

// GET — 列出所有对话
export async function GET(req: NextRequest) {
  try {
    const resourceId =
      req.nextUrl.searchParams.get("resourceId") || DEFAULT_RESOURCE_ID;

    const agent = mastra.getAgent(AGENT_ID);
    const memory = await agent.getMemory();

    if (!memory) {
      return fail("INTERNAL_ERROR", "Agent Memory 未配置", undefined, 500);
    }

    const result = await memory.listThreads({
      filter: { resourceId },
      orderBy: { field: "updatedAt", direction: "DESC" },
    });

    return ok(result.threads);
  } catch (error) {
    return handleRouteError(error);
  }
}

// POST — 创建新对话
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, resourceId } = body as {
      title?: string;
      resourceId?: string;
    };

    const agent = mastra.getAgent(AGENT_ID);
    const memory = await agent.getMemory();

    if (!memory) {
      return fail("INTERNAL_ERROR", "Agent Memory 未配置", undefined, 500);
    }

    const thread = await memory.createThread({
      title: title || `新对话 ${new Date().toLocaleString("zh-CN")}`,
      resourceId: resourceId || DEFAULT_RESOURCE_ID,
      metadata: { createdAt: new Date().toISOString() },
    });

    return ok({
      id: thread.id,
      title: thread.title,
      metadata: thread.metadata,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

// DELETE — 删除对话
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { threadId } = body as { threadId: string };

    const agent = mastra.getAgent(AGENT_ID);
    const memory = await agent.getMemory();

    if (!memory) {
      return fail("INTERNAL_ERROR", "Agent Memory 未配置", undefined, 500);
    }

    await memory.deleteThread(threadId);

    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}