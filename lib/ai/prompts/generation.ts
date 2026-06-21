import type { PageSection, ProductAsset } from "@prisma/client";

import {
  contentLanguageNamesForPrompt,
  normalizeContentLanguage,
  type ContentLanguage,
} from "@/lib/utils/content-language";
import { buildStyleVisualConstraint, buildProductBackgroundExtension } from "./style-templates";
import { buildHeroStyleIdentity } from "./hero-style-adaptations";
import type { ProductAnalysisOutput } from "@/lib/ai/schemas/product-analysis";

function isLowDensityHeroStyle(_style?: string | null): boolean {
  return false;
}

function buildDetailVisualAnchorInstruction(anchor?: Record<string, string> | null) {
  if (!anchor || typeof anchor !== "object") {
    return "";
  }

  const fields = [
    anchor.primaryBg && `primaryBg: ${anchor.primaryBg}`,
    anchor.secondaryBg && `secondaryBg: ${anchor.secondaryBg}`,
    anchor.accentColor && `accentColor: ${anchor.accentColor}`,
    anchor.secondaryAccent && `secondaryAccent: ${anchor.secondaryAccent}`,
    anchor.texture && `texture: ${anchor.texture}`,
    anchor.typography && `typography: ${anchor.typography}`,
    anchor.visualMood && `visualMood: ${anchor.visualMood}`,
    anchor.transitionRule && `transitionRule: ${anchor.transitionRule}`,
  ].filter(Boolean);

  if (!fields.length) {
    return "";
  }

  return [
    "=== DETAIL VISUAL ANCHOR (详情页统一视觉锚点 — 强制执行) ===",
    "The following visual anchor was defined during planning. ALL detail page images MUST follow it to maintain visual continuity and SEAMLESS transitions.",
    `Anchor: ${fields.join(" | ")}`,
    "",
    "MANDATORY RULES (每页生成前必须自检):",
    "1. BACKGROUND TONE UNITY: Use the primaryBg as the main background tone for this image. ALL detail pages MUST share the same color tone DIRECTION (e.g., all warm browns, all warm beiges). Do NOT switch between warm and cool tones.",
    "2. COLOR BRIDGE: Adjacent pages' background hue difference MUST be ≤30° (HSL). Brightness change must be gradual (≤15% step). No jump from deep brown to light grey — the user scrolling down should NOT perceive any 'page switch' sensation.",
    "3. ACCENT COLOR: Use the accentColor for headline text, key highlights, and decorative elements. Do NOT pick a random accent color. Accent color can shift subtly (±15° hue) across pages but must NOT disappear entirely then suddenly reappear.",
    "4. TEXTURE: Apply the specified texture to the background surface. Texture material can vary slightly (wood grain → linen → slate) for visual variety, but the underlying base color must stay within the same tone range to avoid disconnection.",
    "5. TRANSITION: Follow the transitionRule precisely — the background should flow naturally from the previous page. If this is the first detail page, set the tone that all subsequent pages will follow.",
    "6. CONSISTENCY: The overall visual mood and typography style MUST match the anchor description. All detail pages should look like they belong to one cohesive design system — as if designed by one person in one sitting.",
    "7. DISCONNECTION SELF-CHECK (割裂感自检): Before finalizing, ask: 'If a user scrolls from the previous page to this one, will they feel any visual break?' If yes — adjust the color tone, composition rhythm, or visual weight until the transition is seamless.",
    "",
    "FAILURE CASES TO AVOID:",
    "- Using a bright red background when the anchor says 'deep brown wood texture'",
    "- Switching from warm amber background (page 3) to cool grey concrete (page 4) — this creates a jarring disconnection",
    "- Using a completely different color palette that clashes with adjacent detail pages",
    "- Ignoring the texture specification and using flat solid colors",
    "- One page is extremely dense with elements, the next page is nearly empty — visual weight must be balanced",
    "",
  ].join("\n");
}

/**
 * 头图身份指令 — hero_01 展示包装但必须搭配，hero_02~05 禁止出现包装
 */
function detectFlavorFromAnalysis(analysis?: ProductAnalysisOutput | null) {
  if (!analysis) {
    return {
      isSpicy: false,
      isSweetSour: false,
      headlineExamples: ["一口入魂", "鲜香好味", "料足味美"],
      badgeExamples: ["经典", "好味"],
      iconExamples: ["🍜面条弹牙", "🥩肉酱量足", "🌾真材实料"],
      atmosphereElements: ["温暖木桌", "柔和灯光", "新鲜 garnish"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
    };
  }

  const text = `${analysis.productName} ${analysis.category} ${analysis.subcategory} ${analysis.coreSellingPoints?.join(" ") ?? ""} ${analysis.styleTags?.join(" ") ?? ""}`.toLowerCase();

  const isSpicy = /辣|火鸡|椒|麻辣|香辣|爆辣|劲辣|酸辣|泡椒|红油| spicy|hot\b/.test(text);
  const isSweetSour = /番茄|酸甜|柠檬|果香|糖醋|甜酸| sweet.sour|tomato/.test(text);
  const isMild = /清淡|轻食|健康|低脂|蔬菜|素|清爽| light|healthy|low.fat/.test(text);

  if (isSpicy) {
    return {
      isSpicy: true,
      isSweetSour: false,
      headlineExamples: ["爆辣劲爽", "一口入魂", "辣得过瘾"],
      badgeExamples: ["爆辣", "超辣过瘾", "辣得上头"],
      iconExamples: ["🌶️爆辣够劲", "🥩肉酱量足", "🍜面条弹牙"],
      atmosphereElements: ["橙红火焰光效", "干辣椒点缀", "暖色散景", "袅袅蒸汽"],
      forbiddenWords: ["酸甜", "清淡"],
    };
  }

  if (isSweetSour) {
    return {
      isSpicy: false,
      isSweetSour: true,
      headlineExamples: ["酸甜浓郁", "一口入魂", "鲜香开胃"],
      badgeExamples: ["酸甜", "浓郁", "经典"],
      iconExamples: ["🍅酸甜浓郁", "🥩肉酱量足", "🍜面条弹牙"],
      atmosphereElements: ["新鲜番茄片", "绿色香草", "温润金光", "清透酱汁光泽"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
    };
  }

  if (isMild) {
    return {
      isSpicy: false,
      isSweetSour: false,
      headlineExamples: ["清爽鲜香", "一口入魂", "健康好味"],
      badgeExamples: ["清爽", "健康", "轻食"],
      iconExamples: ["🥬清爽健康", "🍜面条弹牙", "🌿真材实料"],
      atmosphereElements: ["新鲜蔬菜", "浅色亚麻", "明亮窗光", "清爽草本"],
      forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣", "重口味"],
    };
  }

  return {
    isSpicy: false,
    isSweetSour: false,
    headlineExamples: ["鲜香浓郁", "一口入魂", "肉香四溢"],
    badgeExamples: ["鲜香", "浓郁", "肉香"],
    iconExamples: ["🥩肉酱量足", "🍜面条弹牙", "🌾真材实料"],
    atmosphereElements: ["温暖木桌", "柔和灯光", "肉酱香氛", "芝麻葱花"],
    forbiddenWords: ["爆辣", "辣得过瘾", "火辣", "超辣"],
  };
}

function buildHeroIdentityInstruction(
  section: PageSection,
  productName?: string | null,
  analysis?: ProductAnalysisOutput | null,
  style?: string | null,
): string {
  if (section.type !== "HERO") return "";

  const product = productName ?? "this product";
  const flavor = detectFlavorFromAnalysis(analysis);
  const styleIdentity = analysis ? buildHeroStyleIdentity(style ?? "street_appetite", analysis) : "";
  const lowDensity = isLowDensityHeroStyle(style);
  const isPrimary = section.order === 0;

  const commonHeader = [
    `========== HERO_0${section.order + 1} IDENTITY: "${product}" ==========`,
    isPrimary
      ? "This is the PRIMARY hero — the first-screen visual that must communicate the product's core appeal."
      : "This is a SECONDARY hero image — it must deliver EQUAL visual quality to the primary hero while showing a DIFFERENT product state/angle/story.",
    `PRODUCT FLAVOR PROFILE: This product is ${flavor.isSpicy ? "SPICY" : flavor.isSweetSour ? "SWEET-SOUR" : "SAVORY/UMAMI"}. ALL copy, badges, icons, and atmosphere elements MUST match this flavor profile.`,
    `FORBIDDEN flavor-mismatched words for this product: ${flavor.forbiddenWords.join(", ")}`,
    "",
    styleIdentity,
    "",
    "CRITICAL — STYLE OVERRIDE: The composition, title style, marketing elements, and atmosphere defaults below are OVERRIDDEN by the HERO STYLE IDENTITY block above whenever they conflict. The finished dish remains the ABSOLUTE visual hero, but HOW it is composed and styled depends on the visual style.",
  ].join("\n");

  if (isPrimary) {
    if (lowDensity) {
      return [
        commonHeader,
        "",
        "LOW-DENSITY PRIMARY HERO COMPOSITION (for minimalist / japanese_fresh / healthy_light / lifestyle_scene / baby_parenting / ink_wash / realistic_food_photo / warm_homestyle / vintage_chinese / regional_memory):",
        "- CENTERED, rule-of-thirds, or style-specific composition — do NOT use the default left-right split unless the style identity explicitly says so",
        "- FINISHED DISH as clear hero (45-55% of frame). It must look appetizing but NOT dramatic or over-styled",
        "- PACKAGING appears only as a small brand badge (≤8% of frame) or is OMITTED entirely if the style identity calls for it",
        "- INTENTIONAL WHITESPACE is required — empty/blank zones can be 25-40% of frame and should feel designed, not accidental",
        "- BACKGROUND must be light, clean, and style-appropriate: white/off-white, pale wood, linen, soft gray, washi paper, ink wash gradient, or natural lifestyle context. NO deep black moody backgrounds",
        "- LIGHTING must be soft natural light or window light — NO dramatic spotlight, NO high-contrast chiaroscuro unless the style calls for it",
        "- ATMOSPHERE must be fresh, clean, natural, elegant, serene, or cozy — NO flames, NO spicy particles, NO heavy warm bokeh unless the style explicitly includes them",
        "",
        "TITLE STYLE (low-density):",
        "- Use ultra-thin sans-serif, fine handwritten script, Mincho-style, or small calligraphy with seal — whichever matches the style identity",
        "- Small to medium size, placed in whitespace or a quiet corner — NOT overlapping the food like a sticker",
        "- NO heavy black outline, NO metallic texture, NO glow, NO 3D bevel, NO rectangular banner behind the title",
        "- The title must feel like part of the scene, not a pasted UI element",
        "",
        "MARKETING ELEMENTS (low-density):",
        "- Reduce to 1-3 subtle elements ONLY (thin-line label, small seal, single circular badge, tiny icon, or data badge)",
        "- Total coverage: 5-12% of frame",
        "- NO dark icon bar, NO stacked banner strips, NO dense tag clusters, NO corner explosion badges, NO 3D metallic ribbons",
        "- For healthy_light: use 1-2 circular data badges (calories / protein / fiber) + fresh ingredient micro-labels",
        "- For minimalist: 1-2 fine-line tags maximum, or no marketing elements at all",
        "- For japanese_fresh: single washi-paper label or small red seal",
        "- For ink_wash: tiny cinnabar seal only, no other tags",
        "",
        "FLAVOR ADAPTATION (low-density):",
        `- Allowed headline words: ${flavor.headlineExamples.join(" / ")}`,
        `- Allowed badge/icon words: ${flavor.badgeExamples.join(" / ")} / ${flavor.iconExamples.join(" / ")}`,
        `- Atmosphere cues: ${flavor.atmosphereElements.join(" / ")} — interpreted gently through the style's lens. NO fire/chili storm`,
        "",
        "FORBIDDEN for low-density styles:",
        "- Heavy metallic calligraphy with black outline",
        "- Dark semi-transparent bottom icon bar with gold glowing borders",
        "- Three-layer horizontal split (title strip + packaging strip + food strip)",
        "- Flame effects, scattered dried chilies, spicy particles (unless product is spicy AND style explicitly allows a subtle chili garnish)",
        "- Dense marketing border frame, top banner, bottom banner, left-side tag cluster",
      ].join("\n");
    }

    return [
      commonHeader,
      "",
      "=== HERO_01 HARD CONSTRAINTS (主图 10 项硬约束 — 必须全部满足，表现形式由风格决定) ===",
      "This PRIMARY hero MUST satisfy ALL 10 hard constraints below. The style determines the LOOK of each element, NOT whether it exists.",
      "",
      "HC1 — 100% INFO DENSITY: Every corner (top-left/top-right/bottom-left/bottom-right/top/bottom) MUST have visual or text content. NO contiguous blank zone larger than 5% of frame. Fill dead zones with texture, garnish, labels, or atmospheric effects.",
      "HC2 — DUAL SUBJECTS: Both (a) product PACKAGING in 3D perspective AND (b) FINISHED FOOD hero shot MUST appear simultaneously. Packaging renders brand identity; food delivers appetite appeal.",
      "HC3 — THREE-LAYER TITLE SYSTEM: LAYER A — brand name + Logo at top; LAYER B — large main headline (6-12 chars) + sub-headline/Slogan (1 line); LAYER C — top selling-point strip with 2-3 capsule tags. Font/color/material per style identity.",
      "HC4 — SIDE SELLING-POINT BAR: A vertical bar on the LEFT or RIGHT side with 4-5 icon+text selling points. Each point has an independent small icon. Bar shape/style per style identity (flame icons / green health icons / brush-stroke strip / guochao cloud strip / cartoon bubbles).",
      "HC5 — BOTTOM HIGH-CONTRAST BANNER: A full-width high-contrast banner at the bottom containing 3-4 core selling-point keywords. Banner material per style identity (metallic brush / paper / washi / rice paper / neon glow / wax seal).",
      "HC6 — BADGE / CORNER-TAG SYSTEM: At least 3 badges/corner tags in DIFFERENT positions: (1) selling-point badge next to headline, (2) trust badge at bottom-right, (3) promo/identity badge at a corner. Badge shape per style identity (circular seal / explosion sticker / ribbon / shield / neon sign / cinnabar seal).",
      "HC7 — INGREDIENT / GARNISH VISUALIZATION: 5-8 real food ingredients/garnishes scattered around the product (noodle bundles, eggs, vegetables, meat, spices). Rendering style per style identity (photorealistic / illustration / ink wash / cartoon / vintage).",
      "HC8 — SEASONING PACKET DISPLAY: 1-2 seasoning packets (broth packet / sauce packet / powder packet) shown as INDEPENDENT visual elements with clear position and appearance. Packet design per style identity (silver foil / green health / black premium / vintage paper / cartoon).",
      "HC9 — STRONG COLOR ZONING: 2-3 dominant colors with clear visual zoning via color blocks / background / banners. Palette per style identity (street red-black / healthy green-white / ink black-white-gray / guochao red-gold / vintage yellow-brown).",
      "HC10 — COMPLETE BRAND INFO: At least 3 of the following must be visually present: brand Logo, brand name, product name, net weight/specs. Presentation form per style identity (badge / banner / seal / label / packaging itself).",
      "",
      "=== COMPOSITION GUIDANCE (构图指引 — 配合硬约束) ===",
      "- The FINISHED DISH must dominate the frame (45-60% of visual weight) — it is the appetite hero",
      "- The PACKAGING appears as a 3D perspective brand badge (8-15% of frame) — brand identification + dual subject",
      "- TOP ZONE: brand name + main headline + sub-headline + 2-3 capsule tags (HC3)",
      "- SIDE BAR: 4-5 icon+text selling points on left or right (HC4)",
      "- BOTTOM ZONE: high-contrast banner with 3-4 keywords (HC5)",
      "- CORNERS: ≥3 badges/corner tags (HC6)",
      "- SCATTERED: 5-8 ingredient props + 1-2 seasoning packets (HC7 + HC8)",
      "- FORBIDDEN: Three horizontal layers (title strip + packaging strip + food strip) — this creates a template-like composition",
      "- SUCCESS: 'All 10 hard constraints present + style-appropriate LOOK + appetite hero + flavor-matched atmosphere = a differentiated, premium hero image.'",
      "",
      "TITLE STYLE (dense styles):",
      "- Default: bold brushstroke calligraphy with metallic gold texture, heavy black outline, slight bevel/emboss, ink splatter",
      "- For cute_cartoon: rounded colorful font with thick outline",
      "- For infographic / tech_geometric: bold sans-serif or HUD-style font",
      "- The title must be a DESIGN ELEMENT integrated into the image, NOT a separate banner or label strip, unless the style explicitly uses a banner (festival_promo / infographic)",
      "",
      "CORNER DECORATION BADGES (dense styles):",
      `- TOP-RIGHT corner: Circular or seal-style badge with text like '${flavor.badgeExamples[0]}' or '${flavor.badgeExamples[1] ?? flavor.badgeExamples[0]}' in red/gold, stamp texture`,
      `- TOP-LEFT corner: Small ${flavor.isSpicy ? "flame-shaped" : "ribbon"} badge with '${flavor.badgeExamples[0]}' icon, adding visual energy`,
      "- These badges should look like comic/explosion-style commercial stickers — 3D, slightly rotated, with drop shadow",
      "- They add visual richness without competing with the main headline or food",
      `- FORBIDDEN: Do NOT use flavor-mismatched badge text like ${flavor.forbiddenWords.map((w) => `"${w}"`).join(" or ")} for this product`,
      "",
      "SELLING POINT ICON BAR (dense styles):",
      `- 3-5 icon+text combinations in a horizontal row at the BOTTOM of the frame (e.g., ${flavor.iconExamples.join(" + ")})`,
      "- REQUIRED style: Dark semi-transparent base bar (black or deep brown) with GOLD GLOWING BORDERS around each icon cell",
      "",
      "COMPOSITION RULES:",
      "- The finished dish MUST dominate the frame and occupy 45-60% of the visual weight — it is the reason users stop scrolling",
      "- Push the food toward the visual center according to the style's composition",
      "- The packaging box is for brand identification AND dual-subject display — give it 8-15% of the frame in 3D perspective",
      "- FORBIDDEN: Three horizontal layers (title strip + packaging strip + food strip) — this creates a template-like, boring composition",
      "- SUCCESS: 'All 10 hard constraints present + style-appropriate LOOK + appetite hero + flavor-matched atmosphere = a differentiated, premium hero image.'",
    ].join("\n");
  }

  return [
    commonHeader,
    "",
    "=== SECONDARY HERO HARD CONSTRAINTS (副图硬约束 — 至少覆盖 6 项) ===",
    "This secondary hero MUST cover at least 6 of the 10 hard constraints. The specific subset depends on the hero's role:",
    "",
    "hero_02 (Finished Dish): MUST cover HC1 info density, HC2 finished food, HC3 title system, HC5 bottom banner, HC6 badges, HC7 ingredient visualization.",
    "hero_03 (Ingredient): MUST cover HC1 info density, HC2 packaging+ingredients, HC4 side selling-point bar, HC7 ingredient scatter, HC8 seasoning packet, HC10 brand info.",
    "hero_04 (Making Scene): MUST cover HC1 info density, HC2 packaging+action, HC3 title system, HC5 bottom banner, HC6 badges, HC7 dynamic ingredients/droplets.",
    "hero_05 (Usage Scene): MUST cover HC1 info density, HC2 packaging+scene, HC3 title system, HC5 bottom banner, HC9 color zoning, HC10 brand info.",
    "",
    "PACKAGING RULE: The product PACKAGING MAY appear in this secondary hero if the visualPrompt calls for it (especially hero_03 and hero_05), but it should NOT dominate the frame — the visual subject per visualPrompt is the hero.",
    "",
    "WHAT TO SHOW:",
    "- Follow the visualPrompt for the main visual subject (finished dish / ingredients / cooking scene / lifestyle scene)",
    "- The visualPrompt explicitly names a companion asset from the reference images — pair it as a visible co-subject",
    "- Use the reference images to understand: brand colors, ingredient shapes, packaging design elements",
    "",
    lowDensity
      ? [
          "LOW-DENSITY SECONDARY HERO RULES:",
          "- Composition, lighting, props, and atmosphere MUST follow the HERO STYLE IDENTITY above",
          "- Keep marketing elements minimal (1-3 subtle labels or none)",
          "- Preserve intentional whitespace and clean aesthetic",
          "- NO dense icon bars, NO heavy 3D badges, NO dark backgrounds, NO dramatic spotlight unless the style calls for it",
        ].join("\n")
      : [
          "DENSE SECONDARY HERO RULES:",
          "- Maintain the same premium commercial polish as the primary hero",
          "- Use style-appropriate marketing elements (badges, tags, icon bars, side bar, bottom banner) at 20-30% coverage",
          "- Keep 3D material quality consistent with hero_01",
          "- Follow the CROSS-HERO DIFFERENTIATION checklist to ensure this hero looks visually distinct",
          "- Ensure the required hard constraint subset is visually present — style determines LOOK, not EXISTENCE",
        ].join("\n"),
    "",
    "THIS IS THE PRODUCT: The finished dish, the ingredients, the cooking process, the lifestyle moment. Show it with the required hard constraints for this hero's role.",
  ].join("\n");
}

function buildCopyFusionInstruction(isLowDensity: boolean, flavor: ReturnType<typeof detectFlavorFromAnalysis>) {
  const common = [
    "",
    "COPY FIDELITY RULE (文案忠实度 — 不可违反):",
    "- The copy text above MUST be rendered EXACTLY as written — do NOT paraphrase, simplify, or replace with generic marketing phrases.",
    "- If the copy says '日晒72小时，面条Q弹有嚼劲', you MUST render exactly '日晒72小时，面条Q弹有嚼劲' — NOT '美味面条' or '好吃面'.",
    "- Each hero image's in-image text must be UNIQUE and SPECIFIC to this product — generic phrases like '美味' '好吃' '精选' appearing alone without specific product data are FORBIDDEN.",
    "- The copy was carefully crafted to be different from other heroes — rendering different text would break the differentiation.",
  ];

  if (isLowDensity) {
    return [
      ...common,
      "",
      "COPY FUSION METHOD — LOW-DENSITY STYLE (文案融合方式 — 低密度风格):",
      "The main headline must be rendered as a QUIET DESIGN ELEMENT, not a loud overlay:",
      "- Font: ultra-thin sans-serif, fine handwritten script, Mincho-style, or small elegant calligraphy with seal — depending on the style identity",
      "- Placement: in whitespace, a quiet corner, or aligned to the style's composition — NOT aggressively overlapping the food",
      "- Style: NO heavy black outline, NO metallic texture, NO glow, NO 3D bevel, NO rectangular banner behind the text",
      "- Size: small to medium — the food remains the hero, text is secondary",
      "- Small text (data/specs/parameters) can use a single thin-line label, small seal, or micro-badge at a corner",
      "",
      "⚠️ FORBIDDEN for low-density styles:",
      "- Large brushstroke calligraphy overlapping the food",
      "- Metallic embossed text with specular highlights",
      "- Glowing neon-like text",
      "- Headline inside a top banner or colored bar",
      "",
      `EXAMPLE for healthy_light: Small light-green sans-serif headline '清爽鲜香' placed in the top-left whitespace above a bright salad-pasta bowl, with two tiny circular badges (🥬清爽健康 / 🍜面条弹牙) in the lower-right corner.`,
    ].join("\n");
  }

  return [
    ...common,
    "",
    "COPY FUSION METHOD (文案融合方式 — 头图大标题必须遵守):",
    "The MAIN HEADLINE text (the first 4-8 characters of the copy) MUST be rendered as a DESIGN ELEMENT integrated into the image, NOT as a separate banner or label strip:",
    "- Calligraphy style (书法字): Bold brushstroke characters with ink splatter effect, overlaid directly on the food image",
    "- Metallic texture (金属质感字): Gold/silver/copper embossed text with specular highlights, floating above the scene",
    "- Glowing text (发光字): Text with warm glow effect, as if lit from behind, creating a neon-like impact",
    "- The headline text should OVERLAP with the food image — it is part of the visual composition, not a separate UI element",
    "- Small text (data/specs/parameters) should use conventional label/badge/tag format at the bottom or corners",
    "",
    "⚠️ FORBIDDEN — DO NOT DO ANY OF THESE:",
    "- FORBIDDEN: Placing the main headline inside a rectangular banner/ribbon/strip at the top of the image",
    "- FORBIDDEN: Placing the main headline inside a colored background bar/strip that separates it from the food image",
    "- FORBIDDEN: The headline text must NOT have a solid-color rectangular background behind it — it should float ON TOP of the food image with only a subtle shadow/glow for readability",
    "- FORBIDDEN: Using a separate 'title bar' or 'header strip' zone — the headline text must be PART of the food image, not a separate UI element above it",
    "",
    "CORRECT EXAMPLE: Large brushstroke characters '爆辣劲爽' floating directly on top of the steaming noodle image, with a subtle dark shadow for readability. The text and food are ONE composition.",
    "INCORRECT EXAMPLE: A red rectangular banner at the top with '爆辣劲爽' text inside it, separated from the food image below. This looks like a cheap template.",
  ].join("\n");
}

function buildHeroFrameFullnessInstruction(isLowDensity: boolean) {
  if (isLowDensity) {
    return [
      "",
      "=== HERO FRAME FULLNESS — LOW-DENSITY STYLE (头图画面饱满度 — 低密度风格) ===",
      "The frame must feel BALANCED and INTENTIONAL, not crowded:",
      "- PRODUCT SUBJECT: 45-55% of frame area",
      "- INTENTIONAL WHITESPACE: 25-40% of frame area — this is a designed pause, not an error",
      "- MARKETING ELEMENTS: 5-12% of frame area (1-3 subtle labels maximum)",
      "- ATMOSPHERE/TEXTURE/PROPS: 15-25% of frame area (light surface texture, fresh garnish, soft shadows, natural props)",
      "",
      "SELF-CHECK: If marketing elements exceed 12% coverage or the frame feels crowded → REMOVE elements. Low-density styles succeed through restraint.",
    ].join("\n");
  }

  return [
    "",
    "=== HERO FRAME FULLNESS QUANTIFICATION (头图画面饱满度量化 — 与硬约束对齐) ===",
    "Every pixel of the hero image frame MUST belong to one of these categories:",
    "- PRODUCT SUBJECT (dual subjects per HC2): 45-60% of frame area (finished dish 35-45% + packaging 8-15%)",
    "- MARKETING ELEMENTS (per HC3+HC4+HC5+HC6): 25-35% of frame area (top headline + side selling-point bar + bottom banner + badges/corner tags)",
    "- INGREDIENTS & SEASONING PACKETS (per HC7+HC8): 5-10% of frame area (5-8 scattered ingredients + 1-2 seasoning packets)",
    "- ATMOSPHERE/TEXTURE: 10-15% of frame area (steam, light rays, texture overlay, vignette, color zoning per HC9)",
    "- EMPTY/BLANK: 0% — there is NO acceptable amount of empty space in a hero image",
    "",
    "HARD CONSTRAINT SELF-CHECK: Before generating, verify ALL 10 hard constraints are accounted for in the frame allocation above. If any HC is missing → ADD it before generating.",
    "A hero image with visible blank/empty zones or missing hard constraints is a FAILED hero image. Commercial hero images are DENSE with visual content.",
  ].join("\n");
}

function buildMarketingElementLayoutInstruction(isLowDensity: boolean) {
  if (isLowDensity) {
    return [
      "",
      "=== MARKETING ELEMENT LAYOUT RULE — LOW-DENSITY STYLE (营销元素布局 — 低密度风格) ===",
      "Marketing elements must be SUBTLE and SPARSE. Less is more:",
      "- PLACEMENT: 1-3 small elements only, placed in quiet corners or aligned whitespace",
      "- FORMS allowed: thin-line label, small circular data badge, tiny seal stamp, single soft tag",
      "- SIZE: small — the largest element should be no bigger than the smallest garnish detail",
      "- DEPTH: minimal — a soft shadow is enough; NO heavy emboss, NO metallic rim, NO 3D bevel",
      "- ALIGNMENT: align to an invisible grid if multiple elements exist, but keep them far apart",
      "",
      "FORBIDDEN:",
      "- Top banner, bottom brand bar, left-side tag cluster, corner explosion badge",
      "- Dark semi-transparent icon bar with gold borders",
      "- Multiple stacked labels or overlapping elements",
      "- Marketing elements covering more than 12% of the frame",
    ].join("\n");
  }

  return [
    "",
    "=== MARKETING ELEMENT LAYOUT RULE (营销元素布局位置规范 — 与硬约束 HC3-HC6 对齐) ===",
    "Marketing elements MUST be arranged with visual hierarchy and aesthetic balance, NOT randomly scattered:",
    "- TOP BANNER / HEADLINE ZONE (HC3 LAYER A+B+C): Located at the TOP 15-20% of the frame. Contains brand name + Logo + large main headline + sub-headline + 2-3 capsule selling-point tags.",
    "- SIDE SELLING-POINT BAR (HC4): Located at the LEFT or RIGHT 10-15% of the frame, VERTICALLY stacked with 4-5 icon+text selling points. Each point has an independent small icon. Bar shape/style per style identity.",
    "- BOTTOM HIGH-CONTRAST BANNER (HC5): Located at the BOTTOM 8-12% of the frame, spanning FULL WIDTH. Contains 3-4 core selling-point keywords in high-contrast colors. Banner material per style identity.",
    "- BADGE / CORNER-TAG SYSTEM (HC6): At least 3 badges/corner tags in DIFFERENT positions: (1) selling-point badge next to headline, (2) trust badge at bottom-right, (3) promo/identity badge at a corner. Shield/circle/seal/ribbon shape per style identity.",
    "- BRAND BADGE (HC10): Brand Logo + brand name + product name + net weight/specs — at least 3 items visually present. Can be on packaging itself, a badge, a banner, or a seal.",
    "- ANNOTATION BUBBLES: Connected to the product via thin lines, positioned adjacent to the product with 2-4 word labels.",
    "",
    "LAYOUT BALANCE RULES:",
    "1. Marketing elements must NOT overlap each other — each element has its own visual zone",
    "2. Marketing elements must NOT obscure the main product — the product must remain the visual hero (45-60% of frame)",
    "3. Elements must share a consistent color family (derived from brand color or product dominant color)",
    "4. All elements must have 3D depth (shadow, emboss, or material texture) — flat stickers are FORBIDDEN",
    "5. The overall layout must feel like a professional commercial poster, not a collage of random stickers",
    "",
    "VISUAL COMPOSITION RULES (视觉编排规则 — 确保有序而非混乱):",
    "1. SPACING: Adjacent elements must have visible breathing space (at least 2-3% of frame width gap). Do NOT pack elements tightly against each other.",
    "2. VISUAL WEIGHT BALANCE: If the product is center-left, place heavier marketing elements (banners, tag clusters) on the right side to balance. If product is center-right, balance left. The overall frame must feel visually STABLE, not lopsided.",
    "3. SIZE HIERARCHY: The largest marketing element (usually the top banner) should be 3-5x the size of the smallest (corner tag). Create a clear visual hierarchy — not all elements the same size.",
    "4. ALIGNMENT: Elements should align to an invisible grid. Left-clustered tags should share the same left edge. Top banner and bottom bar should share the same width. This creates ORDER, not chaos.",
    "5. COLOR GRADATION: Marketing elements should transition in color from the banner (darkest/most saturated) to the smallest tags (lightest/most transparent), creating a natural visual flow from dominant to subtle.",
  ].join("\n");
}

function buildReferenceText(referenceAssets: ProductAsset[], section?: PageSection) {
  if (!referenceAssets.length) {
    return "No reference images were provided — you must create the product from the section analysis.";
  }

  // 区分带标签素材（PACKAGING/PRODUCT/INGREDIENT/INFO_CARD）和普通参考图
  const taggedTypes = new Set(["PACKAGING", "PRODUCT", "INGREDIENT", "INFO_CARD"]);
  const taggedAssets = referenceAssets.filter((a) => taggedTypes.has(a.type));
  const hasTaggedAssets = taggedAssets.length >= 2;

  // 根据 section 类型选择主参考图
  let primaryRef = referenceAssets[0];
  let primaryRole = "identity reference";
  if (hasTaggedAssets) {
    const packaging = taggedAssets.find((a) => a.type === "PACKAGING");
    const product = taggedAssets.find((a) => a.type === "PRODUCT");
    const ingredient = taggedAssets.find((a) => a.type === "INGREDIENT");
    if (section?.type === "HERO" && section.order === 0 && packaging) {
      primaryRef = packaging;
      primaryRole = "primary subject (packaging)";
    } else if (product) {
      primaryRef = product;
      primaryRole = "primary subject (real product)";
    } else if (ingredient) {
      primaryRef = ingredient;
      primaryRole = "primary subject (ingredient)";
    }
  }

  const parts = [
    `=== MAIN PRODUCT IMAGE (${primaryRole}): ${primaryRef.fileName} ===`,
    "This reference image defines the product IDENTITY — brand, flavor, packaging design, color scheme.",
    "",
  ];

  if (hasTaggedAssets) {
    // 有多个带标签素材时，按标签逐个列出，作为 co-subject
    parts.push(
      "=== PRODUCT ASSET REFERENCES (产品素材参考图 — 多素材组合) ===",
      "You have MULTIPLE real product asset images below. Each one shows a DIFFERENT aspect of the product.",
      "When the section's visualPrompt pairs multiple assets (e.g., '产品外包装图 + 产品实物图-正面'),",
      "you MUST show BOTH assets as CLEAR, RECOGNIZABLE visual elements in the generated image.",
      "",
      "ASSET COMPOSITION RULES (素材组合规则 — 头图强制执行):",
      "1. **Co-subject, NOT accessory**: Each paired asset is a CO-SUBJECT in the scene, not a background prop. Each should occupy 30-50% of the visual space and be clearly visible and identifiable.",
      "2. **Recognizable appearance**: Match each asset's real appearance from its reference image — packaging design, product shape, ingredient color/texture must be faithfully rendered.",
      "3. **Natural composition**: Arrange paired assets naturally (e.g., packaging on the left + real product on the right, or product in foreground + ingredients spread behind). The layout should feel like a professional product photoshoot.",
      "4. **Visual balance**: Both assets should be in focus and at comparable visual weight. Do NOT push one asset to the periphery or blur it into the background.",
      "5. **visualPrompt pairing**: The visualPrompt will explicitly name which assets to pair. Follow it precisely.",
      "",
      "Asset list:",
    );
    for (const asset of taggedAssets) {
      const meta = asset.metadata as Record<string, unknown> | null;
      const label = meta?.label ?? asset.type;
      parts.push(`- ${label} (${asset.type}): ${asset.fileName}`);
    }
    parts.push(
      "",
      "=== END PRODUCT ASSET REFERENCES ===",
      "",
    );
  } else if (referenceAssets.length > 1) {
    // 没有带标签素材时，保持原有的 accessory 逻辑
    const supportingFiles = referenceAssets.slice(1).map((item) => item.fileName).join(", ");
    parts.push(
      `=== ACCESSORY REFERENCE IMAGES (辅助参考图): ${supportingFiles} ===`,
      "These reference images provide additional visual context (scenes, ingredients, props).",
      "Use them as inspiration for scene composition, ingredient appearance, and environmental details.",
      "",
      "ACCESSORY USAGE RULES:",
      "1. **场景参考**: Use accessory images to understand real-life scenes, cooking contexts, and ingredient appearances",
      "2. **道具参考**: Extract props, garnishes, and environmental elements from accessory images",
      "3. **氛围参考**: Use accessory images' lighting, mood, and atmosphere as reference for scene design",
      "4. **灵活使用**: Accessory images are optional references — use them when they help the scene, ignore them when they don't",
      "",
    );
  }

  // 通用决策流
  parts.push(
    "REFERENCE IMAGE DECISION FLOW:",
    "- If visualPrompt mentions 'product packaging / 产品包装 / 产品主体' → Show the product packaging as it appears in the reference image",
    "- If visualPrompt mentions 'finished dish / 成品 / cooked bowl' → Show a cooked/prepared version of this product — do NOT show the packaging",
    "- If visualPrompt mentions 'ingredients / 食材 / 原料 / raw materials' → Show raw ingredients — do NOT show the packaging",
    "- If visualPrompt mentions 'cooking / 制作 / 烹饪 / making scene' → Show the cooking process — do NOT show the packaging",
    "- If visualPrompt mentions 'lifestyle / 场景 / usage scene' → Show a real-life scene with the product context — packaging may or may not appear naturally",
    "- If visualPrompt pairs multiple assets by name (e.g., '产品外包装图 + 产品实物图') → Show BOTH assets as co-subjects in the scene",
    "",
  );

  return parts.join("\n");
}

/**
 * 低密度风格头图 visualPrompt 重写 — 完全覆盖 planning 阶段可能遗留的高密度描述
 */
function buildLowDensityHeroVisualPrompt(
  section: PageSection,
  productName?: string | null,
  analysis?: ProductAnalysisOutput | null,
): string {
  const product = productName || analysis?.productName || "this product";
  const flavor = detectFlavorFromAnalysis(analysis);

  // 给AI创意自由度，强调精美度和商业品质，不给死板数值
  // 注意：此处不给统一的"wellness magazine"描述，风格自身美学由 STYLE VISUAL CONSTRAINT 定义
  const commonGuidelines = [
    "CREATIVE FREEDOM: You have full creative license to compose this image in the most visually stunning way possible — WITHIN the specific style's 7 dimensions defined in STYLE VISUAL CONSTRAINT.",
    "QUALITY STANDARD: This must look like premium commercial artwork — magazine quality, true to THIS STYLE's medium (photography / illustration / ink wash / etc.), not amateur.",
    "PRODUCT HERO: The product should be the undeniable focal point, styled to look absolutely appetizing within THIS STYLE's aesthetic language.",
    "STYLE MOOD: Follow the STYLE VISUAL CONSTRAINT's mood definition for THIS SPECIFIC style — do NOT default to a generic light/fresh/wellness look. Each low-density style has its own distinct aesthetic (minimalist / japanese_fresh / healthy_light / ink_wash / vintage_chinese / regional_memory / etc. are all visually different).",
    "MARKETING INTEGRATION: Any text, badges, or labels should feel naturally integrated into the composition per the style's marketingStyle.coverageHint, not bolted on.",
  ];

  switch (section.order) {
    case 0:
      return [
        "LOW-DENSITY PRIMARY HERO — CREATIVE BRIEF:",
        `- Product: ${product} — make it look irresistible and premium.`,
        ...commonGuidelines,
        "- COMPOSITION: Use whatever composition technique creates the most stunning visual impact — centered, rule-of-thirds, dynamic angle, overhead, whatever works best for this specific product.",
        "- LIGHTING: Soft, natural, flattering light that makes the food look fresh and appetizing. Avoid harsh shadows or dramatic contrast.",
        "- ATMOSPHERE: Subtle, refined details that enhance the fresh/healthy mood — steam, garnish, texture, whatever feels right.",
        "- TYPOGRAPHY: If including text, make it elegant and integrated — not overwhelming the food.",
        "- SURPRISE ME: Find a unique angle or styling approach that makes this image stand out. Don't default to generic food photography.",
      ].join("\n");
    case 1:
      return [
        "LOW-DENSITY SECONDARY HERO 1 — CREATIVE BRIEF:",
        `- Show ${product} in a beautifully plated, appetizing state.`,
        ...commonGuidelines,
        "- FOCUS: The plated dish should look like it belongs in a high-end restaurant or food magazine.",
        "- STYLING: Choose props, surfaces, and garnishes that complement the product's natural beauty.",
        "- MOOD: Fresh, inviting, authentic — make viewers want to eat it immediately.",
      ].join("\n");
    case 2:
      return [
        "LOW-DENSITY SECONDARY HERO 2 — CREATIVE BRIEF:",
        `- Showcase the quality ingredients or key components of ${product}.`,
        ...commonGuidelines,
        "- FOCUS: Make the ingredients look fresh, wholesome, and premium.",
        "- ARRANGEMENT: Find an interesting way to present the ingredients — flat lay, artistic scatter, organized display, whatever creates the most visual appeal.",
        "- MOOD: Natural, wholesome, ingredient-forward — emphasize quality and freshness.",
      ].join("\n");
    case 3:
      return [
        "LOW-DENSITY SECONDARY HERO 3 — CREATIVE BRIEF:",
        `- Capture a cooking or preparation moment for ${product}.`,
        ...commonGuidelines,
        "- FOCUS: Show an action or process that feels calm, clean, and approachable.",
        "- MOMENT: Choose a step that's visually interesting — drizzling, plating, arranging, garnishing.",
        "- MOOD: Quiet, intentional, artisanal — like a chef carefully preparing a dish.",
      ].join("\n");
    case 4:
      return [
        "LOW-DENSITY SECONDARY HERO 4 — CREATIVE BRIEF:",
        `- Place ${product} in a lifestyle context that feels natural and aspirational.`,
        ...commonGuidelines,
        "- FOCUS: Create a scene that viewers can relate to and aspire to — breakfast table, desk lunch, picnic, cafe.",
        "- STORY: Tell a micro-story about when/where/how someone might enjoy this product.",
        "- MOOD: Effortless, healthy, everyday enjoyment — make it feel achievable and desirable.",
      ].join("\n");
    default:
      return section.visualPrompt;
  }
}

/**
 * 营销元素材质指令 — 根据风格自主调整，强调精美度
 */
function buildMarketingElement3DInstruction(section: PageSection, style?: string): string {
  const isHero = section.type === "HERO";
  const lowDensityHero = isHero && isLowDensityHeroStyle(style);

  if (lowDensityHero) {
    return [
      "",
      "=== MARKETING ELEMENT STYLE — LOW-DENSITY (低密度风格营销元素) ===",
      "Marketing elements should feel LIGHT, SUBTLE, and NATURALLY INTEGRATED into the scene.",
      "",
      "DESIGN PRINCIPLES:",
      "- Elements should enhance the composition, not dominate it",
      "- Use forms that feel refined and intentional — thin lines, subtle badges, delicate labels",
      "- Materials and textures should complement the fresh/healthy mood of the scene",
      "- Colors should harmonize with the natural palette — think sage, cream, soft gray, pale wood",
      "- Coverage should be minimal — just enough to communicate key info without cluttering",
      "",
      "CREATIVE FREEDOM:",
      "- You have full creative license in how you design and place these elements",
      "- Find innovative ways to integrate text/badges that feel like part of the scene, not overlays",
      "- Consider: thin-line labels, small circular badges, tiny seals, delicate tags, minimalist callouts",
      "- The goal is elegant restraint — every element should earn its place",
      "",
      "QUALITY STANDARD:",
      "- Even minimal elements must look polished and professional",
      "- Typography should be clean and refined",
      "- Spacing and alignment must be intentional",
      "- The overall effect should feel curated, not sparse",
      "=== END MARKETING ELEMENT STYLE — LOW-DENSITY ===",
    ].join("\n");
  }

  const layerContext = isHero
    ? "头图的营销元素需要丰富且有视觉冲击力"
    : "详情页的营销元素需要精致且有信息层次";

  return [
    "",
    "=== MARKETING ELEMENT DESIGN MANDATE (营销元素设计 — 强调精美度) ===",
    `Context: ${layerContext}`,
    "",
    "ALL marketing/design elements (banners, tags, badges, corner marks, label strips, decorative frames) MUST look PREMIUM and PROFESSIONAL — amateur or generic designs are UNACCEPTABLE.",
    "",
    "DESIGN PRINCIPLES:",
    "- Elements should have visual depth and material quality — think 3D, texture, or refined flat design",
    "- EXCEPTION: if the STYLE VISUAL CONSTRAINT specifies a flat/vector/illustration/hand-drawn style, match that aesthetic instead of forcing 3D",
    "- Colors should be rich and purposeful — use gradients, shadows, or material textures to create impact",
    "- Coverage should be substantial enough to create commercial appeal, but balanced with the overall composition",
    "",
    "CREATIVE FREEDOM:",
    "- You have full creative license in how you design these elements",
    "- Find innovative ways to make banners, badges, and tags visually stunning",
    "- Consider: 3D effects, material textures, layered depth, metallic accents, embossed details",
    "- The goal is commercial polish — every element should look like it belongs in a high-end ad",
    "",
    "QUALITY STANDARD:",
    "- Every marketing element must look intentional and professionally designed",
    "- Typography should be bold and readable with proper hierarchy",
    "- Materials and textures should feel premium — not flat or generic",
    "- The overall effect should feel powerful and commercially compelling",
    "=== END MARKETING ELEMENT DESIGN MANDATE ===",
  ].join("\n");
}

/**
 * 全页面多素材组合指令 — 所有图片强制使用至少2个上传素材
 */
function buildMultiAssetMandate(section: PageSection): string {
  const result = [
    "",
    "=== MULTI-ASSET COMPOSITION MANDATE (多素材组合 — 每张图强制执行) ===",
    "You have MULTIPLE reference images showing different aspects of this product. Every generated image MUST combine at least 2 of them.",
    "A single-subject image (e.g., just the product packaging alone, or just one ingredient packet) is a FAILURE.",
    "",
  ];

  if (section.type === "HERO") {
    result.push(
      "For HERO images:",
      "- Compose at least 2 assets as co-subjects in the square frame",
      "- Each co-subject should be clearly visible, matched to its reference image",
      "- The visualPrompt explicitly names which assets to pair — follow it EXACTLY",
    );
  } else {
    result.push(
      "For DETAIL PAGE images:",
      "- Even though these are detail pages, you MUST still compose at least 2 real product assets",
      "- Example: main subject = product real-shot (实物图) + companion = ingredient packet (调料包) placed nearby",
      "- Example: main subject = ingredient macro closeup (调料图) + companion = product info card (信息图) showing specs",
      "- The visualPrompt names which assets to pair — follow it EXACTLY",
    );
  }

  result.push(
    "",
    "FRAME FULLNESS CHECK (画面饱满度):",
    "1. Are at least 2 DISTINCT product assets visibly present in the scene?",
    "2. Is each asset recognizable — matching its reference image appearance?",
    "3. Are they composed as co-subjects, not one hidden behind the other?",
    "4. Does the composition feel like a deliberate multi-product photoshoot, not an accidental snapshot?",
    "",
    "FAILURE MODE: 'I used one asset as the main subject and kept everything else as background texture' → UNACCEPTABLE. BOTH assets must be recognizable.",
    "SUCCESS MODE: 'Product packaging dominates the right 50% of frame at sharp focus, while ingredient packet sits at 40% scale on the left, both clearly identifiable' → ACCEPTABLE.",
    "=== END MULTI-ASSET COMPOSITION MANDATE ===",
  );

  return result.join("\n");
}

function buildMainImageInstruction(referenceAssets: ProductAsset[], style?: string) {
  if (!referenceAssets.length) {
    return [
      "=== PRODUCT IDENTITY — NO REFERENCE IMAGE AVAILABLE ===",
      "CRITICAL: No main product image reference is available.",
      "You MUST generate a realistic, specific product with clear shape, material, color, texture, and proportions.",
      "Do NOT generate a generic, abstract, or placeholder product.",
      "Use the section's structured analysis (title, goal, copy, visual prompt) to determine exactly what product is being sold.",
      "The product MUST look like a real e-commerce product that exactly matches the section description.",
    ].join(" ");
  }

  const taggedTypes = new Set(["PACKAGING", "PRODUCT", "INGREDIENT", "INFO_CARD"]);
  const taggedAssets = referenceAssets.filter((a) => taggedTypes.has(a.type));
  const hasTaggedAssets = taggedAssets.length >= 2;
  const hasSupportingRefs = referenceAssets.length > 1;

  const base = [
    "=== PRODUCT IDENTITY — WHAT STAYS THE SAME vs WHAT CAN CHANGE ===",
    "The FIRST reference image (listed first below) is the MAIN PRODUCT IMAGE — it defines the product IDENTITY.",
    "",
    "CRITICAL — REFERENCE IMAGE IS IDENTITY ONLY, NOT VISUAL MANDATE:",
    "The reference image tells you WHAT product this is. It does NOT mean you must draw the product packaging into every generated image.",
    "The section's visualPrompt decides WHAT to show. The reference image only ensures brand/color/category consistency.",
    "If the visualPrompt says 'show a steaming bowl of noodles', you MUST show a steaming bowl — NOT the product box from the reference image.",
    "",
    "WHAT MUST STAY THE SAME across ALL generated images (product identity — NEVER change these):",
    "1. The BRAND and PRODUCT NAME — this is the same product in every image",
    "2. The PRODUCT CATEGORY — noodle/instant noodle/dried noodle (面食/方便面/干拌面)",
    "3. The FLAVOR PROFILE — same taste variant (e.g., spicy, original, beef, etc.)",
    "4. The COLOR PALETTE — derive from the reference image's color scheme for brand consistency",
    "",
    "WHAT MUST CHANGE across different sections (product presentation — MUST vary these):",
    "1. VISUAL SUBJECT: Each section's visualPrompt defines WHAT to show as the main visual subject —",
    "   - If visualPrompt says 'product packaging' → show the product package/box as the visual hero",
    "   - If visualPrompt says 'finished dish / cooked bowl' → show the PREPARED product (steaming bowl, ready to eat) as the visual hero — NOT the packaging",
    "   - If visualPrompt says 'ingredients / raw materials' → show the RAW INGREDIENTS (noodle cake, seasoning packets, fresh vegetables, meat) as the visual hero — NOT the packaging or cooked dish",
    "   - If visualPrompt says 'cooking/making scene' → show the COOKING PROCESS (pouring, stirring, plating) as the visual hero — with dynamic action, steam, splashes",
    "   - If visualPrompt says 'lifestyle/usage scene' → show the product IN A REAL-LIFE CONTEXT (desk, camping, sofa) as the visual hero — the environment tells the story",
    "",
    "2. ANGLE: Each section must show a DIFFERENT camera angle (overhead, side, 45-degree, close-up, macro)",
    "3. COMPOSITION: Each section must have a DIFFERENT layout —",
    "   - Don't always center the same element in the same way",
    "   - Vary between tight crop and wider scene",
    "   - Some sections can show just a PART of the product (e.g., just the noodles, just the packaging, just the garnish)",
    "4. MOOD: Each section should evoke a DIFFERENT feeling —",
    "   - Product showcase: authoritative, 'this is what you're buying'",
    "   - Finished dish: indulgent, 'I want to eat this NOW'",
    "   - Ingredients: honest, 'here's what goes into it'",
    "   - Cooking scene: dynamic, 'watch it come to life'",
    "   - Lifestyle: relatable, 'this could be my life'",
    "",
    "KEY RULE: The section's visualPrompt is the PRIMARY instruction for what to show. The reference image shows the product IDENTITY, but you must present it in the STATE and SCENE described by the visualPrompt. Think of it like a product photoshoot — the photographer shoots the same product in many different setups: packaged, cooked, ingredients spread, cooking action, lifestyle scene.",
    "",
  ];

  // 场景丰富化 — 始终激活（无论有无参考图）
  base.push(
    "=== SCENE ENRICHMENT — RICH, PREMIUM, APPETIZING COMPOSITION ===",
    "",
    "You MUST create a visually rich composition — NOT a product floating on a plain background:",
    "",
    "1. SURFACE & ENVIRONMENT (桌面与环境):",
    "   - Place the product on a surface appropriate to the selected visual style — follow the STYLE VISUAL CONSTRAINT background material if one is specified",
    "   - The surface MUST have visible texture, grain, weave, or material character — avoid flat featureless surfaces unless the style explicitly calls for it",
    "   - Background must show depth and context appropriate to the style (photographic depth for photography styles; illustrative depth for illustration styles)",
    "",
    "2. CONTEXTUAL PROPS & GARNISHES (道具与配菜):",
  );

  if (hasTaggedAssets) {
    // 有多个带标签素材时：搭配素材作为 co-subject，不是小装饰
    base.push(
      "   - MULTI-ASSET COMPOSITION: When the visualPrompt pairs multiple assets, show them as CO-SUBJECTS in the scene.",
      "   - Each paired asset should occupy 30-50% of the frame and be clearly visible and in focus.",
      "   - Do NOT shrink paired assets to the periphery or blur them — they are co-stars, not background props.",
      "   - Arrange paired assets naturally: packaging + real product side by side, product in foreground + ingredients behind, etc.",
      "   - Additional decorative props (chopsticks, garnishes, tableware) can fill remaining space around the co-subjects.",
    );
  } else if (hasSupportingRefs) {
    base.push(
      "   - IMPORTANT: You have accessory reference images (listed below). Place them as COMPANIONS alongside the main product:",
      "   - The accessory images are DECORATIVE PROPS — small companion elements that fill empty space around the main product",
      "   - HOW TO USE ACCESSORIES (附属品使用方式):",
      "     * Place accessory subjects at the periphery of the frame — corners, edges, or background areas",
      "     * Keep accessories at ≤30% scale relative to the main product",
      "     * Use slightly softer focus on accessories to keep attention on the main product",
      "     * Position accessories to fill negative space without competing for visual attention",
      "   - DO NOT use accessories for: composition decisions, color palette selection, lighting direction, or style reference",
      "   - The main product's visual identity and the section's planned layout remain COMPLETELY UNCHANGED",
    );
  } else {
    base.push(
      "   - Add category-appropriate props around the product based on the product type and section context",
    );
  }

  base.push(
    "   - For food/noodle products: add category-appropriate props (chopsticks, garnishes, tableware, beverages) — unless the STYLE VISUAL CONSTRAINT specifies a specific prop list, in which case follow it",
    "   - Props should be at varying depths (foreground blur, mid-ground companions, background ambiance)",
    "   - Every prop must serve the story: making the product look more desirable and appetizing",
    "",
    "3. LIGHTING & ATMOSPHERE (光影与氛围):",
    "   - Follow the STYLE VISUAL CONSTRAINT lighting direction, quality, and color temperature. If no style is specified, use warm directional light (3800K-4500K)",
    "   - Follow the STYLE VISUAL CONSTRAINT effects (steam, splashes, reflections, etc.). If no style is specified, add natural atmospheric elements: steam, sauce reflections",
    "   - The lighting should enhance the product's appeal in a way consistent with the selected style",
    "",
    "4. COMPOSITION DENSITY (构图密度):",
    "   - Visual subject occupies 55-70% of the frame as the clear hero. If a STYLE VISUAL CONSTRAINT specifies a different coverage range, follow the style",
    "   - Supporting elements fill the remaining space naturally. If the style calls for intentional whitespace (e.g. minimalist, ink wash), respect that",
    "   - Every part of the frame should have visual interest (texture, color, depth, or atmospheric blur)",
    "",
    "CRITICAL: The result must match the selected visual style — if the style is photography-based, aim for a real commercial product photograph with a rich scene; if the style is illustration/3D/flat-design, commit fully to that aesthetic.",
  );

  return base.join(" ");
}

function buildAspectInstruction(aspectRatio: "1:1" | "3:4" | "9:16") {
  if (aspectRatio === "1:1") {
    return "The final image must be a square 1:1 e-commerce hero composition, optimized for tappable product gallery covers.";
  }

  return aspectRatio === "3:4"
    ? "The final image must be a vertical 3:4 marketplace poster composition."
    : "The final image must be a vertical 9:16 long-form mobile commerce composition.";
}

function buildTargetLanguageInstruction(contentLanguage: ContentLanguage) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  return [
    `All user-facing marketing copy that appears inside the image must be written in ${targetLanguage}.`,
    `The section title, key selling points, short supporting copy, disclaimers, and CTA should all be in ${targetLanguage} when they appear in the image.`,
    "Do not mix in Simplified Chinese unless the target language is Simplified Chinese.",
    "Keep the typography native, polished, and commercially readable for the target language.",
  ].join(" ");
}

export function buildNegativePrompt(isLowDensityHero = false) {
  const common = [
    "Negative constraints (do NOT include any of the following in the generated image):",
    "- No garbled text, no illegible characters, no corrupted fonts, no broken characters, no wrong characters (错别字), no missing/extra strokes, no substituted similar-looking characters",
    "- No switched or substituted products — the product in the image MUST be the exact same product as defined by the main product image, never a different or unrelated item",
    "- No deformed or distorted product shapes",
    "- No floating or levitating objects — every object must sit naturally on its surface",
    "- No mismatched light directions, no double shadows, no light source conflicts",
    "- No plastic-like or overly smooth AI-looking textures",
    "- No chaotic or messy compositions — scene elements should be thoughtfully arranged, not randomly scattered",
    "- No objects that are completely unrelated to the product category — all props must be contextually appropriate",
    "- No low-resolution or blurry output",
    "- No prompt instruction text rendered into the image",
    "- No nonsensical text or meaningless character combinations",
    "- No mixed languages unless explicitly required",
  ];

  if (isLowDensityHero) {
    common.push(
      "",
      "=== LOW-DENSITY STYLE NEGATIVE CONSTRAINTS (低密度风格 — 绝对禁止街潮高密度模板残留) ===",
      "- NO pure black midnight-snack background (UNLESS the style's own STYLE VISUAL CONSTRAINT defines a dark/warm background, e.g. vintage_chinese aged rice paper #B87C4F, regional_memory brick red #A55233 — those are the style's identity and must be preserved)",
      "- NO dramatic spotlight or chiaroscuro lighting (UNLESS the style defines hard light, e.g. ink_wash overhead spotlight, vintage_chinese side-backlight — follow the style's own lighting definition)",
      "- NO large calligraphy or metallic text overlaying the food (UNLESS the style calls for it, e.g. ink_wash seal stamp, vintage_chinese brush-written tag)",
      "- NO bottom icon bar with dark semi-transparent background and gold borders",
      "- NO dense marketing border frame (top banner + bottom bar + side tags + corner badges)",
      "- NO flames, chili particles, spicy effects (for non-spicy products)",
      "- NO heavy 3D metallic badges, embossed text, beveled edges (UNLESS the style's marketingStyle.materialPreference allows 3D)",
      "- NO three-layer horizontal split composition",
      "- NO packaging box taking more than 8% of frame",
      "- NO greasy or heavy sauce appearance",
      "- NO midnight-snack or indulgent mood (the style's own mood, as defined in STYLE VISUAL CONSTRAINT, takes priority)",
      "NOTE: These negatives prevent street-appetite/festival-promo template residue. They do NOT override the style's own legitimately-defined background/lighting/atmosphere — always check STYLE VISUAL CONSTRAINT for what THIS style actually requires.",
      "=== END LOW-DENSITY STYLE NEGATIVE CONSTRAINTS ===",
    );
  }

  return common.join("\n");
}

function buildTextRenderingInstruction() {
  return [
    "Text rendering requirements — all text must be clean and professional:",
    "- Use clear, readable Chinese fonts (黑体/思源黑体/微软雅黑) with bold weight for headlines",
    "- Ensure all Chinese characters are properly formed with correct strokes and spacing",
    "- Text must be sharp, legible, and well-contrasted against its background",
    "- Keep text well-separated from other design elements — no overlapping or colliding",
    "- For best results, use clean sans-serif fonts and avoid overly decorative typefaces",
    "",
    "=== TEXT ACCURACY RULE (文字准确性 — 零错别字) ===",
    "CRITICAL: Every character in the image MUST be a real, correctly-written Chinese character. Typos and wrong characters are UNACCEPTABLE in commercial artwork.",
    "",
    "COMMON TYPO PATTERNS TO AVOID (高频错别字模式 — 绝对禁止):",
    "- Do NOT add or remove strokes from any character (e.g. 面条 ≠ 靦条, 酱料 ≠ 酱釆)",
    "- Do NOT substitute similar-looking characters (e.g. 已/己/巳, 拔/拨, 历/厉, 蒸/烝)",
    "- Do NOT mirror or flip any character",
    "- Do NOT merge two characters into one or split one into two",
    "- Do NOT render any character with missing or extra dots/strokes (e.g. 煮 ≠ 煱, 汤 ≠ 烫)",
    "",
    "STRATEGY FOR ACCURATE TEXT RENDERING:",
    "- Render ONLY the exact text provided in the section copy — do NOT invent or paraphrase any text",
    "- Keep each text element SHORT (2-6 characters per label/tag is ideal) — shorter text has fewer typo risk",
    "- For longer text (headlines, slogans), render each character carefully with correct stroke count",
    "- If you are unsure about a character's exact form, use a simpler synonym from the copy instead of guessing",
    "- Prefer standard sans-serif fonts (黑体/思源黑体) over decorative/calligraphic fonts — standard fonts have fewer rendering errors",
    "- Double-check: does every character in the image match the intended text exactly? If not → FIX before output",
    "=== END TEXT ACCURACY RULE ===",
  ].join("\n");
}

function buildProfessionalPhotographyInstruction(style?: string) {
  return [
    "Technical photography parameters to follow:",
    "Shot with 85mm prime lens, f/2.8 to f/4 aperture for selective focus with creamy background bokeh,",
    "ISO 100 for clean noise-free output,",
    "",
    "Lighting setup (appetizing and natural, NOT flat studio):",
    "- Key light: softbox from upper-left at 45-degree angle — color temperature follows STYLE VISUAL CONSTRAINT when specified, otherwise default to warm (3800K-4500K)",
    "- Rim/back light: gentle backlight from behind-left to create edge glow on steam and food highlights",
    "- Fill light: subtle bounce from right side at 20% intensity for soft dimension",
    "- The light must feel NATURAL — like window light, NOT cold clinical studio lighting. If a STYLE VISUAL CONSTRAINT is present, its color temperature takes priority.",
    "",
    "Shadow & contact requirements:",
    "- Soft, natural contact shadow under the product — touching the surface naturally, transparency 20-30%",
    "- No floating shadow, no disconnected shadow, no harsh edged shadow",
    "- Shadows should match the scene's color temperature, not grey or black",
    "",
    "Atmosphere & depth:",
    "- Shallow depth of field: product in tack-sharp focus, background elements in soft bokeh",
    "- Background must have visible texture and depth — NEVER a flat solid color or simple gradient",
    "- For food products: visible steam catching backlight, glossy sauce reflections, fresh garnish highlights",
    "- The image should look like a real photograph taken in a physical dining space — unless the style specifies illustration, 3D render, or flat design, in which case follow the style instead.",
  ].join(" ");
}

function buildPlatformStyleInstruction(platform?: string, isHero = false, isPrimaryHero = false, isLowDensity = false) {
  if (!platform) {
    return "";
  }

  const normalized = platform.toLowerCase();
  const heroLabel = isPrimaryHero ? "primary main image" : isHero ? "secondary main image" : "detail image";
  const cnLabel = isPrimaryHero ? "主图" : isHero ? "副图" : "详情图";

  if (/pinduoduo/i.test(normalized)) {
    if (isLowDensity) {
      const heroDesc = isPrimaryHero
        ? "This is the PRIMARY Pinduoduo main image rendered in a LOW-DENSITY visual style. The image must stay commercially clear and conversion-oriented, but expressed through a clean, fresh, minimal aesthetic."
        : isHero
          ? "This is a SECONDARY Pinduoduo hero image in a LOW-DENSITY visual style. Keep the same fresh, clean aesthetic as the primary hero while showing a different angle or selling point."
          : "This is a Pinduoduo detail image — a supporting page section. Keep the clean, low-density aesthetic; do not add dense marketing frames.";

      return [
        `Platform style — Pinduoduo ${heroLabel} (拼多多${cnLabel} — 低密度风格):`,
        heroDesc,
        "Product must be instantly recognizable and appetizing, but presented with restraint.",
        "Use light, airy backgrounds and natural props instead of dark moody surfaces.",
        "Limit marketing elements to 1-3 subtle labels/badges; avoid dense border frames, top banners, bottom bars, and aggressive promotional stickers.",
        "Color scheme should derive from the product's natural colors, with soft, fresh accents (sage, cream, pale wood, soft gray).",
        "No flames, no chili particles, no heavy 3D metallic text, no dark icon bars.",
        "Readable on mobile screens through clear hierarchy and intentional whitespace, not through density.",
      ].join(" ");
    }

    const heroDesc = isPrimaryHero
      ? "This is the PRIMARY Pinduoduo main image — the single most important hero visual in the gallery. It must deliver maximum first-screen impact with bold product presence, strong price-value signaling, and immediate category recognition. The image must have rich, densely-packed selling point content visually integrated into the composition — multiple benefit tags, value highlights, and promotional badges. Use a rich, attractive background with layered visual depth (dark moody surface with warm accent lighting, or warm-toned gradient) to draw consumer attention. Include prominent marketing border watermark elements: top banner with bold headline text, bottom banner with promotional offer, left-side floating selling-point tags, and decorative frame edges. The color scheme for marketing elements should derive from the product's own color family — each hero picks a different sub-tone within that family."
      : isHero
        ? "This is a SECONDARY Pinduoduo hero image — it should showcase a different angle or selling point than the primary hero. Use decorative frame elements that match the primary hero's 3D quality and design polish, with a different visual focus (product showcase, lifestyle mood, or detail emphasis). The marketing frame should be equally refined but arranged differently — use the same production standard with varied composition and color accents."
        : "This is a Pinduoduo detail image — a supporting page section after the main images. It should explain specific selling points, material details, usage scenarios, or trust factors in depth. Do NOT add marketing border watermark elements, frame decorations, banners, or floating selling-point badge tags — these are reserved for main images only.";

    return [
      `Platform style — Pinduoduo ${heroLabel} (拼多多${cnLabel}):`,
      heroDesc,
      "Bold, high-impact visual language. Strong color contrast with vibrant accents.",
      "Price tag or value anchor element may be visually hinted in the composition.",
      "Direct, benefit-driven visual communication with clear product prominence.",
      "High information density — but still clean and readable on mobile screens.",
      "Visual urgency cues allowed: badges, highlight ribbons, contrast color blocks.",
      isPrimaryHero && "Include prominent marketing frame elements: curved corner banner at top for main title, bottom banner for promotion text, left-side vertical tags for key selling points, brand logo badge at top-left corner. Make the border visually prominent with rich decorative details.",
      "CREATIVE VARIATION: The marketing frame elements (banners, tags, badges) should have creative variations in color and form — do not use the exact same style every time. Experiment with gradient colors, different arc curvatures, different corner radii on tags, different badge shapes (circle/shield/ribbon). Each hero picks a different sub-tone within the product's color family for dimensional variety.",
      "",
      "=== PINDUODUO FOOD-SPECIFIC APPETITE GUIDANCE (拼多多面食食欲指引) ===",
      "For noodle/food products on Pinduoduo, the image MUST trigger instant hunger. Apply these rules as defaults, but if a STYLE VISUAL CONSTRAINT specifies a different visual direction, follow the style instead:",
      "- The prepared dish (成品面) MUST be the visual hero — steaming hot, with visible steam wisps catching warm light",
      "- Use HIGH SATURATION warm colors: deep red chili oil (红油), bright green scallions (葱花), golden noodles (金黄面条), rich amber broth",
      "- Chopsticks lifting noodles in a dynamic 'pull' action — showing noodle strands hanging naturally",
      "- Garnish with appetite amplifiers: halved soft-boiled egg with runny yolk, sliced chili peppers, sesame seeds, meat pieces",
      "- Background: dark wooden table or dark moody surface with warm accent light — creates the 'midnight snack' (深夜食堂) atmosphere",
      "- Color temperature should feel warm and appetizing — derived from the product's color family, not forced to a specific Kelvin range",
      "- The promotional border frame should COMPLEMENT the food — use a shade from the product's color family with slight variation per hero",
    ].filter(Boolean).join(" ");
  }

  if (/xiaohongshu/i.test(normalized)) {
    const heroDesc = isPrimaryHero
      ? "This is the PRIMARY Xiaohongshu cover photo — the hero image that appears in the feed. It must feel like an authentic lifestyle shot, not a commercial ad. The product should be naturally integrated into a real-life setting with rich, warm natural light and a curated but approachable mood. Use a rich, visually appealing background (real home interior, cozy cafe, sunlit window, natural outdoor scene) to make the image attractive and engaging to consumers."
      : isHero
        ? "This is a SECONDARY Xiaohongshu hero image — another cover shot showing a different angle, use case, or mood than the primary cover. Keep the same lifestyle authenticity but introduce visual variety. Focus on product texture, natural interaction, or contextual detail without repeating the primary composition."
        : "This is a Xiaohongshu detail image — an in-depth lifestyle showcase within the post. It can go deeper into product texture, usage demonstration, before/after comparison, or detailed styling inspiration with the same authentic aesthetic. Do NOT add marketing border watermark elements, frame decorations, banners, or floating selling-point badge tags.";

    return [
      `Platform style — Xiaohongshu ${heroLabel} (小红书${cnLabel}):`,
      heroDesc,
      "Lifestyle authenticity is paramount — the image must feel like a real user photo, not a commercial ad.",
      "Soft natural lighting, warm tones. Avoid studio-perfect white-background look.",
      "Product placed off-center (rule of thirds), not dead center.",
      "Shoot from a slight 30-degree overhead angle — never flat lay top-down.",
      "Include subtle lived-in context: a hand holding the item, a coffee cup nearby, a window light source.",
      "No promotional text, no hard-sell visual language, no aggressive color pops.",
      "No marketing border, no frame decorations, no watermark-style elements.",
      "Mood: premium but approachable, curated but not staged.",
    ].join(" ");
  }

  if (/douyin/i.test(normalized)) {
    const heroDesc = isPrimaryHero
      ? "This is the PRIMARY Douyin e-commerce main image — the hero visual in the product showcase. It must grab attention instantly in fast-scrolling feeds with dynamic energy, vibrant colors, and the product plus key selling point clearly readable within 1 second. The image must have rich, densely-packed selling point content — multiple benefit highlights, value tags, and promotional badges integrated into the composition. Use a rich, visually striking background with layered depth (gradient lighting, dynamic color blocks, atmospheric glow effects) to maximize visual impact. Include marketing border watermark elements: top banner with bold, catchy headline text, bottom banner with promotional price or offer, left-side floating selling-point tags with rounded corners, and subtle gradient frame edges. Use modern, energetic color scheme with neon accents for promotional elements."
      : isHero
        ? "This is a SECONDARY Douyin hero image — another gallery shot with different energy or angle from the primary. Use decorative frame elements that match the primary hero's 3D quality and vibrant energy, with a different visual focus (dynamic product angle, lifestyle energy, or alternative selling point). The marketing frame should be equally polished but arranged differently — same production standard, varied composition and color accents."
        : "This is a Douyin e-commerce detail image — a deeper product explanation in the detail page. It should maintain visual energy while delivering more detailed information about features, quality, usage, and differentiation with motion-hinting composition. Do NOT add marketing border watermark elements, frame decorations, banners, or floating selling-point badge tags — these are reserved for main images only.";

    return [
      `Platform style — Douyin ${heroLabel} (抖音${cnLabel}):`,
      heroDesc,
      "Dynamic energy, high visual impact in vertical 3:4 format.",
      "Saturation slightly elevated — must catch attention in fast-scrolling feeds.",
      "Product + key selling point + category keyword must be visually identifiable within 1 second.",
      "Commercial polish with motion-hinting composition — slight dynamic angles, implied movement.",
      "Vibrant but not garish. Modern, punchy, mobile-first aesthetic.",
      isPrimaryHero && "Add marketing frame elements: top curved banner for main title, bottom banner for promotion details, left-side vertical tag badges for key selling points, small brand logo at top-right corner with semi-transparent background. Make the border visually prominent and eye-catching.",
      isHero && !isPrimaryHero && "Use a refined design framework at EQUAL quality — decorative banners and tags that match the primary hero's 3D material sophistication, with an airy composition balance and varied color accents for visual diversity.",
    ].filter(Boolean).join(" ");
  }

  if (/taobao|tmall/i.test(normalized)) {
    const heroDesc = isPrimaryHero
      ? "This is the PRIMARY Taobao/Tmall main image — the single most important product hero shot in the gallery. It must deliver clean, premium, trustworthy commercial photography with the product occupying 70-80% of the frame as the undisputed hero. The image must have rich selling point content visually integrated — multiple benefit highlights, quality certifications, and value propositions displayed around the product. Use a rich, elegant background with layered depth (subtle gradient backdrops, soft environmental reflections, premium studio setting) to attract consumer attention. Include elegant marketing border watermark elements: top banner with refined headline text, bottom banner with subtle promotional offer, left-side floating selling-point tags with rounded corners, and thin decorative frame edges. Use sophisticated color scheme with gold or silver accents for premium feel."
      : isHero
        ? "This is a SECONDARY Taobao/Tmall hero image — another gallery shot with a different communication angle. Use decorative frame elements that match the primary hero's 3D quality and premium refinement, with a different visual focus (craftsmanship detail, material texture, or alternative selling angle). The marketing frame should be equally elegant but arranged differently — same production standard, varied composition."
        : "This is a Taobao/Tmall detail image — a supporting product detail section. It should explain craftsmanship, specifications, material quality, size references, or usage scenarios with the same clean, professional aesthetic, integrating marketing copy visually into the composition. Do NOT add marketing border watermark elements, frame decorations, banners, or floating selling-point badge tags — these are reserved for main images only.";

    return [
      `Platform style — Taobao/Tmall ${heroLabel} (淘宝/天猫${cnLabel}):`,
      heroDesc,
      "Clean, premium, trustworthy commercial photography.",
      "Product is the undisputed hero — 70-80% frame occupancy.",
      "No promotional stickers, no price tags, no aggressive sales text on the image.",
      "The marketing headline and selling points should be visually integrated into the composition as part of the design, not overlaid as separate text boxes.",
      "Mood: professional, high-end, reliable.",
      isPrimaryHero && "Add elegant marketing frame elements: top banner with subtle gradient for main title, bottom banner for promotion details with minimalist style, left-side vertical tag badges for key selling points with soft shadows, small brand logo at top-left corner with clean background. Make the border refined and premium-looking.",
      isHero && !isPrimaryHero && "Use a refined design framework at EQUAL quality — elegant borders and tags that match the primary hero's 3D material sophistication, with a more airy composition balance.",
    ].filter(Boolean).join(" ");
  }

  if (isLowDensity) {
    const heroDesc = isPrimaryHero
      ? "This is the PRIMARY general e-commerce main image rendered in a LOW-DENSITY visual style. Present the product with clean, fresh, minimal commercial photography: light background, natural soft lighting, and only 1-3 subtle selling-point elements."
      : isHero
        ? "This is a SECONDARY general e-commerce hero image in a LOW-DENSITY visual style. Keep the same clean, fresh aesthetic as the primary hero while showing a different angle or selling point."
        : "This is a general e-commerce detail image. Keep the clean, low-density aesthetic; do not add dense marketing frames.";

    return [
      `Platform style — general e-commerce ${heroLabel} (电商${cnLabel} — 低密度风格):`,
      heroDesc,
      "Clean composition with clear visual hierarchy — product first, message second, whitespace intentional.",
      "Soft natural lighting, sharp focus, accurate colors.",
      "NO dense marketing borders, NO top banners, NO bottom icon bars, NO heavy 3D badges.",
      "Use thin-line labels, small circular badges, or tiny seals if marketing elements are needed.",
    ].join(" ");
  }

  const heroDesc = isPrimaryHero
    ? "This is the PRIMARY general e-commerce main image — the hero product shot for marketplace listing. It should present the product with polished commercial photography, clean composition, and clear visual hierarchy for the gallery cover. The image must have rich, densely-packed selling point content visually integrated — multiple benefit tags, value highlights, and promotional messages displayed around the product. Use a rich, attractive background with layered visual depth (gradient lighting, decorative elements, lifestyle context) to draw consumer attention. Include marketing border watermark elements: top banner with headline text, bottom banner with promotional offer, left-side floating selling-point tags, and subtle frame edges to enhance commercial appeal."
    : isHero
      ? "This is a SECONDARY e-commerce hero image — another gallery cover shot showing a different angle or selling point. Use decorative frame elements that match the primary hero's 3D quality and commercial polish, with a different visual focus (alternative product state, lifestyle scene, or detail emphasis). The marketing frame should be equally refined but arranged differently — same production standard, varied composition and color accents."
      : "This is a general e-commerce detail image — a supporting section in the product detail page. It should elaborate on specific product aspects with professional lighting, sharp focus, and accurate colors. Do NOT add marketing border watermark elements, frame decorations, banners, or floating selling-point badge tags — these are reserved for main images only.";

  return [
    `Platform style — general e-commerce ${heroLabel} (电商${cnLabel}):`,
    heroDesc,
    "Polished commercial product photography suitable for marketplace listing.",
    "Clean composition with clear visual hierarchy — product first, message second.",
    "Professional lighting, sharp focus, accurate colors.",
    isPrimaryHero && "Add marketing frame elements: top banner for main title, bottom banner for promotion text, left-side vertical tag badges for key selling points, brand logo badge at appropriate corner. Make the border visually prominent with rich decorative details.",
    isHero && !isPrimaryHero && "Use a refined design framework at EQUAL premium quality — decorative marketing elements that match the primary hero's 3D sophistication, with an airy composition balance and varied color accents for visual diversity.",
  ].filter(Boolean).join(" ");
}

function buildCrossHeroDifferentiationChecklist(isHero: boolean, style?: string) {
  if (!isHero) {
    return "";
  }

  return [
    "=== CROSS-HERO ELEMENT DIFFERENTIATION CHECKLIST (跨头图元素差异化检查 — 每次生成前必须校验) ===",
    "Before generating this hero image, verify ALL of the following:",
    "",
    "--- Marketing Element Style (营销元素样式) ---",
    "1. Is this hero's BANNER SHAPE different from all other heroes? If same → CHANGE IT (full-width rectangle / curved arc / angled diagonal / floating card / ribbon banner / corner flag / wavy ribbon).",
    "2. Is this hero's TAG STYLE (卖点标签造型) different from all other heroes? If same → CHANGE IT (rounded rectangle / water-drop / leaf / scroll / shield / circle / hexagon / diamond).",
    "3. Is this hero's BRAND BADGE style different from all other heroes? If same → CHANGE IT (circle / shield / wax seal / vintage label / ribbon / simple text / hexagonal / badge with wings).",
    "4. Is this hero's FRAME STYLE (装饰边框) different from all other heroes? If same → CHANGE IT (double-line / single thin / corner ornaments / parallel lines / dotted / gradient / no frame).",
    "",
    "--- Visual Composition (视觉构图) ---",
    "5. Is this hero's COMPOSITION STYLE different from all other heroes? If same → CHANGE IT (centered / rule-of-thirds / diagonal / symmetrical / asymmetrical / floating-above / close-crop / wide-angle).",
    "6. Is this hero's LIGHTING DIRECTION different from all other heroes? If same → CHANGE IT (top-left 45° / backlit / side-lit-left / side-lit-right / rim-light / soft-overhead / dramatic-under / natural-window-light).",
    "7. Is this hero's color HUE different from other heroes? If same → pick a completely different hue within the same temperature (warm: red→orange→gold→brown; cool: blue-grey→teal→sage→muted-purple).",
    "",
    "--- Atmosphere & Mood (氛围与情绪) ---",
    "8. Is this hero's ATMOSPHERE different from all other heroes? If same → CHANGE IT (warm-cozy / dramatic-indulgent / clean-premium / playful-energetic / moody-dark / bright-fresh / luxurious-golden / natural-organic).",
    "9. Is this hero's PRODUCT STATE / VISUAL SUBJECT different from all other heroes? If same → CHANGE IT (product packaging with appetite atmosphere / unboxed contents flat-lay / manufacturing craft scene / usage step-by-step tutorial / benefits & multi-scene combination).",
    "   - hero_01 should show PRODUCT PACKAGING with appetite atmosphere and spec callouts, hero_02 should show UNBOXED CONTENTS (noodle block + seasoning packets spread out), hero_03 should show MANUFACTURING CRAFT scene, hero_04 should show USAGE TUTORIAL with step-by-step flow, hero_05 should show BENEFITS & multi-scene gallery.",
    "   - Do NOT default to showing the product packaging in every hero image.",
    "10. Is this hero's color HUE visually distinct from other heroes? If too similar → pick a different hue within the same temperature direction. Do NOT just change saturation — change the actual color (red→orange→gold→brown for warm; blue-grey→teal→sage→purple-grey for cool).",
    "",
    "--- Quality Gate (质量门槛 — 不可因差异化而降低，跨图品质必须对等) ---",
    "11. Does this hero look like a FINISHED, PUBLISHED commercial poster? If not → IMPROVE IT before output.",
    "12. Is all text sharp, legible, and properly rendered? If not → FIX IT before output.",
    "13. Is the visual subject (as defined by visualPrompt) the clear visual hero (≥55% of frame)? If not → ADJUST before output.",
    "14. Does the background have visible texture and depth? If plain/solid → ADD TEXTURE before output.",
    "15. Are the 3D material effects (emboss, foil, shadow, bevel, gloss) fully deployed on ALL design elements? If any tag/badge/banner looks flat → ADD 3D depth before output.",
    "16. CROSS-HERO QUALITY PARITY (跨图品质对等 — 强制执行): Would this hero look embarrassingly lower-quality if placed next to hero_01 in a gallery? If yes → ELEVATE it to the same production standard. Every hero must look like it belongs in the same premium campaign. The 3D material quality, background texture richness, and color design sophistication on this image must match the standard set by hero_01.",
    "",
    "CRITICAL: If any two heroes share the same combination of banner shape + tag style + composition + atmosphere, the generation is INVALID. Fix it before output. However, if a STYLE VISUAL CONSTRAINT specifies a consistent composition approach (e.g. all center-symmetry), that is acceptable — differentiate through other dimensions like product state, props, and color hue instead.",
    "CRITICAL: Quality must be equally high for ALL heroes — do not sacrifice aesthetics just to be different. A secondary hero with mediocre design quality dragging down the entire gallery is UNACCEPTABLE.",
  ].join("\n");
}

function buildDeAiInstruction() {
  return [
    "Critical quality rules to avoid AI-generated look:",
    "1. Every surface must have a specific, named material texture — never say 'nice texture', describe exactly: brushed metal, matte rubber, pebbled leather, anodized aluminum, frosted glass, woven nylon, etc.",
    "2. Shadows must obey physics: a single primary light source, consistent shadow direction, shadows touching the surface.",
    "3. No object may float. Every product and prop must rest on a visible or implied surface with natural contact shadow.",
    "4. Avoid generic 'product photography' smoothness — real products have subtle imperfections, edges, seams, reflections.",
    "5. Colors must be natural and accurate — no over-saturation, no unnatural HDR glow, no surreal color grading.",
    "6. The image must look like it was shot by a professional e-commerce photographer in a studio, not rendered by CGI.",
  ].join(" ");
}

function buildNoodleCategoryGuidance(sectionType?: string, analysis?: ProductAnalysisOutput, style?: string) {
  const isHero = (sectionType ?? "HERO").toUpperCase() === "HERO";
  const lowDensity = isHero && isLowDensityHeroStyle(style);

  const commonRules = lowDensity
    ? [
        "=== CATEGORY-SPECIFIC GUIDANCE: INSTANT NOODLES & DRIED NOODLES (面食品类 — 低密度清新风格) ===",
        "This is a noodle product. The image must look FRESH, NATURAL, and APPETIZING — NOT greasy, heavy, or over-dramatic.",
        "",
        "UNIVERSAL FOOD RULES FOR LOW-DENSITY STYLES:",
        "- Color temperature should be NATURAL WARM or NEUTRAL (4500K-5500K) — morning light, window light, or soft studio light. NO forced golden-amber warmth unless the style calls for it",
        "- Steam should be SUBTLE and wispy — a gentle 'just cooked' hint, NOT a dramatic steam cloud",
        "- Surface should be light and clean: white ceramic, pale wood, linen, bamboo mat, light stone, or soft concrete. It can be minimal but should have subtle material texture",
        "- Lighting should be soft and natural — avoid harsh spotlights and deep shadows",
        "- The image should feel inviting and healthy, not heavy or indulgent",
      ]
    : [
        "=== CATEGORY-SPECIFIC GUIDANCE: INSTANT NOODLES & DRIED NOODLES (面食品类) ===",
        "This is a noodle product (方便面/干拌面/速食面). The image MUST evoke strong appetite appeal.",
        "",
        "UNIVERSAL FOOD RULES (所有模块通用):",
        "- Color temperature MUST be WARM (3800K-4500K) — golden amber tones, NOT cool blue or clinical white",
        "- Show VISIBLE STEAM rising from the noodles when showing a prepared dish — this is the #1 appetite trigger",
        "- The surface MUST have visible texture (wood grain, bamboo weave, slate, linen) — NEVER plain white or solid color",
        "- NEVER use cold clinical white studio light — it kills appetite appeal for food products",
        "- The image should make the viewer HUNGRY within 1 second",
      ];

  // 根据模块类型提供差异化的场景指引
  const type = (sectionType ?? "HERO").toUpperCase();

  if (type === "HERO") {
    if (lowDensity) {
      const isSpicy = analysis && /辣|火鸡|椒|麻辣|香辣|爆辣|劲辣|酸辣|泡椒|红油| spicy|hot\b/.test(
        `${analysis.productName} ${analysis.category} ${analysis.subcategory} ${analysis.coreSellingPoints?.join(" ") ?? ""} ${analysis.styleTags?.join(" ") ?? ""}`.toLowerCase(),
      );

      return [
        ...commonRules,
        "",
        "=== LOW-DENSITY HERO IMAGE SCENE (主图场景 — 清新自然 + 健康食欲) ===",
        "This is the HERO image for a low-density style. It must look appetizing, fresh, and authentic — NOT like a heavy commercial poster.",
        "",
        "PRODUCT STATE: Show the PREPARED/COOKED product in a NATURAL, APPETIZING moment. Dynamic action is optional; a beautifully plated still-life is also acceptable.",
        "",
        "FOOD PRESENTATION (食物呈现):",
        "- The dish should look FRESH and LIGHT — not drowning in oil or sauce",
        "- Noodle strands should be visible but do NOT need dramatic mid-air lift",
        "- Garnish should feel fresh: cherry tomatoes, leafy greens, herbs, lemon wedges, sesame, scallion — matching the product's real ingredients",
        "- Sauce should look glossy but not heavy; avoid oil pools and greasy highlights",
        "- Steam should be subtle and natural, like morning steam from a warm bowl",
        "",
        "LIGHTING (光线 — 柔和自然):",
        "- Soft natural light or large window light from the side",
        "- Food surface: soft, even highlights with gentle shadows",
        "- Background: light, clean, and minimal — white, off-white, pale wood, linen, or soft gray",
        "- Color temperature: neutral to warm natural (4500K-5500K). NO dramatic spotlight, NO deep dark background",
        "",
        "ATMOSPHERE ELEMENTS (氛围元素 — 清新克制):",
        "- NO flames, NO scattered dried chilies, NO spicy particles",
        isSpicy
          ? "- FOR SPICY PRODUCTS in low-density style: only a tiny pinch of red chili flake or a single fresh chili as garnish — NO flames, NO scattered dried chilies, NO spicy particle storm"
          : "- FOR NON-SPICY PRODUCTS: fresh ingredient pieces gently placed around the bowl, soft natural bokeh, subtle steam, a few drops of condensation on a glass of water, light linen napkin",
        "",
        "COMPOSITION: Finished dish occupies 45-55% of frame. Packaging box is tiny (≤8%) or omitted.",
        "",
        "BACKGROUND (critical — do NOT homogenize): The background MUST follow THIS STYLE's own background material and color defined in STYLE VISUAL CONSTRAINT. Each low-density style has a DISTINCT background identity:",
        "- minimalist → matte cement board / micro-cement / pure white ceramic (off-white #F5F5F0, light gray #E8EAE3)",
        "- japanese_fresh → light linen cloth / white-washed old wood (beige-gray #EFEBE5, pale bean-paste green)",
        "- healthy_light → light bamboo mat / white grid cloth / light terrazzo (pale green #D8E6D3, off-white #FDF6EC)",
        "- ink_wash → raw rice paper, black-white-gray gradient, light ink wash (abundant whitespace)",
        "- vintage_chinese → aged rice paper / coarse burlap / old wooden board (dark yellow-brown #B87C4F, mottled)",
        "- regional_memory → old brick wall / faded road sign / weathered billboard (brick red #A55233, blue-gray #5D6B6F)",
        "- realistic_food_photo → light wood grain table / old cutting board / natural stone slab (warm oak #C68B5E)",
        "- warm_homestyle → warm checkered tablecloth / worn family dining table (pale cream-yellow #FDF4E3)",
        "- lifestyle_scene → cement terrace / picnic mat / ordinary kitchen counter (light cement gray #D1CDC5)",
        "- baby_parenting → soft cotton-linen cloth / silicone placemat (pale pink #F9E6EF, pale blue #E3F0F5)",
        "DO NOT default to generic 'white marble / pale wood / linen' for all low-density styles — that destroys style differentiation. Use the EXACT background defined for THIS style.",
        "",
        "IMPORTANT: The hero should feel authentic to THIS STYLE's aesthetic — not a generic fresh/healthy food photo. A minimalist hero looks different from an ink_wash hero, which looks different from a vintage_chinese hero.",
      ].join("\n");
    }

    return [
      ...commonRules,
      "",
      "=== HERO IMAGE SCENE (主图场景 — 食欲冲击 + 动态特写) ===",
      "This is the HERO image — the first thing customers see. It must trigger HUNGER in 1 second.",
      "",
      "PRODUCT STATE: Show the PREPARED/COOKED product in a DYNAMIC, APPETIZING moment — NOT a static bowl sitting on a table",
      "",
      "DYNAMIC FOOD PHOTOGRAPHY (动态食物摄影 — 头图必须遵守):",
      "The hero image MUST show one of these DYNAMIC food moments (NOT a static overhead bowl shot):",
      "- CHOPSTICK LIFT: Chopsticks lifting a generous portion of noodles from the bowl — noodles bending in mid-air with visible elasticity, sauce coating every strand, sauce pulling/dripping effect (拉丝/滴落)",
      "- POUR/DRIZZLE: Sauce being poured over noodles, creating dynamic flow lines and splashes",
      "- STEAM BURST: Steam rising dramatically from the bowl, catching warm backlight, creating a 'just served' atmosphere",
      "",
      "FOOD DETAIL REQUIREMENTS (食物细节 — 每个细节都必须锐利可见):",
      "- Every noodle strand must be individually visible with sauce coating — NOT a blurry mass of noodles",
      "- Meat sauce chunks must be clearly distinguishable — visible texture, not just colored paste",
      "- Sesame seeds (芝麻), chopped scallions (葱花), and herb garnish must be sharp and detailed",
      "- Sauce glossiness: the surface of the noodles and sauce must reflect light, showing a wet, appetizing sheen",
      "- Steam: wispy, warm-toned steam catching the light — NOT white clouds, NOT absent",
      "",
      "LIGHTING (光线 — 戏剧性明暗对比):",
      "- Warm spotlight from upper-right (暖色聚光灯从右上方)",
      "- Food surface: bright, glossy, high-contrast highlights",
      "- Background: deep, dark, dramatically lit — creating a strong light/dark contrast that makes the food 'pop'",
      "- Color temperature: WARM (3800K-4500K) — golden amber on food, NOT cool blue anywhere",
      "",
      "ATMOSPHERE ELEMENTS (氛围元素 — 增加丰富度，但必须匹配产品口味):",
      "For hero_01, the background must NOT be plain or empty. Add dramatic atmosphere elements that MATCH the product's flavor profile:",
      analysis && /辣|火鸡|椒|麻辣|香辣|爆辣|劲辣|酸辣|泡椒|红油| spicy|hot\b/.test(
        `${analysis.productName} ${analysis.category} ${analysis.subcategory} ${analysis.coreSellingPoints?.join(" ") ?? ""} ${analysis.styleTags?.join(" ") ?? ""}`.toLowerCase(),
      )
        ? "- FOR SPICY PRODUCTS: Warm orange-red flames at the bottom-left and bottom-right corners, dried red chili peppers scattered/floating in the background, spicy red/orange particles, warm bokeh lights, wispy steam"
        : "- FOR NON-SPICY PRODUCTS: NO flames, NO chili peppers, NO spicy particles. Instead use: warm golden bokeh lights, soft wispy steam rising from the noodles, fresh ingredient garnishes (tomato slices / green vegetables / herbs) floating gently, rich sauce gloss reflections",
      "",
      "COMPOSITION: Finished dish occupies 55-65% of frame as the ABSOLUTE visual hero. Packaging box is secondary (8-12%).",
      "",
      "BACKGROUND OPTIONS BY HERO ROLE (头图角色差异化背景):",
      "Each hero image MUST have a DIFFERENT background to avoid visual monotony:",
      "- hero_01 (食欲冲击): Deep black / dark charcoal background + warm spotlight on food + optional flame effects (火焰特效) + scattered dried chilies → EXTREME contrast, food JUMPS out of the frame. This is the most dramatic background.",
      "- hero_02 (成品展示): Dark moody wooden table + warm backlight from behind + deep shadows → dramatic appetite focus",
      "- hero_03 (真材实料): Raw wood cutting board / slate stone + macro side-backlight + sharp texture → ingredient authenticity",
      "- hero_04 (制作场景): Kitchen counter / stove surface + dynamic warm light + action shadows → cooking in motion",
      "- hero_05 (使用场景): Real-life desk/table matching scene + natural ambient light → lifestyle immersion",
      "",
      "HIGH-CONTRAST BACKGROUND TECHNIQUE (高对比背景技法 — hero_01 强烈推荐):",
      "For hero_01, the most impactful approach is:",
      "- Background: Pure black or very dark charcoal (#0A0A0A to #1A1A1A)",
      "- Lighting: Single warm spotlight from upper-right, creating a dramatic pool of light on the food",
      "- Effect: The dark background makes the warm-colored food (orange noodles, red sauce, green garnish) appear EXTREMELY saturated and vivid",
      "- Optional: Flame effects (火焰/火苗) around the edges, scattered dried chili peppers, warm bokeh lights in background",
      "- This technique is used by top e-commerce food brands — it maximizes appetite appeal and visual impact",
      "",
      "IMPORTANT: Other sections in this project will show DIFFERENT states of this product (packaged view, ingredients, close-ups, lifestyle scenes). The hero image is the DRAMATIC cooked dish — make it count!",
    ].join("\n");
  }

  if (type === "SELLING_POINTS") {
    return [
      ...commonRules,
      "",
      "=== SELLING POINTS SCENE (卖点展示场景 — 突出核心卖点) ===",
      "This section highlights a specific selling point. Show a DIFFERENT STATE and ANGLE from the hero.",
      "",
      "PRODUCT STATE: Do NOT show the same cooked bowl as the hero. Instead, show ONE of these:",
      "- The PACKAGING: unopened product package showing brand, flavor, and key info on the label",
      "- The INGREDIENTS: noodle cake + ALL seasoning packets laid out on a clean surface",
      "- A CLOSE-UP: extreme macro of noodle texture, sauce detail, or a specific ingredient",
      "- The POUR: sauce being drizzled onto noodles, or chili oil flowing",
      "SURFACE: Light-colored ceramic plate or bamboo mat — CONTRAST with the hero's dark background",
      "ANGLE: Tight close-up or side angle — focus on ONE specific detail, not the full bowl",
      "COMPOSITION: Product occupies 50-60%, with negative space for text overlay",
      "MOOD: Informative yet appetizing — 'look at what you're getting'",
      "AVOID: Don't show the same cooked bowl as the hero. This section must look COMPLETELY DIFFERENT.",
    ].join("\n");
  }

  if (type === "SCENARIO") {
    return [
      ...commonRules,
      "",
      "=== SCENARIO SCENE (使用场景 — 生活代入感) ===",
      "This section shows the product in a REAL LIFE context. Create a lifestyle scene that viewers can relate to.",
      "",
      "PRODUCT STATE: Show the product being ENJOYED or USED in a real setting —",
      "- Someone holding chopsticks picking up noodles from a bowl at a desk",
      "- The cooked bowl placed naturally in a real environment (not staged on a studio surface)",
      "- The packaged product being opened or prepared — showing the 'getting ready to eat' moment",
      "- Hands holding the package, or the product next to everyday items (laptop, phone, remote control)",
      "SCENE OPTIONS (pick ONE that matches the section's visual prompt):",
      "- Late-night study desk: warm desk lamp, laptop open, bowl of noodles beside keyboard — 'midnight snack while working'",
      "- Cozy kitchen counter: morning light through window, bowl on kitchen counter with cooking utensils nearby",
      "- Restaurant/diner booth: retro diner setting, neon sign glow, booth seating, casual dining atmosphere",
      "- Dormitory/bedroom: simple desk, phone propped up playing video, bowl of noodles — 'comfort food while watching shows'",
      "- Outdoor/camping: portable table, campfire glow, noodles in a simpler bowl — 'outdoor adventure meal'",
      "SURFACE: Match the scene (wooden desk, kitchen counter, diner table, camping table)",
      "LIGHTING: Match the scene's natural light (desk lamp warm glow, kitchen morning light, neon diner ambiance)",
      "COMPOSITION: Show the product WITH its environment — don't isolate the bowl. The scene tells the story.",
      "MOOD: 'This could be YOUR life' — relatable, cozy, aspirational comfort",
      "AVOID: Don't just show the bowl on a table like the hero. The ENVIRONMENT and LIFESTYLE are the stars here.",
    ].join("\n");
  }

  if (type === "DETAIL_CLOSEUP") {
    return [
      ...commonRules,
      "",
      "=== DETAIL CLOSEUP SCENE (细节特写场景 — 微距质感) ===",
      "This section is an EXTREME CLOSE-UP showing product quality and texture.",
      "",
      "SURFACE: Minimal — the product fills most of the frame",
      "ANGLE: Macro or very tight close-up — show details invisible at normal distance",
      "COMPOSITION: Product fills 65-75% of frame, shallow depth of field isolates the subject",
      "SCENE OPTIONS (pick ONE):",
      "- Noodle strand macro: individual noodle strands with sauce coating, showing texture and springiness",
      "- Garnish detail: close-up of toppings — a perfect halved egg with runny yolk, fresh scallion rings, sesame seeds on noodles",
      "- Sauce/broth close-up: the rich, glossy surface of the broth with oil droplets and spice particles",
      "- Steam and light: dramatic close-up where steam catches backlight, creating an ethereal food photography moment",
      "LIGHTING: Very directional, creating strong highlights and shadows that reveal texture",
      "MOOD: 'Look at this incredible quality' — luxurious, detailed, premium feel",
      "AVOID: Don't show the full bowl. This is about DETAILS, not the whole dish.",
    ].join("\n");
  }

  if (type === "MATERIAL") {
    return [
      ...commonRules,
      "",
      "=== MATERIAL SCENE (材质展示场景 — 原料与工艺) ===",
      "This section showcases the raw materials, ingredients, or manufacturing quality.",
      "",
      "SCENE OPTIONS (pick ONE):",
      "- Raw ingredients display: uncooked noodle cake, fresh vegetables, spices, and seasonings arranged on a clean surface",
      "- Ingredient story: show the journey from raw to cooked — noodle cake on one side, steaming bowl on the other",
      "- Seasoning packets spread: all included packets laid out with their contents visible (powder, oil, dried vegetables)",
      "- Quality comparison: side-by-side showing the generous portion and quality ingredients",
      "SURFACE: Clean marble, light wood, or linen cloth — brighter and cleaner than the hero scene",
      "LIGHTING: Bright, even lighting that shows ingredient colors accurately — slightly cooler than the hero but still warm",
      "COMPOSITION: Flat lay (top-down) or 45-degree angle showing the full ingredient spread",
      "MOOD: 'Quality you can see' — honest, transparent, premium ingredients",
      "AVOID: Don't show a cooked dish as the main focus. This is about WHAT GOES INTO the product.",
    ].join("\n");
  }

  if (type === "SPECS") {
    return [
      ...commonRules,
      "",
      "=== SPECS SCENE (规格参数场景 — 清晰信息传达) ===",
      "This section communicates product specifications and key information.",
      "",
      "SURFACE: Clean, minimal background — light gradient or subtle texture",
      "ANGLE: Straight-on or slight overhead — clear, readable composition",
      "COMPOSITION: Product at 40-50% of frame, with clear space for text overlay",
      "SCENE: Show the product with its packaging clearly visible — both the prepared dish AND the package together",
      "LIGHTING: Clean, bright, even lighting — slightly more clinical than the hero but still warm-toned",
      "MOOD: 'Here's exactly what you get' — clear, honest, informative",
      "AVOID: Don't make this too atmospheric or moody. Clarity and readability are the priority here.",
    ].join("\n");
  }

  if (type === "BRAND_TRUST") {
    return [
      ...commonRules,
      "",
      "=== BRAND TRUST SCENE (品牌信任场景 — 品质感 + 可信赖) ===",
      "This section builds brand trust and conveys quality/reliability.",
      "",
      "SCENE OPTIONS (pick ONE):",
      "- Premium presentation: noodles in an elegant bowl on a refined surface, suggesting restaurant-quality",
      "- Heritage/tradition: warm kitchen setting with traditional cooking elements (wok, wooden chopsticks, ceramic bowl)",
      "- Quality certification: clean, professional layout with the product and quality indicators",
      "SURFACE: Premium materials — dark marble, polished wood, or elegant ceramic",
      "LIGHTING: Warm, sophisticated lighting — think high-end food magazine, not street food stall",
      "COMPOSITION: Balanced, centered, stable — conveys reliability and quality",
      "MOOD: 'You can trust this brand' — premium, reliable, established",
      "AVOID: Don't make it look cheap or overly casual. This is about elevating the brand image.",
    ].join("\n");
  }

  if (type === "GIFT_SCENE") {
    return [
      ...commonRules,
      "",
      "=== GIFT SCENE (送礼场景 — 包装 + 开箱体验) ===",
      "This section shows the product as a gift or unboxing experience.",
      "",
      "SCENE: Show the product packaging, gift box, or unboxing moment",
      "SURFACE: Gift-wrapping paper, elegant table, or festive setting",
      "LIGHTING: Warm, celebratory lighting — slightly brighter and more cheerful",
      "COMPOSITION: Show the full packaging experience — box, product, extras, gift presentation",
      "MOOD: 'A perfect gift for noodle lovers' — festive, generous, thoughtful",
    ].join("\n");
  }

  if (type === "COMPARISON") {
    return [
      ...commonRules,
      "",
      "=== COMPARISON SCENE (对比场景 — 差异化展示) ===",
      "This section compares products, flavors, or before/after states.",
      "",
      "SCENE: Side-by-side comparison — two bowls, two flavors, or raw vs cooked",
      "SURFACE: Clean, neutral surface that doesn't distract from the comparison",
      "LIGHTING: Even, consistent lighting across both sides for fair comparison",
      "COMPOSITION: Symmetrical or balanced split — each side gets equal visual weight",
      "MOOD: 'See the difference' — clear, informative, compelling",
    ].join("\n");
  }

  // SUMMARY 和其他类型
  return [
    ...commonRules,
    "",
    "=== SUMMARY/CUSTOM SCENE (总结/自定义场景 — 完整产品展示) ===",
    "This section provides a comprehensive product overview or custom visual story.",
    "",
    "SCENE: Show the complete product range or a creative visual story",
    "SURFACE: Choose a surface that complements the section's visual prompt",
    "COMPOSITION: Balanced layout showing the product in its best light",
    "MOOD: Match the section's goal — whether it's comprehensive overview or creative storytelling",
    "KEY: This section MUST look DIFFERENT from all previous sections — different angle, surface, lighting, and composition.",
  ].join("\n");
}

export function buildSectionImagePrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  platform?: string,
  productName?: string,
  detailVisualAnchor?: Record<string, string> | null,
  hasKnowledgeBase?: boolean,
  style?: string,
  searchContext?: string,
  agentMode?: boolean,
  analysis?: ProductAnalysisOutput,
) {
  const hasMainImage = referenceAssets.length > 0;
  const productIdentity = productName || null;
  const lowDensityHero = section.type === "HERO" && isLowDensityHeroStyle(style);
  const flavor = detectFlavorFromAnalysis(analysis);

  // 低密度风格：给原则不给规则，让AI根据产品特性自主创意
  const lowDensityStyleBlock = lowDensityHero
    ? [
        "========== STYLE PRINCIPLE: LOW-DENSITY AESTHETIC (低密度风格原则 — 总体方向) ==========",
        "This project uses a LOW-DENSITY visual style. Your goal is to create a refined, breathable, premium-quality image that honors THIS STYLE's distinct aesthetic.",
        "",
        "PRIORITY ORDER (critical): The specific color temperature, background material/color, lighting direction, composition, props, atmosphere effects, and fullness level for THIS style are DEFINITIVELY defined in the 'STYLE VISUAL CONSTRAINT' section below. That section is the SOURCE OF TRUTH for this style's visual identity. The general principles in this block are ONLY directional guidance — they MUST NOT override or homogenize the style-specific settings in STYLE VISUAL CONSTRAINT.",
        "",
        "STYLE PRINCIPLES (directional only — adapt to the specific style defined in STYLE VISUAL CONSTRAINT):",
        "- Overall mood: Refined, breathable, premium — the exact mood (fresh / serene / nostalgic / literary / rustic / minimal) is defined by THIS STYLE, not by this generic list",
        "- Lighting: Follow the style's own lighting definition — some low-density styles use cool window light, some use warm golden hour, some use overhead spotlight. Do NOT force one lighting mood onto all styles",
        "- Color direction: Follow the style's own color temperature and palette — some styles are cool-toned, some warm-toned, some ink-grayscale. Do NOT homogenize all low-density styles into the same light/clean palette",
        "- Composition: Creative freedom within the style's fullness level — respect whether this style calls for abundant whitespace or moderate density",
        "- Marketing elements: Subtle and integrated per the style's marketingStyle.coverageHint",
        "",
        "QUALITY STANDARD (non-negotiable):",
        "- The image must look like PREMIUM commercial food photography or illustration — magazine quality, true to THIS STYLE's medium",
        "- Every element should feel intentional and polished, not generic or template-like",
        "- The product should be the hero — make it look appetizing and desirable within THIS STYLE's aesthetic language",
        "- Creative composition is encouraged — surprise with unique angles, interesting props, or unexpected styling that elevates THIS SPECIFIC STYLE",
        "",
        "ANTI-HOMOGENIZATION RULE (critical): Different low-density styles MUST look visually DISTINCT from each other. A minimalist style (micro-cement, off-white, near-zero shadows) must NOT look like a vintage_chinese style (aged rice paper, warm 3500K, hard light with shadows) or an ink_wash style (raw rice paper, black-white-gray, overhead spotlight). The style's own 7 dimensions in STYLE VISUAL CONSTRAINT define its uniqueness — preserve it.",
        "=== END STYLE PRINCIPLE ==========",
        "",
      ].join("\n")
    : "";

  return [
    lowDensityStyleBlock,
    "You are a senior e-commerce key-visual designer creating marketplace-ready product artwork.",
    "",
    productIdentity && section.type !== "HERO"
      ? [
          `========== PRODUCT IDENTITY: "${productIdentity}" ==========`,
          `The ONLY product to show in the generated image is: ${productIdentity}.`,
          "You MUST NOT generate any other product. This rule CANNOT be overridden by any other text in this prompt.",
          "The main product image (first reference image below) shows this product — keep it EXACTLY IDENTICAL.",
        ].join("\n")
      : "",
    "",
    buildHeroIdentityInstruction(section, productIdentity, analysis, style),
    "",
    "=== SECTION CONTEXT (for in-image text layout ONLY) ===",
    `Section type: ${section.type}`,
    `Section title: ${section.title}`,
    `Section goal: ${section.goal}`,
    `Copy text (to render AS TEXT inside the image): ${section.copy}`,
    section.type === "HERO" ? buildCopyFusionInstruction(lowDensityHero, flavor) : "",
    `Visual prompt guidance: ${lowDensityHero ? buildLowDensityHeroVisualPrompt(section, productIdentity, analysis) : section.visualPrompt}`,
    "",
    lowDensityHero
      ? [
          "=== VISUAL PROMPT OVERRIDE NOTICE ===",
          "The visual prompt above has been REPLACED by the low-density hero visual rules. The original planning visualPrompt is ignored for style/layout/marketing instructions.",
          "=== END OVERRIDE NOTICE ===",
        ].join("\n")
      : "",
    "",
    buildReferenceText(referenceAssets, section),
    "",
    buildMainImageInstruction(referenceAssets, style),
    "",
    style ? buildStyleVisualConstraint(style) + "\n" : "",
    buildNoodleCategoryGuidance(section.type, analysis, style),
    "",
    "=== SCENE VARIETY MANDATE (场景多样性 — 每张图必须不同) ===",
    "CRITICAL: Each section image MUST be visually DISTINCT from all other sections in this project.",
    "- Do NOT repeat the same visual subject across sections — each section must show a DIFFERENT aspect of the product",
    "- hero_01 shows PRODUCT PACKAGING with appetite atmosphere (完整产品包装+规格信息+食欲场景). hero_02 shows UNBOXED CONTENTS (面饼+调料包+配料展开平铺). hero_03 shows MANUFACTURING CRAFT (制作工艺/原料产地/传统工艺场景). hero_04 shows USAGE INSTRUCTIONS (步骤流程图+食用教程). hero_05 shows BENEFITS & MULTI-SCENE (产品优势标签+多场景小图组合).",
    "- Do NOT default to showing the product packaging in every image — follow the section's visualPrompt",
    "- Do NOT repeat the same angle, surface, lighting, or composition across sections",
    "- Each section should tell a DIFFERENT visual story — different angle, different surface, different props, different mood",
    "- The section's visualPrompt (above) describes the specific scene for THIS section — follow it closely",
    "- Reference the section's title and goal to determine what UNIQUE visual story this section needs to tell",
    "",
    buildDetailVisualAnchorInstruction(detailVisualAnchor),
    "",
    "=== PLATFORM & SECTION STYLE ===",
    buildPlatformStyleInstruction(platform, section.type === "HERO", section.type === "HERO" && section.order === 0, lowDensityHero),
    "",
    buildCrossHeroDifferentiationChecklist(section.type === "HERO", style),
    "",
    buildProfessionalPhotographyInstruction(style),
    "",
    buildAspectInstruction(aspectRatio),
    "",
    buildTargetLanguageInstruction(contentLanguage),
    "",
    buildTextRenderingInstruction(),
    "",
    buildDeAiInstruction(),
    "",
    ...[
      "=== COMPOSITION MANDATE (non-negotiable 构图硬性要求) ===",
      "- The VISUAL SUBJECT (as defined by the section's visualPrompt) MUST be large and prominent in the frame — small subjects floating in empty space are UNACCEPTABLE",
      "- The background MUST match the selected style — some styles use textured surfaces, others use gradients, flat colors, or illustrated backgrounds. Follow the STYLE VISUAL CONSTRAINT",
      "- The overall frame must feel RICH and COMPLETE — every area should contribute to the commercial story and appetite appeal. If a STYLE VISUAL CONSTRAINT specifies intentional whitespace (e.g. minimalist, ink wash), respect the style's fullness level",
      lowDensityHero
        ? "- Design elements (banners, tags, badges, frames) should be SUBTLE and FLAT or lightly shadowed — heavy 3D bevels, metallic emboss, and glossy materials are UNACCEPTABLE for low-density styles"
        : "- All design elements (banners, tags, badges, frames) MUST have 3D depth with shadows, bevels, or material textures — flat 2D rectangles are unacceptable",
      "- Marketing elements in the same image should share a color FAMILY (同色系), not identical hex codes — varied tones create visual richness through color depth",
      "- For food products: visible steam, fresh garnishes, glossy surfaces make food appealing — BUT follow the STYLE VISUAL CONSTRAINT effects and atmosphere. Some styles use different techniques (illustration, data visualization, 3D rendering) to achieve impact",
      "- The scene should be styled and composed to MAXIMIZE desire and commercial impact within the constraints of the selected visual style",
      section.type !== "HERO" ? "- DETAIL PAGE FULLNESS: Detail images must NOT look simple, empty, or sparse. Build a rich mobile e-commerce poster with layered background texture, foreground/midground/background depth, props, shadows, decorative shapes, atmospheric details, and strong commercial polish. Keep information accurate, but do not reduce visual richness." : "",
    ],
    "",
    section.type === "HERO" ? buildHeroFrameFullnessInstruction(lowDensityHero) : "",
    "",
    analysis && section.type === "HERO" ? buildProductBackgroundExtension(analysis) : "",
    buildMultiAssetMandate(section),
    "- CRITICAL: Follow the section's visualPrompt for the visual subject — if it says 'finished dish', show a cooked bowl; if it says 'ingredients', show raw materials; if it says 'cooking scene', show the action. Do NOT default to showing the product packaging in every image.",
    "",
    buildMarketingElement3DInstruction(section, style),
    "",
    section.type === "HERO" ? buildMarketingElementLayoutInstruction(lowDensityHero) : "",
    "",
    "Generate one high-conversion mobile e-commerce visual for this section.",
    "The image should emphasize product clarity, composition hierarchy, material texture, and marketplace aesthetics — executed in the selected visual style.",
    "Enrich the scene with props, textures, and environmental elements appropriate to the style — photography styles should look naturally styled; illustration/3D styles should commit fully to their medium.",
    "The headline, selling points, supporting copy, and CTA should be visually designed inside the image rather than left for later DOM text insertion.",
    "Make the result feel like finished commercial artwork in the selected style, not a blank template.",
    "",
    hasKnowledgeBase
      ? [
          "=== KNOWLEDGE-BASE IMAGE CONTENT CONSTRAINT (知识库图像内容约束 — 强制执行) ===",
          "This project has an active product knowledge base. The following constraint applies to the IMAGE CONTENT:",
          "",
          "RULE 1 — 图像内容可基于参考图合理延伸 (REASONABLE EXTENSION FROM REFERENCES):",
          "- You MAY extend the visual scene based on the reference images. For example, if the reference shows a packaged product, you MAY show it in a cooked/prepared state, in a realistic lifestyle setting, or with appropriate garnishes and props — as long as the extension is REASONABLE and CONSISTENT with what the reference images show.",
          "- You MAY show the product from different angles, in different lighting, on different surfaces, with different compositions — visual creativity is encouraged.",
          "- You MAY add realistic contextual elements (steam, garnishes, tableware, environmental props) that naturally belong in the type of scene being generated.",
          "",
          "RULE 2 — 禁止虚构图像内容 (NO FABRICATED IMAGE CONTENT):",
          "- You MUST NOT show product features, ingredients, or visual details that CONTRADICT what is visible in the reference images. For example, if the packaging shows a red-themed design, do NOT render it with a blue theme.",
          "- You MUST NOT invent product variants, flavors, or versions that are not shown in the reference images or described in the section copy.",
          "- You MUST NOT add fake certifications, fake quality badges, or fake award labels that do not exist in the reference product.",
          "- If the reference images show a specific ingredient list or product appearance, the generated image MUST be consistent with it.",
          "",
          "RULE 3 — 视觉排版与布局不受约束 (LAYOUT AND DESIGN ARE UNCONSTRAINED):",
          "- Banner shapes, tag styles, decorative frames, composition, lighting, atmosphere, color design, background textures, and ALL other visual/layout elements are COMPLETELY FREE.",
          "- This constraint ONLY applies to the factual product content shown in the image (what the product looks like, what ingredients it contains, what claims are made).",
          "",
          "RULE 4 — 违反后果:",
          "- Fabricated product visuals mislead consumers and violate advertising regulations. This is a HARD CONSTRAINT.",
          "- When in doubt, stay closer to what the reference images actually show.",
          "=== END KNOWLEDGE-BASE IMAGE CONTENT CONSTRAINT ===",
        ].join("\n")
      : "",
    "",
    section.type === "HERO"
      ? [
          "",
          "=== FINAL STYLE ENFORCEMENT (最终风格强制执行 — 覆盖任何冲突描述) ===",
          lowDensityHero
            ? "FINAL LOW-DENSITY RULES (这些规则覆盖前面所有冲突描述，包括 visualPrompt): Follow THIS STYLE's own 7 dimensions in STYLE VISUAL CONSTRAINT as the source of truth. Do NOT force a uniform white-background/natural-light look onto all low-density styles — each style has its own background, color temperature, lighting, and atmosphere. Marketing elements: per the style's marketingStyle.coverageHint (subtle). The finished dish is the hero."
            : "FINAL HIGH-DENSITY RULES + HARD CONSTRAINTS (这些规则覆盖前面所有冲突描述，包括 visualPrompt): ALL 10 HARD CONSTRAINTS (HC1-HC10) MUST be present in the generated image: (1) 100% info density, (2) dual subjects (packaging + food), (3) three-layer title system, (4) side selling-point bar with 4-5 tags, (5) bottom high-contrast banner, (6) ≥3 badges/corner tags, (7) 5-8 ingredient props, (8) 1-2 seasoning packets, (9) strong color zoning, (10) complete brand info. Rich marketing elements, strong appetite impact, dramatic lighting, bold title, side bar, bottom banner, corner badges. Make it visually dense and commercially powerful. The style determines the LOOK of each element, NOT whether it exists.",
          "If any prior text (including the visualPrompt guidance above) conflicts with these FINAL RULES, the FINAL RULES win.",
          "=== END FINAL STYLE ENFORCEMENT ===",
        ].join("\n")
      : "",
    "",
    buildNegativePrompt(lowDensityHero),
    "",
    "Ensure all text in the image is clean, sharp, and free of garbled characters or typos. Every Chinese character must have the correct stroke count and form — zero tolerance for wrong characters (错别字).",
    "",
    // 注入联网搜索视觉参考
    searchContext && searchContext.trim().length > 0
      ? [
          "=== WEB SEARCH VISUAL REFERENCE (联网搜索视觉参考) ===",
          "Below are visual design references gathered from web search.",
          "Apply these to this section's composition, lighting, color treatment, and product presentation:",
          searchContext,
          "=== END WEB SEARCH VISUAL REFERENCE ===",
        ].join("\n")
      : "",
    "",
    // 再次强调风格（放在最末尾，对抗模型先验）
    lowDensityHero
      ? [
          "========== FINAL REMINDER: HONOR THIS STYLE'S IDENTITY (风格身份 — 最后提醒) ==========",
          "If you are about to generate a generic dark/dramatic midnight-snack image, OR a generic white/wellness-magazine image — STOP. BOTH are wrong.",
          "This project has a SPECIFIC low-density style. Its color temperature, background material/color, lighting direction, and atmosphere are defined in STYLE VISUAL CONSTRAINT. Generate an image that is TRUE TO THAT SPECIFIC STYLE.",
          "Different low-density styles must look visually distinct from each other — do NOT collapse them into one uniform look.",
          "=== END FINAL REMINDER ==========",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRegenerationPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  platform?: string,
  productName?: string,
  detailVisualAnchor?: Record<string, string> | null,
  style?: string,
  searchContext?: string,
  agentMode?: boolean,
  analysis?: ProductAnalysisOutput,
) {
  return [
    buildSectionImagePrompt(section, referenceAssets, aspectRatio, contentLanguage, platform, productName, detailVisualAnchor, undefined, style, searchContext, agentMode, analysis),
    "",
    "This is a regeneration task. Keep the same product identity and selling-point direction, but improve these aspects compared to the previous generation:",
    "- Sharper product focus and cleaner composition edge separation",
    "- More realistic material textures and surface reflections",
    "- Better visual hierarchy between headline, product, and supporting elements",
    "- Higher commercial polish and marketplace-readiness",
    "- Fix any AI artifacts, soft edges, or unnatural smoothness from the previous attempt",
    "",
    "FOOD-SPECIFIC REGENERATION IMPROVEMENTS (if applicable):",
    "- Make the food look HOTTER — more visible steam, warmer color temperature, glossier surfaces",
    "- Add MORE appetizing garnishes and props if the previous attempt looked empty or sterile",
    "- Ensure the background has warm texture (wood grain, fabric weave) instead of flat color",
    "- Make the composition DENSER — fill empty spaces with scattered garnishes, surface texture, or atmospheric depth",
  ].join("\n");
}

export function buildImageEditPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  mode: "repaint" | "enhance" = "repaint",
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  platform?: string,
  productName?: string,
  agentMode?: boolean,
  analysis?: ProductAnalysisOutput,
) {
  const modeInstruction =
    mode === "enhance"
      ? [
          "This is an enhancement task. Use the current image as the base.",
          "Preserve the overall framing and composition.",
          "Improve these specific aspects:",
          "- Material realism: sharpen fabric weaves, metal reflections, glass transparency",
          "- Texture clarity: eliminate AI smoothness, reveal natural surface grain",
          "- Lighting quality: deepen contrast, make highlights more directional, soften fill zones",
          "- Edge definition: clean up product boundaries, remove halos and bleeding edges",
          "- Commercial polish: elevate the final output to professional product photography grade",
        ].join("\n")
      : [
          "This is a repaint task. Use the current image as the base.",
          "Keep the same product identity — do not change the product itself.",
          "Redesign these aspects based on the section goal:",
          "- Composition: reposition the product, adjust visual weight, change framing",
          "- Atmosphere: shift mood through lighting temperature, background tone, depth of field",
          "- Styling: update the visual language — color palette, prop choices, scene setting",
          "- Emphasis: refocus the visual hierarchy to match the section's primary communication goal",
        ].join("\n");

  const hasAccessoryRefs = referenceAssets.length > 1;

  return [
    buildSectionImagePrompt(section, referenceAssets, aspectRatio, contentLanguage, platform, productName, undefined, undefined, undefined, undefined, agentMode, analysis),
    "",
    modeInstruction,
    "The current section image must be treated as the editable base image.",
    referenceAssets.length > 0
      ? "CRITICAL: The MAIN PRODUCT IMAGE (first reference image) defines the product identity. The product in the edited image MUST be identical to the main product image."
      : "CRITICAL: The product in the base image defines the product identity. Keep it identical — do not replace it with a different product.",
    hasAccessoryRefs
      ? [
          "",
          "=== ACCESSORY REFERENCE IMAGES AS EDIT MATERIALS (附属参考图作为微调素材) ===",
          "You have accessory reference images beyond the main product image.",
          "In EDIT mode, these accessory images serve as VISUAL MATERIALS for image fine-tuning:",
          "",
          "HOW TO USE ACCESSORIES AS EDIT MATERIALS:",
          "1. **素材提取**: Extract visual elements from accessory images — specific textures, decorative objects, garnishes, props, background details",
          "2. **合成融入**: Blend these extracted elements into the base image naturally — like compositing additional layers",
          "3. **不改变主体**: The main product's identity remains 100% unchanged — accessories only ADD to the scene, never replace or alter the product",
          "4. **不改变构图**: Keep the base image's overall composition — accessories fill empty areas or add subtle enrichment at the periphery",
          "5. **比例控制**: Accessory elements should be at ≤30% scale relative to the main product — clearly secondary",
          "",
          "WHAT ACCESSORIES CAN PROVIDE AS MATERIALS:",
          "- Decorative props (flowers, tableware, textiles, ingredients) → place them in empty areas",
          "- Textures (wood grain, fabric, stone) → use as subtle background or surface enrichment",
          "- Garnishes and food elements → scatter around the main dish as appetite amplifiers",
          "- Atmospheric details (steam, sparkle, condensation) → blend into the scene naturally",
          "",
          "The goal: The edited image feels richer and more complete, with accessories seamlessly blended in as natural scene elements.",
        ].join("\n")
      : "",
    "Output one marketplace-ready mobile e-commerce image only.",
  ].filter(Boolean).join("\n");
}

export function buildImageRefinePrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  instruction: string,
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
  platform?: string,
  productName?: string,
  agentMode?: boolean,
) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  const productLock = productName
    ? `CRITICAL: The product to edit is "${productName}". You MUST keep the product identity exactly as "${productName}" — same product, shape, material, color. Do NOT change it to any other product regardless of the instruction text below.`
    : "CRITICAL: Product identity must remain EXACTLY the same — same product, same features, same appearance.";

  const hasAccessoryRefs = referenceAssets.length > 1;

  const accessoryBlock = hasAccessoryRefs
    ? [
        "",
        "=== ACCESSORY REFERENCE IMAGES AS EDIT MATERIALS (附属参考图作为微调素材) ===",
        "Additional reference images are provided alongside the base image.",
        "These accessory images serve as VISUAL MATERIAL SOURCES for the editing process:",
        "",
        "1. **素材提取**: Extract visual elements from accessory images (textures, objects, garnishes, props, decorative details)",
        "2. **按需使用**: Use these material elements ONLY if they help fulfill the user's instruction — do not force them into the edit if not needed",
        "3. **合成融入**: When used, blend extracted elements naturally into the base image as additional visual layers",
        "4. **不喧宾夺主**: Accessory elements must be visually secondary — smaller scale, softer focus, peripheral placement",
        "5. **主体不变**: The main product's identity remains 100% unchanged regardless of what accessories are provided",
        "",
        "Accessory refs are TOOLS for enrichment, not MANDATES to change the image.",
      ].join("\n")
    : "";

  return [
    "You are an expert image editor. Your task is to edit the provided base image according to the user's specific instructions.",
    "",
    "=== CRITICAL RULES (VIOLATE THESE AND THE OUTPUT IS WRONG) ===",
    "RULE #1: The user's instruction below is your PRIMARY and MANDATORY directive. You MUST implement it exactly as stated.",
    "RULE #2: The base image provided is your canvas. Start from it and apply the user's requested changes.",
    `RULE #3 (PRODUCT IDENTITY): ${productLock}`,
    "RULE #4: If user says 'change background to warm tone' → ONLY change the background color/tone, keep everything else identical.",
    "RULE #5: If user says 'add lighting effects' → ONLY add lighting, do not change composition, product position, or other elements.",
    "RULE #6: If user says 'make product more prominent' → ONLY adjust product visibility/size/position, keep background and other elements.",
    accessoryBlock,
    "",
    "=== USER'S INSTRUCTION (THIS IS YOUR TOP PRIORITY) ===",
    `USER SAYS: "${instruction}"`,
    "YOUR TASK: Implement the above instruction precisely and literally. Do not add your own creative interpretation beyond what is asked.",
    "",
    "=== BASE IMAGE CONTEXT (FOR YOUR UNDERSTANDING) ===",
    `Section type: ${section.type}`,
    `Section title: ${section.title}`,
    `Target language for any text: ${targetLanguage}`,
    buildAspectInstruction(aspectRatio),
    platform ? `Platform: ${platform}` : "",
    "",
    "=== TECHNICAL REQUIREMENTS ===",
    "- Output must be a high-quality e-commerce product image",
    "- Any text in the image must be sharp, readable, and in the target language",
    "- Changes must look natural and professionally executed",
    "- Maintain consistent lighting and shadows after edits",
    "",
    buildNegativePrompt(),
    "",
    "REMEMBER: The user instruction is your boss. Follow it exactly. Produce ONE edited image.",
  ].filter(Boolean).join("\n");
}

export function buildSectionSvgLayoutPrompt(
  section: PageSection,
  referenceAssets: ProductAsset[] = [],
  aspectRatio: "1:1" | "3:4" | "9:16" = "9:16",
  contentLanguage: ContentLanguage = "zh-CN",
) {
  const targetLanguage = contentLanguageNamesForPrompt[normalizeContentLanguage(contentLanguage)];

  return [
    "You are designing a mobile e-commerce section poster that will be rendered as SVG.",
    "Return one strict JSON object only.",
    `All user-facing copy must be written in ${targetLanguage}.`,
    `Section type: ${section.type}`,
    `Section title: ${section.title}`,
    `Section goal: ${section.goal}`,
    `Section copy: ${section.copy}`,
    `Visual prompt guidance: ${section.visualPrompt}`,
    `Target aspect ratio: ${aspectRatio}`,
    buildReferenceText(referenceAssets, section),
    "Target JSON shape:",
    `{
  "headline": "string",
  "subheadline": "string",
  "badge": "string",
  "highlights": ["string", "string", "string"],
  "backgroundColor": "#F5E9D8",
  "accentColor": "#A85A2A",
  "panelColor": "#FFF8F0"
}`,
    "Keep the headline concise and commercial.",
    "highlights should contain 2 to 4 short selling points.",
  ].join("\n");
}
