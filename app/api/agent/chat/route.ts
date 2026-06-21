/**
 * Agent Chat API — 面向本地/内网外部应用的独立接口
 *
 * 与 /api/ai-agent/chat 的区别：
 * - 使用标准 SSE (text/event-stream) 格式，任何 HTTP 客户端均可解析
 * - 支持纯文本消息 + 可选图片（data URL）
 * - 事件类型：text / tool_call / tool_result / reasoning / done / error
 *
 * 请求格式：
 * POST /api/agent/chat
 * {
 *   "messages": [
 *     { "role": "user", "content": "帮我生成红烧牛肉面详情页" },
 *     { "role": "assistant", "content": "好的，我来帮你..." },
 *     { "role": "user", "content": "换一种风格" }
 *   ],
 *   "threadId": "可选，会话线程ID，用于记忆隔离",
 *   "resourceId": "可选，资源ID",
 *   "images": ["可选，data URL 数组，仅关联到最后一条用户消息"]
 * }
 */

import { handleChatStream } from "@mastra/ai-sdk";
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/di";
import { mastra } from "@/mastra";

// ---------------------------------------------------------------------------
// SSE 辅助函数
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 将 tool_result 中的 imageUrl 从相对路径转为完整 URL
 * 工具返回的 imageUrl 格式为 /api/files/generated/xxx.png
 * 外部调用方需要完整 URL 才能访问图片
 */
function resolveImageUrl(
  result: unknown,
  requestUrl: string,
): unknown {
  if (typeof result !== "object" || result === null) return result;

  const obj = result as Record<string, unknown>;
  if (typeof obj.imageUrl === "string" && obj.imageUrl.startsWith("/api/files/")) {
    const base = new URL(requestUrl).origin;
    return { ...obj, imageUrl: `${base}${obj.imageUrl}` };
  }
  return obj;
}

// ---------------------------------------------------------------------------
// GET — 轻量健康检查
// ---------------------------------------------------------------------------

export async function GET() {
  return Response.json({
    status: "ok",
    endpoint: "/api/agent/chat",
    method: "POST",
    contentType: "text/event-stream",
    events: ["text", "reasoning", "tool_call", "tool_result", "done", "error"],
    timestamp: new Date().toISOString(),
  }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const raw = await req.json();
  const rawMessages = raw.messages;
  const messages = Array.isArray(rawMessages) ? rawMessages : [];
  const images: string[] = Array.isArray(raw.images) ? raw.images : [];

  const threadId = raw.threadId as string | undefined;
  const resourceId = raw.resourceId as string | undefined;

  // 将 messages 转换为 Mastra 格式
  // 纯文本消息直接使用，图片通过 experimental_attachments 附加到最后一条用户消息
  const processedMessages = messages.map(
    (msg: Record<string, unknown>, msgIndex: number) => {
      const role = msg.role as string;
      const content = msg.content as string;

      // 标准化为 AI SDK CoreMessage 格式
      const result: Record<string, unknown> = { role, content };

      // 如果是最后一条用户消息且有图片，附加 experimental_attachments
      if (
        msgIndex === messages.length - 1 &&
        role === "user" &&
        images.length > 0
      ) {
        result.experimental_attachments = images.map((url, i) => {
          const match = url.match(/^data:([^;]+);/);
          const contentType = match?.[1] ?? "image/png";
          return { url, contentType, name: `image_${i + 1}` };
        });
      }

      return result;
    },
  );

  // Build RequestContext
  const extras: Record<string, unknown> = {};
  if (threadId) extras.threadId = threadId;
  if (resourceId) extras.resourceId = resourceId;

  const requestContext = new RequestContext(
    Object.entries(extras) as [string, {} | undefined][],
  );
  if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  if (threadId) requestContext.set(MASTRA_THREAD_ID_KEY, threadId);

  // 创建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const mastraStream = await handleChatStream({
          mastra,
          agentId: "ximoMallAgent",
          sendReasoning: true,
          sendStart: true,
          sendFinish: true,
          params: {
            messages: processedMessages as any,
            requestContext,
          },
        });

        // 从 Mastra 流中提取事件，转换为标准 SSE
        const reader = mastraStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // value 是 UIMessageStreamPart
            const part = value as Record<string, unknown>;
            const type = part.type as string;

            switch (type) {
              case "text-delta": {
                const textDelta = part.textDelta as string;
                if (textDelta) {
                  controller.enqueue(
                    encoder.encode(sseEvent("text", { delta: textDelta })),
                  );
                }
                break;
              }

              case "tool-call": {
                const toolName = part.toolName as string;
                const toolCallId = part.toolCallId as string;
                const args = part.args as Record<string, unknown>;
                controller.enqueue(
                  encoder.encode(
                    sseEvent("tool_call", { toolName, toolCallId, args }),
                  ),
                );
                break;
              }

              case "tool-result": {
                const toolName = part.toolName as string;
                const toolCallId = part.toolCallId as string;
                const result = resolveImageUrl(part.result, req.url);
                controller.enqueue(
                  encoder.encode(
                    sseEvent("tool_result", { toolName, toolCallId, result }),
                  ),
                );
                break;
              }

              case "reasoning": {
                const reasoningDelta = part.reasoningDelta as string;
                if (reasoningDelta) {
                  controller.enqueue(
                    encoder.encode(
                      sseEvent("reasoning", { delta: reasoningDelta }),
                    ),
                  );
                }
                break;
              }

              case "finish": {
                const finishReason = part.finishReason as string;
                const usage = part.usage as Record<string, number> | undefined;
                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", { finishReason, usage }),
                  ),
                );
                break;
              }

              default: {
                // 其他事件类型（start 等）也转发
                controller.enqueue(
                  encoder.encode(sseEvent(type, part)),
                );
                break;
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Agent 执行失败";
        controller.enqueue(
          encoder.encode(sseEvent("error", { message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// OPTIONS 预检
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
