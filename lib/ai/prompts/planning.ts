import type { ProductAnalysisOutput } from "@/lib/ai/schemas/product-analysis";
import type { AssociatedImageContext } from "@/types/domain";
import {
  platformLabels,
  sectionTypeLabels,
  styleLabels,
  type PlatformOption,
  type StyleOption,
} from "@/types/domain";
import { contentLanguageNamesForPrompt, normalizeContentLanguage, type ContentLanguage } from "@/lib/utils/content-language";
import { buildStyleInstruction, buildProductBackgroundExtension } from "./style-templates";
import { buildHeroStyleAdaptation } from "./hero-style-adaptations";

const sectionTypeGuide = Object.entries(sectionTypeLabels)
  .map(([key, label]) => `${key}=${label}`)
  .join(", ");

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
 * 根据产品分析结果推断口味特征，避免把"爆辣"写死在不辣产品上
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

  // 默认按鲜香处理
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
 * 生成平台特定的商品图片元素指引，帮助规划 AI 了解该平台需要在图片中包含的元素
 * 所有风格统一执行平台强制元素（9个营销元素、3D材质、布局变化等硬元素不删减），
 * 风格差异体现在布局方式/排版风格/配色方向/文案语气，由 buildStyleInstruction 和
 * buildHeroStyleAdaptation 注入，不由本函数删减元素
 */
function buildPlatformImageElements(platform: string, contentLanguage: ContentLanguage): string {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];
  const normalized = platform.toLowerCase();

  const platformElements: Record<string, string[]> = {
    pinduoduo: [
      "=== PLATFORM MANDATORY ELEMENTS FOR HERO IMAGES (头图平台强制元素 — 每张头图必须包含，不可省略) ===",
      "",
      "MANDATORY ELEMENTS FOR EVERY HERO IMAGE (每张头图必须包含以下全部元素):",
      "① TOP BANNER (顶部标题横幅): 圆弧形横幅，放置主营销标题，底色根据产品主色自由搭配和谐色，文字用与底色高对比的浅色，占顶部15-20%区域",
      "② BOTTOM BANNER (底部促销横幅): 促销信息横幅，底色与顶部横幅协调但不重复，文字用高对比浅色，占底部12-15%区域",
      "③ LEFT FLOATING TAGS (左侧浮动卖点标签): 3-5个圆角标签，底色与横幅形成对比的和谐色，文字用高对比色，沿左侧垂直排列",
      "④ BRAND BADGE (品牌徽章): 左上角或右下角，品牌logo或品牌名+信任短语，底色与整体画面协调，半透明，占角落5-8%区域",
      "⑤ PRODUCT BODY (产品主体): 产品图居中偏上，占画面55-65%，是视觉核心",
      "⑥ ATMOSPHERE (氛围元素): 蒸汽/光线/油滴/闪光等至少1种氛围效果",
      "⑦ PROPORTION REFERENCE (参照物): 筷子/人手/手机等至少1个参照物放入画面，让用户感知分量大小",
      "⑧ INGREDIENT SCATTER (散落食材): 产品周围散落2-4种新鲜食材（葱花/辣椒/芝麻/肉类/蔬菜），增强真实食欲感",
      "⑨ CORNER TAG (角标): 画面角落的状态标注，三角折角/圆形/星形/斜切三角，标注'新品'/'HOT'等状态，占角落3-5%区域",
      "",
      "=== COLOR DESIGN PHILOSOPHY (色彩设计 — 顶级电商美工审美) ===",
      "以顶级电商美工的审美去搭配颜色。产品主色（color 字段）是参考起点，不是枷锁。",
      "",
      "你需要像一个资深视觉设计师一样自由创作：",
      "- 凭审美直觉决定每张图的整体色彩方向",
      "- 横幅、标签、徽章、背景、氛围元素之间保持在同一色系内即可（如暖橙→暖金→暖红是一个色系），不必严格同一颜色",
      "- 相邻元素可以有微妙的色相偏移（±15°~30°），产生丰富的色彩层次而不是单调的重复",
      "- 5张头图走5种不同的审美方向，每张的配色气质截然不同",
      "- 可以走高级灰克制路线，可以走撞色大胆路线，可以走同色系渐变路线——怎么好看怎么来",
      "- 营销元素组合在一起时要像一个调色板，每种颜色都有微妙差异但整体和谐",
      "",
      "唯一底线：不要用刺眼的荧光色和高饱和纯色，消费者看着不舒服。",
      "",
      "=== MARKETING ELEMENT 3D MATERIAL EFFECTS (营销元素3D材质效果 — 必须使用) ===",
      "所有营销装饰元素不能是扁平的纯色块。每张头图的横幅/标签/徽章/角标必须有3D立体感和材质感：",
      "",
      "BANNER 3D效果选项（每张头图选一种）:",
      "- EMBOSS/DEBOSS (浮雕/凹版): 文字凸起或凹陷于横幅表面，有投影和高光边缘",
      "- GOLD FOIL (烫金/烫银): 金属光泽箔印，有镜面高光和反射纹路",
      "- VELVET/SUEDE (丝绒质感): 柔光散射，边缘有微妙的织物纹理",
      "- GLOSSY RAISED (高光凸起): 横幅有厚度感，顶部边缘有白色高光线，底部有投影",
      "- ETCHED GLASS (磨砂玻璃): 半透明材质，边缘有磨砂雾化，文字浮雕凸起",
      "- LAYERED (多层叠压): 多层不同色的薄片叠压，边缘露出下层颜色，有纸雕感",
      "",
      "TAG/BADGE 3D效果选项（每张头图选一种）:",
      "- METALLIC RAISED (金属凸版): 金属质感表面，有环境光反射，文字凸起压印",
      "- WAX SEAL (火漆印章): 圆润凸起的蜡质感，边缘不规则微微溢出",
      "- 3D RIBBON (立体丝带): 有折叠阴影和转折高光，丝带穿过或环绕主体",
      "- PILLOW EMBOSS (枕形凸起): 圆润膨胀的立体感，像充气的胶囊",
      "- LASER CUT SHADOW (激光雕刻投影): 标签整体浮于表面上方，有清晰的方向投影",
      "- DOUBLE LAYER (双层结构): 底层大色块+上层小标签，两层之间有投影形成深度",
      "",
      "CREATIVE VARIATION (创意变化):",
      "顶部横幅：渐变方向+3D效果（浮雕/烫金/丝绒/高光凸起）+ 不同圆弧弧度",
      "标签：不同形状（水滴形/叶片形/卷轴形/六边形/盾牌）+ 不同3D材质",
      "品牌徽章：不同形状（盾牌/火漆印章/复古标签/飘带）+ 金属/凹凸/蜡封效果",
      "氛围元素（蒸汽/光线/油滴/闪光）的颜色也要每张不同，与对应头图的配色方案协调。",
      "",
      "=== LAYOUT VARIETY RULE FOR HERO IMAGES (头图布局变化规则 — 强制执行) ===",
      "Each hero image MUST use a DIFFERENT layout arrangement of the mandatory elements above.",
      "Do NOT repeat the same layout across multiple hero images. Vary the arrangement by:",
      "- Moving the top banner to different positions: full-width top / left-aligned / right-aligned / curved arc / angled",
      "- Changing the bottom banner style: full-width bottom / floating card / ribbon / rounded badge",
      "- Repositioning the floating tags: left side / right side / scattered around product / diagonal line / cluster",
      "- Rotating the brand badge position: top-left / top-right / bottom-left / bottom-right / integrated into banner",
      "- Adjusting product position: center / slightly left / slightly right / floating above surface / tilted angle",
      "RULE: Each hero image must have a DISTINCT layout. No two hero images should look the same.",
      "",
      "=== RANDOM ENRICHMENT ELEMENT FOR HERO IMAGES (头图随机丰富元素 — 每张头图必须增加1个) ===",
      "For EACH hero image, you MUST randomly pick ONE additional element from the list below to enrich the layout:",
      "- DECORATIVE RIBBON (装饰丝带): 产品周围的装饰性丝带/飘带，增加动感",
      "- LIGHT RAYS (光线效果): 斜射光束/丁达尔效果，增加画面层次",
      "- SCATTERED INGREDIENTS (散落食材): 产品周围散落的原材料/配菜，增加食欲感",
      "- REVIEW BADGE (好评徽章): '好评率99%' '100万+好评' 等信任徽章",
      "- FLAVOR ICON (口味图标): 表示口味/风味的小图标（辣椒/番茄/牛肉等）",
      "- COMPARISON ARROW (对比箭头): 指向产品卖点的标注箭头/指示线",
      "- HAND/FORK HOLDING (手持/叉取): 人手拿筷子或叉子取食的动态元素",
      "- TEXTURE OVERLAY (纹理叠加): 画面背景的微妙纹理叠加（木纹/布纹/纸纹）",
      "- SPARKLE EFFECTS (闪光粒子): 产品周围的微小闪光/粒子效果，增加精致感",
      "- SPLASH EFFECT (飞溅效果): 汤汁飞溅/水花/油滴飞溅，增加动态冲击力和食欲感",
      "RULE: Each hero image must pick a DIFFERENT enrichment element. Do NOT use the same one twice across hero images.",
    ],

    xiaohongshu: [
      "=== PLATFORM MANDATORY ELEMENTS FOR HERO IMAGES (头图平台强制元素 — 每张头图必须包含) ===",
      "① NATURAL SCENE (自然场景): 真实生活场景，自然光温暖色调",
      "② PRODUCT FOCUS (产品聚焦): 产品偏置构图（三分法），轻微30°俯拍",
      "③ LIFESTYLE PROPS (生活道具): 与场景匹配的生活道具（咖啡杯/书/花/手机等）",
      "④ WARM TONE (暖色调): 自然光+暖色滤镜，禁止白底棚拍感",
      "LAYOUT VARIETY: 每张头图使用不同的三分法构图位置和道具组合",
      "RANDOM ENRICHMENT: 每张头图随机增加1个元素（手部/植物/织物纹理/窗户光线/食物碎屑等）",
      "禁止任何营销边框、水印、促销标签",
    ],

    douyin: [
      "=== PLATFORM MANDATORY ELEMENTS FOR HERO IMAGES (头图平台强制元素 — 每张头图必须包含) ===",
      "① TOP BANNER (顶部吸睛横幅): 渐变横幅标题，底色根据产品主色自由搭配和谐色，文字用高对比浅色，占顶部15-20%",
      "② BOTTOM BANNER (底部促销横幅): 促销文案/品牌标语，底色与顶部协调但不重复，文字高对比色，占底部12-15%",
      "③ LEFT FLOATING TAGS (左侧浮动卖点标签): 圆角标签，3-5个，底色与横幅形成对比的和谐色",
      "④ PRODUCT BODY (产品主体): 垂直3:4动态构图，产品占55-65%",
      "⑤ ENERGY ELEMENTS (能量元素): 微光/动态模糊/速度线等视觉能量感元素，颜色与产品主色协调",
      "⑥ INGREDIENT SCATTER (散落食材): 产品周围散落2-3种新鲜食材",
      "⑦ CORNER TAG (角标): 画面角落的状态标注，三角折角/圆形/星形，标注'新品'/'HOT'等",
      "LAYOUT VARIETY: 每张头图使用不同的横幅风格和能量元素组合",
      "RANDOM ENRICHMENT: 每张头图随机增加1个元素（音符图标/火焰纹理/星芒/烟雾/手部动作/飞溅效果等）",
    ],

    taobao: [
      "=== PLATFORM MANDATORY ELEMENTS FOR HERO IMAGES (头图平台强制元素 — 每张头图必须包含) ===",
      "① TOP BANNER (顶部优雅标题栏): 渐层标题栏，底色根据产品主色自由搭配和谐色，占顶部15-20%",
      "② BOTTOM BANNER (底部促销文案): 极简促销文案，占底部10-12%",
      "③ LEFT SELLING TAGS (左侧卖点标签): 柔和阴影标签，2-4个，底色与顶部协调但不重复",
      "④ BRAND BADGE (品牌logo): 左上角品牌logo",
      "⑤ PRODUCT BODY (产品主体): 产品占画面70-80%",
      "⑥ CORNER TAG (角标): 画面角落的状态标注，三角折角/圆形，标注'新品'/'HOT'等",
      "LAYOUT VARIETY: 每张头图使用不同的渐层方向和标签排列方式",
      "RANDOM ENRICHMENT: 每张头图随机增加1个元素（金属质感/丝绸纹理/光晕/认证印章等）",
    ],
  };

  for (const [key, elements] of Object.entries(platformElements)) {
    if (normalized.includes(key)) {
      return `Platform: ${platformLabels[platform as PlatformOption] ?? platform}\n${elements.join("\n")}\nAll text in images must be in ${targetLanguage}.`;
    }
  }

  // 通用平台
  return [
    "=== PLATFORM MANDATORY ELEMENTS FOR HERO IMAGES (头图平台强制元素 — 每张头图必须包含) ===",
    "① TOP BANNER (顶部标题横幅): 主营销标题，占顶部15-20%，底色根据产品主色自由搭配和谐色，文字高对比浅色",
    "② BOTTOM BANNER (底部促销横幅): 促销信息，占底部12-15%",
    "③ SELLING-POINT TAGS (卖点标签): 3-5个标签，分布在产品周围",
    "④ PRODUCT BODY (产品主体): 产品占画面55-65%",
    "⑤ ATMOSPHERE (氛围元素): 至少1种视觉效果",
    "⑥ INGREDIENT SCATTER (散落食材): 产品周围散落2-3种新鲜食材",
     "COLORS: 以顶级电商美工审美自由搭配，每张图独立配色，不锁色系。唯一的底线：不要刺眼的荧光色和高饱和纯色。",
    "LAYOUT VARIETY: 每张头图使用不同的元素排列组合",
    "RANDOM ENRICHMENT: 每张头图随机增加1个丰富元素（光线/纹理/装饰/道具等）",
    "CRITICAL: 每张头图画面必须饱满丰富 — 不存在大面积空白区域。所有8个强制元素必须覆盖画面95%以上区域。",
    `All text in images must be in ${targetLanguage}.`,
  ].join("\n");
}

/**
 * 将关联图分析上下文格式化为规划可用的摘要
 */
function buildAssociatedContextSummary(contexts: AssociatedImageContext[]): string | null {
  if (!contexts || contexts.length === 0) return null;

  const parts = [
    "=== ASSOCIATED SCENE CONTEXTS (关联场景图分析) ===",
    "The following scenes were extracted from images associated with this product. Use them to enrich section planning:",
    "",
  ];

  contexts.forEach((ctx) => {
    parts.push(`--- Associated Scene ${ctx.index + 1}: ${ctx.fileName} ---`);
    parts.push(`Scene: ${ctx.sceneDescription}`);
    parts.push(`Product relationship: ${ctx.productRelationship}`);
    parts.push(`Visual elements: ${ctx.visualElements.join(", ")}`);
    parts.push(`Composition style: ${ctx.compositionStyle}`);
    parts.push(`Lighting & color: ${ctx.lightingAndColor}`);
    parts.push(`Props & environment: ${ctx.propsAndEnvironment.join(", ")}`);
    parts.push(`Usage scenario: ${ctx.usageScenario}`);
    parts.push("");
  });

  parts.push("PLANNING INSTRUCTIONS for associated scenes:");
  parts.push("1. Use these scenes to create diverse scenario-based detail sections (SCENARIO type).");
  parts.push("2. The visual elements and props can be directly referenced in visualPrompt for each section.");
  parts.push("3. The composition style and lighting info should inform the visual direction of corresponding sections.");
  parts.push("4. Make sure the product identity (from MAIN image) is never confused with these scene contexts.");
  parts.push("5. Each associated scene should inspire at least one section that incorporates its visual elements.");

  return parts.join("\n");
}

/**
 * 构建字体排版约束 — 统一所有图片的文字渲染规范
 * 解决"模糊描述（超大粗体）→ 精确指令（思源黑体 72pt Bold）"的问题
 */
function buildTypographyConstraint(contentLanguage: ContentLanguage): string {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];
  const isChinese = normalizeContentLanguage(contentLanguage) === "zh-CN";

  const fontFamily = isChinese
    ? "中文优先思源黑体（Source Han Sans）/阿里巴巴普惠体，英文用 Inter 或 Helvetica Neue"
    : "Inter, Helvetica Neue, or SF Pro Display";

  return [
    "=== TYPOGRAPHY CONSTRAINT (字体排版约束 — 所有图片文字必须遵守) ===",
    `Target text language: ${targetLanguage}`,
    `Font family: ${fontFamily}`,
    "",
    "FONT WEIGHT (字重):",
    "- 主标题/品牌名: Bold (700) 或 Black (900)，禁止 Regular/Light",
    "- 副标题/卖点标签: SemiBold (600) 或 Bold (700)",
    "- 正文/说明文字: Medium (500) 或 Regular (400)",
    "- 免责声明/小字: Regular (400)",
    "",
    "FONT SIZE (字号 — 相对于画面高度):",
    "- 头图主标题: 占画面高度 8-12%（约 72-120pt 等效）",
    "- 头图副标题/卖点标签: 占画面高度 4-6%（约 36-60pt 等效）",
    "- 详情页主标题: 占画面高度 6-9%（约 60-90pt 等效）",
    "- 详情页副标题: 占画面高度 3-5%（约 30-50pt 等效）",
    "- 详情页卖点标签: 占画面高度 2.5-4%（约 24-40pt 等效）",
    "- 角标/徽章文字: 占画面高度 1.5-2.5%（约 14-24pt 等效）",
    "",
    "TEXT RENDERING RULES (文字渲染规则):",
    "1. 所有文字必须清晰锐利，无模糊、无锯齿、无重叠",
    "2. 文字与背景必须有足够对比度（深色文字配浅色背景，反之亦然）",
    "3. 中文文字必须使用中文字体渲染，禁止用英文字体渲染中文（会出现方块/乱码）",
    "4. 同一系列图片（5张头图/9张详情页）的字体风格、字号比例必须保持一致",
    "5. 文字必须适合手机屏幕一臂距离阅读，最小字号不低于画面高度的 1.5%",
    "6. 标题文字必须居中或左对齐，禁止右对齐（除特殊设计需求）",
    "7. 卖点标签文字必须简短（4-8字），单行排列，禁止换行",
    "",
    "VISUALPROMPT INJECTION (visualPrompt 必须包含字体指令):",
    "每个 section 的 visualPrompt 必须在描述文字位置时，明确指定字体类型、字号、字重。",
    "示例: '主标题用思源黑体 Bold 72pt，白色，居中放置在顶部横幅内'",
    "=== END TYPOGRAPHY CONSTRAINT ===",
  ].join("\n");
}

/**
 * 零空白区规则 — 共享约束块
 * 解决问题：头图留白太多，画面单调
 * 所有风格统一执行4层深度+零大面积留白（硬元素不删减），风格差异体现在每层的
 * 背景材质/灯光/配色方向，由 buildStyleInstruction 和 buildHeroStyleAdaptation 注入
 */
function buildZeroBlankAndLayerRule(): string[] {
  return [
    "",
    "=== ZERO EMPTY SPACE RULE (零空白区规则 — 与硬约束对齐) ===",
    "EVERY area of the hero image frame MUST serve a visual purpose. There are NO arbitrary blank/empty zones allowed. Styles may use designed negative space (texture, shadow, ink wash, seal, vignette), but that negative space IS visual content — not absence of content.",
    "",
    "BLANK ZONE DEFINITION:",
    "- ALLOWED: designed negative space that carries texture, gradient, shadow, brush stroke, seal, grain, pattern, or atmospheric haze.",
    "- FORBIDDEN: any contiguous area larger than 5% of the frame that is a flat, solid, texture-free color with no visible element.",
    "- FORBIDDEN: dead corners with nothing in them. Every corner must contain at least one of: prop, garnish, label, badge, texture detail, shadow, or text.",
    "",
    "HOW TO FILL SPACE:",
    "- Dead corners → add blurred garnish, label cluster, badge, seal, or texture detail",
    "- Flat background areas → add depth layers, atmospheric haze, decorative texture overlay, or subtle pattern",
    "- Large solid-color zones → break them with subtle pattern, grain, vignette shadow, or scattered props",
    "- Spaces between subject and edge → fill with scattered props at varying depths",
    "- The bottom 10-15% → natural home for the bottom banner / tag bar / brand info strip",
    "",
    "=== VISUAL LAYER DEPTH (视觉分层 — 4 层深度，每层有明确视觉贡献) ===",
    "Every hero image MUST have at least 4 distinct depth layers, and NO layer may be empty or near-empty:",
    "- LAYER 1 — FOREGROUND (5-10%): Blurred props, garnish, seasoning packets, or steam wisps at the very front of the frame. Creates depth-of-field effect.",
    "- LAYER 2 — MIDGROUND SUBJECT (45-60%): The sharp-focus main subject (product packaging + finished dish/ingredients). This is the visual anchor.",
    "- LAYER 3 — BACKGROUND ENVIRONMENT (25-35%): Textured surface, contextual environment, warm/cool gradient, or atmospheric depth behind the subject. Must have visible texture.",
    "- LAYER 4 — DESIGN OVERLAY (20-25% for secondary heroes, 30-40% for primary hero): Marketing elements — top banner, bottom banner, side selling-point bar, badges, corner tags, ribbons — floating above the scene with 3D depth.",
    "",
    "MARKETING OVERLAY LAYER MUST INCLUDE (primary hero):",
    "- Top banner with brand name + main headline + sub-headline",
    "- Side selling-point bar with 4-5 icon+text tags",
    "- Bottom high-contrast banner with 3-4 core selling-point keywords",
    "- At least 3 badges/corner tags in different positions",
    "",
    "SELF-CHECK: Does your hero image have all 4 layers with real content? If any layer is missing or indistinct, add specific visual elements to that layer in the visualPrompt. If you can find any zone larger than 5% with no content → FILL IT before output.",
  ];
}

/**
 * 文案差异化约束 — 共享约束块
 * 解决问题：文案单一类同，不同产品出现雷同文案
 */
function buildCopyDifferentiationRule(): string[] {
  return [
    "",
    "=== COPY DIVERSITY MANDATE FOR HERO IMAGES (头图文案差异化 — 强制执行) ===",
    "ALL hero images' `copy` fields MUST be semantically DIFFERENT from each other.",
    "The AI must verify that no two heroes share the same key selling phrases.",
    "",
    "=== COPY LAYER STRATEGY (文案分层策略 — 头图核心) ===",
    "Hero image copy has TWO layers with DIFFERENT purposes:",
    "",
    "LAYER 1 — EMOTIONAL HEADLINE (情绪化大标题，占画面15-20%):",
    "- Purpose: 让用户1秒内产生情绪反应（馋/辣/爽/暖）",
    "- Style: 感官冲击型，4-8字短句，口语化表达",
    "- Examples: '爆辣劲爽' / '一口入魂' / '越吃越上头' / '辣到嘶哈' / '香到舔盘'",
    "- FORBIDDEN in headline: 纯参数文案（如'净含量127g'/'蛋白质≥12g'）— 这些属于Layer 2",
    "- The headline text should be rendered as a DESIGN ELEMENT overlaid on the image (calligraphy/metallic/glowing), NOT as a separate banner",
    "",
    "LAYER 2 — DATA SUPPORT (数据支撑小字，占画面5-10%):",
    "- Purpose: 用具体数据支撑情绪标题，建立信任",
    "- Style: 数据驱动型，包含具体数字/规格/产地",
    "- Examples: '20g火鸡酱+30g炸肉酱' / '日晒72小时工艺' / '3分钟即食'",
    "- Placement: 底部图标条/角落标签/小字注释，NOT as headline",
    "",
    "COPY WRITING STYLE (文案风格 — 每张头图文案必须与其视觉主体对齐):",
    "- hero_01 (食欲冲击): 大标题=感官冲击型(4-8字如'爆辣劲爽')，小字=核心卖点数据。语气诱人冲击感强，让用户读到的瞬间产生食欲",
    "- hero_02 (成品展示): 大标题=口感体验型(如'大口满足')，小字=成品卖点。语气诱人满足",
    "- hero_03 (真材实料): 大标题=品质信任型(如'真材实料')，小字=产地/成分数据。语气真诚可信",
    "- hero_04 (制作场景): 大标题=效率动感型(如'3分钟搞定')，小字=工艺亮点。语气专业动感",
    "- hero_05 (使用场景): 大标题=场景共鸣型(如'深夜救星')，小字=场景价值。语气温暖亲切",
    "",
    "EMOTIONAL COPY STYLES (情绪化文案风格 — 头图大标题必须选一种，且必须与产品口味匹配):",
    "1. SENSORY (感官型): 直接刺激感官。辣产品: '爆辣劲爽' '辣到嘶哈'；酸甜产品: '酸甜浓郁' '鲜香开胃'；鲜香产品: '肉香四溢' '汤浓面劲'；清淡产品: '清爽鲜香' '健康本味'",
    "2. COLLOQUIAL (口语型): 像朋友推荐 — '越吃越上头' '一口入魂' '真的绝了' '大口满足'",
    "3. EXAGGERATED (夸张型): 夸大感受。辣产品: '火辣翻倍' '辣到起飞'；其他: '好吃到哭' '一口沦陷' '料多到爆'",
    "4. SCENE-EMOTION (场景情绪型): 场景+情绪 — '深夜救星' '追剧必备' '露营神仙面' '加班伴侣'",
    "",
    "FLAVOR-MATCHING RULE: 不辣的产品绝对不能用'爆辣/辣得过瘾/火辣/超辣'等辣感词汇；辣的产品绝对不能用'酸甜/清淡'等不匹配词汇。文案必须与产品实际口味一致。",
    "",
    "GENERAL COPY RULES:",
    "- FORBIDDEN: Do NOT use vague hype like '爆款', '必抢', '疯抢', '全网最低价', '神器', '绝绝子', 'yyds'",
    "- INSTEAD: Use specific, vivid, sensory language that makes the reader FEEL something",
    "- Data and numbers belong in Layer 2 (small text), NOT in the emotional headline",
    "",
    "RULE 1 — PRIMARY HERO copy (主图文案定位):",
    "- Headline (Layer 1): 情绪化短句，4-8字，感官冲击力强",
    "- Support (Layer 2): 2-3个核心卖点关键词(口语化) + 产品名 + 品牌名",
    "- Example headline: '爆辣劲爽'",
    "- Example support: '肉酱火鸡面 | 20g火鸡酱+30g炸肉酱 | 非油炸粗面'",
    "",
    "RULE 2 — EACH SECONDARY HERO copy must focus on its UNIQUE visual-copy alignment angle:",
    "- hero_02 Angle (成品体验): 以成品效果、口感体验为核心",
    "  大标题示例：'大口满足' / '汤浓面劲'",
    "  小字示例：'一碗好面3分钟即享，料足味美不将就'",
    "",
    "- hero_03 Angle (真材实料): 以产品的材料、原料、材质为核心",
    "  大标题示例：'真材实料' / '好料出好味'",
    "  小字示例：'精选xx产地顶级原料，蛋白质含量≥12g/100g'",
    "",
    "- hero_04 Angle (制作场景): 以产品的制作方法、烹饪过程为核心",
    "  大标题示例：'3分钟搞定' / '即刻上桌'",
    "  小字示例：'汤底翻滚面条舞动，一碗热气腾腾的好面即刻上桌'",
    "",
    "- hero_05 Angle (使用场景): 以产品在具体生活场景中的价值为核心",
    "  大标题示例：'深夜救星' / '随时随地'",
    "  小字示例：'加班深夜的温暖，追剧周末的陪伴——品质不将就'",
    "",
    "RULE 3 — FORBIDDEN PATTERNS (禁止的类同模式):",
    "- Do NOT use the same adjective across multiple heroes (e.g., all heroes using '美味'/'好吃'/'香浓')",
    "- Do NOT use the same sentence structure (e.g., all copy starts with '精选...')",
    "- Do NOT reuse the same selling point in different heroes",
    "- Each hero's `copy` field must have ≤30% word overlap with any other hero's `copy`",
    "",
    "VERIFICATION: Before output, mentally check: 'If I read only the copy fields, can I tell these are multiple DIFFERENT heroes talking about DIFFERENT aspects of the product?' If NO, rewrite them.",
  ];
}

/**
 * 构建关联图上下文约束块（条件性注入）
 * 当有关联场景图时注入，否则不注入
 */
function buildAssociatedContextBlock(associatedSummary: string | null): string[] {
  if (!associatedSummary) return [];

  return [
    "",
    associatedSummary,
    "",
    "IMPORTANT: The associated scene contexts above show this product in various real-life settings.",
    "In your section plan, you MUST:",
    "- Create scenario-based detail sections that reflect these actual scenes",
    "- Use the visual elements, props, and environments described above as concrete visualPrompt details",
    "- Reference the composition style and lighting from associated scenes in corresponding visualPrompts",
    "- Ensure at least one hero section incorporates a lifestyle mood inspired by an associated scene",
    "- Never treat scene images as defining a different product — the MAIN product identity is absolute",
  ];
}

/**
 * 构建知识库约束块（条件性注入）
 * 当有产品知识库条目时注入地面真相约束，否则不注入
 */
function buildKnowledgeBaseBlock(
  knowledgeEntries?: { category: string; title: string; content: string }[],
): string[] {
  if (!knowledgeEntries || knowledgeEntries.length === 0) return [];

  const categoryLabels: Record<string, string> = {
    BRAND_INFO: "品牌信息", SELLING_POINT: "核心卖点", SPECIFICATION: "产品规格",
    MATERIAL: "材质/原料", TARGET_AUDIENCE: "目标人群", USAGE_SCENARIO: "使用场景", OTHER: "其他",
  };
  const grouped = new Map<string, string[]>();
  for (const e of knowledgeEntries) {
    const list = grouped.get(e.category) ?? [];
    list.push(`- ${e.title}: ${e.content}`);
    grouped.set(e.category, list);
  }
  const blocks: string[] = [];
  for (const [cat, items] of grouped) {
    blocks.push(`### ${categoryLabels[cat] ?? cat}`, ...items, "");
  }

  return [
    "",
    "=== PRODUCT KNOWLEDGE BASE (产品知识库 — 地面真相，强制约束) ===",
    "Below is verified product knowledge from the product knowledge base. This is GROUND TRUTH (地面真相).",
    "ALL factual product attributes, selling points, specifications, materials, and usage scenarios in the output MUST come from these entries.",
    "",
    ...blocks,
    "=== END KNOWLEDGE BASE ===",
    "",
    "=== KNOWLEDGE-BASE TEXT CONSTRAINT (知识库文案约束 — 强制执行) ===",
    "Since a product knowledge base is active, the following HARD CONSTRAINT applies to ALL text content in every section's `copy` field:",
    "",
    "RULE 1 — 文案基于知识库延写 (COPY EXTENDS FROM KNOWLEDGE BASE):",
    "- EVERY piece of text that will appear INSIDE the generated image (headlines, selling points, specs, ingredients, certifications, claims, data points, brand info) MUST be grounded in the knowledge base entries above.",
    "- You MAY extend, rephrase, and combine knowledge base facts into rich, compelling marketing copy. For example, if the knowledge base says '精选澳洲牛腱肉', you MAY write '澳洲进口牛腱肉，大块真材实料看得见' — this is valid extension because the core claim traces back to the knowledge base.",
    "- You MAY write natural marketing language (e.g., '匠心品质', '真材实料', '一口满足') to connect and embellish known facts, as long as the underlying factual claims are knowledge-base-grounded.",
    "- However, you MUST NOT introduce any NEW factual claim that has NO basis in the knowledge base. For example, if the knowledge base does NOT mention '0添加防腐剂', you MUST NOT write it — even if it sounds plausible for the product category.",
    "- If the knowledge base says '蛋白质含量≥12g/100g', you MAY write '高蛋白，每100g含12g蛋白质' — this is rephrasing, not fabrication. But you MUST NOT write '蛋白质含量≥15g/100g' — that changes the data.",
    "",
    "RULE 2 — 空白优于虚构 (OMISSION OVER FABRICATION):",
    "- If the knowledge base lacks 'target audience' info → do NOT invent a target audience. Leave the corresponding copy focused on what IS known.",
    "- If the knowledge base lacks 'usage scenario' info → do NOT invent scenarios. Use the scenarios that ARE present in the knowledge base.",
    "- If the knowledge base lacks specific numbers or certifications → do NOT fabricate them. Write copy without those claims.",
    "",
    "RULE 3 — 视觉创意不受约束 (VISUAL CREATIVITY IS UNCONSTRAINED):",
    "- This constraint applies ONLY to text content (copy, headlines, selling points, data claims).",
    "- Banner shapes, tag styles, brand badge styles, decorative frames, corner tags, composition, lighting, atmosphere, color design, layout density, props, garnishes, and ALL other visual/directional elements in `visualPrompt` are COMPLETELY FREE and UNCONSTRAINED by the knowledge base.",
    "- You should be as creative and varied as possible with visual layout, composition, and decorative elements — the knowledge base only constrains WHAT TEXT goes into the image, not HOW the image looks.",
    "",
    "RULE 4 — 违反后果:",
    "- Fabricated product claims mislead consumers and violate advertising regulations. This is a HARD CONSTRAINT, not a suggestion.",
    "- When in doubt, OMIT the claim rather than risk fabrication.",
    "=== END KNOWLEDGE-BASE TEXT CONSTRAINT ===",
  ];
}

/**
 * 构建素材搭配约束块（条件性注入）
 * 当有上传素材标签时注入素材搭配规则，否则不注入
 */
function buildAssetPairingBlock(
  assetLabels?: { type: string; label: string; id: string }[],
): string[] {
  if (!assetLabels || assetLabels.length === 0) return [];

  const grouped = new Map<string, typeof assetLabels>();
  for (const a of assetLabels) {
    const list = grouped.get(a.type) ?? [];
    list.push(a);
    grouped.set(a.type, list);
  }

  const lines: string[] = [
    "",
    "=== AVAILABLE PROJECT ASSETS (项目可用的真实图片素材) ===",
    "Below are the real product images uploaded to this project. When writing visualPrompts:",
    "1. You MUST reference the actual content visible in these images — NEVER fabricate scenes or visuals that contradict them.",
    "2. Match the product's real appearance (color, shape, packaging design) as shown in the packaging image.",
    "3. For sections showing prepared/cooked versions, use the ingredient images to understand what the real ingredients look like.",
    "4. The product information image contains verified specs, ingredients, and compliance data — use it as ground truth.",
    "",
  ];
  for (const [type, items] of grouped) {
    const labels = items.map((i) => `"${i.label}"`).join(", ");
    lines.push(`- ${type}: ${labels} (${items.length}张)`);
  }
  lines.push(
    "",
    "=== IMAGE ASSET PAIRING RULE (全页面素材搭配规则 — 每条违反都会导致图像单调) ===",
    "EVERY single image in this project (hero AND detail) MUST feature at least 2 different uploaded assets as co-subject visual elements.",
    "A single-subject-with-reference image wastes the user's carefully uploaded multi-angle product materials.",
    "",
    "CRITICAL — PACKAGING REPETITION RULE (外包装重复限制):",
    "PACKAGING (外包装) MUST appear ONLY in: hero_01 + 最多1张详情页 (如 detail_01 或 detail_02).",
    "Apart from those, PACKAGING MUST NOT appear in any other image.",
    "",
    "=== HERO ASSET PAIRING (头图搭配 — 5张必须全部搭配) ===",
    "- hero_01 (主图): PACKAGING as primary + 1 PRODUCT real-shot as companion (e.g., '产品外包装图居中，产品实物图-正面放在右侧')",
    "- hero_02 (成品展示): Finished dish as primary + 1 INGREDIENT item as companion (e.g., '成品碗盘为主，产品调料图-辣椒包散落桌面') — NO PACKAGING",
    "- hero_03 (真材实料): Core ingredient(s) as primary + 1 PRODUCT real-shot as companion (e.g., '食材微距为主，产品实物图-侧面融入背景') — NO PACKAGING",
    "- hero_04 (制作场景): Cooking action as primary + 1 INGREDIENT as companion (e.g., '烹饪动作为主，产品调料图-调料包被撕开') — NO PACKAGING",
    "- hero_05 (使用场景): Lifestyle scene as primary + 1 PRODUCT real-shot as companion (e.g., '生活场景为主，产品实物图-成品放在桌上') — NO PACKAGING",
    "",
    "=== DETAIL PAGE ASSET PAIRING (详情页搭配 — 9张必须全部搭配) ===",
    "Every detail section MUST explicitly pair at least 2 asset labels in its visualPrompt.",
    "- detail_01~03 (首屏+品牌+特写): Pair PRODUCT + INGREDIENT (e.g., '产品实物图居中 + 产品调料图-辣椒包放在前景虚化')",
    "- detail_04~06 (原料+溯源): Pair INGREDIENT + PRODUCT (e.g., '产品调料图-牛肉包特写为主 + 产品实物图放在角落作为参照')",
    "- detail_07~09 (场景+配量+教程): Pair PRODUCT + INGREDIENT (e.g., '产品实物图-成品为主 + 产品调料图-酱料包散落桌面')",
    "Each detail page MUST use a DIFFERENT INGREDIENT or PRODUCT variant — do not reuse the same asset label in consecutive pages.",
    "",
    "=== UNIVERSAL PAIRING RULES (全域搭配规则) ===",
    "1. EVERY section's visualPrompt MUST explicitly name at least 2 labels from AVAILABLE PROJECT ASSETS above (e.g., '产品实物图-正面' + '产品调料图-辣椒包').",
    "2. If a section's visualPrompt only mentions 1 asset or none — it is INVALID. REWRITE it.",
    "3. Do NOT use the phrase '产品外包装图' in any detail page unless it is the ONE allowed detail page.",
    "4. Each asset label must appear as a RECOGNIZABLE visual subject — not a tiny blurred speck in the corner.",
    "5. In visualPrompt, use the exact asset labels from above, like: 'Main subject: 产品实物图-正面. Companion element: 产品调料图-辣椒包 scattered on the surface at 40% scale relative to main subject.'",
    "=== END IMAGE ASSET PAIRING RULE ===",
    "",
    "=== END AVAILABLE ASSETS ===",
  );

  return lines;
}

export function buildSectionPlanningPrompt(
  analysis: ProductAnalysisOutput,
  style: string,
  platform: string,
  detailSectionCount = 6,
  heroImageCount = 4,
  contentLanguage: ContentLanguage = "zh-CN",
  associatedImageContexts?: AssociatedImageContext[],
  knowledgeEntries?: { category: string; title: string; content: string }[],
  assetLabels?: { type: string; label: string; id: string }[],
  _searchContext?: string,
  _agentMode?: boolean,
) {
  const styleLabel = styleLabels[style as StyleOption] ?? style;
  const platformLabel = platformLabels[platform as PlatformOption] ?? platform;
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  const planningContext = {
    productName: analysis.productName,
    category: analysis.category,
    subcategory: analysis.subcategory,
    material: analysis.material,
    color: analysis.color,
    specifications: analysis.specifications,
    styleTags: analysis.styleTags.slice(0, 8),
    targetAudience: analysis.targetAudience.slice(0, 6),
    usageScenarios: analysis.usageScenarios.slice(0, 6),
    coreSellingPoints: analysis.coreSellingPoints.slice(0, 8),
    differentiationPoints: analysis.differentiationPoints.slice(0, 6),
    userConcerns: analysis.userConcerns.slice(0, 6),
    recommendedFocusPoints: analysis.recommendedFocusPoints.slice(0, 8),
    suggestedSectionPlan: analysis.suggestedSectionPlan.slice(0, 8),
  };

  const associatedSummary = associatedImageContexts && associatedImageContexts.length > 0
    ? buildAssociatedContextSummary(associatedImageContexts)
    : null;

  const platformElementsGuide = buildPlatformImageElements(platform, contentLanguage);

  const result = [
    "You are a senior e-commerce content strategist and mobile detail-page planner.",
    `Platform: ${platformLabel}`,
    buildStyleInstruction(style),
    buildProductBackgroundExtension(analysis),
    buildTypographyConstraint(contentLanguage),
    `Target content language: ${targetLanguage}`,
    "Create a mobile product-detail section plan based on the planning context below.",
    "Return strict JSON only.",
    `The output must contain exactly ${heroImageCount + detailSectionCount} sections in total.`,
    `You must create exactly ${heroImageCount} hero sections and exactly ${detailSectionCount} non-hero detail sections.`,
    "All hero sections must come first in the output array.",
    `Among all hero sections, the FIRST hero section is the PRIMARY hero image (主图) — it has the most complete marketing border watermark elements (top title banner, bottom promotion banner, left-side selling-point tags, corner brand badge).`,
    `The remaining ${heroImageCount - 1} hero sections are SECONDARY hero images (副图) — they use an EQUALLY PREMIUM design framework with side banners, floating tags, corner badges, and decorative elements that maintain the SAME visual quality and polish as the primary hero. The design language may use a slightly more airy composition, but the finish, 3D depth, material quality, and commercial polish must be IDENTICAL to hero_01.`,
    `Hero sections represent individual square hero gallery images, so each hero section must have a distinct first-screen communication role across these ${heroImageCount} angles.`,
    "The primary hero carries the most commercially dense message; secondary heroes deliver variety with EQUAL production value — ALL 5 must look like they belong to the same premium campaign shot on the same day by the same photographer.",
    "The hero sections should cover different roles such as primary visual, core selling point, scenario mood, trust, and differentiation without repeating the same purpose.",
    "",
    buildHeroStyleAdaptation(style, analysis),
    "",
    "=== HERO CONTENT TEMPLATE (头图内容模板 — 5张头图固定角色) ===",
    "CRITICAL: These templates describe ROLES and COMMUNICATION GOALS — NOT the visual style. The background material, lighting, props, and atmosphere in your visualPrompts MUST come from the VISUAL STYLE dimensions above AND from the HERO IMAGE STYLE ADAPTATION block above. The style adaptation defines WHICH material / color / typography / atmosphere to use for each hard constraint — it does NOT delete or skip any hard constraint. Every style must keep ALL hard constraint element categories present; the style only changes the LOOK of each element.",
    "",
    "hero_01 (主图/PRIMARY) — 必须同时满足以下 10 项硬约束（表现形式由所选风格决定）：",
    "",
    "HC1 — 信息密度 100%: 画面必须饱满无留白，每个角落（左上/右上/左下/右下/顶部/底部）都必须有视觉或文字内容。风格决定：街潮用深色木纹+火焰/辣椒填充；极简用微水泥纹理+细线框/阴影填充；水墨用墨迹/印章/笔触填充。",
    "HC2 — 双主体展示: 必须同时出现 (a) 产品包装（袋/盒/碗）3D 透视展示 和 (b) 成品食物大图。风格决定：包装材质渲染方式（写实摄影/插画/国潮金色描边/水墨淡彩/复古做旧）。",
    "HC3 — 三层标题系统: LAYER A 品牌名+Logo（顶部）；LAYER B 超大主标题 6-12 字 + 副标题/Slogan 1 行；LAYER C 顶部卖点条（2-3 个胶囊标签）。风格决定：字体（金属书法/细无衬线/毛笔/宋体/木刻）、配色（红金/绿白/黑白/朱红）。",
    "HC4 — 侧边卖点条: 左侧或右侧必须有 4-5 个图标+文字卖点条，每个卖点配独立小图标。风格决定：条形状（火焰图标条/绿色健康图标条/毛笔竖条/国潮祥云条/卡通气泡条）。",
    "HC5 — 底部强对比横幅: 底部必须有一条贯穿画面的强对比色横幅/标签带，包含 3-4 个核心卖点关键词。风格决定：横幅材质（金属拉丝/纸质/和纸/宣纸/霓虹发光/蜡封）。",
    "HC6 — 角标/徽章系统: 至少 3 个不同位置的角标/徽章：标题旁卖点角标、右下角信任徽章、角落促销/身份徽章。风格决定：徽章形状（圆形印章/爆炸贴/丝带/盾牌/港式招牌/朱红印章）。",
    "HC7 — 食材/配料可视化: 画面周围必须散落 5-8 个与产品相关的真实食材/配料（面条团、鸡蛋、蔬菜、肉类、香料）。风格决定：配料类型和渲染风格（写实/插画/水墨/卡通/复古）。",
    "HC8 — 调味料包独立展示: 必须独立展示 1-2 个调味料包（高汤包/酱料包/粉包），作为独立视觉元素。风格决定：料包设计风格（银色铝箔/绿色健康/黑色高端/复古纸包/卡通）。",
    "HC9 — 强色彩分区: 整张图必须有明确的 2-3 色主调，并用色块/背景/横幅进行视觉分区。风格决定：具体配色方案（街潮红黑/健康绿白/水墨黑白灰/国潮红金/复古黄棕）。",
    "HC10 — 品牌信息完整: 画面中必须可视化品牌 Logo、品牌名、产品名、净含量/规格信息（至少 3 项）。风格决定：信息的呈现形式（徽章/横幅/印章/标签/包装本身）。",
    "",
    "hero_01 copy = 品牌名 + 产品名 + 核心食欲 Slogan + 1-3 个卖点关键词（语气按风格调整：街潮用冲击力词，极简用清新词，水墨用雅致词）。",
    "",
    "hero_02 (副图1/Finished Dish) — 成品食欲展示: 成品碗盘为画面主角。必须覆盖 HC1 信息密度、HC2 成品食物、HC3 标题系统、HC5 底部横幅、HC6 角标徽章、HC7 配料可视化。蒸汽升腾+酱汁流光+筷子夹起面条的动态瞬间，配料散落在桌面。蒸汽/酱汁/配料的视觉表现按风格选择，但硬约束元素类别不可删减。",
    "hero_03 (副图2/Ingredient) — 真材实料展示: 核心食材展示。必须覆盖 HC1 信息密度、HC2 包装+食材、HC4 侧边卖点条、HC7 食材散落、HC8 料包展示、HC10 品牌信息。食材大面积散落平铺(60%+)，背景材质按风格选择，但硬约束元素类别不可删减。",
    "hero_04 (副图3/Making Scene) — 制作过程场景: 烹饪瞬间定格。必须覆盖 HC1 信息密度、HC2 包装+动作、HC3 标题系统、HC5 底部横幅、HC6 角标徽章、HC7 动态配料/液滴。飞溅液滴+蒸汽云雾+'3分钟'徽章+工艺标签群。飞溅/蒸汽/徽章的视觉风格按风格选择，但硬约束元素类别不可删减。",
    "hero_05 (副图4/Usage Scene) — 沉浸式使用场景: 完整生活场景。必须覆盖 HC1 信息密度、HC2 包装+场景、HC3 标题系统、HC5 底部横幅、HC9 色彩分区、HC10 品牌信息。场景道具类型/光影氛围按风格选择，但硬约束元素类别不可删减。",
    "",
    "=== HERO STYLE ADAPTATION OVERRIDE (头图风格适配覆盖 — 强制) ===",
    "The HERO IMAGE STYLE ADAPTATION block at the top of this prompt defines the visual language for the selected style. It applies to ALL hero images (hero_01, hero_02, hero_03, hero_04, hero_05), not just the primary hero.",
    "",
    "ALL styles (no low/high density split) keep the full marketing element set and 3-layer structure. The style ONLY changes the LOOK of each element — NOT whether elements exist or how many:",
    "- Marketing border: ALL styles keep top banner + bottom tag bar + corner brand badge + corner tag (25-35% coverage). Style changes the SHAPE / TYPOGRAPHY / COLOR / MATERIAL of these elements (street_appetite: metallic explosive stickers; minimalist: thin-line frames + off-white; ink_wash: seal + calligraphy; vintage_chinese: Song typeface + vermilion).",
    "- Background: ALL styles keep textured backgrounds (no flat white/gradient). Style changes WHICH texture (street_appetite: dark wood/slate; minimalist: micro-cement/off-white ceramic; ink_wash: rice paper; vintage_chinese: aged paper/coarse burlap).",
    "- Lighting: ALL styles keep directional lighting. Style changes color temperature (street_appetite: warm dramatic spotlight; minimalist: neutral soft; ink_wash: overhead spotlight; vintage_chinese: warm side-backlight).",
    "- Props/garnishes: ALL styles keep 5-8 props. Style changes WHICH props (street_appetite: chopsticks/oil droplets/chili scatter; minimalist: single bamboo chopstick/herb leaf; ink_wash: brush/tea set; vintage_chinese: coarse ceramic bowl/wooden tray).",
    "- Atmosphere effects: ALL styles keep at least 1-2 effects. Style changes WHICH effects (street_appetite: flames/chili scatter; minimalist: light steam/soft light; ink_wash: ink mist; vintage_chinese: warm bokeh).",
    "- Typography: ALL styles keep headline + labels. Style changes font (street_appetite: heavy metallic calligraphy; minimalist: thin sans-serif; ink_wash: brush calligraphy + seal; vintage_chinese: Song typeface).",
    "",
    "CRITICAL ANTI-HOMOGENIZATION: Different styles MUST look visually DISTINCT — but through DIFFERENT material/color/typography/atmosphere, NOT through deleting elements. A minimalist hero still has 3 layers + full marketing border + 5-8 props + textured bg — it just uses micro-cement bg, thin-line labels, neutral light, and subtle props instead of dark wood, metallic stickers, warm spotlight, and chili scatter. Do NOT collapse all styles into one look.",
    "",
    "=== DETAIL PAGE CONTENT TEMPLATE (详情页内容模板 — 9张详情页固定角色) ===",
    "detail_01 (首屏食欲大图/selling_points): 品牌+产品+食欲三层结构首屏 — 与hero_01同构但更聚焦食欲转化。顶部(15-20%)：品牌名+Logo+产品大标题(6-14字粗体)+卖点角标。中部(30-35%)：产品包装盒3D透视展示+标注线/气泡指向具体卖点(如'酱多料足！''选用XX原料')。底部(45-55%)：成品食物大图占核心位，极致食欲感，底部角落2-3个圆形图标徽章(核心原料/工艺卖点)。完整营销边框。copy=品牌名+产品名+核心食欲Slogan+2-3个卖点关键词。",
    "detail_02 (品牌背书/brand_trust): 品牌名®+品类定位+双原料图标+免责声明",
    "detail_03 (感官渲染/detail_closeup): 风味定位标题+五维口感(酸度/甜度/肉质/余味/层次)+俯拍成品图",
    "detail_04 (信任锚点/material): 真材实料微距特写+工艺说明(先炒后熬)+关键原料小图",
    "detail_05 (原料溯源A/material): 主料1产地/种植故事+具体参数+切面特写",
    "detail_06 (原料溯源B/material): 主料2品种/工艺故事+品质参数+关联成品体验",
    "detail_07 (效率驱动/scenario): 场景标题+时间承诺(X分钟)+动态飞溅食欲图+难度关联",
    "detail_08 (配量可视化/specs): 配置标题+N大材料拆包平铺+每包标注名称+外盒识别",
    "detail_09 (使用教程/summary): 教程标题+三步图标化流程(每步≤30字)+最终成品体验",
    ...buildZeroBlankAndLayerRule(),
    "",
    "=== HERO SCENE STORYTELLING RULE (头图场景叙事规则) ===",
    "Each hero image must tell a COMPLETE micro-story, not just 'display a product in state X'.",
    "",
    "- hero_01 tells: 'This is what you're buying — and here's exactly why it's worth it' (product + specs + trust)",
    "- hero_02 tells: 'This is what it looks like ready to eat — and it's IRRESISTIBLE' (finished dish + appetite explosion)",
    "- hero_03 tells: 'Here are the REAL ingredients that make it great — see the quality yourself' (ingredient showcase + quality proof)",
    "- hero_04 tells: 'This is how easy/authentic the preparation is — you can do this' (process + action + accessibility)",
    "- hero_05 tells: 'This is how it fits into YOUR life — imagine yourself here' (lifestyle + emotional connection)",
    "",
    "Every visualPrompt must convey the STORY, not just the scene. The composition, props, lighting, and design elements must all serve the story.",
    "",
    "=== SECONDARY HERO IMAGE DETAILED REQUIREMENTS (副图详细生成要求 — 必须逐张差异化) ===",
    `Each of the ${heroImageCount - 1} secondary hero images MUST be planned with ALL of the following concrete visual details in its visualPrompt. Do NOT write vague or generic visualPrompts — every secondary hero needs a specific, actionable visual direction.`,
    "",
    "IMPORTANT — STYLE ADAPTATION: The concrete values you choose for surface, props, lighting, and density below MUST be derived from the VISUAL STYLE dimensions at the top. If the style says 'black stone slab, hard side-light, metallic props, 85%+ fullness', use those — not the generic photography defaults listed as examples.",
    "",
    "For EACH secondary hero, you MUST specify in its visualPrompt:",
    "1. PRODUCT STATE (产品状态): What state is the product in? Choose ONE that is DIFFERENT from the primary hero:",
    "   - Packaged view (unopened product, showing brand/flavor/label design)",
    "   - Ingredients spread (noodle cake + all seasoning packets laid out)",
    "   - Cooking/preparation action (pouring sauce, adding hot water, stirring)",
    "   - Close-up/macro detail (noodle texture, sauce coating, garnish detail, steam wisps)",
    "   - Lifestyle context (product in a real-life setting — desk, kitchen, outdoor)",
    "   - Multiple angles (side view, top-down flat lay, 30-degree angle, dynamic tilt)",
    "",
    "2. CAMERA ANGLE (拍摄角度): Specify the exact camera perspective — must DIFFER from primary hero:",
    "   - Top-down flat lay (90° overhead)",
    "   - 30-degree overhead (slight俯拍)",
    "   - Eye-level straight-on (平视)",
    "   - Low angle (仰拍, 15-20° from table surface)",
    "   - Extreme close-up / macro (微距特写)",
    "   - Side profile (侧面)",
    "   - Dynamic tilt (倾斜15°, 增加动感)",
    "",
    "3. SURFACE & BACKGROUND (桌面与背景): Specify the exact surface material and background (OVERRIDDEN by low-density styles):",
    "   - Default: dark wooden table / bamboo mat / slate board / marble counter / linen cloth / ceramic plate",
    "   - Low-density styles: white / off-white / pale wood / light linen / soft gray surfaces are REQUIRED. Dark moody surfaces are FORBIDDEN.",
    "   - Must have visible texture (grain, weave, polish) — but low-density styles may use subtle texture rather than heavy grain",
    "   - Background depth: layered environment, warm gradient, or contextual blur — NOT flat color. Low-density styles: soft natural blur or clean whitespace is acceptable",
    "",
    "4. PROPS & GARNISHES (道具与配菜): List SPECIFIC props to include around the product:",
    "   - Default: chopsticks, scallions, chili oil, sesame seeds, egg, meat pieces, fresh herbs",
    "   - Low-density styles: minimal props — 1-2 fresh garnishes (cherry tomato, basil leaf, lemon wedge) or none. NO chili oil splashes, NO heavy spices, NO dramatic steam clouds.",
    "   - Context props: tableware, cups, napkins, cooking utensils, packaging materials",
    "   - Lifestyle props: laptop, phone, book, plant, candle (for lifestyle scenes)",
    "   - Props should fill empty space and add visual richness — but for low-density styles, intentional whitespace is REQUIRED and props must be sparse",
    "",
    "5. LIGHTING & MOOD (光影与氛围): Specify the exact lighting direction and emotional tone:",
    "   - Default: warm window light / desk lamp glow / backlight for steam / soft overhead",
    "   - Low-density styles: soft natural window light or bright even studio light. NO dramatic spotlight, NO deep shadows, NO warm-amber color cast unless the style calls for it",
    "   - Color temperature: 凭审美选择——暖调通常更适合食物，但不必锁定色温区间。Low-density styles: neutral-to-warm natural (4500K-5500K)",
    "   - Mood: indulgent / informative / cozy / premium / playful / dramatic. Low-density styles: fresh / serene / natural / healthy / authentic",
    "",
    "6. COMPOSITION DENSITY (构图密度):",
    "   - Default (high-density styles): The frame must be RICH and FULL with zero wasted space:",
    "     * Main subject occupies 45-60% of frame as the clear hero",
    "     * Background environment and props fill 25-35% with depth and texture",
    "     * Foreground framing elements (blurred props, garnish, steam) fill 5-10%",
    "     * Design/marketing overlay occupies 20-25%",
    "     * Every part of the frame has assigned content — NO dead zones",
    "   - Low-density styles: The frame must be BALANCED with intentional whitespace:",
    "     * Main subject occupies 45-55% of frame",
    "     * Intentional whitespace: 25-40% of frame (clean, designed pause)",
    "     * Atmosphere/props: 15-25% (subtle texture, fresh garnish, soft shadows)",
    "     * Design/marketing overlay: 5-12% only (1-3 subtle labels)",
    "     * A low-density hero with crowded marketing elements is a FAILURE",
    "",
    "7. COMMUNICATION GOAL (传达目标): What is this secondary hero SELLING or COMMUNICATING?",
    "   - Core selling point (e.g., 'rich broth', 'generous portions', 'premium ingredients')",
    "   - Lifestyle mood (e.g., 'late-night comfort food', 'quick office lunch')",
    "   - Trust factor (e.g., 'quality ingredients visible', 'brand heritage')",
    "   - Differentiation (e.g., 'unique flavor', 'special preparation method')",
    "",
    "CRITICAL RULES FOR SECONDARY HEROES:",
    "- NO two secondary heroes should share the same product state + camera angle combination",
    "- Each secondary hero MUST look visually DISTINCT from the primary hero and from each other",
    "- The visualPrompt for each secondary hero must be at least 3-4 sentences long with concrete details",
    "- If the product is food, at least one secondary hero should show the PACKAGED product (not just cooked)",
    "- If the product is food, at least one secondary hero should show a CLOSE-UP or MACRO detail",
    "- Every secondary hero must have a clear, specific scene — not a generic 'product on background'",
    "",
    "=== MARKETING ELEMENT STYLE VARIETY FOR HERO IMAGES (头图营销元素样式变化 — 逐图不同) ===",
    "For each of the following 4 visual dimensions, every hero image MUST pick a DIFFERENT style. No two heroes may share the same combination.",
    "Each hero's visualPrompt MUST explicitly name its chosen style for each dimension and note that it differs from other heroes.",
    "",
    "DIMENSION 1 — BANNER SHAPE (横幅形状 — 每张头图不同):",
    "- Options: full-width rectangle / curved arc / angled diagonal / floating card / ribbon banner / corner flag / wavy ribbon",
    "- visualPrompt example: 'Banner shape: curved arc (different from hero_01's full-width rectangle)'",
    "",
    "DIMENSION 2 — TAG STYLE (卖点标签样式 — 每张头图不同):",
    "- Options: rounded rectangle / water-drop shape / leaf shape / scroll shape / shield shape / circle badge / hexagon / diamond / burst explosion (爆炸贴) / speech bubble (对话框)",
    "- visualPrompt example: 'Tag style: leaf-shaped (different from hero_01's rounded rectangle)'",
    "",
    "DIMENSION 3 — BRAND BADGE STYLE (品牌徽章样式 — 每张头图不同):",
    "- Options: circle / shield / wax seal / vintage label / ribbon / simple text / hexagonal / badge with wings",
    "- visualPrompt example: 'Badge style: wax-seal (different from hero_01's ribbon badge)'",
    "",
    "DIMENSION 4 — DECORATIVE FRAME (装饰边框样式 — 每张头图不同):",
    "- Options: double-line frame / single thin border / corner ornaments / parallel lines / dotted border / gradient border / no frame (clean edge)",
    "- visualPrompt example: 'Frame: double-line (different from hero_01's single thin border)'",
    "",
    "DIMENSION 5 — CORNER TAG STYLE (角标样式 — 每张头图不同):",
    "- Options: triangle fold (三角折角) / circle badge (圆形角标) / star burst (星形角标) / diagonal cut (斜切三角) / ribbon corner (丝带角标) / none (无角标)",
    "- visualPrompt example: 'Corner tag: star burst (different from hero_01's triangle fold)'",
    "",
    "DIMENSION 6 — 3D MATERIAL EFFECT (3D材质效果 — 每张头图不同):",
    "- Banner 3D: emboss (浮雕凸起) / gold foil (烫金) / velvet (丝绒) / glossy raised (高光凸起) / etched glass (磨砂) / layered (多层叠压)",
    "- Tag/Badge 3D: metallic (金属凸版) / wax seal (火漆蜡封) / 3D ribbon (立体丝带) / pillow emboss (枕形凸起) / laser cut shadow (激光雕刻投影) / double layer (双层结构)",
    "- visualPrompt example: 'Banner 3D: gold foil with reflective highlights. Tag 3D: metallic raised with embossed text. (different from hero_01's emboss banner)'",
    "",
    "MANDATORY: Each hero's visualPrompt MUST explicitly list its chosen style for all 6 dimensions.",
    "No two heroes may share the same combination of these 6 dimensions.",
    "Each hero's visualPrompt must include a comparison note: 'This hero differs from hero_01 by using [X banner] instead of [Y banner], [A tags] instead of [B tags]'",
    "",
    "=== VISUAL COMPOSITION & ATMOSPHERE VARIETY (头图构图与氛围变化 — 每张必须不同) ===",
    "Beyond marketing element styles, each hero image's OVERALL visual composition and atmosphere MUST be distinctly different.",
    "Each hero's visualPrompt MUST specify unique choices for the following dimensions. No two heroes may share the same combination.",
    "",
    "DIMENSION 7 — COMPOSITION STYLE (构图方式 — 每张不同):",
    "- Options: centered / rule-of-thirds / diagonal / symmetrical / asymmetrical / floating-above / close-crop / wide-angle",
    "- visualPrompt must state: 'Composition: [chosen style] (different from other heroes)'",
    "",
    "DIMENSION 8 — LIGHTING DIRECTION (打光方向 — 每张不同):",
    "- Options: top-left 45° / backlit / side-lit-left / side-lit-right / rim-light / soft-overhead / dramatic-under / natural-window-light",
    "- visualPrompt must state: 'Lighting: [chosen direction] (different from other heroes)'",
    "",
    "DIMENSION 9 — ATMOSPHERE & MOOD (画面氛围 — 每张不同):",
    "- Options: warm-cozy / dramatic-indulgent / clean-premium / playful-energetic / moody-dark / bright-fresh / luxurious-golden / natural-organic",
    "- visualPrompt must state: 'Atmosphere: [chosen mood] (different from other heroes)'",
    "",
    "DIMENSION 10 — PRODUCT PRESENTATION STATE (产品呈现状态 — 每张不同):",
    "- Options: packaged / prepared-ready-to-eat / ingredient-spread / action-shot (pouring/stirring) / close-up-detail / lifestyle-context / multi-angle",
    "- visualPrompt must state: 'Product state: [chosen state] (different from other heroes)'",
    "",
    "DIMENSION 11 — COLOR DESIGN (色彩设计 — 顶级审美自由发挥):",
    "- 以顶级电商美工的审美为每张图独立设计配色，不受色板/配色公式约束",
    "- 5张头图走5种完全不同的色彩审美方向",
    "- 关键原则：同一张图内的营销元素（横幅/标签/徽章/角标）保持在同一色系内即可，每种元素可以有微妙的色相偏移（±15°~30°），产生丰富层次而非单调重复",
    "- visualPrompt must state: 'Color direction: [describe the aesthetic color direction, e.g. warm amber luxury / cool mint freshness / deep burgundy indulgence / muted earth sophistication / bold contrast pop]'",
    "",
    "FULL DIFFERENTIATION RULE: When all 12 dimensions (6 marketing element + 6 visual composition) are combined, every hero image MUST look like it was created by a different designer with a different creative direction. If you cannot tell the heroes apart by their visualPrompts alone, REWRITE them.",
    "",
    "All non-hero sections must come after the hero sections.",
    "Each section item must include: id, type, title, goal, copy, visualPrompt, editableFields.",
    `All user-facing section titles, goals, copy, and in-image text instructions must be written in ${targetLanguage}.`,
    "visualPrompt must use this exact two-part format:",
    `Primary Prompt: <visual direction in ${targetLanguage}>`,
    "English Prompt: <English image prompt>",
    "The visualPrompt must explicitly require the image model to generate the marketing title, selling points, supporting copy, and CTA directly inside the image, instead of relying on external DOM text.",
    `Allowed section types: ${sectionTypeGuide}`,
    "editableFields should include at least one of: sellingPoints, tone, compositionHint.",
    "Avoid duplicate section goals and avoid repeating the same section type excessively.",
    "The section flow should feel commercially complete and conversion-oriented.",
    "",
    "=== IMAGE TEXT SOURCE RULE (图片文字来源规则) ===",
    "The text that appears INSIDE each generated image comes from that section's `copy` field.",
    "- The `copy` field contains all marketing text (headline, selling points, promotion, etc.)",
    "- The `visualPrompt` describes the VISUAL LAYOUT and SCENE — where text elements are placed, but NOT the text content itself",
    "- The image generation AI will render the copy text into the positions described in visualPrompt",
    "",
    "=== COPY FACTUALITY MANDATE (文案真实性强制规则 — 不可违反) ===",
    "ALL text content in every section's `copy` field MUST be factually grounded in the product analysis results provided below (Planning context).",
    "",
    "RULE 1 — 禁止虚构产品信息:",
    "- Do NOT fabricate any product specifications, ingredients, certifications, test results, or manufacturing details that are NOT present in the planning context.",
    "- Do NOT invent specific numbers (e.g., '蛋白质含量≥12g', 'SGS 268项检测', '日晒72小时') unless they appear in the planning context or knowledge base.",
    "- Do NOT create fake user reviews, fake sales figures, or fake certification claims.",
    "- Do NOT attribute qualities to the product that cannot be inferred from the provided analysis data.",
    "",
    "RULE 2 — 仅使用已知信息进行文案编写:",
    "- Product name, category, material, color, specifications: use EXACTLY what the planning context provides.",
    "- Selling points: derive ONLY from coreSellingPoints and differentiationPoints in the planning context.",
    "- Usage scenarios: derive ONLY from usageScenarios in the planning context.",
    "- Target audience: derive ONLY from targetAudience in the planning context.",
    "- If the planning context lacks a specific detail, write the copy WITHOUT that detail — do NOT fill the gap with invented information.",
    "",
    "RULE 3 — 允许的合理推演 (limited inference):",
    "- You MAY rephrase and combine known facts into compelling marketing language (e.g., '真材实料' based on known ingredient info).",
    "- You MAY use general marketing language that does not make specific factual claims (e.g., '匠心品质', '精选好料').",
    "- You MAY describe visual composition and mood freely in visualPrompt — visual direction is creative, not factual.",
    "- But ANY specific data point, number, certification, or technical claim in `copy` MUST trace back to the planning context.",
    "",
    "RULE 4 — 违反后果:",
    "- Fabricated product claims can mislead consumers and violate advertising regulations. This is a HARD CONSTRAINT, not a suggestion.",
    "- If in doubt about a fact, OMIT it rather than invent it.",
    "",
    "--- copy 字段要求 ---",
    "Each section's `copy` field should contain rich, product-specific marketing text. Write naturally based on the product's actual features, selling points, and context. Do NOT use generic template text.",
    "",
    "--- visualPrompt 布局要求 (ALL hero images) ---",
    "Every hero image's `visualPrompt` must describe a RICH, DENSE commercial VISUAL LAYOUT with ZERO empty space:",
    "1. Describe where ALL mandatory platform elements are positioned (top banner, bottom banner, left tags, brand badge, ingredient scatter)",
    "2. Describe at least 3 layers of background (foreground表層 + midground中景 + background depth/atmosphere)",
    "3. List at least 5-8 specific props/garnishes/ingredients arranged around the product",
    "4. Include at least 2 atmospheric effects (steam + light rays, or condensation + sparkle)",
    "5. 凭审美决定横幅、标签、徽章、背景的颜色——自由搭配，怎么好看怎么来",
    "6. Describe the text content and placement of every visible text element",
    "CRITICAL: The image must look like a FINISHED, FULL commercial poster — NO blank/empty zones anywhere in the frame. Every square centimeter must have visual content (product, text, props, texture, or decoration).",
    "",
    "For ALL hero images, the visualPrompt must ALSO explicitly state:",
    "7. BANNER SHAPE chosen (from the MARKETING ELEMENT STYLE VARIETY list) — must differ from other heroes",
    "8. TAG STYLE chosen — must differ from other heroes",
    "9. BRAND BADGE STYLE chosen — must differ from other heroes",
    "10. DECORATIVE FRAME chosen — must differ from other heroes",
    "11. CORNER TAG STYLE chosen — must differ from other heroes",
    "12. A comparison note: 'This hero differs from hero_01 by using [X banner] instead of [Y banner], [A tags] instead of [B tags], [P corner tag] instead of [Q corner tag]'",
    "13. HARD CONSTRAINT CHECKLIST: For hero_01, explicitly confirm ALL 10 hard constraints are present; for hero_02-05, confirm the required subset from HERO CONTENT TEMPLATE.",
    "14. 双主体确认: Explicitly describe that both 'product packaging 3D perspective' AND 'finished food hero shot' appear in the same frame.",
    "15. 侧边条确认: Explicitly describe '4-5 icon+text selling-point tags on the left OR right side' with specific content.",
    "16. 料包确认: Explicitly describe the position and appearance of 'independently displayed seasoning packets (broth/sauce/powder)'.",
    "17. 品牌信息确认: List which brand info elements are visually present (brand Logo, brand name, product name, net weight/specs).",

    "--- goal 字段要求 ---",
    "Each section's `goal` must be specific and conversion-oriented. Examples of GOOD goals:",
    "- '通过成品碗面的极致食欲画面+多层卖点标签，在1秒内抓住用户注意力并传达核心价值'",
    "- '通过展示全部配料包和原料品质，打消用户对食品安全和口味的顾虑'",
    "BAD goals (too vague): '展示产品' '吸引用户' '介绍卖点'",
    "",
    "--- title 字段要求 ---",
    "Each section's `title` must be a compelling, specific Chinese headline (4-10 characters), NOT a generic category name.",
    "GOOD: '深夜食堂·一碗入魂' | '真材实料·看得见' | '匠心工艺·日晒72小时'",
    "BAD: '主图' | '产品展示' | '卖点介绍' | '详情'",
    ...buildCopyDifferentiationRule(),
    "",
    "=== QUALITY PRESERVATION MANDATE (质量保障 — 差异化不可牺牲美感) ===",
    "All the variation rules above (marketing elements, composition, atmosphere, copy) MUST be achieved WITHOUT reducing image quality or aesthetic standards.",
    "",
    "QUALITY FLOOR (美感底线 — 不可突破):",
    "1. Every hero image MUST look like a FINISHED, PUBLISHED commercial poster — never a draft, sketch, or test.",
    "2. All text must be sharp, legible, and properly rendered — no garbled characters, no blurry text, no overlapping text boxes.",
    "3. The product must be the clear visual hero — occupying at least 55% of the frame with strong visual presence.",
    "4. Background must have visible texture and depth — plain white, solid color, or flat gradient backgrounds are UNACCEPTABLE. The background MATERIAL and COLOR follow the style's own 7 dimensions (defined in STYLE VISUAL CONSTRAINT) — e.g. minimalist uses micro-cement/off-white, ink_wash uses rice paper, vintage_chinese uses aged paper/warm brown, street_appetite uses dark wood/slate. All styles still require visible texture and depth; the style only changes WHICH texture/color, not whether texture exists.",
    "5. Lighting must be directional and physically consistent — no conflicting light sources, no unnatural shadows. Color temperature follows the style's own definition (warm for vintage_chinese, neutral for minimalist, cool for japanese_fresh, warm-dramatic for street_appetite — do NOT force one temperature onto all styles).",
    "6. Props and decorative elements must be contextually relevant and well-arranged — not random or chaotic. All styles keep the full prop/garnish count required by the platform elements and layer rules above (5-8 props minimum) — the style only changes WHICH props match its aesthetic, not how many.",
    "7. The overall composition must be balanced and intentional — no lopsided layouts, no awkward empty zones, no cluttered chaos. All styles maintain the 4-layer depth and zero-blank-space requirements above; the style changes the LAYOUT ARRANGEMENT (centered / rule-of-thirds / diagonal / symmetrical per style), not the density.",
    "8. Marketing elements (banners, tags, badges) must be professionally integrated into the composition — not floating or disconnected. All styles keep the full marketing element set (top banner, bottom banner, floating tags, brand badge, corner tag, 3D material) required by the platform rules above — the style only changes the SHAPE / TYPOGRAPHY / COLOR / MATERIAL of these elements per its aesthetic, not whether they exist.",
    "",
    "VARIATION vs QUALITY RELATIONSHIP:",
    "- GOOD variation: changing banner shape from 'curved arc' to 'ribbon banner' while maintaining the same professional finish",
    "- BAD variation: changing to a sloppy layout just to be different",
    "- GOOD variation: shifting mood from 'warm-cozy' to 'dramatic-indulgent' while keeping the same high production value",
    "- BAD variation: using a low-quality aesthetic just to be different from another hero",
    "- RULE: Each hero image must score equally high on commercial quality, regardless of its stylistic direction",
    "",
    "FINAL CHECK BEFORE OUTPUT:",
    "Ask yourself for EACH hero image: 'Would a professional e-commerce brand be proud to use this image as their main product photo?'",
    "If the answer is NO for any hero, IMPROVE IT — do not accept lower quality just because it needs to look different from other heroes.",
    "",
    "=== DETAIL PAGE SECTIONS: 9:16 VERTICAL IMAGE REQUIREMENTS (详情页模块：9:16竖版图要求 — 强制执行) ===",
    "",
    "All non-hero detail page sections generate 9:16 vertical images (1080×1920px). Each image is a FULL-SCREEN slide",
    "that the user scrolls through on their phone. Every single image must be independently compelling and conversion-driven.",
    "",
    "--- CORE PRINCIPLE: ONE SCREEN, ONE TOPIC (一屏一主题) ---",
    "Each detail page section = ONE screen = ONE core selling point. Do NOT cram multiple topics into one image.",
    "The user scrolls at high speed — if they can't understand this screen's message in 0.3 seconds, they skip it.",
    "",
    "--- 9:16 LAYOUT STRUCTURE (每张图的布局结构) ---",
    "Each 9:16 detail page image MUST be divided into three zones:",
    "",
    "TOP 1/3 — HEADLINE ZONE (标题冲击区):",
    "- Main headline (大标题): 6-12 characters, bold, high contrast — the FIRST thing users see",
    "- Sub-headline (副标题): 10-20 characters, supporting benefit or data point",
    "- Optional: brand badge, promotion tag, or trust indicator",
    "- Text must be LARGE enough to read on a phone screen at arm's length",
    "",
    "MIDDLE 1/3 — PRODUCT ZONE (产品主体区):",
    "- Product image occupies 55-70% of this zone as the clear visual hero",
    "- 2-3 floating selling-point tags (卖点标签) positioned around the product. 标签的形状/字体/配色按风格选择（街潮用爆炸贴金属字，极简用细线框无衬线小字，水墨用印章书法字），但标签数量保持2-3个不删减。",
    "- Supporting visual elements: props, ingredients, garnishes, textures — 道具类型按风格选择，数量按分层规则保持不删减。",
    "- This zone must look RICH — no large empty areas. 所有风格都要求饱满无空白；风格改变的是元素怎么布局/排版/配色，不是删减元素。",
    "",
    "BOTTOM 1/3 — CONVERSION ZONE (转化引导区):",
    "- Trust indicators: sales volume, review count, certification badges",
    "- OR value info: bundle presentation, quantity value, satisfaction guarantee",
    "- OR next-screen teaser: subtle arrow or text hinting at more content below",
    "- This zone bridges to the next screen — give users a reason to keep scrolling",
    "",
    "--- COPY WRITING RULES FOR DETAIL SECTIONS (详情页文案写作规则) ---",
    "",
    "1. SELLING POINT FORMULA (卖点提炼公式):",
    "   Each section's selling point must follow: PRODUCT ADVANTAGE → USER BENEFIT → PAIN POINT SOLVED",
    "   Example: '日晒72小时工艺' → '面条Q弹有嚼劲' → '告别软烂泡面'",
    "   Example: '凌晨4点采摘蔬菜' → '24小时内锁鲜封装' → '每一口都是新鲜'",
    "",
    "2. USE SPECIFIC DATA, NOT VAGUE ADJECTIVES (用数据说话，禁用模糊形容词):",
    "   ❌ BAD: '口感好' → ✅ GOOD: '日晒72小时，面条Q弹有嚼劲'",
    "   ❌ BAD: '食材新鲜' → ✅ GOOD: '凌晨4点采摘，24小时内锁鲜封装'",
    "   ❌ BAD: '分量足' → ✅ GOOD: '净含量200g，一包管饱'",
    "   ❌ BAD: '安全健康' → ✅ GOOD: '0添加防腐剂，SGS 268项检测通过'",
    "   ❌ BAD: '品质好' → ✅ GOOD: '精选河套平原高筋面粉，蛋白质含量≥12g/100g'",
    "   RULE: Every selling point MUST include at least ONE concrete number, measurement, or verifiable claim.",
    "",
    "3. HEADLINE MUST BE PUNCHY AND SPECIFIC (标题要有力且具体):",
    "   GOOD headlines: '一碗入魂·骨汤熬足8小时' | '真材实料·每包3大块牛肉' | '0添加·宝宝也能放心吃'",
    "   BAD headlines: '美味享受' | '优质食材' | '好吃不贵' | '品质保证'",
    "   RULE: Headline must contain a specific claim that competitors cannot easily copy.",
    "",
    "4. PAIN-POINT-DRIVEN COPY (痛点驱动文案):",
    "   First identify the user's hesitation, then address it directly:",
    "   - Hesitation: '方便面不健康' → Section: Show ingredients, certifications, 0-additive claims",
    "   - Hesitation: '怕不好吃' → Section: Show steaming hot bowl, noodle pull, real meat chunks",
    "   - Hesitation: '分量不够' → Section: Show 200g noodle cake, full bowl, comparison with hand",
    "",
    "--- DETAIL PAGE FLOW (详情页整体流转逻辑) ---",
    "The detail page sections MUST follow this conversion flow order:",
    "",
    "PHASE 1 — HOOK (吸引层, 1-2 sections):",
    "   Goal: Stop the scroll, create desire",
    "   Content: Most impactful selling point, hero product shot, core benefit headline",
    "   Example sections: SELLING_POINTS (核心卖点), SCENARIO (使用场景)",
    "",
    "PHASE 2 — VALUE (价值层, 2-3 sections):",
    "   Goal: Build product value, showcase quality and uniqueness",
    "   Content: Ingredient quality, manufacturing process, unique features, specifications",
    "   Example sections: MATERIAL (材质原料), DETAIL_CLOSEUP (细节特写), SPECS (规格参数)",
    "",
    "PHASE 3 — TRUST (信任层, 1-2 sections):",
    "   Goal: Eliminate doubts, build confidence",
    "   Content: Certifications, brand story, user reviews, comparison with competitors",
    "   Example sections: BRAND_TRUST (品牌信任), COMPARISON (竞品对比)",
    "",
    "PHASE 4 — CONVERT (转化层, 1 section):",
    "   Goal: Push to purchase, create desire",
    "   Content: Bundle presentation, gift packaging, quantity value, satisfaction guarantee",
    "   Example sections: GIFT_SCENE (礼盒套装), SUMMARY (总结推荐)",
    "",
    "RULE: Do NOT put trust/brand sections before value sections. The order MUST be: Hook → Value → Trust → Convert.",
    "",
    "--- SEAMLESS VISUAL TRANSITION BETWEEN DETAIL IMAGES (详情图之间的无缝衔接 — 最高优先级) ===",
    "详情页是一组连续滚动的画面，用户下滑时相邻页面绝对不允许有任何割裂感。",
    "以顶级电商美工的审美去把控整体的色彩流动感和节奏感，确保9张详情页像一部流畅的视觉叙事长卷。",
    "",
    "=== SEAMLESS TRANSITION RULES (无缝衔接规则 — 每条违反都会造成视觉断裂) ===",
    "",
    "RULE 1 — COLOR BRIDGE (色彩桥梁):",
    "- 所有详情页 MUST 使用同一个主背景色调方向 — 从 detailVisualAnchor.primaryBg 推导",
    "- 相邻页面之间的底色色相差必须 ≤30°（HSL H值），确保用户在滑动时感知不到色彩跳跃",
    "- 允许在同一个色调内做深浅层次变化（如深棕→中棕→浅米色，但底线是同一色相方向）",
    "- 明度变化必须有渐进感：相邻页面明度差 ≤15%，不允许从极深直接跳到极浅",
    "- 禁止色相跳跃：一张深棕木纹背景，下一张冷灰石板背景 — 这会产生明显的视觉断裂感，直接让用户觉得「不是同一家店」",
    "- 纹理材质可以变化（木纹→亚麻布→石板），但底色必须保持在同一色调范围内",
    "",
    "RULE 2 — COMPOSITION RHYTHM (构图节奏):",
    "- 相邻页面的构图重心不能同时居中或同时偏左 — 需要形成左右交替的阅读节奏",
    "- 标题区位置和大小风格保持系列一致，但相邻页面之间做微调避免完全重复",
    "- 卖点标签的排布密度保持一致，不能一张有8个标签下一张只有1个",
    "- 整体信息密度均匀分布，不能一张极满下一张极空",
    "",
    "RULE 3 — NARRATIVE FLOW (叙事流):",
    "- 详情页必须形成一条完整的叙事线：首屏食欲冲击 → 品牌信任 → 感官体验 → 质量证明 → 源头溯源 → 效率场景 → 配量展示 → 使用教程",
    "- 每个页面都必须为下一页面的到来做好铺垫（如当前页底部的视觉引导元素指向下一页的主题）",
    "- 不能出现叙事跳跃：不能从「原料品质」直接跳到「使用教程」，中间必须有逻辑桥梁",
    "",
    "RULE 4 — VISUAL WEIGHT CONTINUITY (视觉重量连续性):",
    "- 相邻页面的整体视觉重量（画面饱满度、色彩浓度、元素密度）不能有突变",
    "- 饱和度在相邻页之间变化不超过10%",
    "- 不能出现一张极暖(色温3500K)下一张极冷(色温6500K)的色彩温度跃变",
    "",
    "RULE 5 — ELEMENT ECHOING (元素呼应):",
    "- 关键设计元素（品牌徽章、标签形状、装饰纹理）在详情页之间应形成呼应关系",
    "- 同一色系的强调色在详情页间可以交替出现但不能完全消失再突然出现",
    "",
    "RULE 6 — DISCONNECTION DETECTION (割裂感自检):",
    "每张详情页完成后必须对相邻页面做割裂感自检：",
    "- 如果把这两张图拼在一起上下滑动，是否能感觉到流畅的自然过渡？",
    "- 如果突然从上一页跳到这一页，用户会不会觉得「怎么变了风格」？",
    "- 如果答案是「有割裂感」，则必须调整当前页面的色彩方向/构图/氛围直至无缝衔接",
    "",
    "同时统一的是排版气质:",
    "- 标题区位置和大小风格保持系列一致",
    "- 卖点标签的排布节奏保持一致",
    "- 整体氛围方向（高端/温暖/清新等）保持统一",
    "",
    "--- FOOD-SPECIFIC DETAIL PAGE RULES (食品类目专属规则) ---",
    "If the product is food (instant noodles, snacks, beverages, etc.), EVERY detail page image MUST follow:",
    "1. 凭审美搭配食欲色系——色温方向按风格自身7维度决定（见 STYLE VISUAL CONSTRAINT）：街潮/促销走暖色冲击，复古中式走暖黄棕，极简走中性米白，日系走冷调清新，水墨走黑白灰。不同风格用不同色温表达食欲感，不强制统一暖色。",
    "2. STEAM/VAPOR: At least ONE image must show visible steam rising from the food — this is the #1 appetite trigger. 蒸汽的表现形式按风格调整（街潮用浓郁蒸汽云，水墨用淡墨氤氲，极简用一缕轻烟），但至少一张必须有蒸汽。",
    "3. INGREDIENT VISIBILITY: Show REAL ingredients — actual meat chunks, real vegetables, visible sauce texture. NOT illustrations.",
    "4. TEXTURE CLOSE-UP: At least ONE section must show a macro close-up of food texture (noodle strands, sauce coating, crispy surface).",
    "5. APPETITE PROPS: Every food image must include appetite-enhancing props (道具数量按平台元素和分层规则保持5-8个不删减) — 道具类型按风格选择：街潮用筷子/油滴/芝麻/辣椒飞散，极简用单支竹筷/一片香草/几粒芝麻，水墨用毛笔/宣纸/茶具，复古中式用粗陶碗/木托/铜勺。风格改变道具的『类型和材质』，不改变『数量』。",
    "6. COMPARISON ELEMENT: Show the product next to something for scale (hand, chopsticks, phone) to communicate portion size.",
    "7. 背景用有质感的材质——具体材质按风格自身7维度决定（见 STYLE VISUAL CONSTRAINT）：街潮用深色木纹/石板，复古中式用陈旧宣纸/粗麻布，极简用微水泥/米白陶瓷，日系用浅亚麻/白木，水墨用生宣纸。所有风格都要求有质感的背景，风格只改变『用哪种质感』，不改变『要不要质感』。",
    "",
    "--- SECTION COPY DENSITY (每个模块的文案密度) ---",
    "Each detail page section's `copy` field must contain AT LEAST:",
    "1. A headline (6-12 chars) with a specific, data-backed claim",
    "2. A sub-headline (10-20 chars) expanding on the headline's benefit",
    "3. 2-4 selling-point tags (4-8 chars each) that are UNIQUE to this section — do NOT repeat tags from other sections",
    "4. If this is the final section: include a promotion/CTA line",
    "RULE: Total copy length per section must be at least 30 characters. Do NOT write a single 10-character title and call it done.",
    "",
    "--- visualPrompt DENSITY FOR DETAIL SECTIONS (详情页visualPrompt饱满度) ---",
    "Every detail page section's `visualPrompt` must describe a COMPLETE, RICH commercial layout:",
    "1. Specify the EXACT text content and placement for headline, sub-headline, and selling-point tags",
    "2. Describe the product's exact position, angle, and state in the frame",
    "3. List at least 3-5 specific visual elements (props, textures, effects) to fill the frame — 元素类型按风格选择（见 STYLE VISUAL CONSTRAINT），数量保持3-5个不删减",
    "4. Specify background layers (at least 2: foreground surface + background depth/atmosphere) — 背景材质/色温按风格7维度选择，层数保持至少2层不删减",
    "5. Include at least ONE atmospheric effect: steam, light rays, oil droplets, sparkle, condensation — 特效类型按风格选择，数量保持至少1个不删减",
    "6. 凭审美定义色彩方案——整体色调方向和关键色按风格7维度决定，不限定数量",
    "7. CRITICAL: The image must look like a FINISHED commercial poster — every area of the 9:16 frame must have visual or textual content. NO blank/empty zones. 所有风格统一执行饱满无空白；风格改变布局/排版/配色，不删减硬元素。",
  ];

  // 插入平台图片元素指引
  result.push(
    "",
    "=== PLATFORM IMAGE ELEMENT REQUIREMENTS (平台图片元素要求) ===",
    platformElementsGuide,
    "When writing visualPrompt, you must include instructions for these platform-specific image elements in the visual composition.",
  );

  // 条件性约束块：按需注入（关联图/知识库/素材搭配）
  // 所有约束内容 100% 保留，只是从内联代码重构为函数调用
  result.push(...buildAssociatedContextBlock(associatedSummary));
  result.push(...buildKnowledgeBaseBlock(knowledgeEntries));
  result.push(...buildAssetPairingBlock(assetLabels));

  result.push(
    "",
    "Planning context:",
    JSON.stringify(planningContext, null, 2),
  );

  return result.join("\n");
}

// ==================== 两阶段规划：头图 + 详情页 ====================

/**
 * 阶段一：头图规划 — 固定 5 张头图
 * 保留全部平台强制元素、配色、布局变化规则
 */
export function buildHeroPlanningPrompt(
  analysis: ProductAnalysisOutput,
  style: string,
  platform: string,
  contentLanguage: ContentLanguage = "zh-CN",
  associatedImageContexts?: AssociatedImageContext[],
) {
  const styleLabel = styleLabels[style as StyleOption] ?? style;
  const platformLabel = platformLabels[platform as PlatformOption] ?? platform;
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];
  const platformElementsGuide = buildPlatformImageElements(platform, contentLanguage);

  const planningContext = {
    productName: analysis.productName,
    category: analysis.category,
    subcategory: analysis.subcategory,
    material: analysis.material,
    color: analysis.color,
    specifications: analysis.specifications,
    styleTags: analysis.styleTags.slice(0, 8),
    targetAudience: analysis.targetAudience.slice(0, 6),
    usageScenarios: analysis.usageScenarios.slice(0, 6),
    coreSellingPoints: analysis.coreSellingPoints.slice(0, 8),
    differentiationPoints: analysis.differentiationPoints.slice(0, 6),
    recommendedFocusPoints: analysis.recommendedFocusPoints.slice(0, 8),
  };

  const flavor = detectFlavorProfile(analysis);
  const heroImageCount = 5;

  const result = [
    "You are a senior e-commerce hero-image planner for mobile product detail pages.",
    `Platform: ${platformLabel}`,
    buildStyleInstruction(style),
    buildProductBackgroundExtension(analysis),
    buildTypographyConstraint(contentLanguage),
    `Target content language: ${targetLanguage}`,
    "",
    "=== PRODUCT FLAVOR PROFILE (产品口味特征 — 决定文案和氛围方向) ===",
    `Detected flavor profile: ${flavor.profile}`,
    `Headline style examples for this product: ${flavor.headlineExamples.join(" / ")}`,
    `Corner badge examples for this product: ${flavor.badgeExamples.join(" / ")}`,
    `Selling point icon examples for this product: ${flavor.iconExamples.join(" / ")}`,
    `Atmosphere elements for this product: ${flavor.atmosphereElements.join(" / ")}`,
    `FORBIDDEN words for this product (DO NOT use): ${flavor.forbiddenWords.join(" / ")}`,
    "CRITICAL: The hero image's headline copy, corner badges, and selling point icons MUST match this product's actual flavor profile. Do NOT use spicy/hot language for non-spicy products, and do NOT use sweet/sour language for spicy products.",
    "",
    buildHeroStyleAdaptation(style, analysis),
    "",
    `Create exactly ${heroImageCount} hero sections for a product detail page gallery.`,
    "Return strict JSON only with a 'sections' array.",
    "",
    "=== HERO IMAGE ROLES (每张头图的固定角色) ===",
    "CRITICAL — STYLE ADAPTATION: These descriptions define ROLES and COMMUNICATION GOALS only. The visual details (background surface, lighting direction, props, atmosphere, color temperature) MUST come from the VISUAL STYLE dimensions above, not from the generic food-photography defaults implied below.",
    `You MUST create exactly ${heroImageCount} hero sections with these FIXED roles:`,
    "",
    "1. **hero_01 — 食欲冲击首屏 (Appetite Impact Hero / 主图)**",
    `   - 角色: 让用户划到的瞬间被食欲画面击中，产生'我要吃这个'的冲动。该产品口味特征为 ${flavor.profile}，文案和氛围必须匹配此口味`,
    `   - copy: 情绪化大标题(4-8字感官冲击，可选方向: ${flavor.headlineExamples.join(" / ")}) + 产品名 + 2-3个卖点关键词(口语化，可选方向: ${flavor.iconExamples.join(" / ")})`,
    "   - visualPrompt: 必须严格遵循上方 HERO IMAGE STYLE ADAPTATION 中的构图/标题/营销/氛围规则，同时保证食欲冲击首屏的核心要素。具体而言：",
    `     COMPOSITION (构图): 由风格适配器决定。街潮/促销/真实摄影/高端风格可走左右分割或强主体构图；极简/日系/水墨/生活方式风格则按各自构图语言（居中留白、三分法、山水画三段式、框架构图）执行，不强制左右分割。`,
    `     SUBJECT (主体): 成品食欲动态画面是绝对核心。示例：筷子从碗中夹起一大坨裹满酱汁的面条，面条在空中弯曲形成动态弧线，酱汁拉丝滴落，肉酱颗粒清晰可见，芝麻葱花点缀其上。食物主体占45-65%（具体比例由风格适配器决定）。`,
    `     PACKAGING (包装身份): 产品包装盒仅在角落作为品牌身份确认，占8-12%。极简/日系/水墨/生活方式风格中可更小或省略，但主图仍需能识别品牌。`,
    `     TITLE (标题): 标题风格由风格适配器决定。街潮/国潮用书法字/金属质感字；极简/日系用极细无衬线/明朝体；水墨用书法小字+朱红印章；卡通用圆润彩色字。标题与食物图像融为一体，不强制独立横幅。`,
    `     MARKETING ELEMENTS (营销元素): 按风格适配器执行。高密度风格（街潮/促销/C4D）用徽章+图标条+角标；低密度风格（极简/日系/水墨）用1-2个细线标签或印章。图标示例方向: ${flavor.iconExamples.join(" + ")}。`,
    `     ATMOSPHERE (氛围): 必须与产品口味匹配。可参考: ${flavor.atmosphereElements.join(" / ")}，但具体表现形式受风格约束（如极简禁用火焰，水墨用淡墨远山替代辣椒飞散）。`,
    "   - 视觉主体: 成品食欲动态画面（筷子夹面/拉丝/酱汁裹覆），包装盒只是配角",
    "   - 构图禁忌: 禁止三层水平分割（标题条+包装条+成品条），这种构图模板感太强，缺乏视觉张力。禁止用与风格冲突的通用默认（如极简风用粗黑边金属字、水墨风用促销爆炸贴）。",
    "",
    "2. **hero_02 — 成品食欲展示 (Finished Dish Hero / 副图1)**",
    "   - 角色: 展示产品制作完成后的成品效果，用极致食欲感打动用户",
    "   - copy: 成品体验标题（如'一碗好面'/'大口满足'）+ 2-3个成品卖点关键词（如'汤浓面劲''料足味美'），不写规格参数",
    "   - visualPrompt: 成品/成品碗盘特写大图，蒸汽升腾，配料散落，食欲道具环绕（筷子/勺子/配菜），突出'做出来就是这样'的期待感",
    "   - 副图：精致设计框架 — 底部食欲关键词标签条(3-4个标签)+角落食欲标识徽章+侧边品牌竖条，设计品质与hero_01同级，3D材质效果一致",
    "   - 视觉主体: 成品/成品碗盘（不是产品包装，是做好的样子）",
    "",
    "3. **hero_03 — 真材实料展示 (Ingredient Hero / 副图2)**",
    "   - 角色: 展示产品的核心原料/食材，用真材实料建立品质信任",
    "   - copy: 真材实料标题 + 2-3个核心原料关键词（如'澳洲牛腱肉''日晒72小时面条'），不写规格参数",
    "   - visualPrompt: 核心食材微距特写/散落排列，食材新鲜感强烈，搭配品质参数标注，突出'好料出好味'的因果关系",
    "   - 副图：精致设计框架 — 品质标签群(3-4个标签)+产地徽章+侧边半透明品质说明条，设计品质与hero_01同级",
    "   - 视觉主体: 核心食材/原料特写（不是产品包装，是原料本身）",
    "",
    "4. **hero_04 — 制作场景展示 (Making Scene Hero / 副图3)**",
    "   - 角色: 展示产品的制作/烹饪过程，用动态场景增强代入感和可信度",
    "   - copy: 制作场景标题（如'3分钟轻松好面'/'慢火熬煮工艺'）+ 2-3个制作亮点关键词，不写规格参数",
    "   - visualPrompt: 制作/烹饪过程场景（如冲泡瞬间/下锅翻煮/浇汤装盘），动态飞溅/蒸汽/手部动作，营造'正在做'的临场感",
    "   - 副图：精致设计框架 — 时间3D徽章+工艺标签群(3-4个)+角落简易横幅，设计品质与hero_01同级",
    "   - 视觉主体: 制作/烹饪过程场景（不是静态产品，是动态制作画面）",
    "",
    "5. **hero_05 — 使用场景展示 (Usage Scene Hero / 副图4)**",
    "   - 角色: 展示产品在实际生活场景中的使用，用场景共鸣触发购买欲",
    "   - copy: 场景标题（如'加班深夜的温暖'/'露营必备速食'）+ 场景价值关键词，不写规格参数",
    "   - visualPrompt: 真实生活场景氛围（如深夜书桌/户外露营/追剧沙发），产品成品融入场景，营造'这就是我的生活'的代入感",
    "   - 副图：精致设计框架 — 底部场景标签条(3-4个关键词)+角落品牌徽章+画面内场景价值气泡，设计品质与hero_01同级",
    "   - 视觉主体: 生活场景+成品融入（不是产品包装，是人在场景中使用）",
    "",
    "=== HERO MARKETING ELEMENT GRADATION (头图营销元素分级 — 5张同一水准，差异化而非降级) ===",
    "主图和副图的营销装饰方式不同，但设计品质、3D材质、视觉冲击力必须处于同一水准。副图不是主图的「降级版」，而是「不同表达」。",
    "",
    "主图 hero_01（食欲冲击表达 — 视觉冲击力最强）:",
    "- 情绪化标题文字直接叠在画面上方，标题风格由 HERO IMAGE STYLE ADAPTATION 决定（街潮/国潮=书法/金属字；极简/日系=极细无衬线/明朝体；水墨=书法小字+朱红印章；卡通=圆润彩色字等），与食物图像融为一体",
    "- 营销元素（图标条/徽章/标签/角标）按风格适配器执行：高密度风格（街潮/促销/C4D）用底部图标条+角落徽章；低密度风格（极简/日系/水墨/生活方式）用1-2个细线标签或印章即可",
    "- 营销元素覆盖画面 5-28%（依风格而定：极简5-10%，街潮20-28%），成品食欲画面 45-65%（依风格而定：极简45-55%，街潮55-65%），包装身份 8-12%（极简/水墨可更小）",
    "- 是所有头图中视觉冲击力最强的一张，像一张让人流口水的广告海报——但'冲击力'的表达方式由风格决定，不一定是左右分割+火焰辣椒",
    "",
    "副图 hero_02~05（精致设计框架 — 同等水准，更注重场景呼吸感）:",
    "- 每张副图必须包含至少3类设计元素：标签群(3-4个) + 角落徽章 + 侧边/底部品牌条 + 画面内标注线/气泡（至少选3种）",
    "- 允许使用顶部/侧边半透明横幅、装饰丝带、纹理叠加、角落品牌水印",
    "- 营销/设计元素覆盖画面 25-30%，场景内容 70-75%",
    "- 3D材质效果、字体品质、色彩设计水准必须与hero_01完全一致——不能因为覆盖率略低就降低设计质量",
    "- 核心要求：副图必须有完整的 DESIGN FRAMEWORK(设计框架)，画面中的标签、徽章、线条应形成一套有编排感的视觉系统。每张副图的视觉丰富度应该像一本高端美食杂志的内页封面。",
    "",
    "副图设计框架的组成（每张副图至少选3种，鼓励全选）:",
    "- 底部或侧边的标签组(3-4个圆形/胶囊形标签，有3D投影) + 角落装饰(角标或小型徽章，有金属/蜡封质感)",
    "- 侧边半透明品牌竖条 + 画面内至少2处标注线/参数气泡",
    "- 装饰纹理叠加(如角落光斑/丝带/水印背景纹理)",
    "- 这些元素必须与主图的营销元素在设计语言上呼应（同色系、同3D质感档次、同字体风格），形成统一的品牌视觉体系",
    "",
    "主图与副图的质量要求（不可违反）:",
    "- 5张头图的3D材质效果同级——浮雕/烫金/丝绒/金属凸版等技法在每张图上都要充分发挥",
    "- 5张头图的背景纹理丰富度同级——没有哪张图可以有更差的背景质感",
    "- 5张头图的色彩设计投入同级——每张都经过精心配色，没有哪张可以随便用色",
    "- 5张头图看起来必须像同一个设计团队在同一天为同一品牌拍摄制作的系列广告——不是一个主图配上4个打折品",
    "- 如果任何一张副图看起来明显比主图粗糙、简陋、随意，则整个规划不合格，必须重做",
    "",
    "=== HERO VISUAL-COPY ALIGNMENT RULE (视觉-文案对齐规则 — 不可违反) ===",
    "每张头图的 visualPrompt 主体画面必须与 copy 文案内容严格对齐：",
    "- hero_01 copy讲食欲冲击+情绪价值 → visualPrompt必须以成品食欲动态画面为视觉核心(筷子夹面/拉丝/酱汁裹覆/蒸汽)，包装盒退居角落作为身份确认，标题风格/构图/营销元素严格遵循 HERO IMAGE STYLE ADAPTATION，不强制左右分割+金属书法字",
    "- hero_02 copy讲成品体验 → visualPrompt必须展示成品碗盘/成品效果",
    "- hero_03 copy讲真材实料 → visualPrompt必须展示核心食材/原料特写",
    "- hero_04 copy讲制作过程 → visualPrompt必须展示制作/烹饪动态场景",
    "- hero_05 copy讲使用场景 → visualPrompt必须展示生活场景+成品融入",
    "禁止出现'copy讲成品但画面只放产品包装'或'copy讲制作但画面只有静态产品'的错位情况。",
    "",
    "=== CRITICAL HERO RULES ===",
    "1. 主图(hero_01)具有最完整营销边框元素，副图(hero_02~05)使用精致设计框架——设计品质同级，表达方式不同",
    "2. 每张头图必须有独特角色，不重复相同目的",
    "3. 所有头图的copy字段必须语义不同，不能共享相同的卖点短语",
    "4. 每张头图必须从分析上下文中提取具体的产品信息，不得使用通用占位文本",
    "5. 5张头图的视觉主体必须各不相同：成品食欲动态画面(包装配角) → 成品效果特写 → 食材原料 → 制作场景 → 使用场景",
    "6. 5张头图的设计品质、3D材质、色彩投入、背景质感必须处于同一水准——任何一张图不能明显比另一张更粗糙",
    "",
    platformElementsGuide,
    ...buildZeroBlankAndLayerRule(),
    ...buildCopyDifferentiationRule(),
    "",
  ];
  const associatedSummary = associatedImageContexts && associatedImageContexts.length > 0
    ? buildAssociatedContextSummary(associatedImageContexts)
    : null;
  if (associatedSummary) {
    result.push(
      "",
      associatedSummary,
      "",
      "Use associated scene contexts to enrich hero_05 (场景图) with real visual details.",
    );
  }

  result.push(
    "",
    "=== COPY FACTUALITY MANDATE (文案真实性强制规则 — 不可违反) ===",
    "ALL text content in every hero's `copy` field MUST be factually grounded in the product analysis results (Planning context below).",
    "- Do NOT fabricate product specifications, ingredients, certifications, test results, or manufacturing details not present in the planning context.",
    "- Do NOT invent specific numbers (e.g., '蛋白质含量≥12g', 'SGS 268项检测') unless they appear in the planning context.",
    "- Do NOT create fake user reviews, fake sales figures, or fake certification claims.",
    "- Selling points MUST derive ONLY from coreSellingPoints and differentiationPoints in the planning context.",
    "- Product name, material, color, specifications: use EXACTLY what the planning context provides.",
    "- You MAY rephrase known facts into compelling marketing language, but ANY specific data point or technical claim MUST trace back to the planning context.",
    "- If in doubt about a fact, OMIT it rather than invent it. Fabricated claims violate advertising regulations.",
    "",
    "=== COPY DIVERSITY MANDATE ===",
    "ALL hero images' copy fields MUST be semantically DIFFERENT from each other.",
    "The AI must verify that no two heroes share the same key selling phrases.",
    "",
    "=== OUTPUT FORMAT ===",
    "Each section must include: id, type (must be 'hero'), title, goal, copy, visualPrompt, editableFields.",
    "visualPrompt must use bilingual format: 'Primary Prompt: <中文>' then 'English Prompt: <English>'.",
    "All user-facing text must be in Simplified Chinese.",
    "",
    "Planning context:",
    JSON.stringify(planningContext, null, 2),
  );

  return result.join("\n");
}

/**
 * 阶段二：详情页规划 — 固定 9 张详情页
 * 保留统一背景规则、食品类目规则、文案密度规则
 */
export function buildDetailPlanningPrompt(
  analysis: ProductAnalysisOutput,
  style: string,
  platform: string,
  contentLanguage: ContentLanguage = "zh-CN",
  associatedImageContexts?: AssociatedImageContext[],
) {
  const styleLabel = styleLabels[style as StyleOption] ?? style;
  const platformLabel = platformLabels[platform as PlatformOption] ?? platform;
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  const planningContext = {
    productName: analysis.productName,
    category: analysis.category,
    subcategory: analysis.subcategory,
    material: analysis.material,
    color: analysis.color,
    specifications: analysis.specifications,
    styleTags: analysis.styleTags.slice(0, 8),
    targetAudience: analysis.targetAudience.slice(0, 6),
    usageScenarios: analysis.usageScenarios.slice(0, 6),
    coreSellingPoints: analysis.coreSellingPoints.slice(0, 8),
    differentiationPoints: analysis.differentiationPoints.slice(0, 6),
    recommendedFocusPoints: analysis.recommendedFocusPoints.slice(0, 8),
    userConcerns: analysis.userConcerns.slice(0, 6),
  };

  const detailSectionCount = 9;

  const result = [
    "You are a senior e-commerce detail-page planner for mobile product pages.",
    `Platform: ${platformLabel}`,
    buildStyleInstruction(style),
    buildProductBackgroundExtension(analysis),
    buildTypographyConstraint(contentLanguage),
    `Target content language: ${targetLanguage}`,
    `Create exactly ${detailSectionCount} detail page sections for a product detail page.`,
    "Return strict JSON only with a 'sections' array.",
    "IMPORTANT: These are DETAIL PAGE sections (not hero images) — do NOT include platform marketing borders/banners/tags.",
    "",
    "=== DETAIL PAGE SECTION ROLES (每张详情页的固定角色) ===",
    "CRITICAL — STYLE ADAPTATION: The visual details in your visualPrompts (surface material, lighting, colors, props) MUST come from the VISUAL STYLE dimensions above. These role descriptions define WHAT each section communicates, not HOW it looks visually.",
    `You MUST create exactly ${detailSectionCount} detail sections with these FIXED roles in this exact order:`,
    "",
    "1. **detail_01 — 首屏食欲大图 (Appetite First Screen)**",
    "   - 角色: 品名+核心食欲Slogan+成品食欲大图(占画面60%+)+卖点标签，以极致食欲感抓牢用户注意力",
    "   - type: selling_points",
    "   - copy: 品名 + 核心食欲Slogan（如'汤浓面劲·一碗入魂'）+ 3-4个卖点标签",
    "   - visualPrompt: 成品碗/盘食欲大图占据画面核心(60%+)，品名和Slogan在顶部以设计字体大字呈现，卖点标签分布在产品周围，画面丰富饱满，蒸汽升腾+光泽反光+食材细节清晰",
    "",
    "2. **detail_02 — 品牌背书 (Brand Endorsement)**",
    "   - 角色: 品牌名®+品类定位+双原料图标+免责声明",
    "   - type: brand_trust",
    "   - copy: 品牌名® + 品类定位描述 + 两个核心原料亮点 + 免责声明小字",
    "   - visualPrompt: 品牌名大字居中，品类定位副标题，左右各一个原料图标/插图，底部免责声明小字",
    "",
    "3. **detail_03 — 感官渲染 (Sensory Rendering)**",
    "   - 角色: 风味定位标题+五维口感描述+俯拍成品图",
    "   - type: detail_closeup",
    "   - copy: 风味定位标题 + 五维口感（酸度/甜度/肉质口感/余味/层次感）每项短描述",
    "   - visualPrompt: 俯拍/45°成品图，五维口感用图标+文字雷达图或标签排列呈现",
    "",
    "4. **detail_04 — 信任锚点 (Trust Anchor)**",
    "   - 角色: 真材实料微距特写+工艺说明+关键原料小图",
    "   - type: material",
    "   - copy: 真材实料标题 + 工艺说明（如'先炒后熬'） + 关键原料名称列表",
    "   - visualPrompt: 食材微距特写大图（如肉块纹理/蔬菜新鲜度），工艺关键词标注，角落放关键原料小图",
    "",
    "5. **detail_05 — 原料溯源A (Ingredient Traceability A)**",
    "   - 角色: 主料1的产地/种植故事+具体参数+切面特写",
    "   - type: material",
    "   - copy: 主料1名称 + 产地故事（1-2句） + 具体品质参数 + 与产品的关联",
    "   - visualPrompt: 主料1的产地意境图（如麦田/牧场）与切面特写组合，参数用数据标签标注",
    "",
    "6. **detail_06 — 原料溯源B (Ingredient Traceability B)**",
    "   - 角色: 主料2的品种/工艺故事+品质参数+关联成品体验",
    "   - type: material",
    "   - copy: 主料2名称 + 品种/工艺故事（1-2句） + 品质参数 + 对成品口感的贡献",
    "   - visualPrompt: 主料2的品种意境图与成品体验图组合，参数标注，强调与成品的关系",
    "",
    "7. **detail_07 — 效率驱动 (Efficiency Driver)**",
    "   - 角色: 场景标题+时间承诺+动态飞溅食欲图+难度关联",
    "   - type: scenario",
    "   - copy: 场景标题（如'加班深夜'/'周末追剧'） + 时间承诺（X分钟） + 难度标签（如'零基础'/'微波炉一键'）",
    "   - visualPrompt: 场景氛围图+动态飞溅食欲元素（汤汁飞溅/蒸汽升腾），时间数字大字突出，难度图标标注",
    "",
    "8. **detail_08 — 配量可视化 (Ingredient Visualization)**",
    "   - 角色: 配置标题+N大材料拆包平铺+每包标注名称+外盒识别",
    "   - type: spec",
    "   - copy: 配置标题（如'N大真材实料'） + 每包名称列表 + 总净含量",
    "   - visualPrompt: 俯拍平铺构图，所有配料包拆包平铺展示，每个料包旁边标注名称，产品外盒在角落可识别",
    "",
    "9. **detail_09 — 使用教程 (Usage Tutorial)**",
    "   - 角色: 教程标题+三步图标化流程",
    "   - type: summary",
    "   - copy: 教程标题 + 三步流程（每步≤30字） + 最终成品体验一句话",
    "   - visualPrompt: 三步图标化流程横向或纵向排列，每步配图标/插图+文字说明，最终成品图收尾",
    "",
    "=== CRITICAL DETAIL PAGE RULES ===",
    "1. 每张详情页的copy必须包含至少30字的具体产品文案，不得使用通用模板文本",
    "2. 所有数据/参数必须从分析上下文提取，不得编造",
    "3. visualPrompt必须使用双语格式: 'Primary Prompt: <中文>' 换行 'English Prompt: <English>'",
    "4. 每张详情页必须有独特角色，相邻页面之间要有自然的阅读流，绝对不可以有视觉割裂感",
    "5. 所有用户可见文字必须为简体中文",
    "6. SEAMLESS TRANSITION (无缝衔接 — 最高优先级): 所有9张详情页必须在色调、构图节奏、视觉重量上形成连续流畅的视觉叙事。相邻页面之间的色相差≤30°(HSL)、明度差≤15%、饱和度差≤10%。不允许出现色彩温度跃变。用户下滑时不应感知到任何'切页'感。",
    "",
    "=== DETAIL VISUAL ANCHOR (详情页统一视觉锚点 — 强制输出) ===",
    "你必须在输出 sections 数组之前，先输出一个 `detailVisualAnchor` 对象，定义所有 9 张详情页共享的视觉基调。",
    "这个锚点确保所有详情页像同一位设计师在同一设计系统下完成，而不是 9 张独立海报。",
    "",
    "detailVisualAnchor 必须包含以下字段（具体值从产品分析结果的 color 字段推导）:",
    "- primaryBg: 主背景色描述（如'深棕色木纹'/'米白色亚麻纹理'/'深灰色石板'），所有详情页共享此背景",
    "- secondaryBg: 次背景色描述（如'浅米色'/'暖白色'），用于标题区/尾部区的浅色过渡",
    "- accentColor: 主强调色（如'暗红色'/'金色'/'橙红色'），用于标题、关键词高亮、装饰元素",
    "- secondaryAccent: 次强调色（如'米白色文字'/'浅金色'），用于副标题和正文",
    "- texture: 主纹理描述（如'粗糙木纹'/'亚麻布纹'/'石板纹理'），所有详情页共享",
    "- typography: 标题排版风格（如'大字居中+副标题左对齐'/'标题左对齐+卖点标签右对齐'）",
    "- visualMood: 整体氛围（如'温暖厚实'/'清新自然'/'高端沉稳'）",
    "- transitionRule: 页面间过渡规则（如'所有页面底色在同一暖棕色系内渐进：深棕→中棕→浅棕→米白→浅棕→中棕→深棕→暖灰→深棕。相邻页色差≤15%明度且色相偏移≤30°。禁止任何冷暖色调混入。用户下滑时完全感觉不到切页。'）",
    "",
    "OUTPUT FORMAT 要求:",
    "最终 JSON 输出格式为: { \"detailVisualAnchor\": { ... }, \"sections\": [ ... ] }",
    "detailVisualAnchor 是顶层字段，与 sections 同级。",
    "",
    "每个详情页的 visualPrompt 必须以锚点引用开头:",
    "'[Visual Anchor: primaryBg=xxx, secondaryBg=xxx, accentColor=xxx, texture=xxx] ...'",
    "这样图像生成阶段可以提取并强制执行统一视觉基调。",
    "",
    "=== FOOD-SPECIFIC RULES ===",
    "If the product is food:",
    "1. Prioritize warm, appetizing tones — avoid cold clinical lighting",
    "2. At least one image must show visible steam",
    "3. Show REAL ingredients, not illustrations",
    "4. Include macro close-up of food texture",
    "5. Every food image needs appetite props (chopsticks, garnishes, oil droplets, sesame seeds)",
    "6. Include a scale element (hand/chopsticks/phone) for portion size reference",
    "",
    "=== COPY FACTUALITY MANDATE (文案真实性强制规则 — 不可违反) ===",
    "ALL text content in every detail section's `copy` field MUST be factually grounded in the product analysis results (Planning context below).",
    "- Do NOT fabricate product specifications, ingredients, certifications, test results, or manufacturing details not present in the planning context.",
    "- Do NOT invent specific numbers (e.g., '蛋白质含量≥12g', 'SGS 268项检测') unless they appear in the planning context.",
    "- Do NOT create fake user reviews, fake sales figures, or fake certification claims.",
    "- Selling points MUST derive ONLY from coreSellingPoints and differentiationPoints in the planning context.",
    "- Product name, material, color, specifications: use EXACTLY what the planning context provides.",
    "- You MAY rephrase known facts into compelling marketing language, but ANY specific data point or technical claim MUST trace back to the planning context.",
    "- If in doubt about a fact, OMIT it rather than invent it. Fabricated claims violate advertising regulations.",
    "",
    "=== OUTPUT FORMAT ===",
    "Each section must include: id, type, title, goal, copy, visualPrompt, editableFields.",
    "Allowed detail section types: selling_points, scenario, detail_closeup, specs, material, brand_trust, summary, custom.",
    "Do NOT use 'hero' type for detail pages.",
    "visualPrompt must use bilingual format: 'Primary Prompt: <中文>' then 'English Prompt: <English>'.",
    "",
    "Planning context:",
    JSON.stringify(planningContext, null, 2),
  ];

  const associatedSummary = associatedImageContexts && associatedImageContexts.length > 0
    ? buildAssociatedContextSummary(associatedImageContexts)
    : null;
  if (associatedSummary) {
    result.push(
      "",
      associatedSummary,
      "",
      "Use associated scene contexts to enrich detail_03 (感官渲染) and detail_07 (场景驱动) with real visual details.",
    );
  }

  return result.join("\n");
}
