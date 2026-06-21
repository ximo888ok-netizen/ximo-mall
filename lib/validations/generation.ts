import { z } from "zod";

export const generationRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
  referenceAssetIds: z.array(z.string()).optional().default([]),
  editMode: z.enum(["repaint", "enhance"]).optional().default("repaint"),
  customMode: z.boolean().optional().default(false),
});

export const refineRequestSchema = z.object({
  modelId: z.string().optional().nullable(),
  referenceAssetIds: z.array(z.string()).optional().default([]),
  instruction: z.string().min(1, "微调说明不能为空"),
  customMode: z.boolean().optional().default(false),
});
