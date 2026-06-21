import { z } from "zod";

export interface AiMonitorContext {
  projectId?: string;
  sectionId?: string;
  operation?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

export interface StructuredRequest<T> {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  images?: string[];
  timeoutMs?: number;
  maxTokens?: number;
  monitor?: AiMonitorContext;
}

export interface TextRequest {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  images?: string[];
  timeoutMs?: number;
  maxTokens?: number;
  monitor?: AiMonitorContext;
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
  aspectRatio?: string;
  referenceImages?: string[];
  monitor?: AiMonitorContext;
}

export interface ImageEditRequest {
  model: string;
  prompt: string;
  image: string;
  mask?: string;
  size?: string;
  aspectRatio?: string;
  referenceImages?: string[];
  monitor?: AiMonitorContext;
}

export interface ImageGenerationResult {
  url?: string | null;
  b64Json?: string | null;
  revisedPrompt?: string | null;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  timeoutMs?: number;
  monitor?: AiMonitorContext;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage?: { promptTokens: number; totalTokens: number };
}

export interface ImageUpscaleRequest {
  model: string;
  image: string;
  upscaleFactor?: number;
  monitor?: AiMonitorContext;
}

export interface ImageUpscaleResult {
  url?: string | null;
  b64Json?: string | null;
}

export interface ProviderAdapter {
  testConnection(): Promise<{ ok: boolean; providerLabel: string }>;
  listModels(): Promise<Array<{ id: string; label: string }>>;
  generateText(input: TextRequest): Promise<{ text: string }>;
  generateStructured<T>(input: StructuredRequest<T>): Promise<{ parsed: T; raw: string }>;
  generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult>;
  editImage(input: ImageEditRequest): Promise<ImageGenerationResult>;
  upscaleImage(input: ImageUpscaleRequest): Promise<ImageUpscaleResult>;
  generateEmbedding(input: EmbeddingRequest): Promise<EmbeddingResult>;
}
