import { z } from "zod";

export const boxPlanningOutputSchema = z.object({
  visualPrompt: z.string(),
  layoutNotes: z.string(),
});

export type BoxPlanningOutput = z.infer<typeof boxPlanningOutputSchema>;
