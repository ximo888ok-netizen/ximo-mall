export interface BoxPromptParams {
  productName: string;
  brandName: string;
  productCategory: string;
  productDimensions?: { width: number; height: number; depth: number };
  boxType: string;
  boxDimensions: { width: number; height: number; depth: number };
  material: string;
  finish: string;
  style: string;
  primaryColor: string;
  secondaryColors: string[];
  fontStyle?: string;
  slogan?: string;
  sellingPoints: string[];
  productDescription: string;
  specifications?: string;
  customInstruction?: string;
}

function buildStyleDescription(style: string) {
  const map: Record<string, string> = {
    "minimal-modern": "简约现代 — 简洁线条、大面积留白、中性色调、现代感字体",
    "luxury": "奢华高端 — 金色点缀、精致工艺、高级材质、烫金烫银效果",
    "vintage": "复古怀旧 — 做旧纹理、经典衬线字体、温暖色调、手工艺感",
    "tech": "科技感 — 未来感线条、几何图形、冷色调、金属质感",
    "natural": "自然环保 — 绿色系、木纹、自然元素、环保材料质感",
    "festive": "节日限定 — 节日元素、喜庆配色、礼盒氛围",
    "guochao": "国潮风格 — 中国传统元素、现代设计语言、东方美学",
    "cute": "清新可爱 — 柔和色系、圆润元素、手绘插画风格",
  };
  return map[style] ?? style;
}

function buildMaterialDescription(material: string) {
  const map: Record<string, string> = {
    "coated-paper": "铜版纸 — 表面光滑、色彩鲜艳、适合精美印刷",
    "kraft-paper": "牛皮纸 — 自然棕色、环保质感、复古风格",
    "specialty-paper": "特种纸 — 独特纹理、高级手感、个性化",
    "white-card": "白卡纸 — 坚挺洁白、印刷效果好、通用性强",
    "corrugated": "瓦楞纸 — 厚实坚固、缓冲保护、适合运输包装",
    "gold-card": "银卡纸/金卡纸 — 金属光泽、奢华感、礼品包装",
  };
  return map[material] ?? material;
}

function buildFinishDescription(finish: string) {
  if (!finish) return "";
  const map: Record<string, string> = {
    "gloss-lamination": "覆光膜 — 表面光亮、色彩鲜艳",
    "matte-lamination": "覆哑膜 — 高级哑光、手感细腻",
    "hot-stamping": "烫金/烫银 — 金属光泽、奢华质感",
    "uv-spot": "局部UV — 局部光亮、层次丰富",
    "embossing": "压纹/凹凸 — 触感精致、高端",
  };
  const items = finish.split(",").map((f) => map[f.trim()] ?? f.trim()).filter(Boolean);
  return items.length > 0 ? `工艺效果：${items.join("、")}` : "";
}

function buildProductDimensionsText(dims?: { width: number; height: number; depth: number }) {
  if (!dims || (!dims.width && !dims.height && !dims.depth)) return "";
  return `产品尺寸：长 ${dims.width}cm × 宽 ${dims.height}cm × 高 ${dims.depth}cm`;
}

function buildBoxDimensionsText(dims: { width: number; height: number; depth: number }) {
  return `包装盒尺寸：长 ${dims.width}cm × 宽 ${dims.height}cm × 深 ${dims.depth}cm（用户输入=正面长×宽，其余面尺寸由此推导）`;
}

/**
 * 构建刀版图生成提示词（整张展开图）
 */
export function buildBoxDielinePrompt(params: BoxPromptParams) {
  const w = params.boxDimensions.width;
  const h = params.boxDimensions.height;
  const d = params.boxDimensions.depth;

  return [
    "Generate a COMPLETE packaging dieline展开图 (刀版结构图) — a professional graphic design file showing ALL faces of the packaging box laid out flat in a single image. This is what a packaging designer creates in Adobe Illustrator — a flat artwork file ready for printing.",
    "",
    "=== CRITICAL: 2D FLAT DESIGN ===",
    "- Output MUST be a flat 2D dieline layout on pure white background (#FFFFFF)",
    "- This is a graphic design file, NOT a photograph, NOT a 3D render, NOT a product photo",
    "- NO 3D box, NO perspective, NO shadows, NO depth, NO lighting effects, NO reflections",
    "- Think Adobe Illustrator output — a flat artwork file for printing",
    "",
    "=== CRITICAL: REALISTIC STYLE ===",
    "- Design style MUST be REALISTIC and PROFESSIONAL, like actual commercial packaging design",
    "- NO anime style, NO cartoon style, NO illustration style, NO hand-drawn style",
    "- Use realistic product photography style for main visuals",
    "- Use professional typography and layout like real packaging",
    "- Colors and textures should look like actual printed packaging materials",
    "",
    "=== 产品信息 ===",
    ...(params.brandName ? [`品牌名称：${params.brandName}`] : []),
    `产品名称：${params.productName}`,
    ...(params.productCategory ? [`产品品类：${params.productCategory}`] : []),
    ...(params.slogan ? [`品牌 Slogan：${params.slogan}`] : []),
    "",
    "=== 设计规格 ===",
    `盒型结构：${params.boxType}`,
    buildBoxDimensionsText(params.boxDimensions),
    `材质：${buildMaterialDescription(params.material)}`,
    ...(buildFinishDescription(params.finish) ? [buildFinishDescription(params.finish)] : []),
    "",
    "=== 视觉设计 ===",
    `设计风格：${buildStyleDescription(params.style)}`,
    `主色调：${params.primaryColor}`,
    ...(params.secondaryColors.length > 0 ? [`辅助色：${params.secondaryColors.join("、")}`] : []),
    ...(params.fontStyle ? [`字体风格：${params.fontStyle}`] : []),
    "",
    "=== 刀版布局结构 ===",
    "The dieline must show all faces arranged in standard folding box展开图 pattern:",
    "",
    "┌─────────────────────────────────────────────────────────┐",
    "│  顶面 Top: " + w + "cm × " + d + "cm (长×深)                          │",
    "├──────────┬──────────┬────────────────────┬──────────┬──────────┤",
    "│ 左翼     │ 左侧面   │ 正面 Front         │ 右侧面   │ 右翼     │",
    "│ (粘口)   │ Side     │ " + w + "cm × " + h + "cm        │ Side     │ (粘口)   │",
    "│ ~1.5cm   │ " + d + "×" + h + "cm  │ (长×宽)            │ " + d + "×" + h + "cm  │ ~1.5cm   │",
    "├──────────┴──────────┴────────────────────┴──────────┴──────────┤",
    "│  底面 Bottom: " + w + "cm × " + d + "cm (长×深)                        │",
    "├─────────────────────────────────────────────────────────┤",
    "│  背面 Back: " + w + "cm × " + h + "cm (长×宽)                           │",
    "─────────────────────────────────────────────────────────",
    "",
    "=== 尺寸标注 (Dimension Annotations) ===",
    "CRITICAL: The dieline MUST include dimension lines with EXACT measurements:",
    `- ${w}cm (长/Length) — shown on front/back faces`,
    `- ${h}cm (宽/Width) — shown on front/back faces`,
    `- ${d}cm (深/Depth) — shown on side faces`,
    "Dimension lines should be outside the dieline with arrows, showing the measurements clearly.",
    "",
    "=== 各面设计内容 ===",
    "",
    "【正面 Front — 核心主视觉面】",
    ...(params.brandName ? [`- 品牌 Logo：**${params.brandName}** — 左上角或顶部居中，清晰突出`] : []),
    `- 产品名称：**${params.productName}** — 大号字体，视觉焦点`,
    ...(params.slogan ? [`- 品牌 Slogan：**${params.slogan}** — 副标题级字号`] : []),
    ...(params.sellingPoints.length > 0 ? [`- 核心卖点标签：${params.sellingPoints.map((s) => "**" + s + "**").join("、")} — 醒目的标签/徽章样式`] : []),
    "- 产品主视觉图 — 占据正面 50-60% 区域的产品展示图",
    ...(params.specifications ? [`- 规格信息：${params.specifications} — 底部小字`] : []),
    `- 主色调 ${params.primaryColor} 作为背景或大面积底色`,
    "",
    "【背面 Back — 产品信息面】",
    ...(params.brandName ? [`- 品牌 Logo：**${params.brandName}** — 小尺寸`] : []),
    `- 产品名称：**${params.productName}**`,
    "- 配料表 / 成分表区域（文字排列整齐）",
    "- 营养成分表区域（表格形式，行列对齐）",
    "- 条形码位置（标准条形码区域）",
    "- 生产信息区域：生产日期、保质期、生产许可编号等",
    "- 品牌官网 / 二维码位置",
    "- 文字最小字号不低于 6pt，技术参数表格化展示",
    "",
    "【侧面 Side × 2 — 品牌延伸面】",
    ...(params.brandName ? [`- 品牌 Logo：**${params.brandName}** — 小尺寸延续`] : []),
    `- 产品名称：**${params.productName}** — 中号字体`,
    "- 装饰性图案/纹理 — 延续正面风格但更简洁",
    "- 信息密度低于正面，偏品牌形象展示",
    "",
    "【顶面 Top — 品牌展示面】",
    ...(params.brandName ? [`- 品牌 Logo：**${params.brandName}** — 居中`] : []),
    `- 产品名称：**${params.productName}**`,
    "- 装饰纹理/图案 — 从正面风格延续",
    "- 构图简洁，居中或对称布局",
    "",
    "【底面 Bottom — 补充信息面】",
    "- 产品条码 / 防伪标识位置",
    "- 生产厂商信息",
    "- 环保标识 / 认证标识",
    "- 简洁排版，与整体风格统一",
    "",
    "=== 刀版线型要求 ===",
    "- Dashed lines (虚线) for fold lines (折叠线) — between faces",
    "- Solid lines (实线) for cut lines (裁切线) — outer boundary",
    "- Thin lines for dimension annotations (尺寸标注线)",
    "- All lines should be crisp and professional",
    "",
    "=== Quality Requirements ===",
    "- MUST be flat 2D design on pure white background, like a印刷设计文件",
    "- NO 3D effects, NO perspective distortion, NO立体感, NO光影渲染",
    "- Text must be clear, readable, professionally typeset with clear hierarchy",
    "- Colors accurate, no oversaturation",
    "- No AI artifacts, no cheap合成感",
    `- Dimension annotations MUST show EXACT measurements: ${w}cm, ${h}cm, ${d}cm`,
    "- Output ONLY the dieline layout, no explanatory text",
    "",
    "=== NEGATIVE PROMPT ===",
    "3D box, perspective, shadows, drop shadow, ambient occlusion, product photography, realistic photo, lighting effects, highlights, reflections, depth of field, volumetric light, studio lighting, scene background, table surface, shelf, 3D render, CGI render, photorealistic box, box on surface, box with shadow",
    "",
    ...(params.customInstruction ? [
      "=== 用户自定义指令（最高优先级）===",
      params.customInstruction,
      "",
    ] : []),
  ].join("\n");
}
