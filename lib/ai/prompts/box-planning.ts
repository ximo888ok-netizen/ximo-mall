import type { BoxAnalysisOutput } from "@/lib/ai/schemas/box-analysis";

function buildStyleDesc(style: string) {
  const map: Record<string, string> = {
    "minimal-modern": "简约现代 — 简洁线条、大面积留白、中性色调、现代感字体",
    "luxury": "奢华高端 — 金色点缀、精致工艺、高级材质、烫金烫银效果",
    "vintage": "复古怀旧 — 做旧纹理、经典衬线字体、温暖色调",
    "tech": "科技感 — 未来感线条、几何图形、冷色调、金属质感",
    "natural": "自然环保 — 绿色系、木纹、自然元素",
    "cute": "清新可爱 — 柔和色系、圆润元素、手绘插画风格",
    "guochao": "国潮风格 — 中国传统元素、现代设计语言、东方美学",
    "festive": "节日限定 — 节日元素、喜庆配色",
  };
  return map[style] ?? style;
}

function buildMaterialDesc(material: string) {
  const map: Record<string, string> = {
    "coated-paper": "铜版纸 — 表面光滑、色彩鲜艳",
    "white-card": "白卡纸 — 坚挺洁白、通用性强",
    "kraft-paper": "牛皮纸 — 自然棕色、环保质感",
    "specialty-paper": "特种纸 — 独特纹理、高级手感",
    "corrugated": "瓦楞纸 — 厚实坚固",
    "gold-card": "金卡/银卡 — 金属光泽、奢华感",
  };
  return map[material] ?? material;
}

export function buildBoxPlanningPrompt(params: {
  analysis: BoxAnalysisOutput;
  boxType: string;
  boxDimensions: { width: number; height: number; depth: number };
  material: string;
  finish: string;
  style: string;
  primaryColor: string;
  secondaryColors: string[];
  fontStyle: string;
  customInstruction: string;
}) {
  const a = params.analysis;
  const finishText = params.finish ? `工艺：${params.finish}` : "";

  const w = params.boxDimensions.width;
  const h = params.boxDimensions.height;
  const d = params.boxDimensions.depth;

  return [
    "You are a packaging design strategist and visual prompt engineer. Your task is to generate ONE comprehensive visualPrompt for a complete packaging dieline/structure diagram (刀版图/包装结构图).",
    "",
    "=== CRITICAL: This is a DIELINE/STRUCTURE DIAGRAM ===",
    "The output must be a COMPLETE packaging dieline展开图 — all faces laid out flat in a single image, with dimension annotations, fold lines, and all design elements. This is NOT individual faces, NOT a 3D render, NOT a product photo.",
    "",
    "Reference: The dieline should look like a professional packaging design file, with:",
    "- All faces arranged in standard dieline layout (like the example image provided by the user)",
    "- Dimension annotations (尺寸标注) showing actual measurements in cm/mm",
    "- Dashed lines for fold lines (折叠线)",
    "- Solid lines for cut lines (裁切线)",
    "- All design content on each face (brand, product name, ingredients, nutrition table, barcode, etc.)",
    "",
    "=== PRODUCT ANALYSIS ===",
    `Product: ${a.productName}`,
    `Brand: ${a.brandInferred}`,
    `Category: ${a.productCategory} > ${a.subcategory}`,
    `Specs: ${a.specifications}`,
    `Slogan: ${a.slogan}`,
    `Selling points: ${a.coreSellingPoints.join(" | ")}`,
    `Description: ${a.productDescription}`,
    `Visual elements: ${a.visualElements.join(", ")}`,
    `Color palette: ${a.colorPalette.join(", ")}`,
    "",
    "=== PACKAGING CONFIGURATION ===",
    `Box type: ${params.boxType}`,
    `Box dimensions (user input = front face): ${w}(长) × ${h}(宽) × ${d}(深) cm`,
    `Face dimensions derived from above:`,
    `  Front/Back: ${w} × ${h} cm (长×宽)`,
    `  Side: ${d} × ${h} cm (深×宽)`,
    `  Top/Bottom: ${w} × ${d} cm (长×深)`,
    `Material: ${buildMaterialDesc(params.material)}`,
    ...(finishText ? [finishText] : []),
    "",
    "=== VISUAL DESIGN ===",
    `Style: ${buildStyleDesc(params.style)}`,
    `Primary color: ${params.primaryColor}`,
    `Secondary colors: ${params.secondaryColors.join(", ")}`,
    `Font style: ${params.fontStyle}`,
    ...(params.customInstruction ? [`\n=== USER CUSTOM INSTRUCTION ===\n${params.customInstruction}`] : []),
    "",
    "=== YOUR TASK ===",
    "Generate ONE visualPrompt for the COMPLETE packaging dieline展开图. This single prompt will be fed to an image generation AI to produce the entire dieline in one shot.",
    "",
    "The visualPrompt MUST include:",
    "",
    "1. **2D FLAT DESIGN CONSTRAINTS** (at the beginning):",
    '   "Flat 2D packaging dieline展开图 on pure white background. This is a graphic design file for printing, NOT a 3D render, NOT a photograph. NO 3D box, NO perspective, NO shadows, NO depth, NO lighting effects. Think Adobe Illustrator output."',
    "",
    "1.5. **REALISTIC STYLE CONSTRAINTS** (CRITICAL):",
    '   "Design style MUST be REALISTIC and PROFESSIONAL, like actual commercial packaging design. NO anime style, NO cartoon style, NO illustration style, NO hand-drawn style, NO manga style. Use realistic product photography style for main visuals. Use professional typography and layout like real packaging. Colors and textures should look like actual printed packaging materials."',
    "",
    "2. **DIELINE LAYOUT STRUCTURE**:",
    `   The dieline must show all faces arranged in standard folding box dieline pattern:`,
    `   - Front face: ${w}cm × ${h}cm (长×宽)`,
    `   - Back face: ${w}cm × ${h}cm (长×宽)`,
    `   - Side faces (×2): ${d}cm × ${h}cm (深×宽)`,
    `   - Top face: ${w}cm × ${d}cm (长×深)`,
    `   - Bottom face: ${w}cm × ${d}cm (长×深)`,
    `   - Glue flaps (粘口): ~1-1.5cm on one side`,
    `   - Dashed lines for fold lines, solid lines for cut lines`,
    "",
    "3. **DIMENSION ANNOTATIONS** (尺寸标注):",
    `   - Must show dimension lines with measurements: ${w}cm, ${h}cm, ${d}cm`,
    "   - Dimension lines should be outside the dieline with arrows",
    "   - All measurements must match the user-provided dimensions EXACTLY",
    "",
    "4. **DESIGN CONTENT ON EACH FACE**:",
    "   Front face:",
    `   - Brand logo/name: "${a.brandInferred}" prominent at top or top-left`,
    `   - Product name: "${a.productName}" as the main headline, large font`,
    `   - Slogan: "${a.slogan}" below product name`,
    `   - Product illustration: stylized product graphic occupying 50-60% area`,
    `   - Selling point badges: ${a.coreSellingPoints.slice(0, 3).map((s) => `"${s}"`).join(", ")}`,
    `   - Primary color ${params.primaryColor} as background or dominant area`,
    "",
    "   Back face:",
    `   - Brand logo (small)`,
    `   - Product name`,
    "   - Full ingredient/component list (precise table, neat rows)",
    "   - Nutrition facts table (grid aligned)",
    "   - Barcode area",
    "   - Production info: date, shelf life, license number",
    "   - QR code / website area",
    "",
    "   Side faces:",
    `   - Smaller brand logo continuation`,
    `   - Product name (medium font)`,
    "   - Brief product description",
    "   - Decorative pattern continuing from front, simpler",
    "",
    "   Top/Bottom faces:",
    `   - Brand logo centered`,
    `   - Product name`,
    "   - Clean decorative pattern",
    "",
    "5. **NEGATIVE CONSTRAINTS** (at the end):",
    '   "NEGATIVE: 3D box, perspective, shadows, drop shadow, product photography, realistic photo, lighting effects, reflections, depth of field, 3D render, photorealistic box"',
    "",
    "=== OUTPUT FORMAT ===",
    "Return strictly valid JSON with this shape:",
    '{',
    '  "visualPrompt": "detailed English prompt for image generation AI describing the COMPLETE dieline展开图 with all faces, dimension annotations, fold lines, and design content",',
    '  "layoutNotes": "刀版图布局说明 in Chinese, describing the arrangement of faces and key design decisions"',
    '}',
    "",
    "=== CRITICAL RULES ===",
    "- visualPrompt must describe the ENTIRE dieline as ONE image, NOT individual faces",
    "- visualPrompt must be in English (better for image generation models)",
    "- layoutNotes must be in Simplified Chinese",
    "- visualPrompt MUST start with 2D flat design constraints and end with negative constraints",
    `- Dimension annotations MUST show the EXACT measurements: ${w}cm, ${h}cm, ${d}cm`,
    "- The dieline layout must follow standard folding box展开图 pattern",
  ].join("\n");
}
