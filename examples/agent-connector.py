"""
Ximo Mall Agent 连接器 (Python 版)

用于外部 Python 应用调用 Ximo Mall AI Agent。

安装依赖：
    pip install httpx

使用方式：
    agent = XimoMallAgent("http://localhost:3000")
    response = agent.chat("帮我生成红烧牛肉面详情页")
    print(response.text)
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator, Callable, Optional

import httpx


# ---------------------------------------------------------------------------
# 类型定义
# ---------------------------------------------------------------------------

@dataclass
class ToolCall:
    tool_name: str
    tool_call_id: str
    args: dict


@dataclass
class ToolResult:
    tool_name: str
    tool_call_id: str
    result: object


@dataclass
class AgentResponse:
    """Agent 完整响应"""
    text: str = ""
    reasoning: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    finish_reason: Optional[str] = None
    usage: Optional[dict] = None


@dataclass
class ChatOptions:
    """对话选项"""
    thread_id: Optional[str] = None
    resource_id: Optional[str] = None
    images: Optional[list[str]] = None
    on_text_delta: Optional[Callable[[str], None]] = None
    on_reasoning_delta: Optional[Callable[[str], None]] = None
    on_tool_call: Optional[Callable[[ToolCall], None]] = None
    on_tool_result: Optional[Callable[[ToolResult], None]] = None


# ---------------------------------------------------------------------------
# 连接器
# ---------------------------------------------------------------------------

class XimoMallAgent:
    """Ximo Mall AI Agent 客户端"""

    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip("/")

    def health(self) -> dict:
        """检查连接状态，status === 'ok' 表示正常"""
        import asyncio
        return asyncio.run(self.health_async())

    async def health_async(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/api/agent/chat")
            resp.raise_for_status()
            return resp.json()

    def tools(self) -> dict:
        """获取 Agent 可调用工具列表"""
        import asyncio
        return asyncio.run(self.tools_async())

    async def tools_async(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/api/agent/info")
            resp.raise_for_status()
            payload = resp.json()
            return payload.get("data", payload)

    def chat(
        self,
        message: str,
        history: list[dict] | None = None,
        options: ChatOptions | None = None,
    ) -> AgentResponse:
        """同步发送对话消息"""
        import asyncio
        return asyncio.run(self.chat_async(message, history, options))

    async def chat_async(
        self,
        message: str,
        history: list[dict] | None = None,
        options: ChatOptions | None = None,
    ) -> AgentResponse:
        """异步发送对话消息"""
        options = options or ChatOptions()
        messages = list(history or [])
        messages.append({"role": "user", "content": message})

        body: dict = {"messages": messages}
        if options.thread_id:
            body["threadId"] = options.thread_id
        if options.resource_id:
            body["resourceId"] = options.resource_id
        if options.images:
            body["images"] = options.images

        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/agent/chat",
                json=body,
                headers={"Content-Type": "application/json"},
            ) as response:
                response.raise_for_status()
                return await self._parse_sse_stream(response, options)

    # ------------------------------------------------------------------
    # SSE 解析
    # ------------------------------------------------------------------

    async def _parse_sse_stream(
        self,
        response: httpx.Response,
        options: ChatOptions,
    ) -> AgentResponse:
        result = AgentResponse()
        buffer = ""

        async for chunk in response.aiter_text():
            buffer += chunk
            parts = buffer.split("\n\n")
            buffer = parts.pop()  # 最后一段可能不完整

            for part in parts:
                event = self._parse_sse_event(part)
                if event is None:
                    continue

                event_type, data = event

                if event_type == "text":
                    delta = data.get("delta", "")
                    result.text += delta
                    if options.on_text_delta:
                        options.on_text_delta(delta)

                elif event_type == "reasoning":
                    delta = data.get("delta", "")
                    result.reasoning += delta
                    if options.on_reasoning_delta:
                        options.on_reasoning_delta(delta)

                elif event_type == "tool_call":
                    tc = ToolCall(
                        tool_name=data["toolName"],
                        tool_call_id=data["toolCallId"],
                        args=data.get("args", {}),
                    )
                    result.tool_calls.append(tc)
                    if options.on_tool_call:
                        options.on_tool_call(tc)

                elif event_type == "tool_result":
                    tr = ToolResult(
                        tool_name=data["toolName"],
                        tool_call_id=data["toolCallId"],
                        result=data.get("result"),
                    )
                    result.tool_results.append(tr)
                    if options.on_tool_result:
                        options.on_tool_result(tr)

                elif event_type == "done":
                    result.finish_reason = data.get("finishReason", "stop")
                    result.usage = data.get("usage")

                elif event_type == "error":
                    raise RuntimeError(data.get("message", "Agent 执行失败"))

        return result

    @staticmethod
    def _parse_sse_event(raw: str) -> tuple[str, dict] | None:
        event_type = "message"
        data_str = ""

        for line in raw.split("\n"):
            if line.startswith("event: "):
                event_type = line[7:].strip()
            elif line.startswith("data: "):
                data_str = line[6:]

        if not data_str:
            return None

        try:
            return event_type, json.loads(data_str)
        except json.JSONDecodeError:
            return None

    # ------------------------------------------------------------------
    # 图片工具
    # ------------------------------------------------------------------

    @staticmethod
    def image_file_to_data_url(file_path: str) -> str:
        """读取本地图片文件并转为 data URL"""
        path = Path(file_path)
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        mime_type = mime_map.get(path.suffix.lower(), "image/png")
        b64 = base64.b64encode(path.read_bytes()).decode()
        return f"data:{mime_type};base64,{b64}"


# ---------------------------------------------------------------------------
# 使用示例
# ---------------------------------------------------------------------------

async def main():
    agent = XimoMallAgent("http://localhost:3000")

    # 示例 1：简单对话
    response = await agent.chat_async("帮我生成红烧牛肉面详情页")
    print(f"回复: {response.text}")
    print(f"思考: {response.reasoning[:200]}...")
    print(f"工具调用: {len(response.tool_calls)} 次")

    # 示例 2：带图片的对话
    # image_url = XimoMallAgent.image_file_to_data_url("./product.jpg")
    # response = await agent.chat_async(
    #     "分析这张产品图",
    #     options=ChatOptions(images=[image_url]),
    # )

    # 示例 3：多轮对话（使用 threadId 保持记忆）
    # thread_id = "my-session-001"
    # r1 = await agent.chat_async(
    #     "帮我生成红烧牛肉面详情页",
    #     options=ChatOptions(thread_id=thread_id),
    # )
    # r2 = await agent.chat_async(
    #     "换一种风格",
    #     history=[{"role": "user", "content": "帮我生成红烧牛肉面详情页"}, {"role": "assistant", "content": r1.text}],
    #     options=ChatOptions(thread_id=thread_id),
    # )

    # 示例 4：实时流式回调
    # def on_text(delta: str):
    #     print(delta, end="", flush=True)
    #
    # response = await agent.chat_async(
    #     "生成详情页",
    #     options=ChatOptions(on_text_delta=on_text),
    # )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
