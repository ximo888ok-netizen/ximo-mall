import type { ProductAsset } from "@prisma/client";

const requiredJsonShape = `{
  "productName": "string",
  "category": "string",
  "subcategory": "string",
  "material": "string",
  "color": "string",
  "specifications": "string — 产品规格（克重、净含量、尺寸、容量等，按产品实际情况描写）",
  "styleTags": ["string"],
  "targetAudience": ["string"],
  "usageScenarios": ["string"],
  "coreSellingPoints": ["string"],
  "differentiationPoints": ["string"],
  "userConcerns": ["string"],
  "recommendedFocusPoints": ["string"],
  "suggestedSectionPlan": [
    {
      "type": "hero | selling_points | scenario | detail_closeup | specs | material | comparison | gift_scene | brand_trust | summary",
      "title": "string",
      "goal": "string"
    }
  ]
}`;

const supportedSectionTypes = [
  "hero",
  "selling_points",
  "scenario",
  "detail_closeup",
  "specs",
  "material",
  "comparison",
  "gift_scene",
  "brand_trust",
  "summary",
].join(", ");

function buildAssetSummary(assets: ProductAsset[], hasAssociated: boolean) {
  const mainAssets = assets.filter((a) => a.type === "MAIN" || a.isMain);
  const associatedAssets = assets.filter((a) => a.type !== "MAIN" && !a.isMain);

  const parts: string[] = [];

  if (mainAssets.length > 0) {
    parts.push("=== PRODUCT MAIN IMAGE (产品主体图) ===");
    parts.push(
      mainAssets
        .map((a, i) => `${i + 1}. type=MAIN; file=${a.fileName}; THIS IS THE PRODUCT IDENTITY SOURCE`)
        .join("\n"),
    );
  }

  if (hasAssociated && associatedAssets.length > 0) {
    parts.push("");
    parts.push("=== ASSOCIATED SCENE IMAGES (关联场景图) ===");
    parts.push("These are scene/context images showing the product in different environments or usage scenarios.");
    parts.push("They are NOT different products — they show the SAME product in context.");
    parts.push(
      associatedAssets
        .map((a, i) => `${i + 1}. type=REFERENCE; file=${a.fileName}`)
        .join("\n"),
    );
  }

  return parts.join("\n") || "No uploaded assets.";
}

export function buildProductAnalysisPrompt(assets: ProductAsset[], hasAssociatedImages = false) {
  const assetSummary = buildAssetSummary(assets, hasAssociatedImages);

  const basePrompt = [
    "You are a senior e-commerce product strategist and detail-page planner.",
    "Analyze the provided product images and return one strict JSON object only.",
    "Do not output markdown, code fences, explanations, comments, or extra keys.",
    "All copy values should be written in Simplified Chinese.",
    "If some attributes are uncertain, infer the most likely answer from the images and keep the field non-empty.",
    "",
    assetSummary,
    "",
  ];

  if (hasAssociatedImages) {
    basePrompt.push(
      "IMPORTANT CONTEXT RULES (关联图上下文规则):",
      "1. The MAIN image defines the product identity — analyze ONLY this for productName, category, material, color.",
      "2. The ASSOCIATED images show the SAME product in different scenes/contexts. Do NOT treat them as different products.",
      "3. Use associated images to enrich: usageScenarios, styleTags, targetAudience, recommendedFocusPoints.",
      "4. Use associated images to inspire suggestedSectionPlan — scenes shown can become detail page sections.",
    );
  }

  basePrompt.push(
    "",
    "Required rules:",
    "1. Every required key must exist.",
    "2. Every array field must be an array of short Chinese strings.",
    "3. suggestedSectionPlan must contain at least 6 sections.",
    `4. suggestedSectionPlan.type must be one of: ${supportedSectionTypes}.`,
    "5. Focus on e-commerce conversion, visual hierarchy, and section planning.",
  );

  if (hasAssociatedImages) {
    basePrompt.push(
      "6. associatedImageContexts: For EACH associated image (index starting from 0 for the first associated image),",
      "   output an object describing: sceneDescription (场景描述), productRelationship (与产品关联),",
      "   visualElements (可用视觉元素 array), compositionStyle (构图风格), lightingAndColor (光线与色调),",
      "   propsAndEnvironment (道具环境 array), usageScenario (使用场景).",
      "   fileName must match the associated image file name exactly.",
    );
  }

  basePrompt.push(
    "",
    "Return exactly this JSON shape:",
    requiredJsonShape,
  );

  if (hasAssociatedImages) {
    basePrompt.push(
      "",
      "Also include associatedImageContexts array:",
      `"associatedImageContexts": [{ "index": 0, "fileName": "string", "sceneDescription": "中文描述", "productRelationship": "中文描述", "visualElements": ["string"], "compositionStyle": "string", "lightingAndColor": "string", "propsAndEnvironment": ["string"], "usageScenario": "string" }]`,
    );
  }

  return basePrompt.join("\n");
}

// ==================== 知识库约束分析提示词 ====================

interface KnowledgeEntrySummary {
  category: string;
  title: string;
  content: string;
}

const categoryLabels: Record<string, string> = {
  BRAND_INFO: "品牌信息",
  SELLING_POINT: "核心卖点",
  SPECIFICATION: "产品规格",
  MATERIAL: "材质/原料",
  TARGET_AUDIENCE: "目标人群",
  USAGE_SCENARIO: "使用场景",
  OTHER: "其他",
};

/**
 * 构建带产品知识库约束的分析提示词
 * 
 * 核心原则：
 * 1. 知识库条目是"地面真相"，图片仅用于视觉确认
 * 2. AI 不得输出与知识库矛盾的信息
 * 3. 仅对主体图（MAIN）分析，不使用关联图
 */
export function buildKnowledgeConstrainedAnalysisPrompt(
  mainAssets: ProductAsset[],
  knowledgeEntries: KnowledgeEntrySummary[],
) {
  const assetSummary = mainAssets.length > 0
    ? [
        "=== PRODUCT IMAGE (产品图 - 仅用于视觉确认) ===",
        mainAssets.map((a, i) => `${i + 1}. type=${a.type}; file=${a.fileName}`).join("\n"),
      ].join("\n")
    : "No product image available.";

  // 按 category 分组组织知识条目
  const grouped = new Map<string, KnowledgeEntrySummary[]>();
  for (const entry of knowledgeEntries) {
    const existing = grouped.get(entry.category) ?? [];
    existing.push(entry);
    grouped.set(entry.category, existing);
  }

  const knowledgeBlocks: string[] = [];
  for (const [category, entries] of grouped) {
    const label = categoryLabels[category] ?? category;
    knowledgeBlocks.push(`### ${label}`);
    for (const entry of entries) {
      knowledgeBlocks.push(`- ${entry.title}: ${entry.content}`);
    }
    knowledgeBlocks.push("");
  }

  return [
    "You are a senior e-commerce product strategist and detail-page planner.",
    "",
    "=== CRITICAL: KNOWLEDGE-BASE-CONSTRAINED ANALYSIS MODE ===",
    "You are provided with a product knowledge base that contains verified, structured information about this product.",
    "The knowledge base entries below are GROUND TRUTH (地面真相). You MUST treat them as the primary source of truth.",
    "",
    "RULES (违反任一规则即为分析失败):",
    "1. **知识库优先**: All factual product attributes (品名、品牌、品类、规格、材质、卖点、人群、场景) MUST come from the knowledge base below. Do NOT override or contradict any knowledge base entry.",
    "2. **图片仅作视觉确认**: The product main image is provided ONLY for visual reference (confirming colors, style, visual elements). Do NOT extract factual product attributes from the image if they contradict the knowledge base.",
    "3. **禁止编造**: If the knowledge base does not contain a specific attribute, you may infer a reasonable value from the product context — but NEVER fabricate something that contradicts known facts.",
    "4. **所有字段必填**: Every required key in the output schema must have a non-empty value. Infer from knowledge base context when a specific field is missing.",
    "5. **仅输出 JSON**: Return one strict JSON object only. No markdown, no code fences, no explanations.",
    "6. **简体中文**: All string values must be in Simplified Chinese.",
    "",
    "=== PRODUCT KNOWLEDGE BASE (地面真相) ===",
    ...knowledgeBlocks,
    "=== END KNOWLEDGE BASE ===",
    "",
    assetSummary,
    "",
    "Required rules:",
    "1. Every required key must exist.",
    "2. Every array field must be an array of short Chinese strings.",
    "3. suggestedSectionPlan must contain at least 6 sections.",
    `4. suggestedSectionPlan.type must be one of: ${supportedSectionTypes}.`,
    "5. Focus on e-commerce conversion, visual hierarchy, and section planning.",
    "6. coreSellingPoints and differentiationPoints MUST be derived from the knowledge base selling points and product specs — NOT invented.",
    "7. usageScenarios and targetAudience MUST be derived from the knowledge base entries — NOT guessed from thin air.",
    "",
    "Return exactly this JSON shape:",
    requiredJsonShape,
  ].join("\n");
}

// ==================== 原有修复提示词 ====================

export function buildProductAnalysisRepairPrompt(raw: string) {
  return [
    "You repair malformed product-analysis output into one strict JSON object.",
    "Return JSON only. No markdown, no explanations, no extra keys.",
    "All string values should be in Simplified Chinese when possible.",
    "If a field is missing, infer a reasonable non-empty value from the source content.",
    "If suggestedSectionPlan is missing or too short, create at least 6 valid sections.",
    `Valid section types: ${supportedSectionTypes}.`,
    "",
    "Target JSON shape:",
    requiredJsonShape,
    "",
    "Source content to repair:",
    raw,
  ].join("\n");
}
