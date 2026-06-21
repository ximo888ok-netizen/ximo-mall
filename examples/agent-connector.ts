/**
 * Ximo Mall Agent 连接器
 *
 * 用于外部应用调用 Ximo Mall AI Agent 的客户端封装。
 * 支持对话式交互、图片上传、工具调用追踪、思考过程展示。
 *
 * 使用方式：
 *   const agent = new XimoMallAgent("http://localhost:3000");
 *   const response = await agent.chat("帮我生成红烧牛肉面详情页");
 *   console.log(response.text);
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  toolCallId: string;
  result: unknown;
}

export interface AgentResponse {
  /** Agent 回复的完整文本 */
  text: string;
  /** Agent 的思考过程 */
  reasoning: string;
  /** 工具调用记录 */
  toolCalls: ToolCall[];
  /** 工具返回结果 */
  toolResults: ToolResult[];
  /** 结束原因 */
  finishReason: string | null;
  /** Token 用量 */
  usage: Record<string, number> | null;
}

export interface ChatOptions {
  /** 会话线程 ID，用于记忆隔离（多轮对话时传入同一值） */
  threadId?: string;
  /** 资源 ID */
  resourceId?: string;
  /** 图片 data URL 数组（仅关联到最后一条用户消息） */
  images?: string[];
  /** 实时回调：收到文本片段 */
  onTextDelta?: (delta: string) => void;
  /** 实时回调：收到思考片段 */
  onReasoningDelta?: (delta: string) => void;
  /** 实时回调：工具被调用 */
  onToolCall?: (call: ToolCall) => void;
  /** 实时回调：工具返回结果 */
  onToolResult?: (result: ToolResult) => void;
}

// ---------------------------------------------------------------------------
// 连接器
// ---------------------------------------------------------------------------

export class XimoMallAgent {
  private readonly baseUrl: string;

  /**
   * @param baseUrl Ximo Mall 服务地址，默认 http://localhost:3000
   */
  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * 检查连接状态
   *
   * @returns 服务状态信息，status === "ok" 表示连接正常
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/api/agent/chat`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`Agent 服务不可用 (${response.status})`);
    }
    return response.json();
  }

  /**
   * 获取 Agent 可调用工具列表
   *
   * @returns Agent 信息和工具列表
   */
  async tools(): Promise<{
    agent: { id: string; name: string };
    tools: Array<{ id: string; description: string }>;
  }> {
    const response = await fetch(`${this.baseUrl}/api/agent/info`, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`获取工具列表失败 (${response.status})`);
    }
    const payload = await response.json();
    return payload.data ?? payload;
  }

  /**
   * 发送对话消息
   *
   * @param message 用户消息文本
   * @param history 历史对话记录（可选，多轮对话时传入）
   * @param options 选项（线程ID、图片、实时回调等）
   * @returns Agent 完整响应
   */
  async chat(
    message: string,
    history: AgentMessage[] = [],
    options: ChatOptions = {},
  ): Promise<AgentResponse> {
    const messages = [...history, { role: "user" as const, content: message }];

    const body: Record<string, unknown> = { messages };
    if (options.threadId) body.threadId = options.threadId;
    if (options.resourceId) body.resourceId = options.resourceId;
    if (options.images && options.images.length > 0) body.images = options.images;

    const response = await fetch(`${this.baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Agent API 错误 (${response.status}): ${text}`);
    }

    return this.parseSSEStream(response, options);
  }

  /**
   * 上传本地图片文件并转为 data URL
   */
  static fileToDataUrl(
    buffer: Buffer,
    mimeType: string = "image/png",
  ): string {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  /**
   * 从文件路径读取图片并转为 data URL（Node.js 环境）
   */
  static async imageFileToDataUrl(
    filePath: string,
  ): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const mimeType = mimeMap[ext] ?? "image/png";
    return XimoMallAgent.fileToDataUrl(buffer, mimeType);
  }

  // -------------------------------------------------------------------------
  // SSE 解析
  // -------------------------------------------------------------------------

  private async parseSSEStream(
    response: Response,
    options: ChatOptions,
  ): Promise<AgentResponse> {
    const result: AgentResponse = {
      text: "",
      reasoning: "",
      toolCalls: [],
      toolResults: [],
      finishReason: null,
      usage: null,
    };

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按双换行分割 SSE 事件
      const parts = buffer.split("\n\n");
      buffer = parts.pop()!; // 最后一段可能不完整，保留

      for (const part of parts) {
        const event = this.parseSSEEvent(part);
        if (!event) continue;

        switch (event.type) {
          case "text": {
            const delta = event.data.delta as string;
            result.text += delta;
            options.onTextDelta?.(delta);
            break;
          }
          case "reasoning": {
            const delta = event.data.delta as string;
            result.reasoning += delta;
            options.onReasoningDelta?.(delta);
            break;
          }
          case "tool_call": {
            const call: ToolCall = {
              toolName: event.data.toolName as string,
              toolCallId: event.data.toolCallId as string,
              args: event.data.args as Record<string, unknown>,
            };
            result.toolCalls.push(call);
            options.onToolCall?.(call);
            break;
          }
          case "tool_result": {
            const tr: ToolResult = {
              toolName: event.data.toolName as string,
              toolCallId: event.data.toolCallId as string,
              result: event.data.result,
            };
            result.toolResults.push(tr);
            options.onToolResult?.(tr);
            break;
          }
          case "done": {
            result.finishReason = (event.data.finishReason as string) ?? "stop";
            result.usage = (event.data.usage as Record<string, number>) ?? null;
            break;
          }
          case "error": {
            throw new Error((event.data.message as string) ?? "Agent 执行失败");
          }
        }
      }
    }

    return result;
  }

  private parseSSEEvent(
    raw: string,
  ): { type: string; data: Record<string, unknown> } | null {
    let type = "message";
    let dataStr = "";

    for (const line of raw.split("\n")) {
      if (line.startsWith("event: ")) {
        type = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6);
      }
    }

    if (!dataStr) return null;

    try {
      return { type, data: JSON.parse(dataStr) };
    } catch {
      return null;
    }
  }
}
