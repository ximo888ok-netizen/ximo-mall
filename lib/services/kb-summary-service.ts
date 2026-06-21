import { prisma } from "@/lib/db/prisma";
import { getProviderAdapter } from "./provider-service";

// ==================== 类型定义 ====================

export interface KnowledgeBaseSummary {
  totalImages: number;
  heroImages: number;
  detailImages: number;
  totalKnowledges: number;
  knowledgeByType: Record<string, number>;
  styleStats: StyleStats;
  layoutStats: LayoutStats;
  typographyStats: TypographyStats;
  appetiteStats: AppetiteStats;
  marketingStats: MarketingStats;
  topKnowledges: TopKnowledge[];
}

export interface StyleStats {
  dominantColors: { color: string; frequency: number }[];
  moodDistribution: { mood: string; count: number }[];
  atmosphereTrends: { atmosphere: string; count: number }[];
}

export interface LayoutStats {
  commonLayouts: { layout: string; count: number }[];
  heroPositions: { position: string; count: number }[];
  textZones: { zone: string; count: number }[];
}

export interface TypographyStats {
  fontStyles: { style: string; count: number }[];
  headlineSizes: { size: string; count: number }[];
  tagStyles: { style: string; count: number }[];
}

export interface AppetiteStats {
  steamFrequency: number;
  garnishTypes: { type: string; count: number }[];
  propTypes: { type: string; count: number }[];
}

export interface MarketingStats {
  percentageLabels: { label: string; count: number }[];
  quantityHints: { hint: string; count: number }[];
  scenePhrases: { phrase: string; count: number }[];
  trustBadges: { badge: string; count: number }[];
}

export interface TopKnowledge {
  id: string;
  type: string;
  name: string;
  description: string;
  confidence: number;
  sampleCount: number;
}

// ==================== 知识库总结 ====================

// 生成知识库量化总结
export async function generateKnowledgeBaseSummary(kbId: string, category?: string): Promise<KnowledgeBaseSummary> {
  // 获取所有已分析的图片
  const images = await prisma.noodleKBImage.findMany({
    where: { kbId, status: "ANALYZED", ...(category ? { category } : {}) },
  });

  // 获取图片 ID 列表，用于过滤属于该类别的知识
  const imageIds = images.map((img) => img.id);

  // 获取所有活跃的知识
  let knowledges = await prisma.noodleKBKnowledge.findMany({
    where: { kbId, isActive: true },
    orderBy: { confidence: "desc" },
  });

  // 如果指定了类别，在内存中过滤属于该类图片的知识
  if (category && imageIds.length > 0) {
    knowledges = knowledges.filter((k) => {
      const srcIds = k.sourceImageIds as string[] | null;
      return srcIds && srcIds.some((id) => imageIds.includes(id));
    });
  }

  // 统计图片数量
  const heroImages = images.filter((img) => img.category === "HERO").length;
  const detailImages = images.filter((img) => img.category === "DETAIL").length;

  // 统计知识类型分布
  const knowledgeByType: Record<string, number> = {};
  for (const k of knowledges) {
    knowledgeByType[k.type] = (knowledgeByType[k.type] || 0) + 1;
  }

  // 分析风格统计（包含配色和装饰）
  const styleStats = analyzeStyleStats(knowledges.filter((k) => k.type === "STYLE"));

  // 分析布局统计
  const layoutStats = analyzeLayoutStats(knowledges.filter((k) => k.type === "LAYOUT"));

  // 分析排版统计
  const typographyStats = analyzeTypographyStats(knowledges.filter((k) => k.type === "TYPOGRAPHY"));

  // 分析食欲元素统计
  const appetiteStats = analyzeAppetiteStats(knowledges.filter((k) => k.type === "APPETITE"));

  // 分析营销元素统计
  const marketingStats = analyzeMarketingStats(knowledges.filter((k) => k.type === "CONTENT"));

  // 获取置信度最高的知识
  const topKnowledges = knowledges.slice(0, 10).map((k) => ({
    id: k.id,
    type: k.type,
    name: k.name,
    description: k.description,
    confidence: k.confidence,
    sampleCount: k.sampleCount,
  }));

  const summary: KnowledgeBaseSummary = {
    totalImages: images.length,
    heroImages,
    detailImages,
    totalKnowledges: knowledges.length,
    knowledgeByType,
    styleStats,
    layoutStats,
    typographyStats,
    appetiteStats,
    marketingStats,
    topKnowledges,
  };

  // 保存总结到知识库
  await prisma.noodleKnowledgeBase.update({
    where: { id: kbId },
    data: { summary },
  });

  return summary;
}

// ==================== 统计分析函数 ====================

function analyzeStyleStats(knowledges: any[]): StyleStats {
  const colorMap: Record<string, number> = {};
  const moodMap: Record<string, number> = {};
  const atmosphereMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    // 统计颜色
    if (attrs?.dominantColors) {
      for (const color of attrs.dominantColors) {
        colorMap[color] = (colorMap[color] || 0) + 1;
      }
    }

    // 统计氛围
    if (attrs?.mood) {
      moodMap[attrs.mood] = (moodMap[attrs.mood] || 0) + 1;
    }

    // 统计大气效果
    if (attrs?.atmosphere) {
      atmosphereMap[attrs.atmosphere] = (atmosphereMap[attrs.atmosphere] || 0) + 1;
    }
  }

  return {
    dominantColors: Object.entries(colorMap)
      .map(([color, frequency]) => ({ color, frequency }))
      .sort((a, b) => b.frequency - a.frequency),
    moodDistribution: Object.entries(moodMap)
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count),
    atmosphereTrends: Object.entries(atmosphereMap)
      .map(([atmosphere, count]) => ({ atmosphere, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function analyzeLayoutStats(knowledges: any[]): LayoutStats {
  const layoutMap: Record<string, number> = {};
  const positionMap: Record<string, number> = {};
  const zoneMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    if (attrs?.layoutType) {
      layoutMap[attrs.layoutType] = (layoutMap[attrs.layoutType] || 0) + 1;
    }

    if (attrs?.heroPosition) {
      positionMap[attrs.heroPosition] = (positionMap[attrs.heroPosition] || 0) + 1;
    }

    if (attrs?.textZones) {
      for (const zone of attrs.textZones) {
        zoneMap[zone] = (zoneMap[zone] || 0) + 1;
      }
    }
  }

  return {
    commonLayouts: Object.entries(layoutMap)
      .map(([layout, count]) => ({ layout, count }))
      .sort((a, b) => b.count - a.count),
    heroPositions: Object.entries(positionMap)
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count),
    textZones: Object.entries(zoneMap)
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function analyzeTypographyStats(knowledges: any[]): TypographyStats {
  const styleMap: Record<string, number> = {};
  const sizeMap: Record<string, number> = {};
  const tagMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    if (attrs?.fontStyle) {
      styleMap[attrs.fontStyle] = (styleMap[attrs.fontStyle] || 0) + 1;
    }

    if (attrs?.headlineSize) {
      sizeMap[attrs.headlineSize] = (sizeMap[attrs.headlineSize] || 0) + 1;
    }

    if (attrs?.tagStyle) {
      tagMap[attrs.tagStyle] = (tagMap[attrs.tagStyle] || 0) + 1;
    }
  }

  return {
    fontStyles: Object.entries(styleMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count),
    headlineSizes: Object.entries(sizeMap)
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count),
    tagStyles: Object.entries(tagMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function analyzeAppetiteStats(knowledges: any[]): AppetiteStats {
  let steamCount = 0;
  const garnishMap: Record<string, number> = {};
  const propMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    if (attrs?.hasSteam) steamCount++;

    if (attrs?.garnishes) {
      for (const g of attrs.garnishes) {
        garnishMap[g] = (garnishMap[g] || 0) + 1;
      }
    }

    if (attrs?.props) {
      for (const p of attrs.props) {
        propMap[p] = (propMap[p] || 0) + 1;
      }
    }
  }

  return {
    steamFrequency: knowledges.length > 0 ? steamCount / knowledges.length : 0,
    garnishTypes: Object.entries(garnishMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    propTypes: Object.entries(propMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function analyzeIngredientStats(knowledges: any[]): IngredientStats {
  const styleMap: Record<string, number> = {};
  const indicatorMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    if (attrs?.displayStyle) {
      styleMap[attrs.displayStyle] = (styleMap[attrs.displayStyle] || 0) + 1;
    }

    if (attrs?.portionIndicators) {
      for (const i of attrs.portionIndicators) {
        indicatorMap[i] = (indicatorMap[i] || 0) + 1;
      }
    }
  }

  return {
    displayStyles: Object.entries(styleMap)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count),
    portionIndicators: Object.entries(indicatorMap)
      .map(([indicator, count]) => ({ indicator, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function analyzeMarketingStats(knowledges: any[]): MarketingStats {
  const percentageMap: Record<string, number> = {};
  const quantityMap: Record<string, number> = {};
  const sceneMap: Record<string, number> = {};
  const trustMap: Record<string, number> = {};

  for (const k of knowledges) {
    const attrs = k.attributes as any;

    if (attrs?.percentageLabels) {
      for (const label of attrs.percentageLabels) {
        percentageMap[label] = (percentageMap[label] || 0) + 1;
      }
    }

    if (attrs?.quantityHints) {
      for (const hint of attrs.quantityHints) {
        quantityMap[hint] = (quantityMap[hint] || 0) + 1;
      }
    }

    if (attrs?.scenePhrases) {
      for (const phrase of attrs.scenePhrases) {
        sceneMap[phrase] = (sceneMap[phrase] || 0) + 1;
      }
    }

    if (attrs?.trustBadges) {
      for (const badge of attrs.trustBadges) {
        trustMap[badge] = (trustMap[badge] || 0) + 1;
      }
    }
  }

  return {
    percentageLabels: Object.entries(percentageMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    quantityHints: Object.entries(quantityMap)
      .map(([hint, count]) => ({ hint, count }))
      .sort((a, b) => b.count - a.count),
    scenePhrases: Object.entries(sceneMap)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count),
    trustBadges: Object.entries(trustMap)
      .map(([badge, count]) => ({ badge, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// 获取知识库总结（如果已生成）
export async function getKnowledgeBaseSummary(kbId: string, category?: string) {
  const kb = await prisma.noodleKnowledgeBase.findUnique({
    where: { id: kbId },
  });

  if (!kb) throw new Error("Knowledge base not found");

  const raw = kb.summary as KnowledgeBaseSummary | null;
  if (!raw || !category) return raw;

  // 如果指定了类别，按类别生成分项总结
  return generateKnowledgeBaseSummary(kbId, category);
}
