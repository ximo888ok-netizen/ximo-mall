import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export async function getAgentModelProvider() {
  const { getProviderAdapter } = await import(
    "@/lib/services/provider-service"
  );

  let provider: { baseUrl: string };
  let apiKey: string;

  try {
    const adapterCtx = await getProviderAdapter("agent");
    provider = adapterCtx.provider;
    apiKey = adapterCtx.apiKey;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    throw new Error(
      `AI Agent 模型 Provider 初始化失败：${detail}。请检查设置 → Provider 管理中是否配置了包含 doubao-seed-2-0-lite-260428 模型的 Provider，并确保 API Key、baseURL 正确。`,
    );
  }

  return createOpenAICompatible({
    baseURL: provider.baseUrl,
    apiKey,
    name: "openai-compatible",
  });
}
