/**
 * 知识应用约束服务
 * 控制智能体如何使用学习到的知识，防止越学越偏
 */

import { prisma } from "@/lib/db/prisma";
import type { KnowledgeType } from "@prisma/client";

// 约束检查上下文
interface ConstraintContext {
  agentType: string;
  projectId?: string;
  sessionId?: string;
}

// 约束检查结果
interface ConstraintCheckResult {
  passed: boolean;
  reason?: string;
  appliedPrompt?: string;
}

// 知识应用记录
interface KnowledgeApplyRecord {
  knowledgeId: string;
  agentType: string;
  projectId?: string;
  sessionId?: string;
  applyMethod: string;
  promptSnippet?: string;
  passedConstraints: boolean;
  failedReason?: string;
}

/**
 * 获取或创建默认约束配置
 */
export async function getOrCreateConstraints(agentType: string) {
  let constraints = await prisma.knowledgeConstraints.findUnique({
    where: { agentType },
  });

  if (!constraints) {
    // 创建默认约束
    constraints = await prisma.knowledgeConstraints.create({
      data: {
        agentType,
        minConfidence: 0.6,
        maxConfidence: 1.0,
        maxAppliesPerDay: 100,
        maxAppliesPerSession: 20,
        maxPromptLength: 800,
        enableNegative: true,
        trackEffectiveness: true,
        isActive: true,
      },
    });
  }

  return constraints;
}

/**
 * 更新约束配置
 */
export async function updateConstraints(
  agentType: string,
  updates: Partial<{
    minConfidence: number;
    maxConfidence: number;
    maxAppliesPerDay: number;
    maxAppliesPerSession: number;
    allowedTypes: KnowledgeType[];
    blockedTypes: KnowledgeType[];
    maxPromptLength: number;
    enableNegative: boolean;
    trackEffectiveness: boolean;
    isActive: boolean;
  }>
) {
  return prisma.knowledgeConstraints.upsert({
    where: { agentType },
    create: {
      agentType,
      ...updates,
    },
    update: updates,
  });
}

/**
 * 检查知识是否可以通过约束
 */
export async function checkKnowledgeConstraints(
  knowledgeId: string,
  context: ConstraintContext
): Promise<ConstraintCheckResult> {
  const knowledge = await prisma.styleKnowledge.findUnique({
    where: { id: knowledgeId },
  });

  if (!knowledge) {
    return { passed: false, reason: "知识不存在" };
  }

  if (!knowledge.isActive) {
    return { passed: false, reason: "知识已被禁用" };
  }

  // 获取约束配置
  const constraints = await getOrCreateConstraints(context.agentType);

  if (!constraints.isActive) {
    return { passed: false, reason: "约束系统已关闭" };
  }

  // 1. 置信度检查
  if (knowledge.confidence < constraints.minConfidence) {
    return {
      passed: false,
      reason: `置信度 ${knowledge.confidence} 低于最低阈值 ${constraints.minConfidence}`,
    };
  }

  if (knowledge.confidence > constraints.maxConfidence) {
    return {
      passed: false,
      reason: `置信度 ${knowledge.confidence} 超过最高阈值 ${constraints.maxConfidence}`,
    };
  }

  // 2. 知识类型检查
  if (constraints.allowedTypes) {
    const allowed = constraints.allowedTypes as string[];
    if (!allowed.includes(knowledge.type)) {
      return {
        passed: false,
        reason: `知识类型 ${knowledge.type} 不在允许列表中`,
      };
    }
  }

  if (constraints.blockedTypes) {
    const blocked = constraints.blockedTypes as string[];
    if (blocked.includes(knowledge.type)) {
      return {
        passed: false,
        reason: `知识类型 ${knowledge.type} 在禁止列表中`,
      };
    }
  }

  // 3. 应用频率检查
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayApplies = await prisma.knowledgeApplyLog.count({
    where: {
      knowledgeId,
      agentType: context.agentType,
      createdAt: { gte: today },
    },
  });

  if (todayApplies >= constraints.maxAppliesPerDay) {
    return {
      passed: false,
      reason: `今日应用次数 ${todayApplies} 已达上限 ${constraints.maxAppliesPerDay}`,
    };
  }

  // 4. 提示词长度检查
  let appliedPrompt = knowledge.promptSnippet || "";
  
  if (appliedPrompt.length > constraints.maxPromptLength) {
    // 截断提示词
    appliedPrompt = appliedPrompt.substring(0, constraints.maxPromptLength);
  }

  // 5. 负面提示词检查
  if (!constraints.enableNegative && knowledge.negativePrompt) {
    // 不应用负面提示词
  }

  return {
    passed: true,
    appliedPrompt,
  };
}

/**
 * 记录知识应用
 */
export async function logKnowledgeApply(
  record: KnowledgeApplyRecord
): Promise<void> {
  await prisma.knowledgeApplyLog.create({
    data: {
      knowledgeId: record.knowledgeId,
      agentType: record.agentType,
      projectId: record.projectId,
      sessionId: record.sessionId,
      applyMethod: record.applyMethod,
      promptSnippet: record.promptSnippet,
      passedConstraints: record.passedConstraints,
      failedReason: record.failedReason,
    },
  });

  // 如果通过约束，更新知识应用统计
  if (record.passedConstraints) {
    await prisma.styleKnowledge.update({
      where: { id: record.knowledgeId },
      data: {
        applyCount: { increment: 1 },
        lastAppliedAt: new Date(),
      },
    });
  }
}

/**
 * 获取知识应用统计
 */
export async function getKnowledgeStats(knowledgeId: string) {
  const [totalApplies, passedApplies, averageRating] = await Promise.all([
    prisma.knowledgeApplyLog.count({ where: { knowledgeId } }),
    prisma.knowledgeApplyLog.count({ where: { knowledgeId, passedConstraints: true } }),
    prisma.knowledgeApplyLog.aggregate({
      where: { knowledgeId, rating: { not: null } },
      _avg: { rating: true },
    }),
  ]);

  return {
    totalApplies,
    passedApplies,
    failedApplies: totalApplies - passedApplies,
    passRate: totalApplies > 0 ? passedApplies / totalApplies : 0,
    averageRating: averageRating._avg.rating || 0,
  };
}

/**
 * 获取效果不佳的知识列表（用于清理）
 */
export async function getUnderperformingKnowledges(
  minApplies: number = 10,
  minRating: number = 3
) {
  const logs = await prisma.knowledgeApplyLog.groupBy({
    by: ["knowledgeId"],
    where: { rating: { not: null } },
    _avg: { rating: true },
    _count: { knowledgeId: true },
    having: {
      rating: { _avg: { lt: minRating } },
      knowledgeId: { _count: { gte: minApplies } },
    },
  });

  return logs.map((log) => ({
    knowledgeId: log.knowledgeId,
    applyCount: log._count.knowledgeId,
    averageRating: log._avg.rating,
  }));
}

/**
 * 应用知识到提示词（带约束检查）
 */
export async function applyKnowledgeWithConstraints(
  knowledgeId: string,
  context: ConstraintContext,
  basePrompt: string
): Promise<{ prompt: string; applied: boolean; reason?: string }> {
  // 检查约束
  const checkResult = await checkKnowledgeConstraints(knowledgeId, context);

  // 记录应用尝试
  await logKnowledgeApply({
    knowledgeId,
    agentType: context.agentType,
    projectId: context.projectId,
    sessionId: context.sessionId,
    applyMethod: "prompt_injection",
    promptSnippet: checkResult.appliedPrompt,
    passedConstraints: checkResult.passed,
    failedReason: checkResult.reason,
  });

  if (!checkResult.passed) {
    return {
      prompt: basePrompt,
      applied: false,
      reason: checkResult.reason,
    };
  }

  // 将知识注入提示词
  const enhancedPrompt = `${basePrompt}\n\n[风格参考] ${checkResult.appliedPrompt}`;

  return {
    prompt: enhancedPrompt,
    applied: true,
  };
}
