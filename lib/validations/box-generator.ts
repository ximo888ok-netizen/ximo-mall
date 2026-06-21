import { z } from "zod";

export const boxAnalyzeSchema = z.object({
  productImageBase64: z.string().min(1),
  productName: z.string().min(1),
  brandName: z.string().optional().default(""),
  productCategory: z.string().optional().default(""),
});

export type BoxAnalyzeInput = z.infer<typeof boxAnalyzeSchema>;

export const boxPlanSchema = z.object({
  productName: z.string().min(1),
  brandName: z.string().optional().default(""),
  productCategory: z.string().optional().default(""),
  specifications: z.string().optional().default(""),
  coreSellingPoints: z.array(z.string()),
  productDescription: z.string(),
  slogan: z.string().optional().default(""),
  boxType: z.string().min(1),
  boxDimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
  }),
  material: z.string().optional().default(""),
  finish: z.string().optional().default(""),
  style: z.string().min(1),
  primaryColor: z.string().optional().default(""),
  secondaryColors: z.array(z.string()).optional().default([]),
  fontStyle: z.string().optional().default(""),
  customInstruction: z.string().optional().default(""),
});

export type BoxPlanInput = z.infer<typeof boxPlanSchema>;

export const boxGenerateSchema = z.object({
  productImageBase64: z.string().min(1),
  productName: z.string().min(1),
  brandName: z.string().optional().default(""),
  productCategory: z.string().optional().default(""),
  boxType: z.string().min(1),
  boxDimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
  }),
  material: z.string().optional().default(""),
  finish: z.string().optional().default(""),
  style: z.string().min(1),
  primaryColor: z.string().optional().default(""),
  secondaryColors: z.array(z.string()).optional().default([]),
  fontStyle: z.string().optional().default(""),
  views: z.array(z.string()).min(1),
  customInstruction: z.string().optional().default(""),
  plannedFaces: z
    .array(
      z.object({
        face: z.string(),
        copy: z.string().optional().default(""),
        visualPrompt: z.string(),
        layoutNotes: z.string().optional().default(""),
      }),
    )
    .optional(),
});

export type BoxGenerateInput = z.infer<typeof boxGenerateSchema>;
