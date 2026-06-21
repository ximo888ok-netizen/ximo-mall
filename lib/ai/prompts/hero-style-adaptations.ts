import type { ProductAnalysisOutput } from "@/lib/ai/schemas/product-analysis";

type HardConstraintStyling = {
  packagingPresentation: string;
  headlineSystem: string;
  sideSellingPointBar: string;
  bottomBanner: string;
  badgeSystem: string;
  ingredientVisualization: string;
  seasoningPacket: string;
  colorScheme: string;
  brandInfo: string;
};

type HeroStyleAdaptation = {
  composition: string;
  subjectTreatment: string;
  titleStyle: string;
  marketingElements: string;
  atmosphere: string;
  forbidden: string;
  flavorNotes: string;
  hardConstraintStyling: HardConstraintStyling;
};

type FlavorProfile = "spicy" | "sweet_sour" | "savory" | "mild" | "unknown";

interface FlavorGuidance {
  profile: FlavorProfile;
  headlineExamples: string[];
  badgeExamples: string[];
  iconExamples: string[];
  atmosphereElements: string[];
  forbiddenWords: string[];
}

/**
 * 根据产品分析结果推断口味特征
 * 与 planning.ts / generation.ts 中的逻辑保持一致
 */
function detectFlavorProfile(analysis: ProductAnalysisOutput): FlavorGuidance {
  const text = `${analysis.productName} ${analysis.category} ${analysis.subcategory} ${analysis.coreSellingPoints.join(" ")} ${analysis.styleTags.join(" ")}`.toLowerCase();

  const hasSpicy = /辣|火鸡|椒|麻辣|香辣|爆辣|劲辣|酸辣|泡椒|红油| spicy|hot\b/.test(text);
  const hasSweetSour = /番茄|酸甜|柠檬|果香|糖醋|甜酸| sweet.sour|tomato/.test(text);
  const hasMild = /清淡|轻食|健康|低脂|蔬菜|素|清爽| light|healthy|low.fat/.test(text);
  const hasSavory = /鲜|香|浓|骨汤|肉酱|芝士|奶香|醇厚| savory|rich/.test(text);

  if (hasSpicy) {
    return {
      profile: "spicy",
      headlineExamples: ["爆辣劲爽", "一口入魂", "辣得过瘾", "火辣翻倍"],
      badgeExamples: ["爆辣", "超辣过瘾", "辣得上头"],
      iconExamples: ["🌶️爆辣够劲", "🥩肉酱量足", "🍜面条弹牙"],
      atmosphereElements: ["火焰特效", "干辣椒飞散", "红色光晕", "辣感粒子"],
      forbiddenWords: ["酸甜", "清淡", "鲜香"],
    };
  }

  if (hasSweetSour) {
    return {
      profile: "sweet_sour",
      headlineExamples: ["酸甜浓郁", "一口入魂", "鲜香开胃", "经典好味"],
      badgeExamples: ["酸甜", "浓郁", "经典"],
      iconExamples: ["🍅酸甜浓郁", "🥩肉酱量足", "🍜面条弹牙"],
      atmosphereElements: ["番茄红渐变背景", "新鲜番茄点缀", "温暖阳光感", "酱汁光泽"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
    };
  }

  if (hasMild) {
    return {
      profile: "mild",
      headlineExamples: ["清爽鲜香", "一口入魂", "健康好味", "轻食首选"],
      badgeExamples: ["清爽", "健康", "轻食"],
      iconExamples: ["🥬清爽健康", "🍜面条弹牙", "🌿真材实料"],
      atmosphereElements: ["明亮自然光", "绿色蔬菜点缀", "清新木质背景", "健康感"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣", "重口味"],
    };
  }

  if (hasSavory) {
    return {
      profile: "savory",
      headlineExamples: ["鲜香浓郁", "一口入魂", "肉香四溢", "汤浓面劲"],
      badgeExamples: ["鲜香", "浓郁", "肉香"],
      iconExamples: ["🥩肉酱量足", "🍜面条弹牙", "🌾真材实料"],
      atmosphereElements: ["浓郁酱汁光泽", "肉酱颗粒特写", "暖色聚光灯", "蒸汽升腾"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
    };
  }

  return {
    profile: "unknown",
    headlineExamples: ["一口入魂", "鲜香好味", "料足味美", "经典好味"],
    badgeExamples: ["经典", "好味", "精选"],
    iconExamples: ["🍜面条弹牙", "🥩肉酱量足", "🌾真材实料"],
    atmosphereElements: ["暖色聚光灯", "蒸汽升腾", "食欲感背景"],
    forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
  };
}

/**
 * 所有风格共享的「主图硬约束清单」提示
 */
function buildQualityFloor(): string {
  return [
    "=== HERO HARD CONSTRAINT CHECKLIST (主图硬约束清单 — 任何风格都不可突破) ===",
    "The visualPrompt for EVERY hero image MUST be a finished, premium, commercially publishable poster. The following are MANDATORY elements — their VISUAL STYLE (color/font/material/shape/layout) is determined by the selected style, but their PRESENCE is NOT negotiable.",
    "",
    "FOR hero_01 (PRIMARY / 主图) — ALL 10 hard constraints MUST be explicitly present in the visualPrompt:",
    "[ ] HC1 — 100% INFO DENSITY: No blank/empty zones anywhere in the frame. Every corner (top-left, top-right, bottom-left, bottom-right) and every edge must contain visual or text content.",
    "[ ] HC2 — DUAL SUBJECTS: Both (a) product packaging (bag/box/bowl) in 3D perspective AND (b) finished food hero shot must appear in the same frame.",
    "[ ] HC3 — 3-LAYER HEADLINE SYSTEM: (A) brand name+Logo at top, (B) large main headline 6-12 characters + 1-line sub-headline/slogan, (C) top selling-point capsule strip with 2-3 tags.",
    "[ ] HC4 — SIDE SELLING-POINT BAR: Left OR right side must have 4-5 icon+text selling-point tags, each with its own small icon.",
    "[ ] HC5 — HIGH-CONTRAST BOTTOM BANNER: A strong-contrast horizontal banner/tag band across the bottom containing 3-4 core selling-point keywords.",
    "[ ] HC6 — BADGE SYSTEM: At least 3 badges/corner tags in different positions (e.g. headline-side tag, bottom-right trust badge, corner promo/identity badge).",
    "[ ] HC7 — INGREDIENT VISUALIZATION: 5-8 real food ingredients/garnishes scattered around the product (noodle bundles, egg, vegetables, meat, spices).",
    "[ ] HC8 — SEASONING PACKET DISPLAY: 1-2 seasoning packets (broth/sauce/powder) must be shown as independent visual elements.",
    "[ ] HC9 — STRONG COLOR ZONING: The whole image must have a clear 2-3 color palette with visible color blocks dividing the frame (background/banner/product zones).",
    "[ ] HC10 — COMPLETE BRAND INFO: Brand Logo, brand name, product name, and net weight/specs must be visually present (at least 3 of these 4).",
    "",
    "FOR hero_02-05 (SECONDARY / 副图) — at least 6 of the 10 hard constraints MUST be explicitly present, and the overall visual density must be ≥80% of hero_01. Each secondary hero must still look like a finished commercial poster with zero large empty zones.",
    "",
    "=== STYLE INTERPRETATION RULE (风格化规则) ===",
    "The STYLE ADAPTATION block above defines HOW each hard constraint looks for the selected style. For example:",
    "- street_appetite renders the side selling-point bar as a fiery neon icon strip; minimalist renders it as a thin-line neutral icon strip.",
    "- vintage_chinese renders the bottom banner as an aged-paper scroll; c4d_3d renders it as a glossy 3D ribbon.",
    "- ink_wash renders badges as red seals; cute_cartoon renders badges as cloud/star stickers.",
    "NEVER delete or skip a hard constraint because of style. The style only changes the LOOK, not the EXISTENCE.",
    "",
    "=== UNIVERSAL QUALITY FLOOR (通用美感底线) ===",
    "- The food/subject must occupy 65-75% of the frame — NO tiny-product-in-empty-space compositions.",
    "- Text must be sharp, legible, and properly rendered with correct fonts.",
    "- Lighting must be physically consistent and enhance the product.",
    "- Props and decorative elements must be contextually relevant and intentionally arranged.",
    "- The composition must feel FULL and BALANCED — not lopsided, not chaotic, and NEVER empty or sparse.",
    "- Marketing elements must be professionally integrated, not randomly floating stickers.",
    "Differentiation is required, but NEVER at the cost of these hard constraints.",
  ].join("\n");
}

/**
 * 20种风格的主图差异化指令表
 */
const styleAdaptations: Record<string, HeroStyleAdaptation> = {
  // 摄影写实类
  minimalist: {
    composition: "居中或轻微偏心构图，画面饱满无留白，食物占65-75%作为绝对视觉中心。禁止大面积空白区域，所有角落必须有纹理、阴影或装饰元素填充。",
    subjectTreatment: "白瓷碗装面条，整齐盘绕，酱汁光泽明显，顶部配料丰富。包装作为3D透视品牌徽章放在角落（8-12%），与食物共同构成完整商业画面。",
    titleStyle: "极细无衬线字体或手写细字，小字号，放在画面上方。禁用粗黑边书法字和金属质感字。",
    marketingElements: "极简线框标签，3-4个细线框标签或小圆形数据徽章，顶部横幅+底部标签条，营销元素覆盖20-25%。标签用细线框或半透明小条，但数量必须充足，不能稀疏。",
    atmosphere: "微水泥/浅灰/米白带清晰纹理的背景 + 柔和方向光 + 轻微蒸汽。背景必须有可见材质纹理，禁止平滑纯色渐变。",
    forbidden: "禁止火焰辣椒特效、禁止粗黑边书法字、禁止深色图标条、禁止左右分割、禁止大面积空白。",
    flavorNotes: "辣产品可用 subtle 红椒点缀，但不要火焰特效；非辣产品完全禁用辣椒/火焰。",
    hardConstraintStyling: {
      packagingPresentation: "包装以3D透视小徽章形式放在画面一角，采用纯白/浅灰哑光材质，仅保留简洁品牌LOGO与净含量，占比8-12%，与瓷碗形成材质对比但不抢主体。",
      headlineSystem: "顶部1-2行纤细无衬线或手写细字标题，小字号，字间距宽松，无粗黑边、无金属光泽，与画面留白克制共存。",
      sideSellingPointBar: "画面左侧或右侧竖排4-5个极细线框图标卖点条，图标线条纤细，文字为短词或单字，间距均匀，不使用深色填充背景。",
      bottomBanner: "底部一条细长半透明/低对比横幅，文字信息精炼（如规格、产地），与背景纹理自然融合，不形成强色块。",
      badgeSystem: "3-4个细线圆形或圆角矩形小徽章，内容可为克数、分钟数、原料数，线框极细，禁止促销爆炸贴与3D金属。",
      ingredientVisualization: "5-8件配料精致摆放于碗内与周围（葱花、芝麻、溏心蛋、香草、坚果等），不堆叠，每样都清晰可辨，共同填满画面。",
      seasoningPacket: "独立料包以浅色棉纸袋或透明小袋形式放在碗边/餐具旁，标签极简，与整体清淡调性一致。",
      colorScheme: "米白、浅灰、原木或淡亚麻2-3色主调，低饱和、高明亮，禁止霓虹、火焰红、金属渐变。",
      brandInfo: "角落放置小尺寸品牌LOGO与一句极简slogan，字体纤细，颜色与标题一致，不形成独立 heavy 区块。",
    },
  },

  street_appetite: {
    composition: "左右分割或筷子动态侧拍，食物占55-65%，包装8-12%退居角落。强明暗对比，食物是绝对视觉中心。",
    subjectTreatment: "筷子夹起一大坨面条，酱汁拉丝，肉酱颗粒清晰。包装以3D透视斜放在左下角，仅作身份确认。",
    titleStyle: "金属质感书法字，粗黑边，墨点飞溅，超大标题直接叠在画面上方，作为视觉设计元素。",
    marketingElements: "右上角圆形印章 + 左上角火焰/口味徽章 + 底部深色发光图标条。徽章有3D金属/蜡封质感。",
    atmosphere: "深黑背景 + 暖色聚光灯 + 火焰 + 干辣椒飞散。辣产品强化火焰，非辣产品改用暖色bokeh/蒸汽/食材点缀。",
    forbidden: "禁止留白过多、禁止包装过大超过12%、禁止浅色图标条、禁止标题用独立横幅条。",
    flavorNotes: "街潮风最适配辣产品；非辣产品保留街潮力量感但用对应口味氛围（番茄红/清爽绿/肉香暖棕）。",
    hardConstraintStyling: {
      packagingPresentation: "包装以3D透视斜放在画面一角，暗黑金属/做旧纸盒质感，表面带街头涂鸦或做旧撕边，占比8-12%，强化品牌街头身份。",
      headlineSystem: "顶部1-2行粗黑边金属书法大字，墨点飞溅，字号超大并直接叠压画面上方，作为视觉设计元素而非独立标题条。",
      sideSellingPointBar: "画面右侧竖排4-5个深色发光图标卖点条，图标为火焰、辣椒、闪电、肉块等街头符号，文字短促有力，带霓虹边缘光。",
      bottomBanner: "底部一条深色高对比图标条/横幅，使用霓虹或高亮文字，信息为辣度、份量、价格锚点，与暗背景形成强烈反差。",
      badgeSystem: "≥3个角标：右上角圆形蜡封/金属印章，左上角火焰/口味徽章，另有'爆辣''劲爽'等3D金属徽章，禁止平面小贴。",
      ingredientVisualization: "5-8件配料动态飞散或高堆（辣椒片、芝麻、肉酱、葱花、花生碎、香菜等），营造爆炸式食欲感，不稀疏。",
      seasoningPacket: "独立料包以暗黑金属小袋或街头涂鸦风格小包装呈现，与主包装视觉统一，可带闪电/火焰小图标。",
      colorScheme: "黑、红、金或黑、橙、霓虹青2-3色高对比主调，强调力量感与食欲冲击，禁止淡雅浅色。",
      brandInfo: "品牌LOGO做旧金属质感或街头涂鸦字体，配合'够辣够劲'等街头slogan，占据角落但不小于主标题的30%。",
    },
  },

  realistic_food_photo: {
    composition: "三角形或45°俯拍构图，食物占65-75%作为视觉中心。画面饱满，碗、筷子、小碟、散落配料填满框架，禁止明显空白区。",
    subjectTreatment: "自然光下的一碗面，蛋黄半熟，葱花芝麻清晰，蒸汽自然。配料丰富（5-8件：番茄片、香草、芝麻、油醋汁、筷子等），保留真实感但不空旷。",
    titleStyle: "手写风格或衬线字体，自然融合，字号中等，放在画面顶部或侧边。",
    marketingElements: "木质/纸质标签，3-4个，分布在顶部横幅、角落和底部标签条。禁用3D金属徽章、霓虹标签、促销爆炸贴，但标签数量必须充足。",
    atmosphere: "纹理木质桌面 + 窗户自然光 + 丰富食材散落。背景有真实纹理和浅景深，禁用火焰特效。",
    forbidden: "禁止过度后期、禁止3D金属字、禁止火焰特效、禁止厚重营销边框、禁止大面积空白。",
    flavorNotes: "按真实食物气质处理：辣产品放少许干辣椒；酸甜产品放番茄/柠檬；清淡产品放蔬菜/香草。",
    hardConstraintStyling: {
      packagingPresentation: "包装以自然摆放方式置于桌面一角，保留真实光影与包装材质褶皱，作为品牌身份确认，占比8-12%，不刻意悬浮。",
      headlineSystem: "顶部1-2行手写或衬线标题，字号中等，颜色与食材/木质桌面协调，像手写菜单或食谱标题。",
      sideSellingPointBar: "画面一侧竖排4-5个纸质/木质小标签图标，内容如'手工制''无添加''慢熬汤'，用麻绳、夹子或胶带自然固定。",
      bottomBanner: "底部一条纸质/麻布横幅或木质标签条，文字为克重、份数、产地，字体手写或复古印刷体。",
      badgeSystem: "3-4个纸质圆形/不规则标签，钉在桌面或碗边，内容可为'新鲜''现做''精选'，禁用3D金属与霓虹。",
      ingredientVisualization: "5-8件真实配料自然散落（番茄片、香草、芝麻、油醋汁小碟、筷子、蒜瓣等），每样都有生活感，共同填满画面。",
      seasoningPacket: "独立料包以真实小袋、玻璃瓶或陶瓷小盅形式放在配料中，标签朴素，像厨房日常。",
      colorScheme: "暖棕、米白、食材本色2-3色主调，自然光感，禁止高饱和霓虹、金属渐变、火焰红。",
      brandInfo: "品牌信息以包装LOGO、桌角小卡片或印章形式自然出现，字体质朴，slogan简短生活化。",
    },
  },

  japanese_fresh: {
    composition: "三分法或居中构图，食物占65-75%作为视觉重心，画面饱满无大面积留白。90°或45°俯拍，碗、筷子、小碟、配料共同填满框架。",
    subjectTreatment: "精致面量，溏心蛋、海苔、葱花、芝麻丰富可见，色调清冷。面条整齐，汤汁清澈，配料丰富但不杂乱。",
    titleStyle: "纤细手写体或明朝体，字号中等，放在画面顶部或侧边。颜色柔和（灰、豆绿、米白），禁用粗黑边。",
    marketingElements: "和纸纹理标签/细线标签，3-4个，分布在顶部横幅、角落和底部标签条。禁用促销感文字，但标签数量必须充足，营销覆盖20-25%。",
    atmosphere: "亚麻布/浅色木桌带清晰纹理 + 柔和侧光 + 绿植/食材点缀。整体清冷柔和但画面充实，无火焰、无辣椒飞散。",
    forbidden: "禁止浓墨重彩、禁止金属质感、禁止促销感文字、禁止深色图标条、禁止火焰辣椒、禁止大面积空白。",
    flavorNotes: "与清淡/轻食/酸甜产品最搭；辣产品只能用最克制的辣感提示（如一小撮辣椒粉），不可火焰。",
    hardConstraintStyling: {
      packagingPresentation: "包装以和风纸盒/木盒或清冷淡雅小袋形式放在画面一角，保留木纹/和纸纹理，占比8-12%，与清冷氛围协调。",
      headlineSystem: "顶部1-2行纤细手写体或明朝体标题，颜色柔和（灰、豆绿、米白），字号中等，字距舒展，无粗黑边。",
      sideSellingPointBar: "画面一侧竖排4-5个和纸纹理细线图标卖点条，图标纤细，文字为简短日文风或中文短词，间距均匀。",
      bottomBanner: "底部一条和纸纹理细横幅或亚麻布标签条，文字信息精炼（如'手延製法''本鰹だし'），颜色低饱和。",
      badgeSystem: "3-4个细线圆角徽章或小型朱红印章，内容和风纹样边框，禁用促销爆炸贴与金属质感。",
      ingredientVisualization: "5-8件精致配料（海苔、溏心蛋、葱花、芝麻、笋片、昆布、樱桃番茄、毛豆等），摆放整齐不堆叠，共同填满画面。",
      seasoningPacket: "独立料包以和风小纸包、木盒或清酒小盅形式呈现，标签简洁，强调天然与手作感。",
      colorScheme: "米白、豆绿、浅灰或亚麻2-3色主调，低饱和、高明度，禁止火焰红、霓虹、金属渐变。",
      brandInfo: "品牌信息以小印章式LOGO或竖排slogan形式置于角落，字体纤细，颜色与标题一致，保持克制。",
    },
  },

  premium_product: {
    composition: "居中漂浮感，产品/碗占65-75%作为绝对视觉中心。对称或轻微偏心，画面饱满无留白，倒影板+品牌徽章+装饰线条共同填充画面。",
    subjectTreatment: "每根面条清晰，酱汁均匀，葱花/配料丰富。包装作为3D透视品牌徽章放在角落（8-12%），与食物共同构成完整高端商业画面。",
    titleStyle: "细体大写英文或极简中文，金色/银色，字号中等。标题作为品牌标识，放在画面上方。",
    marketingElements: "金色细线框标签，3-4个，分布在顶部横幅、角落和底部标签条。禁用彩色促销标签、火焰徽章、卡通元素，但标签数量必须充足，营销覆盖20-25%。",
    atmosphere: "纯黑/纯白背景带高级纹理（磨砂/皮革/拉丝金属） + 对称柔光 + 镜面倒影 + 轻微光晕。背景必须有质感，禁止平滑纯色。",
    forbidden: "禁止火焰、禁止手绘涂鸦、禁止密集图标、禁止粗黑边书法字、禁止烟火气氛围、禁止大面积空白。",
    flavorNotes: "辣产品可用深红/金配色暗示；非辣产品走金/银/白高级感。文案和图标保持高端。",
    hardConstraintStyling: {
      packagingPresentation: "包装作为3D透视品牌徽章悬浮或斜放于画面一角，采用金/银/黑高级材质并带镜面倒影，占比8-12%，彰显品牌身份。",
      headlineSystem: "顶部1-2行细体大写英文或极简中文标题，金色/银色，字号中等，字距精致，作为品牌标识出现。",
      sideSellingPointBar: "画面一侧竖排4-5个金色细线框图标卖点条，图标优雅，文字简短高端（如'匠心''甄选''慢熬'），间距均匀。",
      bottomBanner: "底部一条金色细线横幅或黑底金字条，文字精炼（如净含量、获奖信息），与倒影板自然衔接。",
      badgeSystem: "3-4个金色箔片/浮雕质感徽章，分布在顶部、角落，内容为'金选''传承''0添加'等，禁用彩色促销图标。",
      ingredientVisualization: "5-8件精选配料高级摆盘（黑松露片、金箔、香草、鱼子、溏心蛋、芦笋等），每样都精致可控，共同构成高端画面。",
      seasoningPacket: "独立料包以金/银小袋、玻璃瓶装或金属小盅形式呈现，标签极简高端，与主视觉统一。",
      colorScheme: "黑、金、银或白、金、银2-3色高级色主调，低饱和金属光泽，禁止霓虹、火焰红、卡通色。",
      brandInfo: "品牌LOGO以浮雕/烫金形式置于画面上方或角落，配合高级感slogan，信息完整但不喧宾夺主。",
    },
  },

  healthy_light: {
    composition: "90° flat lay 或居中构图，食物和配料丰富排列，食物占65-75%作为视觉中心。画面饱满无大面积留白，碗、配料、餐具、装饰元素共同填满框架。",
    subjectTreatment: "荞麦面/魔芋面 + 鸡胸 + 西兰花 + 樱桃番茄 + 油醋汁 + 坚果/柠檬片。配料丰富（5-8件），强调新鲜、低脂、健康。",
    titleStyle: "清新无衬线字体，绿色/白色，放在顶部或侧边。字号中等偏大，给人轻盈健康感。",
    marketingElements: "圆形数据徽章（卡路里/蛋白质/膳食纤维） + 清新图标条 + 顶部横幅，3-4个标签。禁用重油酱汁渲染和厚重金属字，但标签数量必须充足，营销覆盖20-25%。",
    atmosphere: "浅绿/米白背景带清晰纹理（竹席/亚麻布/浅木纹） + 明亮自然光 + 水珠/薄荷叶。背景必须有可见材质纹理，禁止平滑纯色渐变，无浓厚蒸汽。",
    forbidden: "禁止重油酱汁、禁止火焰、禁止深色厚重背景、禁止爆辣文案、禁止高热量暗示、禁止大面积空白。",
    flavorNotes: "只适配清淡/健康/轻食产品。绝对禁用辣感火焰和重口味文案。",
    hardConstraintStyling: {
      packagingPresentation: "包装以清新透明/环保材质或白色小袋形式放在画面一角，强调天然无负担，占比8-12%，与健康主题一致。",
      headlineSystem: "顶部1-2行清新无衬线标题，绿色或白色，字号中等偏大，字距舒展，给人轻盈健康感。",
      sideSellingPointBar: "画面一侧竖排4-5个圆形数据图标卖点条，内容为卡路里、蛋白质、膳食纤维、低脂、无添加等，图标清新。",
      bottomBanner: "底部一条清新绿色/白色图标条或横幅，文字为健康关键词（如'轻食''0脂''高纤'），与背景纹理协调。",
      badgeSystem: "3-4个圆形营养数据徽章，内容为'低卡''高蛋白''富含膳食纤维'等，颜色清新，禁用重油和火焰图标。",
      ingredientVisualization: "5-8件健康配料丰富排列（鸡胸、西兰花、樱桃番茄、柠檬片、坚果、牛油果、薄荷叶、芝麻等），强调新鲜与低脂。",
      seasoningPacket: "独立料包以清新小袋、玻璃瓶油醋汁或亚麻小布袋形式呈现，标签注明低脂/无添加。",
      colorScheme: "浅绿、米白、白色2-3色主调，明亮自然，禁止深色厚重、火焰红、高饱和促销色。",
      brandInfo: "品牌LOGO以清新字体置于角落，配合'轻食首选''天然健康'等slogan，信息完整且符合健康调性。",
    },
  },

  // 插画艺术类
  guochao_illustration: {
    composition: "中心对称或圆形徽章构图，食物/包装占70-80%。插画化平面布局，弱化真实摄影景深。",
    subjectTreatment: "插画化面条螺旋上升，筷子夹面，芝麻飞散。包装可变成插画主体，线条流畅夸张。",
    titleStyle: "毛笔书法大字，朱红/金色，与祥云纹样融合。标题可环绕或压在产品上方。",
    marketingElements: "金色印章'经典''匠心' + 云纹边框 + 金色箔片质感。禁用现代无衬线促销标签。",
    atmosphere: "朱砂红/藏青背景 + 金色云纹 + 无真实阴影。国潮华丽感，插画化金色粒子。",
    forbidden: "禁止真实摄影光影、禁止极简留白、禁止卡通涂鸦、禁止3D金属霓虹。",
    flavorNotes: "辣产品可用金色火焰纹/辣椒纹装饰；非辣产品用祥云/食材纹装饰。",
    hardConstraintStyling: {
      packagingPresentation: "包装以插画化主体或国潮纹样徽章形式呈现，与祥云/龙纹/海浪融合，占比8-12%，线条流畅夸张。",
      headlineSystem: "顶部1-2行毛笔书法大字，朱红或金色，标题可环绕产品或压在产品上方，与祥云纹样融合。",
      sideSellingPointBar: "画面两侧4-5个云纹边框图标卖点条，图标为国潮符号（龙、凤、祥云、辣椒纹、食材纹），金色描边。",
      bottomBanner: "底部一条金色云纹横幅或卷轴条，文字为'匠心''传承''经典好味'等国潮关键词。",
      badgeSystem: "≥3个金色印章徽章（'经典''匠心''金选'等），另有云纹角标，禁用现代无衬线促销标签。",
      ingredientVisualization: "5-8件配料插画化飞散（芝麻、辣椒、葱花、肉片、花生、香菜等），以金色粒子或国潮线条呈现，不稀疏。",
      seasoningPacket: "独立料包以国潮纹样锦囊/小袋或金色小盅形式呈现，带有传统纹样与书法标签。",
      colorScheme: "朱砂红、藏青、金2-3色主调，华丽饱和但不过于杂乱，禁止霓虹、卡通色、冷白。",
      brandInfo: "品牌名以书法印章或金色题款形式置于画面上方或角落，slogan为国潮风格短句，信息完整。",
    },
  },

  vintage_chinese: {
    composition: "三角形或居中构图，粗陶碗+筷子+小碟，食物占65-75%。30°俯拍或平视，怀旧摄影构图，画面饱满有生活气息，禁止明显空白。",
    subjectTreatment: "老式粗瓷碗装面，面条堆高，萝卜干、黄豆、葱花、卤蛋等配料丰富。保留手工感和岁月痕迹。",
    titleStyle: "做旧活字印刷字体或木刻字体，深棕/暗红色。标题放在画面顶部或侧边，字号中等。",
    marketingElements: "木刻印章 + 毛笔价格牌 + 旧报纸标签，3-4个。禁用现代胶囊标签、霓虹色、3D金属，但标签数量必须充足，营销覆盖20-25%。",
    atmosphere: "泛黄宣纸/粗麻布带清晰纹理 + 侧逆光 + 暖黄怀旧色调。蒸汽自然，有老旧质感，背景必须有材质纹理。",
    forbidden: "禁止现代无衬线字体、禁止霓虹色、禁止3D效果、禁止极简留白、禁止大面积空白。",
    flavorNotes: "适配地方风味/传统口味。辣产品用老式辣椒酱罐；酸甜/清淡产品用对应传统配料。",
    hardConstraintStyling: {
      packagingPresentation: "包装以老式粗陶罐、旧报纸包裹或复古纸袋形式出现，带有岁月痕迹，占比8-12%，强化怀旧感。",
      headlineSystem: "顶部1-2行做旧活字印刷或木刻字体标题，深棕/暗红色，字号中等，像老招牌或旧报纸标题。",
      sideSellingPointBar: "画面一侧竖排4-5个木刻印章式图标卖点条，图标为老式纹样（麦穗、辣椒、卤蛋、碗筷），文字古朴。",
      bottomBanner: "底部一条旧报纸/木板横幅或毛笔价格牌，文字为'老字号''古法''匠心'等传统关键词。",
      badgeSystem: "3-4个木刻印章/毛笔价格牌徽章，内容为'老字号''现做''精选'等，禁用现代胶囊标签与霓虹色。",
      ingredientVisualization: "5-8件传统配料丰富可见（萝卜干、黄豆、葱花、卤蛋、咸菜、香菜、辣椒油、蒜泥等），保留手工感与岁月痕迹。",
      seasoningPacket: "独立料包以老式纸包、陶罐或竹筒形式呈现，标签为手写或木刻印刷风格。",
      colorScheme: "泛黄、深棕、暗红2-3色主调，暖黄怀旧色调，禁止霓虹、金属渐变、冷白。",
      brandInfo: "品牌信息以做旧印章、老招牌或包装上的旧字体呈现，slogan古朴，信息完整。",
    },
  },

  creative_handdrawn: {
    composition: "对角线构图，面条沿对角线方向，真实与手绘拼贴。不对称、有动感、像手账页。",
    subjectTreatment: "一半真实面条 + 一半手绘线条，被一只涂鸦'大手'夹起。可加入对话框、箭头。",
    titleStyle: "手写马克笔字体，彩色，带对话框。活泼、不规则、有手绘飞白。",
    marketingElements: "对话框标签 + 手绘星星/箭头 + 彩色涂鸦。禁用3D金属、严肃徽章。",
    atmosphere: "牛皮纸/素描纸纹理 + 水彩痕迹 + 彩色铅笔屑。无真实火焰，可用手绘火焰涂鸦。",
    forbidden: "禁止3D金属质感、禁止严肃摄影、禁止对称居中、禁止厚重营销边框。",
    flavorNotes: "文案和图标全部手绘化。辣产品画小辣椒涂鸦；非辣产品画番茄/蔬菜/笑脸涂鸦。",
    hardConstraintStyling: {
      packagingPresentation: "包装一半真实一半手绘线条，或被涂鸦'大手'拿着，像手账拼贴，占比8-12%，活泼不规则。",
      headlineSystem: "顶部1-2行手写马克笔字体标题，彩色，带对话框或箭头，字号中等偏大，有手绘飞白。",
      sideSellingPointBar: "画面一侧竖排4-5个手绘对话框/箭头图标卖点条，文字手写，颜色多彩，像手账标注。",
      bottomBanner: "底部一条手绘横幅或彩色胶带条，文字为手写关键词（如'好吃''料足''快煮'），带涂鸦装饰。",
      badgeSystem: "3-4个手绘星星/对话框/箭头徽章，内容为'推荐''爆款''新口味'等，禁用3D金属与严肃徽章。",
      ingredientVisualization: "5-8件配料一半真实一半手绘（番茄、辣椒、蔬菜、笑脸、葱花等），以涂鸦方式飞散或标注。",
      seasoningPacket: "独立料包以手绘小袋形式呈现，旁边带手写标注箭头，强调'秘密酱料'等趣味文案。",
      colorScheme: "牛皮纸、彩色铅笔、水彩2-3色主调（黄、粉、蓝、绿中任选2-3色），活泼手绘感，禁止金属、霓虹。",
      brandInfo: "品牌LOGO以手绘字体或涂鸦印章形式出现，slogan简短有趣，像手账签名。",
    },
  },

  cute_cartoon: {
    composition: "中心构图，食物占60-70%，周围环绕小元素。饱满可爱，像一个儿童食品包装。",
    subjectTreatment: "面条变成笑脸，酱汁变成腮红，碗有卡通眼睛。配料也卡通化（星星蛋、圆点肉粒）。",
    titleStyle: "圆润卡通字体，彩色描边，活泼可爱。字号可较大，颜色明亮。",
    marketingElements: "云朵形状标签 + 小熊徽章 + 彩虹元素。禁用写实火焰、书法字、高端黑金。",
    atmosphere: "明黄/粉蓝背景 + 波点/云朵贴纸 + 毛绒玩具。整体童趣安全，无危险辣感暗示。",
    forbidden: "禁止写实火焰、禁止书法字、禁止高端黑金、禁止重口味文案、禁止复杂3D金属。",
    flavorNotes: "辣产品只能非常温和地暗示（如微笑小辣椒），不可强调'爆辣'。酸甜/清淡/奶香更适配。",
    hardConstraintStyling: {
      packagingPresentation: "包装卡通化，带有圆润边角、卡通眼睛或笑脸，像儿童食品包装，占比8-12%，安全可爱。",
      headlineSystem: "顶部1-2行圆润卡通字体标题，彩色描边，字号较大，颜色明亮，给人活泼可爱感。",
      sideSellingPointBar: "画面一侧竖排4-5个云朵/星星/彩虹图标卖点条，文字圆润，颜色柔和可爱。",
      bottomBanner: "底部一条彩虹色或云朵形状卡通横幅，文字为'好吃''营养''可爱'等童趣关键词。",
      badgeSystem: "3-4个云朵/小熊/星星/彩虹徽章，内容为'宝宝爱''营养''无添加'等，禁用写实火焰、书法字、黑金。",
      ingredientVisualization: "5-8件卡通化配料（星星蛋、圆点肉粒、笑脸蔬菜、彩虹面条、小熊饼干等），共同填满画面。",
      seasoningPacket: "独立料包以卡通小袋/小瓶子形式呈现，带有可爱表情或动物图案。",
      colorScheme: "明黄、粉蓝、粉红或薄荷绿2-3色主调，明亮柔和，禁止深色、火焰红、金属、霓虹。",
      brandInfo: "品牌LOGO以圆润卡通字体或动物形象呈现，slogan简短可爱，符合儿童安全调性。",
    },
  },

  // 促销营销类
  festival_promo: {
    composition: "放射构图，产品/碗在中心，光线向四周放射，占80%。强冲击、高饱和、无留白。",
    subjectTreatment: "包装打开，酱料包飞出，面条被金色光芒环绕。强调促销感和节日氛围。",
    titleStyle: "3D立体促销大字，红金/霓虹渐变，'买一送一''到手价'等。字号巨大，居中顶部。",
    marketingElements: "红包、优惠券、倒计时、购物车图标、价格爆炸框。丰富但必须整齐，不可乱堆。",
    atmosphere: "红金渐变/激光纸/亮片 + 星芒光斑 + 彩色光效。氛围热闹喜庆。",
    forbidden: "禁止极简、禁止留白、禁止冷淡色调、禁止标题单独小字。",
    flavorNotes: "促销风可适配任何口味，但氛围元素要匹配：辣产品加金色辣椒/火焰纹；非辣产品加对应食材装饰。",
    hardConstraintStyling: {
      packagingPresentation: "包装以打开/倾斜/悬浮的促销姿态置于画面中心附近，酱料包/配料向外飞出，金色光芒环绕，占比8-12%。",
      headlineSystem: "顶部1-2行3D立体促销大字，红金/霓虹渐变，字号巨大，居中顶部，直接传达'买一送一''到手价'等信息。",
      sideSellingPointBar: "画面两侧4-5个红包/优惠券/购物车/倒计时图标卖点条，信息为'限时''满减''包邮'等促销关键词。",
      bottomBanner: "底部一条高对比价格爆炸框/倒计时横幅，文字醒目，颜色与红金主题一致，突出促销利益点。",
      badgeSystem: "≥3个促销徽章：红包、优惠券、倒计时、'爆款''热卖'等，3D立体有厚度，排列整齐不杂乱。",
      ingredientVisualization: "5-8件配料在金色光芒中飞散（辣椒片、芝麻、肉酱、葱花、花生、金币状元素等），营造节日丰盛感。",
      seasoningPacket: "独立料包以促销小包装/礼盒装形式呈现，带有节日纹样或'加赠'字样。",
      colorScheme: "红、金、橙2-3色高饱和主调，搭配霓虹渐变，热闹喜庆，禁止冷淡色调与大面积留白。",
      brandInfo: "品牌LOGO以金色/红色立体字或红包印章形式出现，slogan突出节日优惠，信息醒目完整。",
    },
  },

  // 场景叙事类
  warm_homestyle: {
    composition: "倾斜快照感或居中构图，碗在画面中央偏下但占65-75%，家庭餐桌场景。画面饱满，碗、筷子、配菜、生活道具共同填满框架，禁止明显空白。",
    subjectTreatment: "搪瓷碗/普通瓷碗装面，煎蛋、筷子搭在碗边，配菜丰富。食物真实不做作但画面充实。",
    titleStyle: "手写温暖字体，放在画面上方或侧边。颜色暖棕或米白，像手写便利贴。",
    marketingElements: "小贴纸标签'妈妈的味道''3分钟搞定'等，3-4个，分布在顶部横幅、角落和底部标签条。禁用3D金属徽章、促销爆炸贴，但标签数量必须充足。",
    atmosphere: "格子桌布/粗陶桌 + 台灯暖光 + 茶杯/遥控器/橘子/小菜等生活道具。温馨、有烟火气，画面充实。",
    forbidden: "禁止高端摆盘、禁止黑色背景、禁止过度修图、禁止厚重营销边框、禁止大面积空白。",
    flavorNotes: "适配家常口味。辣产品可放老干妈瓶；酸甜/清淡产品放对应家常配菜。",
    hardConstraintStyling: {
      packagingPresentation: "包装以家庭常用形态出现，如放在桌角、冰箱旁或被手撕开一半，占比8-12%，与生活场景自然融合。",
      headlineSystem: "顶部1-2行手写温暖字体标题，暖棕或米白色，像手写便利贴或家庭菜单，字号中等。",
      sideSellingPointBar: "画面一侧竖排4-5个手写贴纸图标卖点条，内容为'妈妈的味道''3分钟搞定''料足''暖胃'等家常关键词。",
      bottomBanner: "底部一条手写便利贴横幅或粗布标签条，文字为克重、份数、烹饪时间，字体温暖不规则。",
      badgeSystem: "3-4个温馨小贴纸徽章（'家常''暖心''足料'等），形状像便签、爱心或小锅，禁用3D金属与促销爆炸贴。",
      ingredientVisualization: "5-8件家常配料与生活道具共同填满画面（煎蛋、青菜、葱花、萝卜干、小菜碟、橘子、茶杯、筷子等）。",
      seasoningPacket: "独立料包以家常小袋/调味罐或老干妈式玻璃瓶形式呈现，放在桌边配料中。",
      colorScheme: "暖棕、米白、橙色2-3色主调，台灯暖光感，禁止黑色背景、冷白、霓虹、金属。",
      brandInfo: "品牌LOGO以手写或复古印刷字体出现在包装或桌角小卡片上，slogan生活化（如'家的味道'），信息完整。",
    },
  },

  regional_memory: {
    composition: "实景融合构图，碗占65-75%作为视觉中心，放在老自行车后座/石阶/旧木桌上，背景虚化的地标/城市元素。画面饱满，前景/中景/背景都有视觉内容，禁止大面积空白。",
    subjectTreatment: "地方特色碗装面，配料丰富体现地域（如热干面的萝卜丁、酸豆角、葱花；西北面的油泼辣子、蒜）。保留地方特色。",
    titleStyle: "方言字体或复古招牌字体，如'蛮是那个事'。颜色做旧红/蓝灰。标题放在画面顶部或侧边，字号中等。",
    marketingElements: "复古标签 + 地标徽章 + 方言气泡，3-4个。禁用现代极简标签、卡通涂鸦，但标签数量必须充足，营销覆盖20-25%。",
    atmosphere: "红砖墙/旧路牌/旧木桌带清晰纹理 + 黄昏侧逆光 + 老报纸/搪瓷杯/地方小物件。温暖怀旧，有城市记忆，背景必须有质感。",
    forbidden: "禁止现代极简、禁止冷白光、禁止卡通、禁止3D金属霓虹、禁止大面积空白。",
    flavorNotes: "按地域口味适配。武汉热干面风格配辣萝卜丁；西北面食配红油辣子；江南口味配清淡汤面。",
    hardConstraintStyling: {
      packagingPresentation: "包装与当地地标/老物件融合，如放在老自行车后座、石阶上或旧木桌一角，占比8-12%，强化地域身份。",
      headlineSystem: "顶部1-2行方言字体或复古招牌字体标题，做旧红/蓝灰色，像老街招牌，字号中等。",
      sideSellingPointBar: "画面一侧竖排4-5个地标/方言图标卖点条，图标为当地元素（黄鹤楼、钟楼、油泼辣子、热干面剪影），文字带方言感。",
      bottomBanner: "底部一条复古招牌横幅或旧路牌标签条，文字为地域口号（如'蛮是那个事''老味道'），做旧质感。",
      badgeSystem: "3-4个地标徽章/方言气泡（'本地''传承''老味道'等），形状像旧路牌或搪瓷杯，禁用现代极简标签。",
      ingredientVisualization: "5-8件地域配料丰富呈现（热干面萝卜丁、酸豆角、西北油泼辣子、蒜、江南小青菜等），突出地方特色。",
      seasoningPacket: "独立料包以地方特色小包装呈现，如武汉芝麻酱小包、西北油泼辣子罐，标签做旧。",
      colorScheme: "红砖、旧蓝、暖黄2-3色主调，黄昏侧逆光感，禁止冷白光、霓虹、卡通色。",
      brandInfo: "品牌信息以复古招牌印章或包装旧字体出现，slogan带地域记忆（如'一城一味'），信息完整。",
    },
  },

  lifestyle_scene: {
    composition: "框架构图或居中构图，食物占65-75%作为视觉中心。利用窗框/栏杆形成画中画，但画面必须饱满无大面积留白。",
    subjectTreatment: "户外餐桌/窗台上的面条碗，自然状态。配饮品、书本、绿植、餐具等生活道具（5-8件），画面充实。",
    titleStyle: "轻盈手写体，字号中等，放在画面顶部或侧边。颜色与场景协调。",
    marketingElements: "生活方式道具（帆布包/书本/咖啡杯） + 3-4个清新标签/徽章，分布在顶部横幅、角落和底部标签条。禁用促销边框、厚重徽章，但标签数量必须充足。",
    atmosphere: "水泥露台/野餐垫带纹理 + 自然光 + 绿植 + 冰美式。清新自然但画面充实，有生活情调。",
    forbidden: "禁止火焰、禁止促销感、禁止深色厚重、禁止密集营销元素、禁止大面积空白。",
    flavorNotes: "适配清淡/酸甜/轻食口味。辣产品只许极 subtle 提示，不可火焰辣椒破坏清新感。",
    hardConstraintStyling: {
      packagingPresentation: "包装自然放在生活场景中，如窗台、野餐垫或帆布包旁，占比8-12%，与生活方式道具共存。",
      headlineSystem: "顶部1-2行轻盈手写体标题，字号中等，颜色与场景协调（绿、棕、米白），像生活杂志标题。",
      sideSellingPointBar: "画面一侧竖排4-5个清新图标卖点条，图标为生活方式元素（帆布包、书本、咖啡杯、绿植、阳光），文字简短清新。",
      bottomBanner: "底部一条清新标签条或野餐布横幅，文字为'慢享''自然''轻食'等生活方式关键词。",
      badgeSystem: "3-4个清新小徽章（'天然''轻食''无负担'等），形状简洁自然，禁用促销爆炸贴与厚重金属。",
      ingredientVisualization: "5-8件生活化配料与道具共同填满画面（牛油果、樱桃番茄、香草、柠檬、冰美式、书本、绿植、餐具等）。",
      seasoningPacket: "独立料包以清新玻璃瓶/小袋形式呈现，放在生活道具中，标签简约自然。",
      colorScheme: "浅绿、米白、原木2-3色主调，自然光感，禁止深色厚重、火焰红、促销红金。",
      brandInfo: "品牌LOGO以清新手写或极简字体出现在包装或生活小卡片上，slogan自然生活化，信息完整。",
    },
  },

  baby_parenting: {
    composition: "90° flat lay 或居中构图，儿童分格餐盘居中，食物占65-75%。画面饱满，餐盘、餐具、辅食、装饰元素共同填满框架，安全干净有序。",
    subjectTreatment: "细短面条、卡通造型（星星/小熊）、蔬果泥、切成小块的水果蔬菜。强调宝宝友好、易吞咽，配料丰富但不杂乱。",
    titleStyle: "圆润柔和字体，粉色/浅蓝，字号中等偏大。给人安全温柔感。",
    marketingElements: "硅胶勺/围兜 + 营养数据小标签（钙/铁/维生素）+ 可爱图标条，3-4个标签。禁用火焰、辣椒、刺激性颜色，但标签数量必须充足。",
    atmosphere: "浅粉/浅蓝背景带柔和纹理（棉布/木纹） + 柔软棉布 + 自然光 + 婴儿小手/玩具。温暖安全画面充实，无烫感。",
    forbidden: "禁止辣椒/火焰/蒸汽（避免烫感）、禁止重口味文案、禁止深色厚重背景、禁止大面积空白。",
    flavorNotes: "只适配清淡/健康/宝宝辅食类产品。绝对禁用任何辣感元素和'爆辣'文案。",
    hardConstraintStyling: {
      packagingPresentation: "包装以宝宝餐盒/辅食袋/安全材质小袋形式出现，圆润无锐角，占比8-12%，强调婴幼儿安全。",
      headlineSystem: "顶部1-2行圆润柔和字体标题，粉色或浅蓝色，字号中等偏大，给人安全温柔感。",
      sideSellingPointBar: "画面一侧竖排4-5个营养数据图标卖点条，内容为钙、铁、维生素、易吞咽、无添加等宝宝友好关键词。",
      bottomBanner: "底部一条柔和图标条或棉质横幅，文字为'宝宝爱吃''营养均衡''易消化'等育儿关键词。",
      badgeSystem: "3-4个可爱营养徽章（'高钙''富铁''维生素''无添加'等），形状圆润，禁用火焰、辣椒、刺激性颜色。",
      ingredientVisualization: "5-8件宝宝友好配料与餐具共同填满画面（星星面、蔬果泥、小块水果、西兰花、胡萝卜、硅胶勺、围兜、婴儿小手等）。",
      seasoningPacket: "独立料包以宝宝辅食小袋/小盒形式呈现，标签注明无盐/低钠/易消化，颜色柔和。",
      colorScheme: "浅粉、浅蓝、米白2-3色主调，柔和明亮，禁止辣椒红、火焰、深色、刺激性高饱和色。",
      brandInfo: "品牌LOGO以圆润柔和字体或动物/星星形象出现，slogan强调安全与营养，信息完整温柔。",
    },
  },

  // 概念创意类
  ink_wash: {
    composition: "山水画三段式但画面饱满无大面积留白（前景碗占25-30%、中景筷子/配料占35-40%、背景水墨纹理占25-30%，另有10-15%营销文字/印章）。不左右分割，但三段之间用墨色深浅/食材/书法元素填充，不能空。",
    subjectTreatment: "黑瓷碗中的面条如山脉，葱花芝麻为'墨点'，周围有砚台、毛笔、茶盏、水墨飞溅等文化道具。食物与文化元素共同构成完整商业画面。",
    titleStyle: "书法大字或行书，占据顶部/侧边显著位置，朱红印章点缀。标题像画作题款但要有设计感。",
    marketingElements: "朱红印章'匠心''传承' + 书法标签 + 细线信息条，3-4个。印章和标签总面积15-20%，不能只有一个小印章。",
    atmosphere: "宣纸纹理带清晰纤维 + 水墨渐变 + 远山轮廓 + 毛笔砚台。背景必须有水墨笔触/晕染/纹理，禁止平滑纯色或大片无纹理留白。",
    forbidden: "禁止3D、禁止火焰、禁止促销感图标、禁止粗黑边金属字、禁止平滑纯色背景、禁止大面积空白。",
    flavorNotes: "水墨风适配所有口味但氛围要转化：辣产品用淡墨远山+极淡红椒；非辣产品用山水/食材水墨。",
    hardConstraintStyling: {
      packagingPresentation: "包装以水墨晕染或山水卷轴形式呈现，与远山/云雾融合，占比8-12%，像画作中的题跋元素。",
      headlineSystem: "顶部1-2行书法大字/行书标题，占据显著位置，朱红印章点缀，标题像画作题款但有设计感。",
      sideSellingPointBar: "画面一侧竖排4-5个水墨笔触边框图标卖点条，图标为山水、食材、毛笔、茶盏等文化符号，文字简短。",
      bottomBanner: "底部一条水墨细线信息条或卷轴横幅，文字为'匠心''传承''山水一味'等文化关键词。",
      badgeSystem: "≥3个朱红印章徽章（'匠心''传承''山水'等），另有书法角标，印章和标签总面积15-20%，不能只有一个小印章。",
      ingredientVisualization: "5-8件配料化作墨点或淡彩食材（葱花芝麻为墨点，肉片为淡墨，砚台、毛笔、茶盏为文化道具），共同填满山水三段。",
      seasoningPacket: "独立料包以水墨小袋/茶盏/竹筒形式呈现，标签为书法或朱红印章，与水墨意境统一。",
      colorScheme: "黑、白、朱红2-3色主调，水墨浓淡层次，禁止高饱和霓虹、3D金属、火焰红、平滑纯色。",
      brandInfo: "品牌名以书法印章或山水题款形式置于画面上方/角落，slogan文雅有诗意，信息完整。",
    },
  },

  infographic: {
    composition: "左右分割：左侧真实/插画食物，右侧数据图表。信息清晰，有设计感。",
    subjectTreatment: "面条碗分解图（面条长度、酱料克数、卡路里）。产品可被拆解为信息元素。",
    titleStyle: "粗体无衬线字体，品牌色，清晰可读。标题在顶部或数据区上方。",
    marketingElements: "数据图表、进度条、icon、营养成分表。禁用装饰性火焰徽章、书法字。",
    atmosphere: "白色/浅灰背景 + 品牌色线条 + 几何图形。干净、理性、信息密度高。",
    forbidden: "禁止水墨、禁止手绘涂鸦、禁止过多留白、禁止无序装饰。",
    flavorNotes: "数据化表达口味：辣度条、酸度条、蛋白质含量等。避免情绪化的'爆辣'文字，改用数值/星级。",
    hardConstraintStyling: {
      packagingPresentation: "包装以分解图/数据标注形式出现在食物旁或数据区内，占比8-12%，带有尺寸/克数标注线。",
      headlineSystem: "顶部1-2行粗体无衬线标题，品牌色，清晰可读，标题在顶部或数据区上方。",
      sideSellingPointBar: "画面右侧竖排4-5个数据图表/进度条图标卖点条，内容为辣度、酸度、蛋白质含量、热量、烹饪时间等量化指标。",
      bottomBanner: "底部一条营养成分表/数据汇总横幅，文字为克数、卡路里、蛋白质等关键数据，理性清晰。",
      badgeSystem: "3-4个数据徽章（'蛋白质含量''辣度星级''低卡'等），以进度条/星级/数值形式呈现，禁用装饰性火焰与书法字。",
      ingredientVisualization: "5-8件配料以分解标注形式呈现（面条长度、酱料克数、番茄重量、葱花克数等），每样都带数据标注。",
      seasoningPacket: "独立料包以营养成分小标签/独立数据卡片形式呈现，标注酱料热量、钠含量等。",
      colorScheme: "白、浅灰、品牌色2-3色主调，干净理性，禁止水墨、手绘涂鸦、无序装饰色。",
      brandInfo: "品牌LOGO以简洁无衬线字体置于数据区或包装旁，slogan数据化（如'每一份都清楚'），信息完整。",
    },
  },

  c4d_3d: {
    composition: "中心对称 + 爆炸突破效果，物体悬浮，低角度仰拍。强烈3D冲击感。",
    subjectTreatment: "3D建模面条螺旋飞出，酱汁球、辣椒片、芝麻围绕。产品像CG广告片。",
    titleStyle: "3D金属/玻璃质感立体字，霓虹渐变。标题悬浮在场景中，有光影反射。",
    marketingElements: "悬浮3D图标、品牌logo立体字、全息标签。标签也要有3D厚度和材质。",
    atmosphere: "渐变背景 + 金属/磨砂玻璃质感 + 数字粒子。科技感、未来感、高饱和。",
    forbidden: "禁止真实摄影光影、禁止手绘、禁止平面标签、禁止淡雅留白。",
    flavorNotes: "辣产品用红色/橙色霓虹能量球+辣椒碎片；非辣产品用对应口味配色（番茄红/清爽青/奶香金）。",
    hardConstraintStyling: {
      packagingPresentation: "包装以3D建模悬浮形式出现，带有金属/玻璃/磨砂质感与光影反射，占比8-12%，像CG广告中的品牌模型。",
      headlineSystem: "顶部1-2行3D金属/玻璃质感立体字标题，霓虹渐变，标题悬浮在场景中，有光影反射与厚度。",
      sideSellingPointBar: "画面两侧竖排4-5个悬浮3D图标卖点条，图标为立体食材/品牌符号，带有3D厚度和材质。",
      bottomBanner: "底部一条3D立体横幅/全息标签条，文字为'NEW''爆款''科技锁鲜'等，带有霓虹边缘光。",
      badgeSystem: "≥3个3D立体徽章/全息标签（'3D锁鲜''劲爽''爆款'等），有厚度和材质，禁止平面小贴。",
      ingredientVisualization: "5-8件3D配料悬浮飞散（面条螺旋、酱汁球、辣椒片、芝麻、肉块、蔬菜片等），营造CG广告冲击感。",
      seasoningPacket: "独立料包以3D小包装/能量球/悬浮胶囊形式呈现，带有霓虹光效与材质反射。",
      colorScheme: "霓虹渐变、金属银、深空蓝或对应口味配色（番茄红/清爽青/奶香金）2-3色主调，高饱和科技感。",
      brandInfo: "品牌LOGO以3D立体字或全息投影形式悬浮于画面上方/角落，slogan未来感，信息完整且有光影。",
    },
  },

  tech_geometric: {
    composition: "对称 + 碎片化/重组，碗被几何线条切割。有科技感和参数化秩序。",
    subjectTreatment: "面条呈六边形截面，酱汁为流体模拟，参数化曲线。产品被'分析'和'重构'。",
    titleStyle: "HUD风格字体，霓虹青 + 深灰。字号中等，像数据读数。",
    marketingElements: "全息投影数据（蛋白质含量） + 游标卡尺 + 电路板图标。禁用书法字、手绘涂鸦。",
    atmosphere: "深色网格背景 + 霓虹边缘光 + 数据可视化元素。冷色调科技感。",
    forbidden: "禁止手绘、禁止自然木纹、禁止温暖色调、禁止水墨、禁止卡通。",
    flavorNotes: "用数据表达口味：辣度百分比、番茄酸度值、蛋白质含量等。避免情绪化文案。",
    hardConstraintStyling: {
      packagingPresentation: "包装以参数化线框/全息投影形式出现，被几何线条切割或重构，占比8-12%，像实验室分析样本。",
      headlineSystem: "顶部1-2行HUD风格字体标题，霓虹青+深灰，字号中等，像数据读数或科技界面标题。",
      sideSellingPointBar: "画面一侧竖排4-5个全息投影数据图标卖点条，内容为辣度百分比、番茄酸度值、蛋白质含量、克重、烹饪时间等。",
      bottomBanner: "底部一条数据可视化横幅/网格标签条，文字为营养成分与参数化指标，像科技仪表盘。",
      badgeSystem: "3-4个全息数据徽章（'蛋白质XX%''辣度XX%''酸度XX'等），以进度环/数值形式呈现，禁用书法字与手绘。",
      ingredientVisualization: "5-8件配料以六边形截面/流体模拟/参数化曲线形式呈现（面条截面、酱汁流体、辣椒分子、芝麻颗粒等），科技感强。",
      seasoningPacket: "独立料包以数据化小容器/全息胶囊形式呈现，标注成分百分比与营养数据。",
      colorScheme: "深灰、霓虹青、白或数据蓝2-3色主调，冷色调科技感，禁止温暖色调、木纹、手绘色。",
      brandInfo: "品牌LOGO以HUD风格或电路板纹理字体呈现，slogan数据化（如'精准美味'），信息完整科技感。",
    },
  },

  dynamic_video: {
    composition: "关键帧思维，选'最高lift瞬间'或'酱汁浇下瞬间'，占满画面。有动态模糊和动作感。",
    subjectTreatment: "慢动作面条弹起、酱汁飞溅、沸水冲击面饼。捕捉运动中的食物。",
    titleStyle: "动态模糊字体或视频字幕条风格。像视频截图中的标题条，有速度感。",
    marketingElements: "进度条、计时器'3分钟'、动作箭头。禁用静态对称摆盘的标签。",
    atmosphere: "深色背景 + 戏剧性动态光线 + 慢动作水花/蒸汽。强调'此刻正在发生'。",
    forbidden: "禁止静态居中摆盘、禁止过度装饰、禁止缺失动作感、禁止淡雅留白。",
    flavorNotes: "动作内容要匹配口味：辣产品表现红油飞溅/辣椒撒落；非辣产品表现酱汁浇下/食材落入汤中。",
    hardConstraintStyling: {
      packagingPresentation: "包装在动作中呈现，如被酱汁冲击、被手撕开或悬浮于飞溅的配料中，占比8-12%，充满速度感。",
      headlineSystem: "顶部1-2行动态模糊字体标题或视频字幕条，有速度感，像视频截图中的标题，字号大且有运动轨迹。",
      sideSellingPointBar: "画面一侧竖排4-5个动作箭头/计时器/进度条图标卖点条，内容为'3分钟''快煮''劲道''爽滑'等动态关键词。",
      bottomBanner: "底部一条速度感横幅/视频字幕条，文字为倒计时、进度条或'此刻正在发生'，带有动态模糊效果。",
      badgeSystem: "3-4个动态徽章（'3分钟''快煮''劲道''热卖'等），带有动作箭头或进度环，禁用静态对称摆盘标签。",
      ingredientVisualization: "5-8件配料在动态中呈现（慢动作面条弹起、酱汁飞溅、辣椒撒落、沸水冲击、芝麻飞散、肉酱拉丝等），营造运动感。",
      seasoningPacket: "独立料包以动作中打开/倾倒的小袋呈现，酱料正被挤出，强调'此刻新鲜'。",
      colorScheme: "深色背景+戏剧性光线2-3色主调（黑、橙红、亮黄或对应口味色），高对比动态感，禁止淡雅留白。",
      brandInfo: "品牌LOGO以动态字幕或速度感字体出现在画面中，slogan强调即时与新鲜，信息完整有速度感。",
    },
  },
};

/**
 * 为指定风格生成主图差异化指令
 * 返回可直接注入 planning / generation prompt 的字符串
 */
export function buildHeroStyleAdaptation(
  styleKey: string,
  analysis: ProductAnalysisOutput,
): string {
  const resolvedKey = styleKey ?? "street_appetite";
  const adaptation = styleAdaptations[resolvedKey] ?? styleAdaptations["street_appetite"];
  const flavor = detectFlavorProfile(analysis);

  return [
    "=== HERO IMAGE STYLE ADAPTATION (主图风格差异化指令 — 强制覆盖通用默认) ===",
    `Style: ${resolvedKey}`,
    `Flavor profile: ${flavor.profile}`,
    `Flavor-allowed headline examples: ${flavor.headlineExamples.join(" / ")}`,
    `Flavor-allowed badge examples: ${flavor.badgeExamples.join(" / ")}`,
    `Flavor-allowed icon examples: ${flavor.iconExamples.join(" / ")}`,
    `Flavor atmosphere elements: ${flavor.atmosphereElements.join(" / ")}`,
    `FORBIDDEN flavor-mismatched words: ${flavor.forbiddenWords.join(" / ")}`,
    "",
    "CRITICAL: The following style-specific rules OVERRIDE the generic hero defaults. Do NOT fall back to the default 'left-right split + metallic calligraphy + dark icon bar' if it conflicts with this style.",
    "",
    `COMPOSITION (构图): ${adaptation.composition}`,
    `SUBJECT TREATMENT (食物呈现): ${adaptation.subjectTreatment}`,
    `TITLE STYLE (标题风格): ${adaptation.titleStyle}`,
    `MARKETING ELEMENTS (营销元素): ${adaptation.marketingElements}`,
    `ATMOSPHERE (氛围): ${adaptation.atmosphere}`,
    `FORBIDDEN (禁忌): ${adaptation.forbidden}`,
    `FLAVOR NOTES (口味适配): ${adaptation.flavorNotes}`,
    "",
    "=== HARD CONSTRAINT STYLING FOR THIS STYLE (本风格硬约束执行规范 — 风格决定 LOOK，不决定是否存在) ===",
    "HC1 — INFO DENSITY (信息密度): The frame must be FULL — no blank/empty zones anywhere; every corner and edge must hold visual or text content. The style only determines HOW the space is filled (texture/shadow/brush stroke/seal/pattern), not WHETHER it is filled.",
    `HC2 — PACKAGING PRESENTATION (包装展示): ${adaptation.hardConstraintStyling.packagingPresentation}`,
    `HC3 — HEADLINE SYSTEM (标题系统): ${adaptation.hardConstraintStyling.headlineSystem}`,
    `HC4 — SIDE SELLING-POINT BAR (侧边卖点条): ${adaptation.hardConstraintStyling.sideSellingPointBar}`,
    `HC5 — BOTTOM BANNER (底部横幅): ${adaptation.hardConstraintStyling.bottomBanner}`,
    `HC6 — BADGE SYSTEM (徽章系统): ${adaptation.hardConstraintStyling.badgeSystem}`,
    `HC7 — INGREDIENT VISUALIZATION (配料可视化): ${adaptation.hardConstraintStyling.ingredientVisualization}`,
    `HC8 — SEASONING PACKET (料包展示): ${adaptation.hardConstraintStyling.seasoningPacket}`,
    `HC9 — COLOR SCHEME (色彩分区): ${adaptation.hardConstraintStyling.colorScheme}`,
    `HC10 — BRAND INFO (品牌信息): ${adaptation.hardConstraintStyling.brandInfo}`,
    "",
    "STYLE-FLAVOR ALIGNMENT RULE:",
    "- Headline copy, corner badges, and selling-point icons MUST use the flavor-allowed examples above and MUST NOT use forbidden words.",
    "- Atmosphere elements MUST be chosen from the flavor-allowed list, interpreted through the lens of this visual style.",
    "- For example: a spicy product in 'japanese_fresh' style can show a tiny pinch of red chili flake as garnish, but NO flames, NO scattered dried chilies, NO spicy particles.",
    "- Another example: a non-spicy product in 'street_appetite' style keeps the dramatic lighting and composition but replaces flames/chilies with warm bokeh + fresh ingredient garnish + sauce gloss.",
    "",
    buildQualityFloor(),
    "=== END HERO IMAGE STYLE ADAPTATION ===",
  ].join("\n");
}

/**
 * 生成层专用：返回更精简的风格适配提示
 */
export function buildHeroStyleIdentity(styleKey: string, analysis: ProductAnalysisOutput): string {
  const resolvedKey = styleKey ?? "street_appetite";
  const adaptation = styleAdaptations[resolvedKey] ?? styleAdaptations["street_appetite"];
  const flavor = detectFlavorProfile(analysis);

  return [
    "=== HERO STYLE IDENTITY FOR IMAGE GENERATION (生成层风格身份 — 覆盖通用指令) ===",
    `Style: ${resolvedKey}`,
    `Detected flavor: ${flavor.profile}`,
    `Use headline direction: ${flavor.headlineExamples.join(" / ")}`,
    `Use badge direction: ${flavor.badgeExamples.join(" / ")}`,
    `Use icon direction: ${flavor.iconExamples.join(" / ")}`,
    `Use atmosphere direction: ${flavor.atmosphereElements.join(" / ")}`,
    `FORBIDDEN words: ${flavor.forbiddenWords.join(" / ")}`,
    "",
    "OVERRIDE RULES for this style:",
    `- COMPOSITION: ${adaptation.composition}`,
    `- SUBJECT: ${adaptation.subjectTreatment}`,
    `- TITLE: ${adaptation.titleStyle}`,
    `- MARKETING: ${adaptation.marketingElements}`,
    `- ATMOSPHERE: ${adaptation.atmosphere}`,
    `- FORBIDDEN: ${adaptation.forbidden}`,
    "",
    "Do NOT use the generic 'left-right split + metallic gold calligraphy + dark bottom icon bar' formula if this style says otherwise. The style-specific rules above take priority.",
    "=== END HERO STYLE IDENTITY ===",
  ].join("\n");
}
