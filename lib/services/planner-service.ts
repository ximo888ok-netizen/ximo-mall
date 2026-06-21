import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";

import { buildSectionPlanningPrompt } from "@/lib/ai/prompts";
import { sectionPlanOutputSchema } from "@/lib/ai/schemas/section-plan";
import { validatePlanResult, formatValidationResult } from "@/lib/ai/validators/plan-validator";
import { listKnowledgeEntries } from "@/lib/services/product-library-service";
import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "@/lib/services/provider-service";
import { completeTask, createTask, failTask, findRecentRunningTask } from "@/lib/services/task-service";
import { normalizeContentLanguage, type ContentLanguage } from "@/lib/utils/content-language";
import type { SectionTypeKey } from "@/types/domain";

type PreviewConfigInput = {
  heroImageCount: number;
  detailSectionCount: number;
  imageAspectRatio: "3:4" | "9:16";
  contentLanguage: ContentLanguage;
};

type RawPlannedSection = {
  id: string;
  type: string;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  editableFields: Record<string, unknown>;
};

type NormalizedSection = {
  sectionKey: string;
  type: string;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  editableData: Record<string, unknown>;
  order: number;
};

const previewConfigSchema = z.object({
  heroImageCount: z.number().int().min(0).max(9),
  detailSectionCount: z.number().int().min(0).max(12),
  imageAspectRatio: z.enum(["3:4", "9:16"]).default("9:16"),
  contentLanguage: z.enum(["zh-CN", "en-US", "ja-JP", "ko-KR"]).default("zh-CN"),
});

const previewDecisionSchema = z.object({
  heroImageCount: z.number().int().min(0).max(9),
  detailSectionCount: z.number().int().min(1).max(12),
  reason: z.string().default(""),
});

const heroFallbackSections: Array<{
  id: string;
  type: SectionTypeKey;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  editableFields: Record<string, unknown>;
}> = [
  {
    id: "hero_01",
    type: "hero",
    title: "产品规格展示",
    goal: "完整产品包装居中展示，配合规格参数和食欲氛围，建立第一眼产品认知。",
    copy: "产品名+核心规格+最核心卖点。如'xx品牌红烧牛肉面 145g×2袋｜精选澳洲牛腱肉，5分钟一碗好面'",
    visualPrompt:
      "Primary Prompt: 电商头图主视觉，完整产品包装居中展示(50-60%)，产品名称和规格参数大字呈现在顶部横幅，规格标签分布四周，背景为暖色食欲氛围（蒸汽、食材光泽、道具环绕）。具有完整营销边框：顶部标题横幅+底部促销横幅+左侧卖点标签+品牌徽章。\nEnglish Prompt: Premium e-commerce primary hero with centered product packaging, specification callouts and appetite atmosphere, full marketing border elements.",
    editableFields: {
      tone: "高级质感+食欲氛围",
      compositionHint: "居中构图+规格标注+食欲场景",
    },
  },
  {
    id: "hero_02",
    type: "hero",
    title: "拆包内容物展示",
    goal: "展示产品拆包后的全部内容物（面饼+调料包+配料），让用户一眼看到'里面有什么'。",
    copy: "内容丰富标题+内容物数量关键词。如'内含5包料·诚意满满｜面饼×1+酱包×1+粉包×1+菜包×1+油包×1'",
    visualPrompt:
      "Primary Prompt: 电商副图，拆包内容物展开平铺：面饼居中，各类调料包环绕排列并标注名称，干料配菜散落填充空隙。底部内容物标签条+角落品牌徽章+侧边说明条。\nEnglish Prompt: Secondary hero image showing unboxed contents flat-lay — noodle block centered, seasoning packets arranged around with labels, dry ingredients scattered to fill gaps.",
    editableFields: {
      tone: "丰富价值",
      compositionHint: "内容物平铺+标注",
    },
  },
  {
    id: "hero_03",
    type: "hero",
    title: "制作工艺展示",
    goal: "展示产品的制作工艺和产地场景，用工艺背书建立品质信任。",
    copy: "工艺卖点标题+2-3个工艺关键词。如'非遗工艺·12道工序｜手工日晒·石磨研磨·传统蒸制'",
    visualPrompt:
      "Primary Prompt: 电商副图，制作工艺场景可视化呈现（原料产地/晒面/蒸制），工艺亮点以3D标签标注，背景有工艺相关纹理（竹编/石磨/蒸笼），精致设计框架。\nEnglish Prompt: Secondary hero image with manufacturing craft scene — ingredient origin, sun-drying, steaming, craft highlights marked with 3D tags, textured background.",
    editableFields: {
      tone: "匠心品质",
      compositionHint: "工艺场景化+标签标注",
    },
  },
  {
    id: "hero_04",
    type: "hero",
    title: "使用教程展示",
    goal: "以步骤教程形式展示产品的使用和食用流程，降低用户认知门槛。",
    copy: "教程标题+步骤说明关键词。如'5分钟轻松享用｜拆包→加料→注水→等待→享用'",
    visualPrompt:
      "Primary Prompt: 电商副图，关键步骤以图标化流程展示(3-5步)，每步配简短文字说明，成品效果图占据画面上方大幅空间，时间标识以3D徽章突出，精致设计框架。\nEnglish Prompt: Secondary hero image with step-by-step usage tutorial — 3-5 iconified steps with short text, finished dish preview on top, time badge as 3D emblem.",
    editableFields: {
      tone: "操作清晰+低门槛",
      compositionHint: "步骤流程图+成品预览",
    },
  },
  {
    id: "hero_05",
    type: "hero",
    title: "优势与场景展示",
    goal: "展示产品的核心优势和多种使用场景，用场景多样性扩大人群覆盖。",
    copy: "优势总结标题+2-3个使用场景关键词。如'随时随地·一碗好面｜办公/宿舍/露营/家中'",
    visualPrompt:
      "Primary Prompt: 电商副图，多张不同场景小图以画廊式排版组合，每场景配简短标签，产品核心优势以大字浮动标签分布画面四周，底部优势总结横幅，精致设计框架。\nEnglish Prompt: Secondary hero image with multi-scene gallery layout — different usage scene thumbnails with labels, benefit floating tags around, bottom summary banner.",
    editableFields: {
      tone: "场景多样+价值总结",
      compositionHint: "多场景画廊+优势标签",
    },
  },
];

const detailFallbackSections: Array<{
  id: string;
  type: SectionTypeKey;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  editableFields: Record<string, unknown>;
}> = [
  {
    id: "detail_01",
    type: "selling_points",
    title: "产品首屏介绍",
    goal: "详情页第一屏：以产品包装和强食欲氛围成品为视觉锚点，配合产品名称标题、核心卖点标签、价值主张文案和完整营销边框，信息密度与其他详情页对等，让用户第一眼就被吸引并快速理解产品核心价值。",
    copy: "产品名称+一句核心价值主张+2-4个核心卖点标签。如'xx品牌红烧牛肉面｜精选澳洲牛腱肉·5分钟一碗好面·非遗工艺·诚意5包料'",
    visualPrompt:
      "Primary Prompt: 9:16竖版详情页第一屏，产品包装正面和强食欲氛围成品为视觉锚点(占画面主体)，产品名称标题介绍在顶部横幅，2-4个核心卖点以3D标签/徽章环绕产品，底部CTA信息横幅，侧边卖点标签条，品牌徽章；成品必须有足够食欲表现（热气、光泽、浓郁色泽、质感细节）；画面饱满丰富，信息密度与其他详情页对等，纹理背景、暖光、投影、餐具或食物道具、前中后景层次、装饰形状、空间深度和商业氛围。\nEnglish Prompt: 9:16 vertical first detail-page screen, product packaging front and highly appetizing finished product as visual anchors, product name title in top banner, 2-4 core selling points as 3D tags/badges around the product, bottom CTA banner, side selling-point tags, brand badge; strong appetite cues; rich full composition with textured background, warm lighting, shadows, props, depth layers, and premium commercial atmosphere.",
    editableFields: {
      tone: "饱满丰富+食欲氛围",
      compositionHint: "包装+成品双锚点+卖点标签+营销边框",
    },
  },
  {
    id: "detail_02",
    type: "brand_trust",
    title: "品牌背书",
    goal: "品牌名®+品类定位+双原料图标+免责声明，建立信任。",
    copy: "品牌名®+品类定位+两个核心原料亮点+免责声明。",
    visualPrompt:
      "Primary Prompt: 品牌名大字居中，品类定位副标题，左右各一个原料图标/插图，底部免责声明小字。\nEnglish Prompt: Brand name centered large, category positioning subtitle, dual ingredient icons on left and right, disclaimer small text at bottom.",
    editableFields: {
      tone: "信任建立",
      compositionHint: "品牌居中+双图标",
    },
  },
  {
    id: "detail_03",
    type: "detail_closeup",
    title: "感官渲染",
    goal: "风味定位+五维口感描述+俯拍成品图，激发感官想象。",
    copy: "风味定位标题+五维口感（酸度/甜度/肉质/余味/层次）每项短描述。",
    visualPrompt:
      "Primary Prompt: 俯拍/45°成品图，五维口感用图标+文字雷达图或标签排列呈现。\nEnglish Prompt: Top-down or 45° finished product shot, five-dimensional taste profile displayed with icons and text radar chart or tag arrangement.",
    editableFields: {
      tone: "感官激发",
      compositionHint: "俯拍+五维雷达",
    },
  },
  {
    id: "detail_04",
    type: "material",
    title: "信任锚点",
    goal: "真材实料微距特写+工艺说明+关键原料小图，建立品质信任。",
    copy: "真材实料标题+工艺说明+关键原料名称列表。",
    visualPrompt:
      "Primary Prompt: 食材微距特写大图（肉块纹理/蔬菜新鲜度），工艺关键词标注，角落放关键原料小图。\nEnglish Prompt: Macro close-up of real ingredients (meat texture/vegetable freshness), process keyword callouts, key ingredient thumbnails in corners.",
    editableFields: {
      tone: "品质背书",
      compositionHint: "微距+工艺标注",
    },
  },
  {
    id: "detail_05",
    type: "material",
    title: "原料溯源A",
    goal: "主料1产地故事+具体参数+切面特写，深度溯源。",
    copy: "主料1名称+产地故事+品质参数+与产品关联。",
    visualPrompt:
      "Primary Prompt: 主料1产地意境图与切面特写组合，参数用数据标签标注。\nEnglish Prompt: Main ingredient 1 origin mood image combined with cross-section close-up, parameters annotated with data labels.",
    editableFields: {
      tone: "溯源故事",
      compositionHint: "产地意境+数据标注",
    },
  },
  {
    id: "detail_06",
    type: "material",
    title: "原料溯源B",
    goal: "主料2品种故事+品质参数+关联成品体验。",
    copy: "主料2名称+品种/工艺故事+品质参数+对成品口感的贡献。",
    visualPrompt:
      "Primary Prompt: 主料2品种意境图与成品体验图组合，参数标注，强调与成品关系。\nEnglish Prompt: Main ingredient 2 variety mood image combined with finished product experience image, parameter annotations, emphasizing relationship to the final product.",
    editableFields: {
      tone: "溯源故事",
      compositionHint: "品种意境+成品关联",
    },
  },
  {
    id: "detail_07",
    type: "scenario",
    title: "效率驱动",
    goal: "场景标题+时间承诺+动态食欲图+难度关联，驱动购买。",
    copy: "场景标题+时间承诺（X分钟）+难度标签。",
    visualPrompt:
      "Primary Prompt: 场景氛围图+动态飞溅食欲元素（汤汁飞溅/蒸汽升腾），时间数字大字突出，难度图标标注。\nEnglish Prompt: Scene atmosphere image with dynamic splash appetizing elements (broth splashing/steam rising), time number prominently large, difficulty icon annotation.",
    editableFields: {
      tone: "效率驱动",
      compositionHint: "场景+时间大字+飞溅动感",
    },
  },
  {
    id: "detail_08",
    type: "specs",
    title: "配量可视化",
    goal: "N大材料拆包平铺+每包标注+外盒识别，直观展示。",
    copy: "配置标题+N大材料名称列表+总净含量。",
    visualPrompt:
      "Primary Prompt: 俯拍平铺构图，所有配料包拆包平铺展示，每个料包旁边标注名称，产品外盒在角落可识别。\nEnglish Prompt: Top-down flat lay composition, all ingredient packets unpacked and laid flat, each labeled with name, product outer box identifiable in corner.",
    editableFields: {
      tone: "可视化",
      compositionHint: "俯拍平铺+标签标注",
    },
  },
  {
    id: "detail_09",
    type: "summary",
    title: "使用教程",
    goal: "教程标题+三步图标化流程（每步≤30字），降低使用门槛。",
    copy: "教程标题+三步流程（每步≤30字）+最终成品体验。",
    visualPrompt:
      "Primary Prompt: 三步图标化流程横向排列，每步配图标/插图+文字说明，最终成品图收尾。\nEnglish Prompt: Three-step iconized process arranged horizontally, each step with icon/illustration and text description, closing with finished product image.",
    editableFields: {
      tone: "教程引导",
      compositionHint: "三步流程+成品收尾",
    },
  },
];

const sectionTypeMap: Record<string, string> = {
  hero: "HERO",
  selling_points: "SELLING_POINTS",
  scenario: "SCENARIO",
  detail_closeup: "DETAIL_CLOSEUP",
  specs: "SPECS",
  material: "MATERIAL",
  comparison: "COMPARISON",
  gift_scene: "GIFT_SCENE",
  brand_trust: "BRAND_TRUST",
  summary: "SUMMARY",
  custom: "CUSTOM",
};

function normalizeSectionType(type: string) {
  const normalized = type.trim().toLowerCase();
  return sectionTypeMap[normalized] ?? "CUSTOM";
}

function ensureBilingualPrompt(prompt: string, sectionTitle: string) {
  const trimmed = prompt.trim();
  if (
    trimmed.includes("English Prompt:") &&
    (trimmed.includes("中文提示：") || trimmed.includes("Primary Prompt:"))
  ) {
    return trimmed;
  }

  const primaryPrompt =
    trimmed || `${sectionTitle}，突出商品主体、商业排版和图内卖点信息，适合移动端电商详情页。`;
  return `Primary Prompt: ${primaryPrompt}\nEnglish Prompt: A premium e-commerce section visual for ${sectionTitle}, with the marketing copy designed directly inside the image and a strong conversion-focused composition.`;
}

function normalizeEditableFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readPreviewConfig(snapshot: unknown): PreviewConfigInput {
  const raw = ((snapshot as Record<string, unknown> | null) ?? {}).previewConfig;
  return previewConfigSchema.parse({
    heroImageCount: Number((raw as Record<string, unknown> | null)?.heroImageCount ?? 4),
    detailSectionCount: Number((raw as Record<string, unknown> | null)?.detailSectionCount ?? 6),
    imageAspectRatio: ((raw as Record<string, unknown> | null)?.imageAspectRatio ?? "9:16") as "3:4" | "9:16",
    contentLanguage: normalizeContentLanguage((raw as Record<string, unknown> | null)?.contentLanguage),
  });
}

function readPreviewMeta(snapshot: unknown) {
  const raw = ((snapshot as Record<string, unknown> | null) ?? {}).previewConfig as Record<string, unknown> | null;
  return {
    imageAspectRatio: raw?.imageAspectRatio === "3:4" ? "3:4" : "9:16",
    contentLanguage: normalizeContentLanguage(raw?.contentLanguage),
  } as const;
}

async function normalizeProjectSections(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  let heroCursor = 0;
  let detailCursor = 0;

  await prisma.$transaction(
    project.sections.map((section, index) => {
      const isHero = section.type === "HERO";
      if (isHero) {
        heroCursor += 1;
      } else {
        detailCursor += 1;
      }

      return prisma.pageSection.update({
        where: { id: section.id },
        data: {
          order: index,
          sectionKey: isHero
            ? `hero_${String(heroCursor).padStart(2, "0")}`
            : `detail_${String(detailCursor).padStart(2, "0")}_${section.type.toLowerCase()}`,
        },
      });
    }),
  );

  const currentSnapshot = (project.modelSnapshot as Record<string, unknown> | null) ?? {};
  const currentPreviewMeta = readPreviewMeta(project.modelSnapshot);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      modelSnapshot: {
        ...currentSnapshot,
        previewConfig: {
          ...(currentSnapshot.previewConfig as Record<string, unknown> | null),
          heroImageCount: heroCursor,
          detailSectionCount: detailCursor,
          imageAspectRatio: currentPreviewMeta.imageAspectRatio,
          contentLanguage: currentPreviewMeta.contentLanguage,
        },
      } as Prisma.InputJsonValue,
    },
  });
}

async function assertSectionMutationAllowed(projectId: string, options: { addingType?: string; deletingSectionId?: string; updatingSectionId?: string; nextType?: string }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  let heroCount = project.sections.filter((section) => section.type === "HERO").length;
  let detailCount = project.sections.filter((section) => section.type !== "HERO").length;

  if (options.addingType) {
    if (normalizeSectionType(options.addingType) === "HERO") {
      if (heroCount >= 9) {
        throw new Error("头图最多保留 9 张，请先删除或改成详情页后再新增。");
      }
      heroCount += 1;
    } else {
      if (detailCount >= 12) {
        throw new Error("详情页最多保留 12 张，请先删除或改成头图后再新增。");
      }
      detailCount += 1;
    }
  }

  if (options.deletingSectionId) {
    const target = project.sections.find((section) => section.id === options.deletingSectionId);
    if (!target) {
      throw new Error("Section not found.");
    }

    if (target.type === "HERO") {
      if (heroCount <= 3) {
        throw new Error("头图至少保留 3 张，不能继续删除。");
      }
      heroCount -= 1;
    } else {
      if (detailCount <= 4) {
        throw new Error("详情页至少保留 4 张，不能继续删除。");
      }
      detailCount -= 1;
    }
  }

  if (options.updatingSectionId && options.nextType) {
    const target = project.sections.find((section) => section.id === options.updatingSectionId);
    if (!target) {
      throw new Error("Section not found.");
    }

    const currentType = target.type;
    const nextType = normalizeSectionType(options.nextType);
    if (currentType !== nextType) {
      if (currentType === "HERO" && nextType !== "HERO") {
        if (heroCount <= 3) {
          throw new Error("头图至少保留 3 张，不能把当前头图改成详情页。");
        }
        if (detailCount >= 12) {
          throw new Error("详情页最多保留 12 张，请先删除多余详情页后再转换。");
        }
      }

      if (currentType !== "HERO" && nextType === "HERO") {
        if (detailCount <= 4) {
          throw new Error("详情页至少保留 4 张，不能把当前详情页改成头图。");
        }
        if (heroCount >= 9) {
          throw new Error("头图最多保留 9 张，请先删除多余头图后再转换。");
        }
      }
    }
  }
}

function buildPreviewDecisionPrompt(analysis: Record<string, unknown>, contentLanguage: ContentLanguage) {
  const context = {
    productName: analysis.productName,
    category: analysis.category,
    subcategory: analysis.subcategory,
    styleTags: Array.isArray(analysis.styleTags) ? analysis.styleTags.slice(0, 6) : [],
    usageScenarios: Array.isArray(analysis.usageScenarios) ? analysis.usageScenarios.slice(0, 6) : [],
    coreSellingPoints: Array.isArray(analysis.coreSellingPoints) ? analysis.coreSellingPoints.slice(0, 8) : [],
    differentiationPoints: Array.isArray(analysis.differentiationPoints)
      ? analysis.differentiationPoints.slice(0, 6)
      : [],
    suggestedSectionPlan: Array.isArray(analysis.suggestedSectionPlan) ? analysis.suggestedSectionPlan.slice(0, 8) : [],
  };

  return [
    "You are a senior e-commerce creative strategist deciding the right image count plan for a product detail page.",
    "Return strict JSON only.",
    "heroImageCount must be an integer between 1 and 9.",
    "detailSectionCount must be an integer between 4 and 12.",
    `The target content language for the final page is ${contentLanguage}.`,
    "Hero images should be enough to cover distinct first-screen communication angles such as hero visual, selling point emphasis, scenario mood, trust, or differentiation.",
    "Detail sections should be enough to fully explain selling points, craftsmanship, specs, trust, and use cases without becoming repetitive.",
    "If the product is simple, reduce quantity. If the product needs richer explanation, increase quantity.",
    "",
    "Product context:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function buildFallbackDetail(index: number) {
  const template = detailFallbackSections[index % detailFallbackSections.length];
  return {
    type: normalizeSectionType(template.type),
    title: template.title,
    goal: template.goal,
    copy: template.copy,
    visualPrompt: template.visualPrompt,
    editableData: template.editableFields,
  };
}

function buildFallbackHero(index: number) {
  const template = heroFallbackSections[index % heroFallbackSections.length];
  return {
    type: "HERO",
    title: template.title,
    goal: template.goal,
    copy: template.copy,
    visualPrompt: template.visualPrompt,
    editableData: template.editableFields,
  };
}

function buildNormalizedSections(
  rawSections: RawPlannedSection[],
  heroImageCount: number,
  detailSectionCount: number,
): NormalizedSection[] {
  const normalized = rawSections.map((section, index) => ({
    type: normalizeSectionType(section.type),
    title: section.title || `模块 ${index + 1}`,
    goal: section.goal || "突出商品卖点",
    copy: section.copy || "",
    visualPrompt: ensureBilingualPrompt(section.visualPrompt || "", section.title || `模块 ${index + 1}`),
    editableData: normalizeEditableFields(section.editableFields),
  }));

  const heroPool = normalized.filter((section) => section.type === "HERO");
  const detailPool = normalized.filter((section) => section.type !== "HERO");

  const finalHeroes = heroPool.slice(0, heroImageCount);
  while (finalHeroes.length < heroImageCount) {
    finalHeroes.push(buildFallbackHero(finalHeroes.length));
  }

  const finalDetails = detailPool.slice(0, detailSectionCount);
  while (finalDetails.length < detailSectionCount) {
    finalDetails.push(buildFallbackDetail(finalDetails.length));
  }

  if (finalDetails[0]) {
    finalDetails[0] = {
      ...finalDetails[0],
      type: "SELLING_POINTS",
      title: finalDetails[0].title || "产品首屏介绍",
      goal: "详情页第一屏：以产品包装和强食欲氛围成品为视觉锚点，配合产品名称标题、核心卖点标签、价值主张文案和完整营销边框，信息密度与其他详情页对等，让用户第一眼就被吸引并快速理解产品核心价值。",
      visualPrompt: ensureBilingualPrompt(
        `详情页第一屏：以产品包装正面和强食欲氛围的产品成品为视觉锚点(占画面主体)，产品名称标题介绍在顶部横幅，2-4个核心卖点以3D标签/徽章环绕产品，底部CTA信息横幅，侧边卖点标签条，品牌徽章；成品必须有足够食欲表现（热气、光泽、浓郁色泽、质感细节，按产品实际适配）；画面必须饱满丰富，与其他详情页信息密度对等，加入纹理背景、暖光、投影、餐具或食物道具、前中后景层次、装饰形状、空间深度和商业氛围；不要虚构价格优惠和认证信息，但卖点、场景、口感描述等真实内容都欢迎。\n\n${finalDetails[0].visualPrompt}`,
        finalDetails[0].title || "产品首屏介绍",
      ),
      editableData: {
        ...finalDetails[0].editableData,
        firstScreenHardConstraint: "产品包装+强食欲氛围产品成品+产品名称标题+核心卖点标签+价值主张文案",
      },
    };
  }

  return [...finalHeroes, ...finalDetails].map((section, index) => {
    if (section.type === "HERO") {
      return {
        ...section,
        sectionKey: `hero_${String(index + 1).padStart(2, "0")}`,
        order: index,
      };
    }

    const detailIndex = index + 1 - finalHeroes.length;
    return {
      ...section,
      sectionKey: `detail_${String(detailIndex).padStart(2, "0")}_${section.type.toLowerCase()}`,
      order: index,
    };
  });
}

function isModelNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    /404|does not exist|not found for model|InvalidEndpointOrModel|model.*not found/i.test(error.message)
  );
}

function buildPlanningModelCandidates(
  provider: Awaited<ReturnType<typeof getProviderAdapter>>["provider"],
  preferredModelId?: string | null,
): string[] {
  // 明确查找用户在 UI 中标记的默认规划模型
  const defaultPlanningModel = provider.models.find((item) => item.isDefaultPlanning);
  const defaultAnalysisModel = provider.models.find((item) => item.isDefaultAnalysis);

  const priorityMatches: (string | null)[] = [
    preferredModelId ?? null,
    // 最优先：用户在 UI 中标记的默认规划模型
    defaultPlanningModel?.modelId ?? null,
    // 其次：用户在 UI 中标记的默认分析模型（作为回退）
    defaultAnalysisModel?.modelId ?? null,
  ];
  const seen = new Set(priorityMatches.filter(Boolean) as string[]);

  const rest = [
    ...provider.models
      .filter((item) => (item.capabilities as Record<string, boolean>).structured_output && !seen.has(item.modelId))
      .map((item) => item.modelId),
    ...provider.models
      .filter((item) => (item.capabilities as Record<string, boolean>).text && !seen.has(item.modelId))
      .map((item) => item.modelId),
  ];

  return [...(priorityMatches.filter(Boolean) as string[]), ...rest];
}

async function decidePreviewConfigWithAi(projectId: string, preferredModelId?: string | null) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, assets: true },
  });

  if (!project?.analysis) {
    throw new Error("请先完成商品分析，再进行页面规划。");
  }

  const { provider, adapter } = await getProviderAdapter("planning");
  const modelCandidates = buildPlanningModelCandidates(provider, preferredModelId);

  if (!modelCandidates.length) {
    throw new Error("当前没有可用的文案规划模型。");
  }

  const currentPreviewConfig = readPreviewConfig(project.modelSnapshot);
  const prompt = buildPreviewDecisionPrompt(
    project.analysis.normalizedResult as Record<string, unknown>,
    currentPreviewConfig.contentLanguage,
  );
  const skippedModels: string[] = [];

  for (const model of modelCandidates) {
    try {
      const result = await adapter.generateStructured({
        model,
        systemPrompt: "Return strict JSON only.",
        userPrompt: prompt,
        schema: previewDecisionSchema,
        timeoutMs: 180000,
        monitor: {
          projectId,
          operation: "preview_count_planning",
        },
      });

      const current = readPreviewConfig(project.modelSnapshot);
      const decided = previewConfigSchema.parse({
        heroImageCount: result.parsed.heroImageCount,
        detailSectionCount: result.parsed.detailSectionCount,
        imageAspectRatio: current.imageAspectRatio,
        contentLanguage: current.contentLanguage,
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          modelSnapshot: {
            ...(project.modelSnapshot as Record<string, unknown> | null),
            previewConfig: decided,
            previewConfigSource: "ai",
            previewConfigReason: result.parsed.reason,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        previewConfig: decided,
        reason: result.parsed.reason,
      };
    } catch (error) {
      if (isModelNotFoundError(error)) {
        skippedModels.push(model);
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `所有规划模型均已尝试但均不可用。已跳过：${skippedModels.join("、")}。请前往 Provider 设置重新发现模型。`,
  );
}

export async function planSections(
  projectId: string,
  options?: {
    modelId?: string | null;
    previewConfig?: PreviewConfigInput | null;
    autoDecideCounts?: boolean;
    searchContext?: string;
    agentMode?: boolean;
  },
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analysis: true, assets: true },
  });

  if (!project?.analysis) {
    throw new Error("请先完成商品分析，再进行页面规划。");
  }

  const { provider, adapter } = await getProviderAdapter("planning");
  const modelCandidates = buildPlanningModelCandidates(provider, options?.modelId);

  if (!modelCandidates.length) {
    throw new Error("当前没有可用的文案规划模型。");
  }

  const existingTask = await findRecentRunningTask({
    projectId,
    taskType: "PLAN",
    maxAgeMinutes: 10,
  });
  if (existingTask) {
    throw new Error("当前页面规划仍在进行中，请等待这一轮完成后再试。");
  }

  let previewConfig =
    options?.previewConfig != null ? previewConfigSchema.parse(options.previewConfig) : readPreviewConfig(project.modelSnapshot);
  let previewDecisionReason = "";

  if (options?.autoDecideCounts) {
    const decision = await decidePreviewConfigWithAi(projectId);
    previewConfig = decision.previewConfig;
    previewDecisionReason = decision.reason;
  }

  const skippedModels: string[] = [];

  for (const model of modelCandidates) {
    const task = await createTask({
      projectId,
      taskType: "PLAN",
      inputPayload: { model, candidates: modelCandidates, previewConfig, autoDecideCounts: Boolean(options?.autoDecideCounts) },
    });

    try {
      // 提取关联图上下文（分析与规划之间的静默传递通道）
      const analysisResult = project.analysis.normalizedResult as Record<string, unknown>;
      const associatedImageContexts = (
        Array.isArray(analysisResult.associatedImageContexts)
          ? analysisResult.associatedImageContexts
          : undefined
      ) as import("@/types/domain").AssociatedImageContext[] | undefined;

      // 从产品知识库拉取知识条目（如果项目关联了产品库）
      let knowledgeEntries: { category: string; title: string; content: string }[] | undefined;
      if (project.productLibraryId) {
        try {
          const entries = await listKnowledgeEntries(project.productLibraryId);
          knowledgeEntries = entries.map((e) => ({ category: e.category, title: e.title, content: e.content }));
        } catch {
          // 静默失败，不阻塞规划
        }
      }

      const assetLabels = (project.assets ?? [])
        .filter((a) => {
          const meta = a.metadata as Record<string, unknown> | null;
          return meta && typeof meta === "object" && typeof meta.label === "string";
        })
        .map((a) => {
          const meta = a.metadata as Record<string, string>;
          return { type: a.type, label: meta.label ?? a.type, id: a.id };
        });

      const prompt = buildSectionPlanningPrompt(
        project.analysis.normalizedResult as never,
        project.style,
        project.platform,
        previewConfig.detailSectionCount,
        previewConfig.heroImageCount,
        previewConfig.contentLanguage,
        associatedImageContexts,
        knowledgeEntries,
        assetLabels.length > 0 ? assetLabels : undefined,
        options?.searchContext,
        options?.agentMode,
      );

      const structuredResult = await adapter.generateStructured({
        model,
        systemPrompt: "You MUST return ONLY valid JSON. No markdown, no explanations.",
        userPrompt: prompt,
        schema: sectionPlanOutputSchema,
        maxTokens: 16384,
        timeoutMs: 300000,
        monitor: { projectId, operation: "section_planning" },
      });

      const rawSections = structuredResult.parsed.sections as RawPlannedSection[];
      const detailVisualAnchor = structuredResult.parsed.detailVisualAnchor ?? null;

      if (!rawSections.length) {
        throw new Error("AI 规划返回了空的 sections 数组，请重试。");
      }

      // 后置校验：检查文案词重叠、禁用词、文案密度、字体指令
      // 不阻断流程，仅记录警告到 modelSnapshot 供前端展示
      const validationResult = validatePlanResult(
        rawSections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          copy: s.copy,
          visualPrompt: s.visualPrompt,
        })),
      );
      if (!validationResult.passed) {
        console.warn(formatValidationResult(validationResult));
      }

      await prisma.pageSection.deleteMany({ where: { projectId } });

      const sections = buildNormalizedSections(
        rawSections,
        previewConfig.heroImageCount,
        previewConfig.detailSectionCount,
      );

      await prisma.pageSection.createMany({
        data: sections.map((section) => ({
          projectId,
          sectionKey: section.sectionKey,
          type: section.type as never,
          title: section.title,
          goal: section.goal,
          copy: section.copy,
          visualPrompt: section.visualPrompt,
          order: section.order,
          editableData: section.editableData as Prisma.InputJsonValue,
        })),
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: "PLANNED",
          modelSnapshot: {
            ...(project.modelSnapshot as Record<string, unknown> | null),
            planningModelId: model,
            previewConfig,
            previewConfigSource: options?.autoDecideCounts ? "ai" : "manual",
            previewConfigReason: previewDecisionReason,
            detailVisualAnchor: detailVisualAnchor ?? undefined,
            planValidation: JSON.parse(
              JSON.stringify({
                passed: validationResult.passed,
                warningCount: validationResult.warnings.length,
                warnings: validationResult.warnings,
                validatedAt: new Date().toISOString(),
              }),
            ),
            agentPlanningReview: {
              status: "PENDING_USER_REVIEW",
              plannedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      const saved = await prisma.pageSection.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
      });
      await completeTask(task.id, { sections: saved, previewConfig, previewDecisionReason });
      return {
        sections: saved,
        previewConfig,
        previewDecisionReason,
      };
    } catch (error) {
      if (isModelNotFoundError(error)) {
        skippedModels.push(model);
        await completeTask(task.id, { skipped: true, model, reason: error instanceof Error ? error.message : "Model not found" });
        continue;
      }

      const message =
        error instanceof Error
          ? error.message.includes("timed out")
            ? "页面规划请求超时，请稍后重试，或在 AI 配置里改用更快的规划模型。"
            : error.message
          : "页面规划失败";
      try {
        await failTask(task.id, message);
      } catch {
        // failTask 自身的错误不应覆盖原始错误
      }
      throw new Error(message);
    }
  }

  throw new Error(
    `所有规划模型均已尝试但均不可用。已跳过：${skippedModels.join("、")}。请前往 Provider 设置重新发现模型。`,
  );
}

export async function createSection(
  projectId: string,
  input: {
    type: string;
    title: string;
    goal: string;
    copy: string;
    visualPrompt: string;
    editableFields?: Record<string, unknown>;
  },
) {
  await assertSectionMutationAllowed(projectId, { addingType: input.type });
  const count = await prisma.pageSection.count({ where: { projectId } });
  const created = await prisma.pageSection.create({
    data: {
      projectId,
      sectionKey:
        normalizeSectionType(input.type) === "HERO"
          ? `hero_${String(count + 1).padStart(2, "0")}`
          : `detail_${String(count + 1).padStart(2, "0")}_${nanoid(6)}`,
      type: normalizeSectionType(input.type) as never,
      title: input.title,
      goal: input.goal,
      copy: input.copy,
      visualPrompt: ensureBilingualPrompt(input.visualPrompt, input.title),
      order: count,
      editableData: (input.editableFields ?? {}) as Prisma.InputJsonValue,
    },
  });
  await normalizeProjectSections(projectId);
  return created;
}

export async function updateSection(sectionId: string, input: Record<string, unknown>) {
  const current = await prisma.pageSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  if (!current) {
    throw new Error("Section not found.");
  }

  if ("type" in input && typeof input.type === "string") {
    await assertSectionMutationAllowed(current.projectId, {
      updatingSectionId: sectionId,
      nextType: input.type,
    });
  }

  const payload = { ...input } as Record<string, unknown>;
  if ("visualPrompt" in payload && typeof payload.visualPrompt === "string") {
    payload.visualPrompt = ensureBilingualPrompt(payload.visualPrompt, String(payload.title ?? "当前模块"));
  }
  if ("type" in payload && typeof payload.type === "string") {
    payload.type = normalizeSectionType(payload.type) as never;
  }
  if ("editableData" in payload) {
    payload.editableData = payload.editableData as Prisma.InputJsonValue;
  }
  const updated = await prisma.pageSection.update({
    where: { id: sectionId },
    data: payload,
  });
  await normalizeProjectSections(current.projectId);
  return updated;
}

export async function deleteSection(sectionId: string) {
  const current = await prisma.pageSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  if (!current) {
    throw new Error("Section not found.");
  }

  await assertSectionMutationAllowed(current.projectId, { deletingSectionId: sectionId });
  const deleted = await prisma.pageSection.delete({
    where: { id: sectionId },
  });
  await normalizeProjectSections(current.projectId);
  return deleted;
}

export async function reorderSections(projectId: string, orderedSectionIds: string[]) {
  await prisma.$transaction(
    orderedSectionIds.map((sectionId, index) =>
      prisma.pageSection.update({
        where: { id: sectionId },
        data: { order: index },
      }),
    ),
  );

  await normalizeProjectSections(projectId);

  return prisma.pageSection.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });
}
