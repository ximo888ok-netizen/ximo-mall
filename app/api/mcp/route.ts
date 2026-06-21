import { NextRequest, NextResponse } from "next/server";

// MCP 服务器地址（可通过环境变量配置）
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, arguments: args } = body;

    if (!tool) {
      return NextResponse.json(
        { error: "缺少 tool 参数" },
        { status: 400 }
      );
    }

    // 转发请求到 MCP 服务器
    const mcpResponse = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: tool,
          arguments: args || {},
        },
      }),
    });

    const text = await mcpResponse.text();
    
    // 解析 MCP 响应（可能是 SSE 格式）
    let data;
    try {
      // 尝试直接解析 JSON
      data = JSON.parse(text);
    } catch {
      // 尝试解析 SSE 格式
      const jsonMatch = text.match(/data: (.+)/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[1]);
      } else {
        return NextResponse.json(
          { error: "无法解析 MCP 响应" },
          { status: 500 }
        );
      }
    }

    // 提取工具调用结果
    if (data.result) {
      const content = data.result.content || [];
      const textContent = content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      
      try {
        return NextResponse.json(JSON.parse(textContent));
      } catch {
        return NextResponse.json({ result: textContent });
      }
    }

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "工具调用失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("MCP API 错误:", error);
    return NextResponse.json(
      { error: "MCP 服务器连接失败，请确保 MCP 服务器已启动" },
      { status: 500 }
    );
  }
}

// 获取 MCP 服务器状态
export async function GET() {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/health`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { 
        status: "disconnected",
        error: "无法连接到 MCP 服务器",
        mcpServerUrl: MCP_SERVER_URL,
      },
      { status: 503 }
    );
  }
}
