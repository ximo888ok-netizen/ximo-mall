import { handleChatStream } from "@mastra/ai-sdk";
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/di";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@/mastra";

export async function POST(req: Request) {
  const raw = await req.json();
  const rawMessages = raw.messages;
  const messages = Array.isArray(rawMessages) ? rawMessages : [];

  const threadId = raw.threadId as string | undefined;
  const resourceId = raw.resourceId as string | undefined;
  const { messages: _, threadId: _t, resourceId: _r, ...extras } = raw;

  // Convert file parts from messages:
  // - Image files → experimental_attachments ONLY for the LAST message (current input)
  // - Historical messages: strip file parts, replace with text markers, NO attachments
  // - Non-image files → text markers
  //
  // Critical: data URLs contain MBs of base64-encoded image data. If we attach them
  // to ALL messages, Mastra Memory stores them and reloads 30×MBs → OOM crash.
  // The model only needs to see images from the current input — historical images
  // have already been analyzed and summarized in the conversation text.
  const lastMessageIndex = messages.length - 1;
  const processedMessages = messages.map(
    (msg: Record<string, unknown>, msgIndex: number) => {
      if (!Array.isArray((msg as { parts?: unknown }).parts)) return msg;

      const parts = (msg as { parts: Record<string, unknown>[] }).parts;
      const hasFileParts = parts.some((p) => p.type === "file");
      if (!hasFileParts) return msg;

      const imageAttachments: Array<{ url: string; contentType?: string; name?: string }> = [];
      const textMarkers: Array<{ type: string; text: string }> = [];

      for (const p of parts) {
        if (p.type !== "file") continue;

        const mediaType = (p as { mediaType?: string }).mediaType ?? "";
        const url = (p as { url?: string }).url ?? "";
        const filename = (p as { filename?: string }).filename ?? "未命名文件";

        if (mediaType.startsWith("image/") && url) {
          imageAttachments.push({ url, contentType: mediaType, name: filename });
          textMarkers.push({ type: "text", text: `[用户上传了图片: ${filename}]` });
        } else {
          textMarkers.push({ type: "text", text: `[用户上传了文件: ${filename}]` });
        }
      }

      const remainingParts = parts.filter((p) => p.type !== "file");

      // Only attach images for the last message (current user input).
      // Historical messages' images are NOT added to experimental_attachments
      // to prevent Memory from storing MBs of base64 data.
      if (imageAttachments.length > 0 && msgIndex === lastMessageIndex) {
        return {
          ...msg,
          parts: [...remainingParts, ...textMarkers],
          experimental_attachments: imageAttachments,
        };
      }

      // Strip file parts, replace with text markers, no attachments
      return { ...msg, parts: [...remainingParts, ...textMarkers] };
    },
  );

  // Build RequestContext with Mastra reserved keys for memory thread isolation
  const requestContext = new RequestContext(
    Object.entries(extras) as [string, {} | undefined][],
  );
  if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  if (threadId) requestContext.set(MASTRA_THREAD_ID_KEY, threadId);

  const stream = await handleChatStream({
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

  return createUIMessageStreamResponse({
    stream: stream as unknown as Parameters<
      typeof createUIMessageStreamResponse
    >[0]["stream"],
  });
}
