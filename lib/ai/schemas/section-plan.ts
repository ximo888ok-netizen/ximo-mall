import { z } from "zod";

export const detailVisualAnchorSchema = z.object({
  primaryBg: z.string().optional().default(""),
  secondaryBg: z.string().optional().default(""),
  accentColor: z.string().optional().default(""),
  secondaryAccent: z.string().optional().default(""),
  texture: z.string().optional().default(""),
  typography: z.string().optional().default(""),
  visualMood: z.string().optional().default(""),
  transitionRule: z.string().optional().default(""),
});

export type DetailVisualAnchor = z.infer<typeof detailVisualAnchorSchema>;

const looseSectionItemSchema = z.object({
  id: z.string().optional().default(""),
  type: z.string().optional().default("custom"),
  title: z.string().optional().default(""),
  goal: z.string().optional().default(""),
  copy: z.string().optional().default(""),
  visualPrompt: z.string().optional().default(""),
  editableFields: z.record(z.string(), z.any()).optional().default({}),
});

export const sectionPlanOutputSchema = z.preprocess(
  (val) => {
    if (Array.isArray(val)) {
      return { sections: val, detailVisualAnchor: null };
    }
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const anchor = obj.detailVisualAnchor ?? null;
      if (Array.isArray(obj.sections)) return { sections: obj.sections, detailVisualAnchor: anchor };
      if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as Record<string, unknown>).sections)) {
        return { sections: (obj.data as Record<string, unknown>).sections, detailVisualAnchor: (obj.data as Record<string, unknown>).detailVisualAnchor ?? anchor };
      }
      if (obj.result && typeof obj.result === "object" && Array.isArray((obj.result as Record<string, unknown>).sections)) {
        return { sections: (obj.result as Record<string, unknown>).sections, detailVisualAnchor: (obj.result as Record<string, unknown>).detailVisualAnchor ?? anchor };
      }
    }
    return { sections: [], detailVisualAnchor: null };
  },
  z.object({
    sections: z.array(looseSectionItemSchema),
    detailVisualAnchor: detailVisualAnchorSchema.nullable().optional(),
  }),
);

export type SectionPlanOutput = z.infer<typeof sectionPlanOutputSchema>;
