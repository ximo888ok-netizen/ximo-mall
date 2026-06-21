import { NextRequest } from "next/server";

import { getProviderAdapter } from "@/lib/services/provider-service";
import { buildBoxPlanningPrompt } from "@/lib/ai/prompts/box-planning";
import { boxPlanningOutputSchema } from "@/lib/ai/schemas/box-planning";
import { boxPlanSchema } from "@/lib/validations/box-generator";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest) {
  try {
    const input = boxPlanSchema.parse(await request.json().catch(() => ({})));

    const { provider, adapter } = await getProviderAdapter("planning");

    const defaultPlanningModel = provider.models.find((item) => item.isDefaultPlanning);
    const defaultAnalysisModel = provider.models.find((item) => item.isDefaultAnalysis);

    const priorityModels = [
      defaultPlanningModel?.modelId ?? null,
      defaultAnalysisModel?.modelId ?? null,
    ].filter(Boolean) as string[];

    const seen = new Set(priorityModels);

    const rest = [
      ...provider.models
        .filter((item) => (item.capabilities as Record<string, boolean>).structured_output && !seen.has(item.modelId))
        .map((item) => item.modelId),
      ...provider.models
        .filter((item) => (item.capabilities as Record<string, boolean>).text && !seen.has(item.modelId))
        .map((item) => item.modelId),
    ];

    const candidates = [...priorityModels, ...rest];
    const errors: string[] = [];

    for (const model of candidates) {
      try {
        const result = await adapter.generateStructured({
          model,
          systemPrompt: "Return one strict JSON object only. No markdown. DO NOT wrap in code fences.",
          userPrompt: buildBoxPlanningPrompt({
            analysis: {
              productName: input.productName,
              productCategory: input.productCategory,
              subcategory: "",
              specifications: input.specifications,
              coreSellingPoints: input.coreSellingPoints,
              productDescription: input.productDescription,
              targetAudience: [],
              usageScenarios: [],
              brandInferred: input.brandName,
              visualElements: [],
              colorPalette: [input.primaryColor, ...input.secondaryColors],
              slogan: input.slogan,
            },
            boxType: input.boxType,
            boxDimensions: input.boxDimensions,
            material: input.material,
            finish: input.finish,
            style: input.style,
            primaryColor: input.primaryColor,
            secondaryColors: input.secondaryColors,
            fontStyle: input.fontStyle,
            customInstruction: input.customInstruction,
          }),
          schema: boxPlanningOutputSchema,
          maxTokens: 8192,
          timeoutMs: 180000,
          monitor: { operation: "box_plan_faces" },
        });

        return ok(result.parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown planning error";
        errors.push(`${model}: ${message}`);

        if (/monthly spending limit|spending limit|quota|invalid token|unauthorized|forbidden/i.test(message)) {
          return handleRouteError(error);
        }
      }
    }

    return handleRouteError(
      new Error(`所有可用规划模型均失败：${errors.join(" | ")}`),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
