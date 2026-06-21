import { NextRequest } from "next/server";

import { getProviderAdapter } from "@/lib/services/provider-service";
import { buildBoxAnalysisPrompt } from "@/lib/ai/prompts/box-analysis";
import { boxAnalysisOutputSchema } from "@/lib/ai/schemas/box-analysis";
import { boxAnalyzeSchema } from "@/lib/validations/box-generator";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    const input = boxAnalyzeSchema.parse(await request.json().catch(() => ({})));

    const { provider, adapter } = await getProviderAdapter("analysis");

    const visionModels = provider.models.filter((item) => {
      const caps = (item.capabilities as Record<string, boolean> | null) ?? {};
      return caps.text && caps.vision;
    });

    if (!visionModels.length) {
      return handleRouteError(
        new Error("当前 Provider 没有探测到支持视觉分析的模型。请前往 AI 配置页面检查模型服务配置。"),
      );
    }

    const candidates = [
      visionModels.find((item) => item.modelId.includes("doubao-seed-2-0-lite-260428"))?.modelId ?? null,
      provider.models.find((item) => (item as Record<string, unknown>).isDefaultAnalysis === true)?.modelId ?? null,
      ...visionModels
        .filter((item) => /gemini|vision|gpt-4o|gpt-4\.1|claude|qwen|doubao|glm/i.test(item.modelId) && !/preview|experimental|beta/i.test(item.modelId))
        .map((item) => item.modelId),
      ...visionModels.map((item) => item.modelId),
    ].filter(Boolean) as string[];

    const uniqueCandidates = [...new Set(candidates)];
    const productImageDataUrl = input.productImageBase64.startsWith("data:")
      ? input.productImageBase64
      : `data:image/jpeg;base64,${input.productImageBase64}`;

    const errors: string[] = [];

    for (const model of uniqueCandidates) {
      try {
        const result = await adapter.generateStructured({
          model,
          systemPrompt: "Return one strict JSON object only. No markdown. All text in Simplified Chinese.",
          userPrompt: buildBoxAnalysisPrompt({
            productName: input.productName,
            brandName: input.brandName,
            productCategory: input.productCategory,
          }),
          schema: boxAnalysisOutputSchema,
          images: [productImageDataUrl],
          maxTokens: 4096,
          timeoutMs: 120000,
          monitor: { operation: "box_analyze" },
        });

        return ok(result.parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown analysis error";
        errors.push(`${model}: ${message}`);

        if (/monthly spending limit|spending limit|quota|invalid token|unauthorized|forbidden/i.test(message)) {
          return handleRouteError(error);
        }
      }
    }

    return handleRouteError(
      new Error(`所有可用分析模型均失败：${errors.join(" | ")}`),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
