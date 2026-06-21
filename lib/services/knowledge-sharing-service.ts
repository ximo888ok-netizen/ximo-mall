/**
 * 知识共享服务
 * 将图片学习 Agent 的学习成果赋能给其他工作流 Agent
 */

import type { KnowledgeType, Prisma } from "@prisma/client";

import {
  buildEnhancedPrompt,
  getActiveKnowledges,
  getKnowledgeByType,
  recordKnowledgeApply,
} from "@/lib/services/image-learning-service";
import { prisma } from "@/lib/db/prisma";

// ==================== 知识应用上下文类型 ====================

export type AgentType = "ANALYSIS" | "PLANNING" | "GENERATION" | "EXPORT";

export interface KnowledgeContext {
  agentType: AgentType;
  projectId: string;
  sectionId?: string;
  sectionType?: string;
  sectionTitle?: string;
  productCategory?: string;
  platform?: string;
  style?: string;
}

export interface KnowledgeApplication {
  method: "prompt_injection" | "reference_image" | "parameter_adjust";
  content: string | Record<string, unknown>;
  knowledges: Array<{
    id: string;
    type: KnowledgeType;
    name: string;
  }>;
}

// ==================== 知识匹配与推荐 ====================

/**
 * 为指定上下文匹配最合适的知识
 */
export async function matchKnowledgesForContext(
  context: KnowledgeContext,
  options?: {
    sessionId?: string;
    limit?: number;
    minConfidence?: number;
  }
): Promise<KnowledgeApplication> {
  const { sessionId, limit = 5, minConfidence = 0.6 } = options || {};

  // 获取活跃知识
  const knowledges = await getActiveKnowledges(sessionId);

  // 过滤低置信度
  const filtered = knowledges.filter((k) => k.confidence >= minConfidence);

  // 根据 Agent 类型和上下文计算匹配分数
  const scored = filtered.map((k) => ({
    knowledge: k,
    score: calculateMatchScore(k, context),
  }));

  // 排序并取前 N
  const topKnowledges = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.knowledge);

  // 根据 Agent 类型构建应用内容
  const application = await buildKnowledgeApplication(topKnowledges, context);

  // 记录知识应用
  for (const knowledge of topKnowledges) {
    await recordKnowledgeApply({
      knowledgeId: knowledge.id,
      agentType: context.agentType,
      projectId: context.projectId,
      sectionId: context.sectionId,
      applyMethod: application.method,
      applyDetails: {
        context,
        score: scored.find((s) => s.knowledge.id === knowledge.id)?.score,
      },
    });
  }

  return application;
}

function calculateMatchScore(
  knowledge: Awaited<ReturnType<typeof getActiveKnowledges>>[0],
  context: KnowledgeContext
): number {
  let score = knowledge.confidence;

  // 根据 Agent 类型调整权重
  const agentTypeWeights: Record<AgentType, Record<KnowledgeType, number>> = {
    ANALYSIS: {
      STYLE: 0.9,
      CONTENT: 1.0,
      COMPOSITION: 0.8,
      COLOR: 0.9,
      TYPOGRAPHY: 0.7,
      SCENE: 0.8,
    },
    PLANNING: {
      STYLE: 0.9,
      CONTENT: 0.9,
      COMPOSITION: 0.8,
      COLOR: 0.8,
      TYPOGRAPHY: 0.7,
      SCENE: 0.9,
    },
    GENERATION: {
      STYLE: 1.0,
      CONTENT: 0.8,
      COMPOSITION: 0.9,
      COLOR: 1.0,
      TYPOGRAPHY: 0.9,
      SCENE: 0.9,
    },
    EXPORT: {
      STYLE: 0.8,
      CONTENT: 0.7,
      COMPOSITION: 0.8,
      COLOR: 0.8,
      TYPOGRAPHY: 0.9,
      SCENE: 0.7,
    },
  };

  const typeWeight = agentTypeWeights[context.agentType]?.[knowledge.type] ?? 0.8;
  score *= typeWeight;

  // 根据模块类型调整
  if (context.sectionType) {
    const sectionTypePriority: Record<string, KnowledgeType[]> = {
      HERO: ["STYLE", "COLOR", "COMPOSITION", "TYPOGRAPHY"],
      SELLING_POINTS: ["CONTENT", "TYPOGRAPHY", "STYLE"],
      SCENARIO: ["SCENE", "STYLE", "COLOR"],
      DETAIL_CLOSEUP: ["COMPOSITION", "STYLE", "COLOR"],
      SPECS: ["TYPOGRAPHY", "STYLE"],
      MATERIAL: ["STYLE", "SCENE"],
      COMPARISON: ["COMPOSITION", "TYPOGRAPHY"],
      BRAND_TRUST: ["STYLE", "COLOR"],
      SUMMARY: ["STYLE", "TYPOGRAPHY", "COLOR"],
    };

    const priorities = sectionTypePriority[context.sectionType] || [];
    const priorityIndex = priorities.indexOf(knowledge.type);
    if (priorityIndex !== -1) {
      score *= 1 + (priorities.length - priorityIndex) * 0.1;
    }
  }

  // 应用次数奖励（热门知识）
  const applyBonus = Math.min(knowledge.applyCount * 0.02, 0.2);
  score += applyBonus;

  return Math.min(score, 1.0);
}

async function buildKnowledgeApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>,
  context: KnowledgeContext
): Promise<KnowledgeApplication> {
  // 根据 Agent 类型选择应用方式
  switch (context.agentType) {
    case "ANALYSIS":
      return buildAnalysisAgentApplication(knowledges, context);
    case "PLANNING":
      return buildPlanningAgentApplication(knowledges, context);
    case "GENERATION":
      return buildGenerationAgentApplication(knowledges, context);
    case "EXPORT":
      return buildExportAgentApplication(knowledges, context);
    default:
      return buildGenericApplication(knowledges);
  }
}

// ==================== 各 Agent 类型的知识应用 ====================

/**
 * 为分析 Agent 构建知识应用
 * 主要注入到系统提示词中，影响分析维度
 */
function buildAnalysisAgentApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>,
  context: KnowledgeContext
): KnowledgeApplication {
  const styleKnowledges = knowledges.filter((k) => k.type === "STYLE");
  const contentKnowledges = knowledges.filter((k) => k.type === "CONTENT");
  const colorKnowledges = knowledges.filter((k) => k.type === "COLOR");

  const promptInjection = [
    "## 风格偏好参考",
    styleKnowledges.map((k) => `- ${k.name}: ${k.description}`).join("\n"),
    "",
    "## 内容元素参考",
    contentKnowledges.map((k) => `- ${k.name}: ${k.description}`).join("\n"),
    "",
    "## 配色方案参考",
    colorKnowledges.map((k) => {
      const attrs = k.attributes as Record<string, string>;
      return `- ${k.name}: ${attrs.primaryColor || ""} ${attrs.colorScheme || ""}`;
    }).join("\n"),
  ].join("\n");

  return {
    method: "prompt_injection",
    content: promptInjection,
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
    })),
  };
}

/**
 * 为规划 Agent 构建知识应用
 * 影响页面结构规划和模块设计
 */
function buildPlanningAgentApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>,
  context: KnowledgeContext
): KnowledgeApplication {
  const compositionKnowledges = knowledges.filter((k) => k.type === "COMPOSITION");
  const sceneKnowledges = knowledges.filter((k) => k.type === "SCENE");
  const typographyKnowledges = knowledges.filter((k) => k.type === "TYPOGRAPHY");

  const promptInjection = [
    "## 构图规划参考",
    compositionKnowledges.map((k) => `- ${k.name}: ${k.description}`).join("\n"),
    "",
    "## 场景布置参考",
    sceneKnowledges.map((k) => `- ${k.name}: ${k.description}`).join("\n"),
    "",
    "## 文案排版参考",
    typographyKnowledges.map((k) => `- ${k.name}: ${k.description}`).join("\n"),
    "",
    "请在规划页面模块时，参考以上风格偏好进行设计。",
  ].join("\n");

  return {
    method: "prompt_injection",
    content: promptInjection,
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
    })),
  };
}

/**
 * 为生成 Agent 构建知识应用
 * 影响图片生成提示词和参考图片选择
 */
async function buildGenerationAgentApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>,
  context: KnowledgeContext
): Promise<KnowledgeApplication> {
  // 构建提示词增强
  const enhancement = await buildEnhancedPrompt(
    {
      sectionType: context.sectionType || "HERO",
      sectionTitle: context.sectionTitle || "",
      productCategory: context.productCategory,
    },
    undefined // 使用所有活跃知识
  );

  // 获取推荐参考图片
  const referenceImages = await getRecommendedReferenceImages(
    context,
    knowledges.map((k) => k.id)
  );

  return {
    method: "prompt_injection",
    content: {
      promptEnhancement: enhancement.enhancement,
      negativePrompt: buildNegativePrompt(knowledges),
      referenceImages: referenceImages.map((r) => ({
        id: r.id,
        filePath: r.filePath,
        reason: r.reason,
      })),
    },
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
    })),
  };
}

/**
 * 为导出 Agent 构建知识应用
 * 影响导出格式和样式
 */
function buildExportAgentApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>,
  context: KnowledgeContext
): KnowledgeApplication {
  const styleKnowledges = knowledges.filter((k) => k.type === "STYLE");
  const colorKnowledges = knowledges.filter((k) => k.type === "COLOR");

  const parameters = {
    style: styleKnowledges[0]?.name || "default",
    colorScheme: colorKnowledges.map((k) => {
      const attrs = k.attributes as Record<string, string>;
      return {
        primary: attrs.primaryColor,
        secondary: attrs.secondaryColor,
        accent: attrs.accentColor,
      };
    })[0],
  };

  return {
    method: "parameter_adjust",
    content: parameters,
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
    })),
  };
}

function buildGenericApplication(
  knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>
): KnowledgeApplication {
  const promptInjection = knowledges
    .map((k) => `[${k.type}] ${k.name}: ${k.promptSnippet || k.description}`)
    .join("\n");

  return {
    method: "prompt_injection",
    content: promptInjection,
    knowledges: knowledges.map((k) => ({
      id: k.id,
      type: k.type,
      name: k.name,
    })),
  };
}

function buildNegativePrompt(knowledges: Awaited<ReturnType<typeof getActiveKnowledges>>): string {
  const negativeParts = knowledges
    .map((k) => k.negativePrompt)
    .filter(Boolean) as string[];

  return [...new Set(negativeParts)].join(", ");
}

// ==================== 参考图片推荐 ====================

interface RecommendedReference {
  id: string;
  filePath: string;
  reason: string;
  matchScore: number;
}

async function getRecommendedReferenceImages(
  context: KnowledgeContext,
  knowledgeIds: string[]
): Promise<RecommendedReference[]> {
  // 查找与这些知识关联的学习图片
  const sources = await prisma.knowledgeSource.findMany({
    where: {
      knowledgeId: { in: knowledgeIds },
    },
    include: {
      image: {
        select: {
          id: true,
          filePath: true,
          fileName: true,
          analysisResult: true,
        },
      },
    },
    orderBy: {
      weight: "desc",
    },
    take: 10,
  });

  // 计算匹配分数并去重
  const uniqueImages = new Map<string, RecommendedReference>();

  for (const source of sources) {
    const existing = uniqueImages.get(source.imageId);
    if (existing) {
      existing.matchScore = Math.max(existing.matchScore, source.weight);
    } else {
      uniqueImages.set(source.imageId, {
        id: source.imageId,
        filePath: source.image.filePath,
        reason: `来源于学习知识: ${source.knowledgeId}`,
        matchScore: source.weight,
      });
    }
  }

  return Array.from(uniqueImages.values())
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}

// ==================== 快捷应用方法 ====================

/**
 * 获取增强的分析提示词
 */
export async function getEnhancedAnalysisPrompt(
  projectId: string,
  basePrompt: string
): Promise<string> {
  const application = await matchKnowledgesForContext(
    {
      agentType: "ANALYSIS",
      projectId,
    },
    { limit: 3 }
  );

  if (application.method === "prompt_injection" && typeof application.content === "string") {
    return `${basePrompt}\n\n${application.content}`;
  }

  return basePrompt;
}

/**
 * 获取增强的规划提示词
 */
export async function getEnhancedPlanningPrompt(
  projectId: string,
  basePrompt: string
): Promise<string> {
  const application = await matchKnowledgesForContext(
    {
      agentType: "PLANNING",
      projectId,
    },
    { limit: 3 }
  );

  if (application.method === "prompt_injection" && typeof application.content === "string") {
    return `${basePrompt}\n\n${application.content}`;
  }

  return basePrompt;
}

/**
 * 获取增强的生成配置
 */
export async function getEnhancedGenerationConfig(
  projectId: string,
  sectionId: string,
  sectionType: string,
  sectionTitle: string
): Promise<{
  promptEnhancement: string;
  negativePrompt: string;
  referenceImages: Array<{
    id: string;
    filePath: string;
    reason: string;
  }>;
}> {
  const application = await matchKnowledgesForContext(
    {
      agentType: "GENERATION",
      projectId,
      sectionId,
      sectionType,
      sectionTitle,
    },
    { limit: 5 }
  );

  if (
    application.method === "prompt_injection" &&
    typeof application.content === "object"
  ) {
    const content = application.content as {
      promptEnhancement: string;
      negativePrompt: string;
      referenceImages: Array<{
        id: string;
        filePath: string;
        reason: string;
      }>;
    };

    return {
      promptEnhancement: content.promptEnhancement || "",
      negativePrompt: content.negativePrompt || "",
      referenceImages: content.referenceImages || [],
    };
  }

  return {
    promptEnhancement: "",
    negativePrompt: "",
    referenceImages: [],
  };
}

// ==================== 知识库统计 ====================

export async function getKnowledgeStats(sessionId?: string) {
  const where: Prisma.StyleKnowledgeWhereInput = { isActive: true };
  if (sessionId) where.sessionId = sessionId;

  const [totalKnowledges, byType, topApplied] = await Promise.all([
    prisma.styleKnowledge.count({ where }),
    prisma.styleKnowledge.groupBy({
      by: ["type"],
      where,
      _count: { id: true },
    }),
    prisma.styleKnowledge.findMany({
      where,
      orderBy: { applyCount: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        applyCount: true,
        confidence: true,
      },
    }),
  ]);

  return {
    totalKnowledges,
    byType: byType.map((t) => ({
      type: t.type,
      count: t._count.id,
    })),
    topApplied,
  };
}
