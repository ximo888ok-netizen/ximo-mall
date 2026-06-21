/**
 * Agent Info API — 连接状态 & 可调用工具
 *
 * GET /api/agent/info
 *
 * 返回：
 * {
 *   "status": "ok",
 *   "agent": { "id": "...", "name": "..." },
 *   "tools": [
 *     { "id": "createProjectTool", "description": "..." },
 *     ...
 *   ],
 *   "timestamp": "..."
 * }
 */

import { mastra } from "@/mastra";
import { ok } from "@/lib/utils/route";

export async function GET() {
  const agent = mastra.getAgent("ximoMallAgent");

  // 从 Agent 实例提取工具信息
  const agentTools = agent.listTools();
  const tools = Object.entries(agentTools as Record<string, { description?: string }>).map(
    ([id, tool]) => ({
      id,
      description: tool.description ?? "",
    }),
  );

  return ok({
    status: "ok",
    agent: {
      id: agent.id,
      name: agent.name,
    },
    tools,
    timestamp: new Date().toISOString(),
  });
}

// CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
