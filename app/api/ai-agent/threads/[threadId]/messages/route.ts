import { NextRequest } from "next/server";
import { ok, fail, handleRouteError } from "@/lib/utils/route";
import { mastra } from "@/mastra";

const AGENT_ID = "ximoMallAgent";

/** GET /api/ai-agent/threads/[threadId]/messages — 加载指定线程的历史消息 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await params;

    const agent = mastra.getAgent(AGENT_ID);
    const memory = await agent.getMemory();

    if (!memory) {
      return fail("INTERNAL_ERROR", "Agent Memory 未配置", undefined, 500);
    }

    const result = await memory.recall({
      threadId,
      perPage: 200,
      orderBy: { field: "createdAt", direction: "ASC" },
    });

    // Convert MastraDBMessage to a minimal UI-friendly shape.
    // Full UIMessage conversion is complex; we extract role + text content only.
    const messages = result.messages.map((m) => {
      let text = "";
      if (typeof m.content === "string") {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        text = m.content
          .map((part: unknown) => {
            const p = part as Record<string, unknown>;
            if (p.type === "text" && typeof p.text === "string") return p.text;
            if (p.type === "tool-call" && typeof p.toolName === "string")
              return `[调用工具: ${p.toolName}]`;
            if (p.type === "tool-result" && typeof p.toolName === "string")
              return `[工具结果: ${p.toolName}]`;
            if (p.type === "image" || (p.type === "file" && p.url))
              return "[图片]";
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }

      return {
        id: m.id,
        role: m.role,
        text,
        createdAt: m.createdAt,
      };
    });

    return ok({ threadId, messages });
  } catch (error) {
    return handleRouteError(error);
  }
}
