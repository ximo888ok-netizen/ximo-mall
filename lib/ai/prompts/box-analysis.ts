export function buildBoxAnalysisPrompt(params: {
  productName: string;
  brandName: string;
  productCategory: string;
}) {
  return [
    "You are a senior e-commerce product strategist specializing in packaging design. Your task is to deeply analyze the provided product image and extract structured information for packaging design purposes.",
    "",
    "=== USER PROVIDED CONTEXT ===",
    ...(params.brandName ? [`Brand name: ${params.brandName}`] : []),
    `Product name: ${params.productName}`,
    ...(params.productCategory ? [`Category: ${params.productCategory}`] : []),
    "",
    "=== ANALYSIS TASK ===",
    "Analyze the product image carefully. Based on visual evidence from the image, combined with the user-provided context, extract or infer the following structured information. All copy should be in Simplified Chinese.",
    "",
    "1. productName: Refine from user input — the full product display name suitable for packaging",
    "2. productCategory: Classify into a specific sub-category",
    "3. subcategory: Finer classification within the category",
    "4. specifications: Net weight, volume, count, or other quantitative specs visible on or inferable from the product",
    "5. coreSellingPoints: 3-5 compelling selling points. Each should be a complete sentence ready for packaging use. Must be factual — only state claims that are visually supported or reasonably inferred",
    "6. productDescription: A 2-3 sentence product description suitable for the back of the box. Describe what the product is, key ingredients/materials, and the core value proposition",
    "7. targetAudience: Who would buy this? Describe in natural Chinese (e.g., '追求品质生活的年轻白领')",
    "8. usageScenarios: When and where would people use this? (e.g., '早餐时间', '下午茶')",
    "9. brandInferred: If the user didn't provide a brand, infer a suitable brand name from the product category and style",
    "10. visualElements: What visual elements, icons, illustrations would suit this product on packaging? (e.g., '番茄', '意面', '热气')",
    "11. colorPalette: Recommended 3-5 hex colors for packaging, derived from the product image's dominant colors (e.g., '#E64A19')",
    "12. slogan: A catchy brand slogan in Chinese (8-12 characters), suitable for the front of the package",
    "",
    "=== CRITICAL RULES ===",
    "- DO NOT fabricate specifications. If not visible, use reasonable estimates based on product type. Mark estimates with '(约)'",
    "- DO NOT invent health claims, certifications, or awards",
    "- Selling points must be marketing-ready — punchy, benefit-driven, consumer-facing",
    "- All output text must be in Simplified Chinese except for hex color codes",
    "- Return ONLY valid JSON matching the output schema. No markdown, no commentary.",
  ].join("\n");
}
