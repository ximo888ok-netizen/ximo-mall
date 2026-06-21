# Ximo Mall Agent API 接口文档

> **版本**: 1.0
> **基础地址**: `http://localhost:3000`
> **适用场景**: 本地 / 内网外部应用调用 Ximo Mall AI Agent

---

## 目录

1. [概述](#1-概述)
2. [连接检查](#2-连接检查)
3. [工具列表](#3-工具列表)
4. [对话接口](#4-对话接口)
5. [SSE 事件参考](#5-sse-事件参考)
6. [Python SDK](#6-python-sdk)
7. [完整示例](#7-完整示例)

---

## 1. 概述

Ximo Mall Agent API 提供三个端点，支持外部应用与内置 AI Agent 进行对话式交互：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/agent/chat` | GET | 连接健康检查 |
| `/api/agent/info` | GET | 获取 Agent 信息和可调用工具列表 |
| `/api/agent/chat` | POST | 发送对话消息（SSE 流式响应） |

**通用约定：**
- 所有接口支持 CORS（`Access-Control-Allow-Origin: *`）
- 请求和响应均使用 JSON 格式
- 对话接口响应为 SSE（Server-Sent Events）流

---

## 2. 连接检查

检查 Agent 服务是否可用。

### 请求

```
GET /api/agent/chat
```

### 响应

```json
{
  "status": "ok",
  "endpoint": "/api/agent/chat",
  "method": "POST",
  "contentType": "text/event-stream",
  "events": ["text", "reasoning", "tool_call", "tool_result", "done", "error"],
  "timestamp": "2026-06-16T10:30:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"ok"` 表示服务正常 |
| `endpoint` | string | 对话端点路径 |
| `events` | string[] | 支持的 SSE 事件类型 |
| `timestamp` | string | 服务器当前时间（ISO 8601） |

### Python 调用

```python
import httpx

resp = httpx.get("http://localhost:3000/api/agent/chat")
data = resp.json()
if data["status"] == "ok":
    print("Agent 服务正常")
```

---

## 3. 工具列表

获取 Agent 的身份信息和可调用工具列表。

### 请求

```
GET /api/agent/info
```

### 响应

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "agent": {
      "id": "ximo-mall-agent",
      "name": "Ximo Mall AI Agent"
    },
    "tools": [
      {
        "id": "createProjectTool",
        "description": "创建新项目并上传产品图片，初始化详情页模块结构"
      },
      {
        "id": "planSectionsTool",
        "description": "规划详情页各模块的文案和视觉方向"
      },
      {
        "id": "generateHeroImageTool",
        "description": "生成详情页头图（主视觉图）"
      },
      {
        "id": "generateDetailImageTool",
        "description": "生成详情页内容图（卖点图、场景图、细节图等）"
      },
      {
        "id": "editImageTool",
        "description": "对已生成的图片进行整体重绘或增强"
      },
      {
        "id": "refineImageTool",
        "description": "对已生成的图片进行定向微调（局部修改）"
      },
      {
        "id": "upscaleImageTool",
        "description": "对已生成的图片进行超分高清放大"
      },
      {
        "id": "updateSectionTool",
        "description": "更新详情页某个模块的文案或视觉提示词"
      },
      {
        "id": "approvePlanningReviewTool",
        "description": "审核并确认规划方案"
      },
      {
        "id": "webSearchTool",
        "description": "联网搜索产品相关信息"
      }
    ],
    "timestamp": "2026-06-16T10:30:00.000Z"
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent.id` | string | Agent 标识符 |
| `agent.name` | string | Agent 显示名称 |
| `tools` | array | 可调用工具列表 |
| `tools[].id` | string | 工具标识符（SSE 事件中 `toolName` 对应此值） |
| `tools[].description` | string | 工具功能描述 |

### Python 调用

```python
import httpx

resp = httpx.get("http://localhost:3000/api/agent/info")
data = resp.json()["data"]
print(f"Agent: {data['agent']['name']}")
for tool in data["tools"]:
    print(f"  - {tool['id']}: {tool['description']}")
```

---

## 4. 对话接口

与 Agent 进行对话，Agent 会自动调度工具完成任务。响应为 SSE 流式格式。

### 请求

```
POST /api/agent/chat
Content-Type: application/json
```

### 请求体

```json
{
  "messages": [
    { "role": "user", "content": "帮我生成红烧牛肉面详情页" }
  ],
  "threadId": "可选，会话线程ID",
  "resourceId": "可选，资源ID",
  "images": ["可选，data URL 数组"]
}
```

### 请求字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messages` | array | 是 | 对话消息列表，至少包含一条 `role: "user"` 的消息 |
| `threadId` | string | 否 | 会话线程 ID，传入相同值可保持多轮对话记忆 |
| `resourceId` | string | 否 | 资源 ID，用于关联特定资源 |
| `images` | string[] | 否 | 图片 data URL 数组，自动关联到最后一条用户消息 |

### messages 格式

```json
[
  { "role": "user", "content": "用户消息文本" },
  { "role": "assistant", "content": "Agent 回复文本" }
]
```

- `role`: `"user"` 或 `"assistant"`
- `content`: 消息文本内容

### images 格式

图片使用 data URL 编码，格式为 `data:<mime>;base64,<数据>`：

```json
{
  "images": [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
  ]
}
```

支持的图片格式：`image/png`、`image/jpeg`、`image/webp`、`image/gif`

### 响应

响应为 SSE（Server-Sent Events）流，`Content-Type: text/event-stream`。

每个事件的格式：

```
event: <事件类型>
data: <JSON 数据>

```

### Python 调用（原始 HTTP）

```python
import httpx
import json

body = {
    "messages": [
        {"role": "user", "content": "帮我生成红烧牛肉面详情页"}
    ]
}

with httpx.stream("POST", "http://localhost:3000/api/agent/chat", json=body, timeout=300) as resp:
    resp.raise_for_status()
    for line in resp.iter_lines():
        if line.startswith("event: "):
            event_type = line[7:]
        elif line.startswith("data: "):
            data = json.loads(line[6:])
            # 处理事件...
```

---

## 5. SSE 事件参考

### 5.1 `text` — 文本片段

Agent 回复的文本内容，逐片段推送。拼接所有 `delta` 即为完整回复。

```
event: text
data: {"delta": "好的"}

event: text
data: {"delta": "，我来帮你"}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `delta` | string | 文本片段 |

### 5.2 `reasoning` — 思考过程

Agent 的深度思考链路，展示推理过程。

```
event: reasoning
data: {"delta": "用户需要生成红烧牛肉面详情页..."}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `delta` | string | 思考片段 |

### 5.3 `tool_call` — 工具调用

Agent 调用某个工具，包含工具名和参数。

```
event: tool_call
data: {"toolName": "createProjectTool", "toolCallId": "call_abc123", "args": {"productName": "红烧牛肉面"}}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `toolName` | string | 工具标识符（与 `/api/agent/info` 中的 `id` 对应） |
| `toolCallId` | string | 本次调用的唯一 ID，用于关联 `tool_result` |
| `args` | object | 工具调用参数 |

### 5.4 `tool_result` — 工具返回

工具执行完毕后返回的结果。

```
event: tool_result
data: {"toolName": "createProjectTool", "toolCallId": "call_abc123", "result": {"projectId": "proj_xxx", "status": "created"}}
```

**图片生成工具的返回**（`generateHeroImageTool`、`generateDetailImageTool`、`editImageTool`、`refineImageTool`、`upscaleImageTool`）：

```
event: tool_result
data: {
  "toolName": "generateHeroImageTool",
  "toolCallId": "call_def456",
  "result": {
    "success": true,
    "imageAssetId": "asset_abc123",
    "imageUrl": "http://localhost:3000/api/files/generated/proj_xxx/hero/1686900000-abc123.png"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `toolName` | string | 工具标识符 |
| `toolCallId` | string | 与 `tool_call` 中的 ID 对应 |
| `result` | object | 工具返回结果 |
| `result.success` | boolean | 是否成功 |
| `result.imageUrl` | string | **完整可访问的图片 URL**（可直接用 HTTP GET 下载图片） |
| `result.imageAssetId` | string | 图片资产 ID（用于后续编辑/精修/超分操作） |
| `result.error` | string | 失败时的错误信息 |

> **注意**: `imageUrl` 已自动从相对路径转为完整 URL（如 `http://localhost:3000/api/files/...`），外部应用可直接通过此 URL 下载图片，无需额外拼接。

### 5.5 `done` — 对话结束

Agent 完成所有回复和工具调用。

```
event: done
data: {"finishReason": "stop", "usage": {"promptTokens": 1500, "completionTokens": 800}}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `finishReason` | string | 结束原因：`"stop"`（正常结束）、`"tool-calls"`（等待工具结果后继续）、`"length"`（达到长度限制） |
| `usage` | object \| null | Token 用量统计 |

### 5.6 `error` — 错误

执行过程中发生错误。

```
event: error
data: {"message": "AI Provider 额度用尽"}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `message` | string | 错误描述 |

### 5.7 事件时序

一次完整的 Agent 对话，事件按以下时序出现：

```
reasoning (可选，思考过程)
  → text (回复文本，可能穿插多段)
  → tool_call (调用工具)
  → tool_result (工具返回)
  → [重复 tool_call / tool_result ...]
  → text (基于工具结果继续回复)
  → done (结束)
```

---

## 6. Python SDK

### 6.1 安装

```bash
pip install httpx
```

将 `agent-connector.py` 复制到项目中即可使用。

### 6.2 BananaMallAgent 类

```python
from agent_connector import BananaMallAgent, ChatOptions, AgentResponse
```

#### 构造函数

```python
agent = BananaMallAgent(base_url="http://localhost:3000")
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `base_url` | str | `"http://localhost:3000"` | Ximo Mall 服务地址 |

#### health() — 连接检查

```python
result = agent.health()
# {"status": "ok", "timestamp": "..."}
```

#### tools() — 工具列表

```python
result = agent.tools()
# {"agent": {...}, "tools": [...]}
```

#### chat() — 同步对话

```python
response = agent.chat(
    message: str,                    # 用户消息
    history: list[dict] | None = None,  # 历史对话
    options: ChatOptions | None = None, # 选项
) -> AgentResponse
```

#### chat_async() — 异步对话

```python
response = await agent.chat_async(
    message: str,
    history: list[dict] | None = None,
    options: ChatOptions | None = None,
) -> AgentResponse
```

### 6.3 ChatOptions 选项

```python
ChatOptions(
    thread_id="会话线程ID",           # 多轮对话记忆
    resource_id="资源ID",            # 关联资源
    images=["data:image/png;base64,..."],  # 图片 data URL
    on_text_delta=lambda delta: ...,      # 文本片段回调
    on_reasoning_delta=lambda delta: ..., # 思考片段回调
    on_tool_call=lambda call: ...,        # 工具调用回调
    on_tool_result=lambda result: ...,    # 工具结果回调
)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `thread_id` | str \| None | 会话线程 ID，传入相同值保持对话记忆 |
| `resource_id` | str \| None | 资源 ID |
| `images` | list[str] \| None | 图片 data URL 列表 |
| `on_text_delta` | Callable[[str], None] \| None | 实时文本片段回调 |
| `on_reasoning_delta` | Callable[[str], None] \| None | 实时思考片段回调 |
| `on_tool_call` | Callable[[ToolCall], None] \| None | 工具调用回调 |
| `on_tool_result` | Callable[[ToolResult], None] \| None | 工具结果回调 |

### 6.4 AgentResponse 响应

```python
@dataclass
class AgentResponse:
    text: str                    # Agent 完整回复文本
    reasoning: str               # Agent 思考过程
    tool_calls: list[ToolCall]   # 工具调用记录
    tool_results: list[ToolResult]  # 工具返回结果
    finish_reason: str | None    # 结束原因
    usage: dict | None           # Token 用量
```

### 6.5 图片工具

```python
# 读取本地图片文件并转为 data URL
data_url = BananaMallAgent.image_file_to_data_url("./product.jpg")
```

支持格式：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`

---

## 7. 完整示例

### 7.1 简单对话

```python
from agent_connector import BananaMallAgent

agent = BananaMallAgent("http://localhost:3000")

# 检查连接
health = agent.health()
print(f"服务状态: {health['status']}")

# 发送消息
response = agent.chat("帮我生成红烧牛肉面详情页")
print(f"回复: {response.text}")
print(f"思考: {response.reasoning[:200]}...")
print(f"工具调用: {len(response.tool_calls)} 次")
```

### 7.2 带图片的对话

```python
from agent_connector import BananaMallAgent, ChatOptions

agent = BananaMallAgent("http://localhost:3000")

# 读取本地产品图
image_url = BananaMallAgent.image_file_to_data_url("./product.jpg")

# 发送带图片的消息
response = agent.chat(
    "分析这张产品图并生成详情页",
    options=ChatOptions(images=[image_url]),
)
print(response.text)
```

### 7.3 多轮对话

```python
from agent_connector import BananaMallAgent, ChatOptions

agent = BananaMallAgent("http://localhost:3000")
thread_id = "my-session-001"

# 第一轮
r1 = agent.chat(
    "帮我生成红烧牛肉面详情页",
    options=ChatOptions(thread_id=thread_id),
)
print(f"第一轮: {r1.text[:100]}...")

# 第二轮（带上历史记录）
r2 = agent.chat(
    "换一种极简风格",
    history=[
        {"role": "user", "content": "帮我生成红烧牛肉面详情页"},
        {"role": "assistant", "content": r1.text},
    ],
    options=ChatOptions(thread_id=thread_id),
)
print(f"第二轮: {r2.text[:100]}...")
```

### 7.4 实时流式输出

```python
from agent_connector import BananaMallAgent, ChatOptions

agent = BananaMallAgent("http://localhost:3000")

# 实时打印 Agent 回复
def on_text(delta: str):
    print(delta, end="", flush=True)

def on_tool_call(call):
    print(f"\n[调用工具: {call.tool_name}]")

def on_tool_result(result):
    print(f"[工具返回: {result.tool_name}]")

response = agent.chat(
    "帮我生成红烧牛肉面详情页",
    options=ChatOptions(
        on_text_delta=on_text,
        on_tool_call=on_tool_call,
        on_tool_result=on_tool_result,
    ),
)
```

### 7.5 异步用法

```python
import asyncio
from agent_connector import BananaMallAgent, ChatOptions

async def main():
    agent = BananaMallAgent("http://localhost:3000")

    # 异步对话
    response = await agent.chat_async("帮我生成红烧牛肉面详情页")
    print(response.text)

    # 异步健康检查
    health = await agent.health_async()
    print(health["status"])

asyncio.run(main())
```

### 7.6 查看可调用工具

```python
from agent_connector import BananaMallAgent

agent = BananaMallAgent("http://localhost:3000")

info = agent.tools()
print(f"Agent: {info['agent']['name']}")
print("可调用工具:")
for tool in info["tools"]:
    print(f"  {tool['id']}: {tool['description']}")
```

### 7.7 获取生成的图片

Agent 生成图片后，`tool_result` 事件中包含 `imageUrl`，可直接下载。

```python
from agent_connector import BananaMallAgent, ChatOptions
import httpx

agent = BananaMallAgent("http://localhost:3000")

# 收集所有生成的图片 URL
image_urls = []

def on_tool_result(result):
    if result.result and isinstance(result.result, dict):
        if result.result.get("success") and result.result.get("imageUrl"):
            image_urls.append(result.result["imageUrl"])
            print(f"图片已生成: {result.result['imageUrl']}")

response = agent.chat(
    "帮我生成红烧牛肉面详情页",
    options=ChatOptions(on_tool_result=on_tool_result),
)

# 下载所有生成的图片
for i, url in enumerate(image_urls):
    img_resp = httpx.get(url)
    with open(f"output_{i + 1}.png", "wb") as f:
        f.write(img_resp.content)
    print(f"已保存: output_{i + 1}.png")
```

也可以从 `response.tool_results` 中事后提取：

```python
response = agent.chat("帮我生成红烧牛肉面详情页")

for tr in response.tool_results:
    if isinstance(tr.result, dict) and tr.result.get("success"):
        url = tr.result.get("imageUrl")
        if url:
            print(f"图片 URL: {url}")
            # 下载图片
            img_data = httpx.get(url).content
            with open("generated_image.png", "wb") as f:
                f.write(img_data)
```

---

## 附录：错误处理

| 场景 | 处理方式 |
|------|---------|
| 服务未启动 | `httpx.ConnectError`，检查服务是否运行 |
| 请求格式错误 | HTTP 400，检查 JSON 格式 |
| Agent 执行出错 | SSE `error` 事件，`data.message` 包含错误描述 |
| AI Provider 额度用尽 | SSE `error` 事件，检查 Provider 配置 |
| 超时 | `httpx.TimeoutException`，建议设置 `timeout=300` |

```python
import httpx
from agent_connector import BananaMallAgent

agent = BananaMallAgent("http://localhost:3000")

try:
    response = agent.chat("生成详情页")
except httpx.ConnectError:
    print("无法连接 Agent 服务，请检查服务是否启动")
except httpx.TimeoutException:
    print("请求超时，Agent 可能正在执行耗时操作")
except RuntimeError as e:
    print(f"Agent 执行错误: {e}")
```
