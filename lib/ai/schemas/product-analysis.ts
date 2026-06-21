import { z } from "zod";

export const productAnalysisOutputSchema = z.object({
  productName: z.string(),
  category: z.string(),
  subcategory: z.string(),
  material: z.string(),
  color: z.string(),
  specifications: z.string(),
  styleTags: z.array(z.string()),
  targetAudience: z.array(z.string()),
  usageScenarios: z.array(z.string()),
  coreSellingPoints: z.array(z.string()),
  differentiationPoints: z.array(z.string()),
  userConcerns: z.array(z.string()),
  recommendedFocusPoints: z.array(z.string()),
  suggestedSectionPlan: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      goal: z.string(),
    }),
  ),
  // 关联图上下文分析（仅当存在关联图时填充，静默传给图片规划）
  associatedImageContexts: z.array(
    z.object({
      index: z.number(),
      fileName: z.string(),
      sceneDescription: z.string(),
      productRelationship: z.string(),
      visualElements: z.array(z.string()),
      compositionStyle: z.string(),
      lightingAndColor: z.string(),
      propsAndEnvironment: z.array(z.string()),
      usageScenario: z.string(),
    }),
  ).optional(),
});

export type ProductAnalysisOutput = z.infer<typeof productAnalysisOutputSchema>;
