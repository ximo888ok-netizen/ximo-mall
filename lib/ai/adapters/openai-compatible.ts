import { z } from "zod";

import type {
  AiMonitorContext,
  ChatMessage,
  EmbeddingRequest,
  EmbeddingResult,
  ImageEditRequest,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageUpscaleRequest,
  ImageUpscaleResult,
  ProviderAdapter,
  StructuredRequest,
  TextRequest,
} from "@/lib/ai/provider-client";
import { inferCategory, logApiUsage } from "@/lib/monitor/api-usage";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function isGeminiImageModel(model: string) {
  return /gemini.*image|nano-banana|banana/i.test(model);
}

function isDashScopeProvider(baseUrl: string) {
  return /dashscope\.aliyuncs\.com/i.test(baseUrl);
}

function isVolcengineProvider(baseUrl: string) {
  return /volces\.com/i.test(baseUrl);
}

function normalizeVolcengineBaseUrl(baseUrl: string) {
  let normalized = baseUrl
    .replace(/\/images\/(generations|edits)\/?$/i, "")
    .replace(/\/chat\/completions\/?$/i, "")
    .replace(/\/+$/, "");
  return normalized;
}

function normalizeDashScopeBaseUrl(baseUrl: string) {
  let normalized = baseUrl.replace(/\/compatible-mode\/v1\/?$/, "").replace(/\/+$/, "");
  
  const match = normalized.match(/^(https?:\/\/[^/]+)/);
  if (match) {
    return match[1];
  }
  
  return normalized;
}

function getDashScopeApiBase(baseUrl: string) {
  return normalizeDashScopeBaseUrl(baseUrl);
}

function resolveDashScopeSize(input: { size?: string; aspectRatio?: string }) {
  if (input.size) {
    const dashSize = input.size.replace(/x/gi, "*");
    // DashScope 要求总像素在 [589824, 16777216] 之间，低于下限时向上取整
    const dimMatch = dashSize.match(/^(\d+)\*(\d+)$/);
    if (dimMatch) {
      const w = Number(dimMatch[1]);
      const h = Number(dimMatch[2]);
      const totalPixels = w * h;
      const MIN_PIXELS = 589824;
      if (totalPixels < MIN_PIXELS) {
        const scale = Math.sqrt(MIN_PIXELS / totalPixels);
        const newW = Math.ceil(w * scale / 8) * 8; // 8 的倍数对齐
        const newH = Math.ceil(h * scale / 8) * 8;
        return `${newW}*${newH}`;
      }
    }
    return dashSize;
  }
  const ar = input.aspectRatio ?? "9:16";
  switch (ar) {
    case "1:1":
      return "1024*1024";
    case "3:4":
    case "9:16":
      return "1024*1536";
    default:
      // 支持自定义宽高比字符串（如 "16:9", "2:3", "4:3" 等）
      if (/^\d+:\d+$/.test(ar)) {
        const [w, h] = ar.split(":").map(Number);
        if (w > 0 && h > 0) {
          const ratio = w / h;
          if (ratio >= 1) {
            return `1024*${Math.round(1024 / ratio)}`;
          } else {
            return `${Math.round(1024 * ratio)}*1024`;
          }
        }
      }
      return "1024*1024";
  }
}

function extractDashScopeImageResult(payload: any): ImageGenerationResult {
  const choices = payload?.output?.choices ?? [];
  const parts = choices[0]?.message?.content ?? [];

  for (const part of parts) {
    if (part?.image) {
      const imageStr = String(part.image);
      if (imageStr.startsWith("data:")) {
        return {
          url: null,
          b64Json: imageStr.replace(/^data:image\/\w+;base64,/, ""),
          revisedPrompt: typeof part?.text === "string" ? part.text : null,
        };
      }
      return {
        url: imageStr,
        b64Json: null,
        revisedPrompt: typeof part?.text === "string" ? part.text : null,
      };
    }
  }

  throw new Error("DashScope image generation returned no image data.");
}

function deriveGoogleBaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);

  if (/\/google(?:\/.*)?$/i.test(normalized)) {
    return normalized.replace(/\/(v1|v1beta)$/i, "");
  }

  if (/\/v1(?:beta)?$/i.test(normalized)) {
    return normalized.replace(/\/v1(?:beta)?$/i, "/google");
  }

  return `${normalized}/google`;
}

function sizeToAspectRatio(size?: string) {
  switch (size) {
    case "3:4":
      return "3:4";
    case "9:16":
      return "9:16";
    case "1024x1536":
      return "2:3";
    case "1536x1024":
      return "3:2";
    case "1024x1024":
      return "1:1";
    default:
      return "9:16";
  }
}

function resolveAspectRatio(input: { aspectRatio?: string; size?: string }) {
  if (input.aspectRatio) {
    return input.aspectRatio;
  }

  return sizeToAspectRatio(input.size);
}

function resolveOpenAiSize(input: { aspectRatio?: string; size?: string }) {
  if (input.size) {
    return input.size;
  }

  if (input.aspectRatio === "1:1") {
    return "1024x1024";
  }

  if (input.aspectRatio === "3:4" || input.aspectRatio === "9:16") {
    return "1024x1536";
  }

  // 支持自定义宽高比字符串（如 "16:9", "2:3", "4:3" 等）
  if (input.aspectRatio && /^\d+:\d+$/.test(input.aspectRatio)) {
    const [w, h] = input.aspectRatio.split(":").map(Number);
    if (w > 0 && h > 0) {
      const ratio = w / h;
      if (ratio >= 1) {
        return `1024x${Math.round(1024 / ratio)}`;
      } else {
        return `${Math.round(1024 * ratio)}x1024`;
      }
    }
  }

  return "1024x1536";
}

function dataUrlToInlineData(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 image data URL.");
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function extractTextContent(payload: unknown) {
  const message = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map((entry) =>
        typeof entry === "object" && entry && "text" in entry ? String(entry.text ?? "") : "",
      )
      .join("\n")
      .trim();
  }

  return "";
}

function parseJsonBlock(raw: string) {
  const direct = raw.trim();
  if (direct.startsWith("{") || direct.startsWith("[")) {
    return direct;
  }

  const fencedMatch = direct.match(/```json([\s\S]*?)```/i) || direct.match(/```([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return direct.slice(firstBrace, lastBrace + 1);
  }

  return direct;
}

function tryParseJsonBody(body: RequestInit["body"]) {
  if (typeof body !== "string") {
    return null;
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferModelFromEndpoint(url: string, bodyPayload?: Record<string, unknown> | null) {
  if (typeof bodyPayload?.model === "string") {
    return bodyPayload.model;
  }

  const match = url.match(/\/models\/([^:\/]+):generateContent/i);
  return match?.[1] ?? null;
}

function readMonitorContext(input?: AiMonitorContext) {
  return {
    projectId: input?.projectId ?? null,
    sectionId: input?.sectionId ?? null,
    operation: input?.operation ?? null,
  };
}

function tryParseStructuredPayload<T>(raw: string, schema: z.ZodType<T>) {
  const parsedJson = JSON.parse(parseJsonBlock(raw));
  try {
    return schema.parse(parsedJson);
  } catch (error) {
    const errorDetails = error instanceof z.ZodError ? error.flatten() : String(error);
    console.error(
      `[Zod 解析失败] \n` +
      `原始内容（前 500 字符）: ${raw.slice(0, 500)}\n` +
      `错误详情: ${JSON.stringify(errorDetails)}`,
    );
    throw error;
  }
}

function buildMessages(input: TextRequest | StructuredRequest<unknown>): ChatMessage[] {
  const content: ChatMessage["content"] =
    input.images?.length
      ? [
          { type: "text", text: input.userPrompt },
          ...input.images.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ]
      : input.userPrompt;

  const messages: ChatMessage[] = [];
  if (input.systemPrompt) {
    messages.push({ role: "system", content: input.systemPrompt });
  }
  messages.push({ role: "user", content });
  return messages;
}

function extractImageResult(payload: {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
}): ImageGenerationResult {
  const result = payload.data?.[0];
  if (!result) {
    throw new Error("Image generation returned no data.");
  }

  return {
    url: result.url ?? null,
    b64Json: result.b64_json ?? null,
    revisedPrompt: result.revised_prompt ?? null,
  };
}

function extractGoogleImageResult(payload: any): ImageGenerationResult {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inlineData = part?.inlineData ?? part?.inline_data ?? null;
    if (inlineData?.data) {
      return {
        url: null,
        b64Json: String(inlineData.data),
        revisedPrompt: typeof part?.text === "string" ? part.text : null,
      };
    }
  }

  throw new Error("Google image generation returned no inline image data.");
}

function toImageRefs(images: string[]) {
  return images.map((imageUrl) => ({
    image_url: imageUrl,
  }));
}

function toMaskRef(mask: string) {
  return {
    image_url: mask,
  };
}

function classifyProbeResult(status: number, body: string) {
  if (/model.+does not exist|does not exist|invalid_value.+model|param.+model|unsupported model/i.test(body)) {
    return "unavailable" as const;
  }
  if (/no available endpoint|not found|404/i.test(body) || status === 404) {
    return "unavailable" as const;
  }
  if (status === 429 || /限流|rate limit/i.test(body)) {
    return "rate_limited" as const;
  }
  if (/invalid value.+size|supported values|images\[0\]|unknown parameter|invalid type|aspectratio/i.test(body)) {
    return "available" as const;
  }
  if (status === 401 || status === 403) {
    return "unknown" as const;
  }
  if (status === 400 || status === 200) {
    return "available" as const;
  }
  return "unknown" as const;
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  // 缓存不支持 json_object 的模型，避免重复400请求
  private jsonUnsupportedModels = new Set<string>();

  private supportsJsonObjectMode(model: string) {
    if (/deepseek-v4-flash/i.test(model) && /ark\.cn-beijing\.volces\.com/i.test(this.baseUrl)) {
      return false;
    }
    return !this.jsonUnsupportedModels.has(model);
  }

  private async fetchRaw(
    url: string,
    init?: RequestInit,
    extraHeaders?: Record<string, string>,
    timeoutMs = 15000,
    monitor?: AiMonitorContext,
    options?: {
      suppressUsageLog?: boolean;
    },
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const method = init?.method ?? "GET";
    const bodyPayload = tryParseJsonBody(init?.body);
    const model = inferModelFromEndpoint(url, bodyPayload);
    const category = inferCategory(url, bodyPayload);
    const requestBytes = typeof init?.body === "string" ? Buffer.byteLength(init.body) : 0;

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(extraHeaders ?? {}),
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const body = await response.text();
      if (!options?.suppressUsageLog) {
        await logApiUsage({
          providerBaseUrl: normalizeBaseUrl(this.baseUrl),
          endpoint: url,
          method,
          model,
          ...readMonitorContext(monitor),
          category,
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
          success: response.ok,
          requestBytes,
          responseBytes: Buffer.byteLength(body),
          responseBody: body,
          errorMessage: response.ok ? null : body.slice(0, 1000),
        });
      }
      return {
        ok: response.ok,
        status: response.status,
        body,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (!options?.suppressUsageLog) {
        await logApiUsage({
          providerBaseUrl: normalizeBaseUrl(this.baseUrl),
          endpoint: url,
          method,
          model,
          ...readMonitorContext(monitor),
          category,
          statusCode: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          requestBytes,
          responseBytes: 0,
          responseBody: "",
          errorMessage: error instanceof Error ? error.message : "Unknown request failure",
        });
      }

      if ((error as Error)?.name === "AbortError") {
        throw new Error(`Provider request timed out after ${timeoutMs}ms: ${url}`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestRaw(
    path: string,
    init?: RequestInit,
    timeoutMs?: number,
    monitor?: AiMonitorContext,
    options?: {
      suppressUsageLog?: boolean;
    },
  ) {
    const isDashScope = isDashScopeProvider(this.baseUrl);
    const baseUrl = isDashScope
      ? `${normalizeDashScopeBaseUrl(this.baseUrl)}/compatible-mode/v1`
      : isVolcengineProvider(this.baseUrl)
        ? normalizeVolcengineBaseUrl(this.baseUrl)
        : normalizeBaseUrl(this.baseUrl);
    return this.fetchRaw(`${baseUrl}${path}`, init, undefined, timeoutMs, monitor, options);
  }

  private async requestJson<T>(path: string, init?: RequestInit, timeoutMs?: number, monitor?: AiMonitorContext) {
    const response = await this.requestRaw(path, init, timeoutMs, monitor);

    if (!response.ok) {
      throw new Error(`Provider request failed (${response.status}): ${response.body}`);
    }

    return JSON.parse(response.body) as T;
  }

  private async requestGoogleJson<T>(path: string, body: unknown, timeoutMs = 45000, monitor?: AiMonitorContext) {
    const base = deriveGoogleBaseUrl(this.baseUrl);
    const attempts = [
      `${base}/v1${path}`,
      `${base}/v1beta${path}`,
    ];
    const collapsedAttempts: Array<{
      endpoint: string;
      statusCode: number;
      success: boolean;
      errorMessage: string | null;
    }> = [];
    let finalSuccess: {
      body: string;
      url: string;
      status: number;
      durationMs: number;
    } | null = null;

    for (const url of attempts) {
      try {
        const response = await this.fetchRaw(
          url,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          {
            "x-goog-api-key": this.apiKey,
          },
          timeoutMs,
          monitor,
          {
            suppressUsageLog: true,
          },
        );

        collapsedAttempts.push({
          endpoint: url,
          statusCode: response.status,
          success: response.ok,
          errorMessage: response.ok ? null : response.body.slice(0, 1000),
        });

        if (response.ok) {
          finalSuccess = {
            body: response.body,
            url,
            status: response.status,
            durationMs: response.durationMs,
          };
          break;
        }
      } catch (error) {
        collapsedAttempts.push({
          endpoint: url,
          statusCode: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown Google protocol error",
        });
      }
    }

    const requestBody = JSON.stringify(body);
    const model = typeof (body as Record<string, unknown>)?.model === "string" ? String((body as Record<string, unknown>).model) : inferModelFromEndpoint(path);
    const retrySummary =
      collapsedAttempts.length > 1
        ? collapsedAttempts
            .filter((item) => !item.success)
            .map((item) => `${item.statusCode} ${item.endpoint}`)
            .join(" | ")
        : null;

    if (finalSuccess) {
      await logApiUsage({
        providerBaseUrl: normalizeBaseUrl(this.baseUrl),
        endpoint: finalSuccess.url,
        finalEndpoint: finalSuccess.url,
        method: "POST",
        model,
        ...readMonitorContext(monitor),
        category: inferCategory(finalSuccess.url, typeof body === "object" ? (body as Record<string, unknown>) : null),
        statusCode: finalSuccess.status,
        durationMs: collapsedAttempts.reduce((sum, item, index) => sum + (index === collapsedAttempts.length - 1 ? finalSuccess.durationMs : 0), 0) || finalSuccess.durationMs,
        success: true,
        requestBytes: Buffer.byteLength(requestBody),
        responseBytes: Buffer.byteLength(finalSuccess.body),
        responseBody: finalSuccess.body,
        attemptCount: collapsedAttempts.length,
        retrySummary,
        collapsedAttempts,
        errorMessage: null,
      });

      return JSON.parse(finalSuccess.body) as T;
    }

    const errorSummary = collapsedAttempts
      .map((item) => `${item.endpoint} -> ${item.statusCode}: ${item.errorMessage ?? "Unknown error"}`)
      .join(" | ");

    await logApiUsage({
      providerBaseUrl: normalizeBaseUrl(this.baseUrl),
      endpoint: attempts[attempts.length - 1] ?? `${base}/v1${path}`,
      finalEndpoint: attempts[attempts.length - 1] ?? `${base}/v1${path}`,
      method: "POST",
      model,
      ...readMonitorContext(monitor),
      category: inferCategory(`${base}/v1${path}`, typeof body === "object" ? (body as Record<string, unknown>) : null),
      statusCode: collapsedAttempts[collapsedAttempts.length - 1]?.statusCode ?? 0,
      durationMs: 0,
      success: false,
      requestBytes: Buffer.byteLength(requestBody),
      responseBytes: 0,
      responseBody: errorSummary,
      attemptCount: collapsedAttempts.length,
      retrySummary,
      collapsedAttempts,
      errorMessage: errorSummary,
    });

    throw new Error(`Google protocol request failed: ${errorSummary}`);
  }

  private async repairStructuredOutput<T>(input: StructuredRequest<T>, raw: string, reason: string) {
    const supportsJsonMode = this.supportsJsonObjectMode(input.model);

    const repairMessages = [
      {
        role: "system" as const,
        content: "You repair malformed model output into strict valid JSON. You MUST return ONLY valid JSON. No markdown fences, no explanations.",
      },
      {
        role: "user" as const,
        content: [
          `The previous response could not be parsed.`,
          `Reason: ${reason}`,
          "Convert the following content into strict valid JSON that matches the intended structure.",
          "Do not add markdown fences or commentary.",
          "",
          raw,
        ].join("\n"),
      },
    ];

    if (supportsJsonMode) {
      try {
        const payload = await this.requestJson("/chat/completions", {
          method: "POST",
          body: JSON.stringify({
            model: input.model,
            temperature: 0,
            max_tokens: input.maxTokens ?? 8192,
            response_format: { type: "json_object" },
            messages: repairMessages,
          }),
        }, input.timeoutMs ?? 120000);

        const repairedRaw = extractTextContent(payload);
        return {
          parsed: tryParseStructuredPayload(repairedRaw, input.schema),
          raw: repairedRaw,
        };
      } catch (error) {
        if (error instanceof Error && /json_object|response_format.*not supported|is not supported/i.test(error.message)) {
          this.jsonUnsupportedModels.add(input.model);
        } else {
          throw error;
        }
      }
    }

    // 纯文本模式修复
    const fallbackPayload = await this.requestJson("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        max_tokens: input.maxTokens ?? 8192,
        messages: repairMessages,
      }),
    }, input.timeoutMs ?? 120000);

    const repairedRaw = extractTextContent(fallbackPayload);
    return {
      parsed: tryParseStructuredPayload(repairedRaw, input.schema),
      raw: repairedRaw,
    };
  }

  private async probeDashScopeImageSupport(model: string) {
    const dashScopeBase = normalizeDashScopeBaseUrl(this.baseUrl);
    const url = `${dashScopeBase}/api/v1/services/aigc/multimodal-generation/generation`;

    const genProbe = await this.fetchRaw(
      url,
      {
        method: "POST",
        body: JSON.stringify({
          model,
          input: {
            messages: [{ role: "user", content: [{ text: "probe" }] }],
          },
          parameters: {
            n: 1,
            size: "1024*1024",
          },
        }),
      },
      undefined,
      5000,
      undefined,
      { suppressUsageLog: true },
    );

    const editProbe = await this.fetchRaw(
      url,
      {
        method: "POST",
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { image: "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260310/jiydyi/image%2B%2818%29-2026-03-10-16-39-59.webp" },
                  { text: "probe" },
                ],
              },
            ],
          },
          parameters: {
            n: 1,
            size: "1024*1024",
          },
        }),
      },
      undefined,
      5000,
      undefined,
      { suppressUsageLog: true },
    );

    return {
      imageGeneration: classifyProbeResult(genProbe.status, genProbe.body),
      imageEdit: classifyProbeResult(editProbe.status, editProbe.body),
      note: [genProbe.body, editProbe.body].filter(Boolean).join(" | ").slice(0, 1000),
    };
  }

  private async probeGeminiImageSupport(model: string) {
    const tinyTransparentPixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pW4xQAAAABJRU5ErkJggg==";

    const generationBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Generate a simple colored square." }],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        candidateCount: 1,
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    };

    const editBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Edit this image slightly and keep the same subject." },
            { inlineData: dataUrlToInlineData(tinyTransparentPixel) },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        candidateCount: 1,
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    };

    const generationProbe = await this.fetchRaw(
      `${deriveGoogleBaseUrl(this.baseUrl)}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        body: JSON.stringify(generationBody),
      },
      {
        "x-goog-api-key": this.apiKey,
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    const editProbe = await this.fetchRaw(
      `${deriveGoogleBaseUrl(this.baseUrl)}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        body: JSON.stringify(editBody),
      },
      {
        "x-goog-api-key": this.apiKey,
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    return {
      imageGeneration: classifyProbeResult(generationProbe.status, generationProbe.body),
      imageEdit: classifyProbeResult(editProbe.status, editProbe.body),
      note: [generationProbe.body, editProbe.body].filter(Boolean).join(" | ").slice(0, 1000),
    };
  }

  private async probeVolcengineImageSupport(model: string) {
    const probeImageUrl =
      "https://ark-project.tos-cn-beijing.volces.com/doc_image/seededit_i2i.jpeg";

    const generationProbe = await this.requestRaw(
      "/images/generations",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          prompt: "probe",
          size: "adaptive",
          response_format: "url",
        }),
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    const editProbe = await this.requestRaw(
      "/images/generations",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          prompt: "probe",
          image: probeImageUrl,
          size: "adaptive",
          response_format: "url",
        }),
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    return {
      imageGeneration: classifyProbeResult(generationProbe.status, generationProbe.body),
      imageEdit: classifyProbeResult(editProbe.status, editProbe.body),
      note: [generationProbe.body, editProbe.body].filter(Boolean).join(" | ").slice(0, 1000),
    };
  }

  async probeImageEndpointSupport(model: string) {
    if (isGeminiImageModel(model)) {
      try {
        return await this.probeGeminiImageSupport(model);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Google protocol probe error";
        return {
          imageGeneration: "unknown" as const,
          imageEdit: "unknown" as const,
          note: message,
        };
      }
    }

    if (isDashScopeProvider(this.baseUrl)) {
      return this.probeDashScopeImageSupport(model);
    }

    if (isVolcengineProvider(this.baseUrl)) {
      return this.probeVolcengineImageSupport(model);
    }

    const tinyTransparentPixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pW4xQAAAABJRU5ErkJggg==";

    const generationProbe = await this.requestRaw(
      "/images/generations",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          prompt: "probe",
          size: "1024x1024",
        }),
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    const editProbe = await this.requestRaw(
      "/images/edits",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          prompt: "probe",
          size: "1024x1024",
          images: [{ image_url: tinyTransparentPixel }],
        }),
      },
      5000,
      undefined,
      {
        suppressUsageLog: true,
      },
    );

    return {
      imageGeneration: classifyProbeResult(generationProbe.status, generationProbe.body),
      imageEdit: classifyProbeResult(editProbe.status, editProbe.body),
      note: [generationProbe.body, editProbe.body].filter(Boolean).join(" | ").slice(0, 1000),
    };
  }

  private async requestModelsJson<T>() {
    try {
      return await this.requestJson<T>("/models", { method: "GET" }, 10000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isMethodError =
        message.includes("method") ||
        message.includes("GET") ||
        message.includes("not supported") ||
        message.includes("InvalidParameter") ||
        message.includes("405");

      if (isMethodError) {
        const postBodies = [{ model: "" }, {}];
        let lastError: unknown;
        for (const body of postBodies) {
          try {
            return await this.requestJson<T>(
              "/models",
              { method: "POST", body: JSON.stringify(body) },
              10000,
            );
          } catch (e) {
            lastError = e;
          }
        }
        if (isDashScopeProvider(this.baseUrl)) {
          return this.fetchDashScopeModelsJson<T>();
        }
        throw lastError;
      }

      if (isDashScopeProvider(this.baseUrl)) {
        return this.fetchDashScopeModelsJson<T>();
      }

      throw error;
    }
  }

  private async fetchDashScopeModelsJson<T>() {
    const dashScopeBase = normalizeDashScopeBaseUrl(this.baseUrl);
    const url = `${dashScopeBase}/compatible-mode/v1/models`;
    const response = await this.fetchRaw(url, { method: "GET" }, undefined, 10000);
    if (!response.ok) {
      const postResponse = await this.fetchRaw(
        url,
        { method: "POST", body: JSON.stringify({}) },
        undefined,
        10000,
      );
      if (!postResponse.ok) {
        throw new Error(`DashScope models fetch failed: ${postResponse.body}`);
      }
      return JSON.parse(postResponse.body) as T;
    }
    return JSON.parse(response.body) as T;
  }

  async testConnection() {
    await this.requestModelsJson<{ data?: unknown[] }>();
    return {
      ok: true,
      providerLabel: normalizeBaseUrl(this.baseUrl),
    };
  }

  async listModels() {
    const payload = await this.requestModelsJson<{ data?: Array<{ id: string; label?: string }> }>();
    return (payload.data ?? []).map((item) => ({
      id: item.id,
      label: item.label ?? item.id,
    }));
  }

  async generateText(input: TextRequest) {
    const payload = await this.requestJson("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: input.model,
        messages: buildMessages(input),
        temperature: 0.4,
      }),
    }, input.timeoutMs ?? 120000, input.monitor);

    return {
      text: extractTextContent(payload),
    };
  }

  async generateStructured<T>(input: StructuredRequest<T>) {
    const supportsJsonMode = this.supportsJsonObjectMode(input.model);

    // 尝试带 json_object 格式请求（仅当模型支持时）
    if (supportsJsonMode) {
      try {
        const payload = await this.requestJson("/chat/completions", {
          method: "POST",
          body: JSON.stringify({
            model: input.model,
            messages: buildMessages(input),
            temperature: 0.2,
            max_tokens: input.maxTokens ?? 8192,
            response_format: { type: "json_object" },
          }),
        }, input.timeoutMs ?? 120000, input.monitor);

        const raw = extractTextContent(payload);
        try {
          const parsed = tryParseStructuredPayload(raw, input.schema);
          return { parsed, raw };
        } catch (error) {
          return this.repairStructuredOutput(
            input,
            raw,
            error instanceof Error ? error.message : "Unknown structured parse error",
          );
        }
      } catch (error) {
        if (error instanceof Error && /json_object|response_format.*not supported|is not supported/i.test(error.message)) {
          // 标记该模型不支持 json_object，后续调用直接跳过
          this.jsonUnsupportedModels.add(input.model);
        } else {
          throw error;
        }
      }
    }

    // 纯文本模式 fallback
    const messages = buildMessages(input);
    messages.push({ role: "system", content: "You MUST return ONLY valid JSON. No markdown fences, no explanations." });

    const fallbackPayload = await this.requestJson("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: input.model,
        messages,
        temperature: 0.2,
        max_tokens: input.maxTokens ?? 8192,
      }),
    }, input.timeoutMs ?? 120000, input.monitor);

    const raw = extractTextContent(fallbackPayload);
    try {
      const parsed = tryParseStructuredPayload(raw, input.schema);
      return { parsed, raw };
    } catch (parseError) {
      return this.repairStructuredOutput(
        input,
        raw,
        parseError instanceof Error ? parseError.message : "Unknown structured parse error",
      );
    }
  }

  private async generateGeminiImageWithGoogleProtocol(input: {
    model: string;
    prompt: string;
    referenceImages?: string[];
    baseImage?: string | null;
    size?: string;
    aspectRatio?: string;
    monitor?: AiMonitorContext;
  }) {
    const imageParts = [input.baseImage ?? null, ...(input.referenceImages ?? [])]
      .filter(Boolean)
      .map((item) => ({ inlineData: dataUrlToInlineData(item as string) }));

    const payload = await this.requestGoogleJson<any>(`/models/${input.model}:generateContent`, {
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }, ...imageParts],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        candidateCount: 1,
        imageConfig: {
          aspectRatio: resolveAspectRatio(input),
        },
      },
    }, 90000, input.monitor);

    return extractGoogleImageResult(payload);
  }

  private async generateDashScopeImage(input: {
    model: string;
    prompt: string;
    negativePrompt?: string;
    referenceImages?: string[];
    baseImage?: string | null;
    size?: string;
    aspectRatio?: string;
    monitor?: AiMonitorContext;
  }) {
    const dashScopeBase = normalizeDashScopeBaseUrl(this.baseUrl);
    const content: Array<{ image?: string; text?: string }> = [];

    if (input.baseImage) {
      content.push({ image: input.baseImage });
    }

    // 百炼原生 API 对不同模型的参考图数量有硬性限制：
    // qwen-image 系列最多 3 张，wan 系列最多 8 张（文字占 1 个 slot，总共 9）
    const isQwenImage = /qwen.*image/i.test(input.model);
    const maxRefs = isQwenImage ? 3 : 8;
    const refs = (input.referenceImages ?? []).slice(0, maxRefs);

    for (const ref of refs) {
      content.push({ image: ref });
    }
    content.push({ text: input.prompt });

    const body = {
      model: input.model,
      input: {
        messages: [
          {
            role: "user",
            content,
          },
        ],
      },
      parameters: {
        n: 1,
        negative_prompt: input.negativePrompt || " ",
        prompt_extend: true,
        watermark: false,
        size: resolveDashScopeSize(input),
      },
    };

    const url = `${dashScopeBase}/api/v1/services/aigc/multimodal-generation/generation`;
    const response = await this.fetchRaw(
      url,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      undefined,
      120000,
      input.monitor,
    );

    if (!response.ok) {
      throw new Error(`DashScope request failed (${response.status}): ${response.body}`);
    }

    return extractDashScopeImageResult(JSON.parse(response.body));
  }

  async generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const referenceImages = input.referenceImages ?? [];
    let googleProtocolError: unknown = null;

    if (isGeminiImageModel(input.model)) {
      try {
        return await this.generateGeminiImageWithGoogleProtocol({
          model: input.model,
          prompt: input.prompt,
          referenceImages,
          size: input.size,
          aspectRatio: input.aspectRatio,
          monitor: input.monitor,
        });
      } catch (error) {
        googleProtocolError = error;
        if (!referenceImages.length) {
          throw error;
        }
      }
    }

    // DashScope 原生生图模型跳过 compatible-mode 尝试，直接走原生 API
    // compatible-mode 端点只支持标准 OpenAI 模型名，wan/qwen-image 等百炼原生模型需要原生端点
    if (isDashScopeProvider(this.baseUrl) && !isGeminiImageModel(input.model)) {
      return this.generateDashScopeImage({
        model: input.model,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        referenceImages,
        size: input.size,
        aspectRatio: input.aspectRatio,
        monitor: input.monitor,
      });
    }

    if (referenceImages.length > 0) {
      const referenceErrors: string[] = [];
      if (googleProtocolError instanceof Error) {
        referenceErrors.push(`Google protocol failed: ${googleProtocolError.message}`);
      }
      const imageRefs = toImageRefs(referenceImages);

      for (const attempt of [
        ...(isVolcengineProvider(this.baseUrl)
          ? [
              {
                path: "/images/generations",
                body: {
                  model: input.model,
                  prompt: input.prompt,
                  image: referenceImages[0],
                  response_format: "url",
                  size: "adaptive",
                },
              },
            ]
          : []),
        {
          path: "/images/edits",
          body: {
            model: input.model,
            prompt: input.prompt,
            size: resolveOpenAiSize(input),
            images: imageRefs,
          },
        },
        {
          path: "/images/edits",
          body: {
            model: input.model,
            prompt: input.prompt,
            size: resolveOpenAiSize(input),
            images: imageRefs,
            input_fidelity: "high",
          },
        },
        {
          path: "/images/generations",
          body: {
            model: input.model,
            prompt: input.prompt,
            size: resolveOpenAiSize(input),
            reference_images: imageRefs,
          },
        },
        {
          path: "/images/generations",
          body: {
            model: input.model,
            prompt: input.prompt,
            size: resolveOpenAiSize(input),
            input_images: imageRefs,
          },
        },
      ]) {
        try {
          const payload = await this.requestJson<{
            data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
          }>(attempt.path, {
            method: "POST",
            body: JSON.stringify(attempt.body),
          }, undefined, input.monitor);

          return extractImageResult(payload);
        } catch (error) {
          referenceErrors.push(error instanceof Error ? error.message : "Unknown reference image generation error");
        }
      }

      if (isDashScopeProvider(this.baseUrl)) {
        try {
          return await this.generateDashScopeImage({
            model: input.model,
            prompt: input.prompt,
            referenceImages,
            size: input.size,
            aspectRatio: input.aspectRatio,
            monitor: input.monitor,
          });
        } catch (dashError) {
          referenceErrors.push(
            dashError instanceof Error ? dashError.message : "DashScope reference image generation failed",
          );
        }
      }

      throw new Error(`Reference-guided image generation failed: ${referenceErrors.join(" | ")}`);
    }

    try {
      const generationAttempts: Array<{ body: Record<string, unknown> }> = [
        ...(isVolcengineProvider(this.baseUrl)
          ? [
              {
                body: {
                  model: input.model,
                  prompt: input.prompt,
                  response_format: "url",
                  size: "adaptive",
                },
              },
            ]
          : []),
        {
          body: {
            model: input.model,
            prompt: input.prompt,
            size: resolveOpenAiSize(input),
          },
        },
      ];

      let generationError: string | null = null;
      for (const attempt of generationAttempts) {
        try {
          const payload = await this.requestJson<{
            data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
          }>("/images/generations", {
            method: "POST",
            body: JSON.stringify(attempt.body),
          }, undefined, input.monitor);

          return extractImageResult(payload);
        } catch (error) {
          generationError = error instanceof Error ? error.message : "Unknown image generation error";
        }
      }

      throw new Error(generationError ?? "Image generation failed");
    } catch (error) {
      if (isDashScopeProvider(this.baseUrl)) {
        return this.generateDashScopeImage({
          model: input.model,
          prompt: input.prompt,
          referenceImages,
          size: input.size,
          aspectRatio: input.aspectRatio,
          monitor: input.monitor,
        });
      }

      if (!isGeminiImageModel(input.model)) {
        throw error;
      }

      return this.generateGeminiImageWithGoogleProtocol({
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        aspectRatio: input.aspectRatio,
        monitor: input.monitor,
      });
    }
  }

  async editImage(input: ImageEditRequest): Promise<ImageGenerationResult> {
    const imageRefs = toImageRefs([input.image, ...(input.referenceImages ?? [])]);
    let googleProtocolError: unknown = null;
    if (isGeminiImageModel(input.model)) {
      try {
        return await this.generateGeminiImageWithGoogleProtocol({
          model: input.model,
          prompt: input.prompt,
          baseImage: input.image,
          referenceImages: input.referenceImages,
          size: input.size,
          aspectRatio: input.aspectRatio,
          monitor: input.monitor,
        });
      } catch (error) {
        googleProtocolError = error;
        // Fall through to compatibility attempts for providers that proxy Gemini image models via OpenAI image APIs.
      }
    }

    // DashScope 原生生图模型跳过 compatible-mode 尝试，直接走原生 API
    if (isDashScopeProvider(this.baseUrl) && !isGeminiImageModel(input.model)) {
      return this.generateDashScopeImage({
        model: input.model,
        prompt: input.prompt,
        baseImage: input.image,
        referenceImages: input.referenceImages,
        size: input.size,
        aspectRatio: input.aspectRatio,
        monitor: input.monitor,
      });
    }

    const attempts = [
      ...(isVolcengineProvider(this.baseUrl)
        ? [
            {
              path: "/images/generations",
              body: {
                model: input.model,
                prompt: input.prompt,
                image: input.image,
                response_format: "url",
                size: "adaptive",
              },
            },
          ]
        : []),
      {
        path: "/images/edits",
        body: {
          model: input.model,
          prompt: input.prompt,
          size: resolveOpenAiSize(input),
          images: imageRefs,
          ...(input.mask ? { mask: toMaskRef(input.mask) } : {}),
        },
      },
      {
        path: "/images/edits",
        body: {
          model: input.model,
          prompt: input.prompt,
          size: resolveOpenAiSize(input),
          images: imageRefs,
          input_fidelity: "high",
          ...(input.mask ? { mask: toMaskRef(input.mask) } : {}),
        },
      },
      {
        path: "/images/generations",
        body: {
          model: input.model,
          prompt: input.prompt,
          size: resolveOpenAiSize(input),
          reference_images: imageRefs,
          ...(input.mask ? { mask: toMaskRef(input.mask) } : {}),
        },
      },
    ];

    const errors: string[] = [];

    for (const attempt of attempts) {
      try {
        const payload = await this.requestJson<{
          data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
        }>(attempt.path, {
          method: "POST",
          body: JSON.stringify(attempt.body),
        }, undefined, input.monitor);

        return extractImageResult(payload);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Unknown image edit error");
      }
    }

    if (isGeminiImageModel(input.model)) {
      errors.unshift(
        googleProtocolError instanceof Error
          ? `Google protocol image edit failed: ${googleProtocolError.message}`
          : "Google protocol image edit attempt did not complete successfully",
      );
    }

    if (isDashScopeProvider(this.baseUrl)) {
      try {
        return await this.generateDashScopeImage({
          model: input.model,
          prompt: input.prompt,
          baseImage: input.image,
          referenceImages: input.referenceImages,
          size: input.size,
          aspectRatio: input.aspectRatio,
          monitor: input.monitor,
        });
      } catch (dashError) {
        errors.push(
          dashError instanceof Error ? dashError.message : "DashScope image edit failed",
        );
      }
    }

    throw new Error(`Base64 image edit failed: ${errors.join(" | ")}`);
  }

  async upscaleImage(input: ImageUpscaleRequest): Promise<ImageUpscaleResult> {
    const dashScopeBase = normalizeDashScopeBaseUrl(this.baseUrl);
    const upscaleFactor = input.upscaleFactor ?? 2;

    // 创建超分任务
    const createTaskUrl = `${dashScopeBase}/api/v1/services/aigc/image2image/image-synthesis`;
    const createResponse = await this.fetchRaw(
      createTaskUrl,
      {
        method: "POST",
        body: JSON.stringify({
          model: "wanx2.1-imageedit",
          input: {
            prompt: "图像超分",
            function: "super_resolution",
            base_image_url: input.image,
          },
          parameters: {
            upscale_factor: upscaleFactor,
            n: 1,
          },
        }),
      },
      {
        "X-DashScope-Async": "enable",
      },
      30000,
      input.monitor,
    );

    if (!createResponse.ok) {
      throw new Error(`DashScope upscale task creation failed (${createResponse.status}): ${createResponse.body}`);
    }

    const createResult = JSON.parse(createResponse.body);
    const taskId = createResult?.output?.task_id;

    if (!taskId) {
      throw new Error(`DashScope upscale task creation returned no task_id: ${createResponse.body}`);
    }

    // 轮询任务结果
    const pollUrl = `${dashScopeBase}/api/v1/tasks/${taskId}`;
    const maxAttempts = 30;
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const pollResponse = await this.fetchRaw(
        pollUrl,
        { method: "GET" },
        undefined,
        10000,
        input.monitor,
      );

      if (!pollResponse.ok) {
        continue;
      }

      const pollResult = JSON.parse(pollResponse.body);
      const taskStatus = pollResult?.output?.task_status;

      if (taskStatus === "SUCCEEDED") {
        const results = pollResult?.output?.results ?? [];
        if (results.length > 0 && results[0].url) {
          return { url: results[0].url, b64Json: null };
        }
        throw new Error("DashScope upscale task succeeded but returned no image URL");
      }

      if (taskStatus === "FAILED") {
        const code = pollResult?.output?.code ?? "UNKNOWN";
        const message = pollResult?.output?.message ?? "Task failed";
        throw new Error(`DashScope upscale task failed: ${code} - ${message}`);
      }

      if (taskStatus === "CANCELED" || taskStatus === "UNKNOWN") {
        throw new Error(`DashScope upscale task ended with status: ${taskStatus}`);
      }

      // PENDING 或 RUNNING，继续等待
    }

    throw new Error(`DashScope upscale task timed out after ${maxAttempts * pollInterval / 1000}s`);
  }

  async generateEmbedding(input: EmbeddingRequest): Promise<EmbeddingResult> {
    const payload = await this.requestJson<{
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage?: { prompt_tokens: number; total_tokens: number };
    }>("/embeddings", {
      method: "POST",
      body: JSON.stringify({
        model: input.model,
        input: input.input,
      }),
    }, input.timeoutMs ?? 30000, input.monitor);

    return {
      embeddings: payload.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding),
      model: payload.model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      },
    };
  }
}

export function parseProviderError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.flatten();
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown provider error";
}
