/**
 * 知识约束配置 API
 * 管理智能体的知识应用约束
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import type { KnowledgeType } from "@prisma/client";
import {
  getOrCreateConstraints,
  updateConstraints,
  getKnowledgeStats,
  getUnderperformingKnowledges,
} from "@/lib/services/knowledge-constraints-service";

// 更新约束请求体
const updateSchema = z.object({
  agentType: z.string(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxConfidence: z.number().min(0).max(1).optional(),
  maxAppliesPerDay: z.number().int().min(1).optional(),
  maxAppliesPerSession: z.number().int().min(1).optional(),
  allowedTypes: z.array(z.string()).optional(),
  blockedTypes: z.array(z.string()).optional(),
  maxPromptLength: z.number().int().min(100).optional(),
  enableNegative: z.boolean().optional(),
  trackEffectiveness: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET: 获取所有约束配置
export async function GET() {
  try {
    const agentTypes = ["ANALYSIS", "PLANNING", "GENERATION", "REVIEW"];
    
    const constraints = await Promise.all(
      agentTypes.map(async (agentType) => {
        const config = await getOrCreateConstraints(agentType);
        return {
          agentType: config.agentType,
          minConfidence: config.minConfidence,
          maxConfidence: config.maxConfidence,
          maxAppliesPerDay: config.maxAppliesPerDay,
          maxAppliesPerSession: config.maxAppliesPerSession,
          allowedTypes: config.allowedTypes,
          blockedTypes: config.blockedTypes,
          maxPromptLength: config.maxPromptLength,
          enableNegative: config.enableNegative,
          trackEffectiveness: config.trackEffectiveness,
          isActive: config.isActive,
          updatedAt: config.updatedAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: constraints,
    });
  } catch (error) {
    console.error("[API] Failed to get constraints:", error);
    return NextResponse.json(
      { success: false, error: "获取约束配置失败" },
      { status: 500 }
    );
  }
}

// POST: 更新约束配置
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const { agentType, ...updates } = data;

    const constraints = await updateConstraints(agentType, {
      ...updates,
      allowedTypes: updates.allowedTypes as KnowledgeType[] | undefined,
      blockedTypes: updates.blockedTypes as KnowledgeType[] | undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        agentType: constraints.agentType,
        minConfidence: constraints.minConfidence,
        maxConfidence: constraints.maxConfidence,
        maxAppliesPerDay: constraints.maxAppliesPerDay,
        maxAppliesPerSession: constraints.maxAppliesPerSession,
        allowedTypes: constraints.allowedTypes,
        blockedTypes: constraints.blockedTypes,
        maxPromptLength: constraints.maxPromptLength,
        enableNegative: constraints.enableNegative,
        trackEffectiveness: constraints.trackEffectiveness,
        isActive: constraints.isActive,
        updatedAt: constraints.updatedAt,
      },
    });
  } catch (error) {
    console.error("[API] Failed to update constraints:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "请求参数错误", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "更新约束配置失败" },
      { status: 500 }
    );
  }
}
