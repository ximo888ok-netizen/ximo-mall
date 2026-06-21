import { z } from "zod";

export const boxAnalysisOutputSchema = z.object({
  productName: z.string(),
  productCategory: z.string(),
  subcategory: z.string(),
  specifications: z.string(),
  coreSellingPoints: z.array(z.string()),
  productDescription: z.string(),
  targetAudience: z.array(z.string()),
  usageScenarios: z.array(z.string()),
  brandInferred: z.string(),
  visualElements: z.array(z.string()),
  colorPalette: z.array(z.string()),
  slogan: z.string(),
});

export type BoxAnalysisOutput = z.infer<typeof boxAnalysisOutputSchema>;
