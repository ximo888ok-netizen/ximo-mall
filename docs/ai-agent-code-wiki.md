# AI Agent 模块 Code Wiki

> **项目**: ximo-mall — AI 电商详情页生成与编辑工作台
> **模块**: AI Agent（对话式 AI 交互入口）
> **技术栈**: Mastra + AI SDK + React + TypeScript + Prisma (SQLite)
> **文档版本**: v1.0 | 2026-06-11

---

## 目录

1. [模块概述](#1-模块概述)
2. [整体架构](#2-整体架构)
3. [目录结构](#3-目录结构)
4. [核心组件详解](#4-核心组件详解)
   - [4.1 前端页面 — `app/ai-agent/page.tsx`](#41-前端页面--appai-agentpagetsx)
   - [4.2 前端组件 — `components/ai-agent/ai-agent-workspace.tsx`](#42-前端组件--componentsai-agentai-agent-workspacetsx)
   - [4.3 对话侧边栏 — `components/ai-agent/conversation-sidebar.tsx`](#43-对话侧边栏--componentsai-agentconversation-sidebartsx)
   - [4.4 Chat API 路由 — `app/api/ai-agent/chat/route.ts`](#44-chat-api-路由--appapiai-agentchatroutets)
   - [4.5 Threads API 路由 — `app/api/ai-agent/threads/route.ts`](#45-threads-api-路由--appapiai-agentthreadsroutets)
   - [4.6 Mastra 入口 — `mastra/index.ts`](#46-mastra-入口--mastraindexts)
   - [4.7 Agent 定义 — `mastra/agents/ximo-mall-agent.ts`](#47-agent-定义--mastraagentsximo-mall-agentts)
   - [4.8 Model Provider — `mastra/model-provider.ts`](#48-model-provider--mastramodel-providerts)
   - [4.9 Tool: createProjectTool](#49-tool-createprojecttool)
   - [4.10 Tool: analyzeProductTool](#410-tool-analyzeproducttool)
   - [4.11 Tool: planSectionsTool](#411-tool-plansectionstool)
   - [4.12 Tool: generateHeroImageTool](#412-tool-generateheroimagetool)
   - [4.13 Tool: generateDetailImageTool](#413-tool-generatedetailimagetool)
   - [4.14 Tool: editImageTool](#414-tool-editimagetool)
   - [4.15 Tool: webSearchTool](#415-tool-websearchtool)
5. [数据流详解](#5-数据流详解)
6. [关键类与函数说明](#6-关键类与函数说明)
7. [依赖关系](#7-依赖关系)
8. [项目运行方式](#8-项目运行方式)

---

## 1. 模块概述

AI Agent 模块是 ximo-mall 的**对话式 AI 交互入口**，基于 [Mastra](https://mastra.ai/) 框架构建。用户通过自然语言对话，驱动 AI 自动完成电商详情页的完整生成流程：创建项目 → 搜索竞品 → 分析商品 → 规划页面 → 生成图片 → 汇报结果。

### 核心能力

| 能力 | 说明 |
|------|------|
| **多轮对话** | 基于 Mastra Memory + LibSQL 持久化存储，支持对话历史管理与多线程隔离 |
| **7 个专用工具** | 创建项目、商品分析、页面规划、头图生成、详情图生成、图像编辑、联网搜索 |
| **双模式运行** | 自动模式（全自动 6 步流程）与问答模式（每步确认） |
| **联网搜索** | 集成百度 AI 搜索，搜索竞品详情页视觉参考和行业趋势 |
| **多图上传** | 支持上传多张商品图片，自动标注主图/详情图/参考图 |
| **平台/风格选择** | 支持 5 个电商平台 + 20 种视觉风格 + 自定义生成张数 |
| **流式响应** | 基于 AI SDK 的 Server-Sent Events 流式传输，实时展示思考过程与工具调用状态 |

### 主控模型

- **deepseek-v4-flash-260425**：纯文本调度器，负责理解用户意图、调度工具链、审核返回结果
- 该模型**不支持图像输入**，图片处理通过工具链委托给专门的视觉模型

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端 (React Client)                          │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │  ConversationSidebar │    │     AiAgentWorkspace              │   │
│  │  - 对话列表 CRUD      │    │  - useChat (AI SDK)              │   │
│  │  - 线程切换/删除      │    │  - 消息气泡渲染                   │   │
│  │  - 新建对话           │    │  - 工具调用状态展示               │   │
│  └──────────────────────┘    │  - 平台/风格/模式/张数选择器       │   │
│                               │  - 图片上传预览                    │   │
│                               │  - 联网搜索开关                    │   │
│                               └───────────┬──────────────────────┘   │
│                                           │                          │
│                               POST /api/ai-agent/chat                │
│                               GET/POST/DELETE /api/ai-agent/threads  │
└───────────────────────────────────────────┼──────────────────────────┘
                                            │
┌───────────────────────────────────────────┼──────────────────────────┐
│                          Next.js API Route                           │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  app/api/ai-agent/chat/route.ts                                │  │
│  │  - 接收消息 + extras (platform, style, mode, images, etc.)     │  │
│  │  - 剥离文件 parts（主控模型不支持图像）                         │  │
│  │  - 构建 RequestContext（注入 Mastra reserved keys）            │  │
│  │  - 调用 handleChatStream → 流式返回                            │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  app/api/ai-agent/threads/route.ts                             │  │
│  │  - GET: 列出所有对话线程                                       │  │
│  │  - POST: 创建新对话线程                                        │  │
│  │  - DELETE: 删除对话线程                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────┼──────────────────────────┘
                                            │
┌───────────────────────────────────────────┼──────────────────────────┐
│                       Mastra Agent Framework                         │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  mastra/index.ts                                               │  │
│  │  - Mastra 实例化（注册 Agent + LibSQL 存储）                    │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  mastra/agents/ximo-mall-agent.ts                            │  │
│  │  - Agent 定义（id, name, instructions, model, memory, tools）  │  │
│  │  - 7 个工具注册                                                │  │
│  │  - 动态模型 Provider（从数据库获取配置）                        │  │
│  └───────┬───────────────────────────────────────────────────────┘  │
│          │                                                           │
│  ┌───────┴───────────────────────────────────────────────────────┐  │
│  │  mastra/tools/  (7 个独立 Tool)                                │  │
│  │  ├── create-project.ts      创建项目 + 上传图片 + 初始化模块    │  │
│  │  ├── analyze-product.ts     商品分析（doubao-seed-2-0-lite）   │  │
│  │  ├── plan-sections.ts       页面规划（deepseek-v4-flash）      │  │
│  │  ├── generate-hero-image.ts 头图生成（wan2.7-image）           │  │
│  │  ├── generate-detail-image.ts 详情图生成（wan2.7-image）       │  │
│  │  ├── edit-image.ts          图像编辑（wan2.7-image）           │  │
│  │  └── web-search.ts          联网搜索（百度 AI 搜索）           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  mastra/model-provider.ts                                      │  │
│  │  - 动态从数据库获取 Provider 配置                              │  │
│  │  - 创建 AI SDK 兼容的 OpenAI Compatible 实例                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
            ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
            │  Prisma DB    │    │  lib/services/    │    │  外部 AI API      │
            │  (SQLite)     │    │  - analysis       │    │  - deepseek       │
            │               │    │  - planner        │    │  - doubao         │
            │               │    │  - generation     │    │  - wan2.7         │
            │               │    │  - provider       │    │  - 百度 AI 搜索    │
            └──────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 3. 目录结构

```
ximo-mall/
├── app/
│   ├── ai-agent/
│   │   └── page.tsx                          # 前端页面入口
│   └── api/ai-agent/
│       ├── chat/
│       │   └── route.ts                      # Agent 对话流式 API
│       └── threads/
│           └── route.ts                      # 对话线程 CRUD API
├── components/ai-agent/
│   ├── ai-agent-workspace.tsx                # 主工作台组件（核心 UI）
│   └── conversation-sidebar.tsx              # 左侧对话列表侧边栏
├── mastra/
│   ├── index.ts                              # Mastra 框架入口
│   ├── model-provider.ts                     # 动态 Provider 实例创建
│   ├── agents/
│   │   └── ximo-mall-agent.ts              # Agent 定义（instructions + tools）
│   └── tools/
│       ├── create-project.ts                 # 创建项目工具
│       ├── analyze-product.ts                # 商品分析工具
│       ├── plan-sections.ts                  # 页面规划工具
│       ├── generate-hero-image.ts            # 头图生成工具
│       ├── generate-detail-image.ts          # 详情图生成工具
│       ├── edit-image.ts                     # 图像编辑工具
│       └── web-search.ts                     # 联网搜索工具
├── lib/
│   ├── db/prisma.ts                          # Prisma 客户端单例
│   ├── services/
│   │   ├── analysis-service.ts               # 商品分析服务（被 analyzeProductTool 调用）
│   │   ├── planner-service.ts                # 页面规划服务（被 planSectionsTool 调用）
│   │   ├── generation-service.ts             # 图像生成服务（被 3 个图像 Tool 调用）
│   │   └── provider-service.ts               # Provider 管理服务（被 model-provider 调用）
│   ├── storage/asset-manager.ts              # 资产管理（被 createProjectTool 调用）
│   └── utils/route.ts                        # API 响应工具（ok/fail/handleRouteError）
├── types/domain.ts                           # 领域类型（platformLabels, styleLabels, styleCategories）
└── storage/
    └── agent-memory.db                       # Agent 对话记忆数据库（LibSQL）
```

---

## 4. 核心组件详解

### 4.1 前端页面 — `app/ai-agent/page.tsx`

[page.tsx](file:///f:/ximo-mall-main/app/ai-agent/page.tsx)

```typescript
import { AiAgentWorkspace } from "@/components/ai-agent/ai-agent-workspace";
export const dynamic = "force-dynamic";

export default async function AiAgentPage() {
  return <AiAgentWorkspace />;
}
```

- **职责**: 页面入口，渲染主工作台组件
- **`dynamic = "force-dynamic"`**: 强制动态渲染，禁用静态生成缓存
- 无额外数据获取，所有状态管理下沉到客户端组件

---

### 4.2 前端组件 — `components/ai-agent/ai-agent-workspace.tsx`

[ai-agent-workspace.tsx](file:///f:/ximo-mall-main/components/ai-agent/ai-agent-workspace.tsx)（1040 行）

这是 AI Agent 模块最核心的前端组件，负责整个对话交互 UI。

#### 状态管理

| 状态变量 | 类型 | 说明 |
|----------|------|------|
| `currentThreadId` | `string \| null` | 当前活跃的对话线程 ID |
| `attachedFiles` | `Array<{file, label}>` | 用户上传的图片文件列表 |
| `inputText` | `string` | 输入框文本 |
| `platform` | `PlatformKey \| null` | 选中的电商平台 |
| `style` | `string \| null` | 选中的视觉风格 |
| `mode` | `"auto" \| "interactive" \| null` | 运行模式 |
| `heroCount` | `number` (默认 3) | 头图生成张数 |
| `detailCount` | `number` (默认 6) | 详情图生成张数 |
| `webSearch` | `boolean` | 是否启用联网搜索 |
| `expandedSelector` | `"platform" \| "style" \| "mode" \| "count" \| null` | 当前展开的选择器面板 |

#### 核心函数

**`handleFormSubmit`** — 表单提交处理（第 239-337 行）

```
流程:
1. 构建配置前缀字符串 [平台: xxx | 风格: xxx | 模式: xxx | 主图: N张 | 详情: N张]
2. 构建 extras 对象（platform, style, mode, heroCount, detailCount, webSearch）
3. 处理上传图片：FileReader 读取为 base64 → 序列化为 JSON → 存入 extras.images
4. 调用 sendMessage({ text }, { body: { ...extras, threadId, resourceId } })
5. 清空输入框和附件列表
```

**`useChat` Hook** — AI SDK 集成（第 139-143 行）

```typescript
const { messages, sendMessage, status, setMessages } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/ai-agent/chat",
  }),
});
```

- 使用 `@ai-sdk/react` 的 `useChat` Hook
- `DefaultChatTransport` 处理 HTTP 流式通信
- `messages` 包含完整的对话历史（含 tool-call parts）
- `status` 反映当前流式状态：`"submitted"` | `"streaming"` | `"ready"` | `"error"`

**消息渲染** — 支持 5 种 part 类型

| Part 类型 | 渲染方式 |
|-----------|----------|
| `text` | 文本气泡，流式输出时显示闪烁光标 |
| `file` (image) | 用户上传的图片缩略图 |
| `reasoning` | 紫色背景的"思考中"面板（模型推理过程） |
| `dynamic-tool` / `tool-*` | 工具调用卡片（含状态图标、结果摘要、生成图片预览） |
| 无 parts（assistant 等待中） | 三点跳动动画 |

**工具调用状态展示**

```
状态颜色映射:
- running (input-streaming / input-available) → 琥珀色 (Loader2 旋转)
- output-available + success → 翠绿色 (CheckCircle2)
- output-error / output-denied → 红色 (XCircle)
- 其他 → 灰色 (Wrench)
```

**选择器面板** — 4 组可展开的选择器

| 选择器 | 选项 | 图标 |
|--------|------|------|
| 平台 | 抖音电商 / 拼多多 / 淘宝天猫 / 通用电商 | Monitor |
| 风格 | 20 种风格，按 5 大类分组（摄影写实/插画艺术/促销营销/场景叙事/概念创意） | Palette |
| 模式 | 自动模式 / 问答模式 | Zap |
| 张数 | 主图 0-9 张 / 详情 0-12 张 | Camera |
| 联网搜索 | 开关 toggle | Globe |

**线程切换缓存** — `threadMessagesCacheRef`

```typescript
const threadMessagesCacheRef = useRef<Map<string, typeof messages>>(new Map());
```

- 切换线程时保存当前线程消息到 Map
- 切回时从缓存恢复，避免重复请求

---

### 4.3 对话侧边栏 — `components/ai-agent/conversation-sidebar.tsx`

[conversation-sidebar.tsx](file:///f:/ximo-mall-main/components/ai-agent/conversation-sidebar.tsx)（195 行）

#### Props

| Prop | 类型 | 说明 |
|------|------|------|
| `currentThreadId` | `string \| null` | 当前选中的线程 ID |
| `onSelectThread` | `(threadId: string) => void` | 选择线程回调 |
| `onNewConversation` | `(threadId?: string \| null) => void` | 新建/清空对话回调 |

#### 核心函数

| 函数 | 说明 |
|------|------|
| `fetchThreads()` | GET `/api/ai-agent/threads` 获取对话列表 |
| `handleCreateThread()` | POST `/api/ai-agent/threads` 创建新对话，自动选中 |
| `handleDeleteThread(e, threadId)` | DELETE `/api/ai-agent/threads` 删除对话，若为当前对话则清空 |

#### UI 结构

```
┌──────────────────────┐
│  [新建对话] 按钮       │
├──────────────────────┤
│  ┌─────────────────┐ │
│  │ 💬 对话标题      │ │  ← hover 显示删除按钮
│  │    3分钟前       │ │
│  ├─────────────────┤ │
│  │ 💬 对话标题      │ │  ← 当前选中高亮
│  │    1小时前       │ │
│  └─────────────────┘ │
└──────────────────────┘
```

---

### 4.4 Chat API 路由 — `app/api/ai-agent/chat/route.ts`

[chat/route.ts](file:///f:/ximo-mall-main/app/api/ai-agent/chat/route.ts)（73 行）

#### 请求格式

```json
{
  "messages": [
    { "role": "user", "parts": [{ "type": "text", "text": "..." }, { "type": "file", "url": "blob:...", "mediaType": "image/png", "filename": "product.png" }] }
  ],
  "threadId": "thread_xxx",
  "resourceId": "ximo-mall-user",
  "platform": "douyin_ecommerce",
  "style": "minimalist",
  "mode": "auto",
  "heroCount": "3",
  "detailCount": "6",
  "webSearch": "true",
  "images": "[{\"base64\":\"...\",\"fileName\":\"...\",\"mimeType\":\"...\",\"label\":\"...\"}]"
}
```

#### 处理流程

```
1. 解析请求体 → 提取 messages, threadId, resourceId, extras
2. 剥离文件 parts → 替换为文本标记 [用户上传了图片: xxx]
   （因为 deepseek-v4-flash 不支持图像输入）
3. 构建 RequestContext → 注入 Mastra reserved keys
   - MASTRA_RESOURCE_ID_KEY → resourceId（线程隔离）
   - MASTRA_THREAD_ID_KEY → threadId（记忆关联）
   - 其他 extras 作为自定义上下文传递
4. 调用 handleChatStream({ mastra, agentId: "ximoMallAgent", ... })
5. 返回 createUIMessageStreamResponse (SSE 流)
```

#### 关键设计决策

- **文件剥离**: 主控模型 deepseek-v4-flash 不支持 vision，文件 parts 在到达 Agent 前被替换为文本标记。实际图片数据通过 `extras.images`（base64 JSON）传递到 `createProjectTool` 的 `requestContext`
- **RequestContext**: Mastra 的依赖注入机制，用于在线程间传递上下文数据。`MASTRA_RESOURCE_ID_KEY` 和 `MASTRA_THREAD_ID_KEY` 是 Mastra 保留键，用于 Memory 的线程隔离

---

### 4.5 Threads API 路由 — `app/api/ai-agent/threads/route.ts`

[threads/route.ts](file:///f:/ximo-mall-main/app/api/ai-agent/threads/route.ts)（83 行）

| 方法 | 功能 | 说明 |
|------|------|------|
| `GET` | 列出所有对话 | 按 `updatedAt DESC` 排序，通过 `resourceId` 过滤 |
| `POST` | 创建新对话 | 必填 `title`，可选 `resourceId`（默认 `"ximo-mall-user"`） |
| `DELETE` | 删除对话 | 必填 `threadId` |

所有操作通过 `mastra.getAgent("ximoMallAgent").getMemory()` 获取 Memory 实例后执行。

---

### 4.6 Mastra 入口 — `mastra/index.ts`

[mastra/index.ts](file:///f:/ximo-mall-main/mastra/index.ts)（11 行）

```typescript
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { ximoMallAgent } from "./agents/ximo-mall-agent";

export const mastra = new Mastra({
  agents: { ximoMallAgent },
  storage: new LibSQLStore({
    id: "agent-memory-store",
    url: "file:./storage/agent-memory.db",
  }),
});
```

- **Mastra 实例**: 全局单例，注册 Agent 和存储后端
- **LibSQLStore**: 基于 SQLite 的存储引擎，用于持久化 Agent Memory（对话历史、线程元数据）
- **存储路径**: `storage/agent-memory.db`（项目根目录相对路径）

---

### 4.7 Agent 定义 — `mastra/agents/ximo-mall-agent.ts`

[ximo-mall-agent.ts](file:///f:/ximo-mall-main/mastra/agents/ximo-mall-agent.ts)（142 行）

#### Agent 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `id` | `"ximo-mall-agent"` | Agent 唯一标识 |
| `name` | `"Ximo Mall AI Agent"` | 显示名称 |
| `model` | 动态函数 → `deepseek-v4-flash-260425` | 主控模型，纯文本 |
| `memory.lastMessages` | `30` | 保留最近 30 条消息 |
| `memory.semanticRecall` | `false` | 禁用语义召回 |
| `tools` | 7 个 Tool | 见下方工具矩阵 |

#### Instructions 核心内容

Agent 的 system prompt 定义了以下行为规则：

1. **角色定位**: 10 年资深电商美工，纯文本调度器
2. **工具矩阵**: 明确每个工具的执行者（哪个模型/服务）和职责
3. **图片处理流程**: 收到图片标记 → createProject → analyzeProduct → planSections → 逐张生成
4. **联网搜索流程**: 在 planSections 前插入 webSearch → 提炼 3-5 条设计洞察 → 注入 searchContext
5. **平台视觉要点**: 淘宝/天猫（精致专业）、抖音（场景冲击）、拼多多（朴实质感）、小红书（笔记感）
6. **风格速查**: 5 大类 20 种风格的快速参考表
7. **双模式**: 自由聊天模式（灵活响应）vs 工作执行模式（自动/问答）
8. **改图**: editImageTool 支持 repaint / enhance / refine 三种模式
9. **质量标准**: 商品主体突出、色调一致、构图服务信息传递
10. **安全边界**: 拒绝侵权/仿冒/敏感内容

#### 自动模式 6 步流程

```
Step 1: createProjectTool → 记住 projectId
Step 2: analyzeProductTool({ projectId }) → 拿到商品分析结果
Step 3: [可选] webSearchTool → 搜索竞品视觉参考
Step 4: planSectionsTool({ projectId, searchContext }) → 拿到 heroSectionIds + detailSectionIds
Step 5: 逐张出图
  - 对 heroSectionIds 中每个 id → generateHeroImageTool({ projectId, sectionId: id })
  - 对 detailSectionIds 中每个 id → generateDetailImageTool({ projectId, sectionId: id })
Step 6: 汇报总结
```

---

### 4.8 Model Provider — `mastra/model-provider.ts`

[model-provider.ts](file:///f:/ximo-mall-main/mastra/model-provider.ts)（27 行）

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export async function getAgentModelProvider() {
  const { getProviderAdapter } = await import("@/lib/services/provider-service");

  let provider: { baseUrl: string };
  let apiKey: string;

  try {
    const adapterCtx = await getProviderAdapter("planning");
    provider = adapterCtx.provider;
    apiKey = adapterCtx.apiKey;
  } catch (error) {
    throw new Error(
      `AI Agent 模型 Provider 初始化失败：${detail}。请检查设置 → Provider 管理中是否配置了包含 deepseek-v4-flash-260425 模型的 Provider`
    );
  }

  return createOpenAICompatible({
    baseURL: provider.baseUrl,
    apiKey,
    name: "openai-compatible",
  });
}
```

- **动态延迟导入**: 使用 `await import()` 避免循环依赖
- **Provider 选择**: 复用 `getProviderAdapter("planning")` 获取规划角色的 Provider 配置
- **API Key 安全**: 从数据库读取已加密的 API Key（通过 `provider-service` 解密）
- **返回值**: 一个 `createOpenAICompatible` 工厂函数，Agent 的 `model` 属性调用它并传入具体模型名

---

### 4.9 Tool: createProjectTool

[create-project.ts](file:///f:/ximo-mall-main/mastra/tools/create-project.ts)（201 行）

| 属性 | 值 |
|------|-----|
| `id` | `"create-project"` |
| **执行者** | 后端服务（Prisma + asset-manager） |
| **前置条件** | 无（通常是第一步） |

#### 输入 Schema

```typescript
{
  name: string,           // 项目名称
  platform: string,       // 目标电商平台
  style: string,          // 视觉风格
  description?: string,   // 项目描述/用户需求
}
```

#### 输出 Schema

```typescript
{
  success: boolean,
  projectId?: string,     // 创建的项目 ID（后续工具的输入）
  message?: string,
  error?: string,
}
```

#### 执行逻辑

```
1. 在 Prisma 中创建 Project 记录
2. 从 requestContext 读取 images JSON（多图 base64 数据）
3. 逐张调用 saveUploadAsset 存入项目资产库
   - 首张 → type: "MAIN"
   - 含"参考"/"素材"标签 → type: "REFERENCE"
   - 其余 → type: "DETAIL"
4. 从 requestContext 读取 heroCount / detailCount（默认 3/6）
5. 清空旧 PageSection → 创建新的空白模块
   - HERO 模块: hero_01, hero_02, ...
   - DETAIL 模块: detail_01_selling_points, detail_02_detail_closeup, ...
   - 详情类型池: SELLING_POINTS → DETAIL_CLOSEUP → SCENARIO → SPECS → MATERIAL → COMPARISON → GIFT_SCENE → BRAND_TRUST → SUMMARY → CUSTOM...
6. 更新 Project 状态为 "EDITING"，写入 modelSnapshot
```

---

### 4.10 Tool: analyzeProductTool

[analyze-product.ts](file:///f:/ximo-mall-main/mastra/tools/analyze-product.ts)（28 行）

| 属性 | 值 |
|------|-----|
| `id` | `"analyze-product"` |
| **执行者** | doubao-seed-2-0-lite-260428（视觉模型） |
| **前置条件** | 需要 createProjectTool 返回的 projectId |

#### 输入/输出

```typescript
// 输入
{ projectId: string }

// 输出
{ success: boolean, analysis?: any, error?: string }
```

#### 执行逻辑

直接委托给 `lib/services/analysis-service.ts` 的 `analyzeProject(projectId)` 函数，该函数使用 doubao-seed-2-0-lite 视觉模型分析项目中的商品图片，提取品类、材质、卖点、人群、场景等结构化信息。

---

### 4.11 Tool: planSectionsTool

[plan-sections.ts](file:///f:/ximo-mall-main/mastra/tools/plan-sections.ts)（74 行）

| 属性 | 值 |
|------|-----|
| `id` | `"plan-sections"` |
| **执行者** | deepseek-v4-flash-260425 |
| **前置条件** | 需要完成商品分析 |

#### 输入 Schema

```typescript
{
  projectId: string,
  searchContext?: string,  // 联网搜索结果的提炼摘要
}
```

#### 输出 Schema

```typescript
{
  success: boolean,
  heroSectionIds?: string[],     // 头图模块 ID 数组
  detailSectionIds?: string[],   // 详情模块 ID 数组
  heroCount?: number,
  detailCount?: number,
  sections?: any,
  error?: string,
}
```

#### 关键逻辑

- 从 `requestContext` 读取用户配置的 `heroCount` / `detailCount`（限制范围 1-5 / 0-10）
- 调用 `planSections(projectId, { previewConfig, searchContext, agentMode: true })`
- 将返回的 sections 按 type 拆分为 `heroSectionIds` 和 `detailSectionIds`
- 这两个 ID 数组是后续图像生成工具的**关键输入**——Agent 必须逐个遍历调用

---

### 4.12 Tool: generateHeroImageTool

[generate-hero-image.ts](file:///f:/ximo-mall-main/mastra/tools/generate-hero-image.ts)（67 行）

| 属性 | 值 |
|------|-----|
| `id` | `"generate-hero-image"` |
| **执行者** | wan2.7-image |
| **前置条件** | 需要 planSectionsTool 返回的 heroSectionIds |

#### 输入 Schema

```typescript
{
  projectId: string,
  sectionId: string,                    // 头图模块 ID
  searchContext?: string,               // 联网搜索视觉参考
  referenceAssetLabels?: string[],      // 按 label 查找参考图
}
```

#### 输出 Schema

```typescript
{
  success: boolean,
  imageAssetId?: string,
  imageUrl?: string,     // /api/files/xxx 格式
  error?: string,
}
```

#### 关键逻辑

- 支持通过 `referenceAssetLabels` 按 label 匹配项目中的参考图资产
- 调用 `generateSectionImage(projectId, sectionId, undefined, referenceAssetIds, undefined, searchContext, true)`
- 最后一个参数 `agentMode: true` 表示由 Agent 触发

---

### 4.13 Tool: generateDetailImageTool

[generate-detail-image.ts](file:///f:/ximo-mall-main/mastra/tools/generate-detail-image.ts)（67 行）

与 `generateHeroImageTool` 结构完全一致，区别仅在于 `id` 和描述文案。同样调用 `generateSectionImage`，由 `sectionId` 对应的 section type 决定生成的是详情图而非头图。

---

### 4.14 Tool: editImageTool

[edit-image.ts](file:///f:/ximo-mall-main/mastra/tools/edit-image.ts)（54 行）

| 属性 | 值 |
|------|-----|
| `id` | `"edit-image"` |
| **执行者** | wan2.7-image |
| **前置条件** | 需要有已生成的底图 |

#### 输入 Schema

```typescript
{
  projectId: string,
  sectionId: string,
  editMode: "repaint" | "enhance",  // 默认 "repaint"
  instruction?: string,              // 提供时使用 refine 模式
}
```

#### 三种编辑模式

| 模式 | 触发条件 | 调用的 Service 函数 |
|------|----------|---------------------|
| `repaint` | `editMode === "repaint"` 且无 instruction | `editSectionImage` |
| `enhance` | `editMode === "enhance"` 且无 instruction | `editSectionImage` |
| `refine` | 提供了 `instruction` | `refineSectionImage` |

---

### 4.15 Tool: webSearchTool

[web-search.ts](file:///f:/ximo-mall-main/mastra/tools/web-search.ts)（108 行）

| 属性 | 值 |
|------|-----|
| `id` | `"web-search"` |
| **执行者** | 百度 AI 搜索（ernie-4.5-turbo-128k + baidu_search_v2） |
| **前置条件** | 需要配置 `BAIDU_AI_SEARCH_API_KEY` 环境变量 |

#### 输入/输出

```typescript
// 输入
{ query: string }

// 输出
{
  success: boolean,
  results?: Array<{ title, url, content, date? }>,
  generatedText?: string,    // AI 生成的综合回答
  source?: string,           // "智能搜索生成"
  error?: string,
}
```

#### 搜索策略

- 使用百度千帆 `ai_search/chat/completions` API
- System prompt 注入 7 维度视觉分析指令（图片视觉、整图布局、元素排版、元素样式、文案样式、色调分配、产品主体关联物）
- 模型: `ernie-4.5-turbo-128k`
- 搜索源: `baidu_search_v2`，top_k=10
- 返回结构化引用 + AI 生成的综合分析

#### API Key 轮换

当前使用单一 `BAIDU_AI_SEARCH_API_KEY`，注释中提及"双 API 轮换"但实际代码未实现。

---

## 5. 数据流详解

### 5.1 完整对话数据流

```
用户输入文字 + 上传图片
        │
        ▼
┌─ AiAgentWorkspace.handleFormSubmit ─────────────────────────────┐
│  1. 构建配置前缀 [平台 | 风格 | 模式 | 主图N张 | 详情N张]         │
│  2. 图片 File → FileReader → base64                              │
│  3. 构建 extras: { platform, style, mode, heroCount,             │
│                    detailCount, webSearch, images(JSON) }        │
│  4. sendMessage({ text }, { body: { ...extras, threadId } })    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/ai-agent/chat
                            ▼
┌─ chat/route.ts ─────────────────────────────────────────────────┐
│  1. 剥离 file parts → 替换为 [用户上传了图片: xxx] 文本标记       │
│  2. 构建 RequestContext({ platform, style, mode, images, ... }) │
│  3. 设置 MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY           │
│  4. handleChatStream({ mastra, agentId: "ximoMallAgent" })    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─ Mastra Agent 运行时 ───────────────────────────────────────────┐
│  ximoMallAgent (deepseek-v4-flash-260425)                      │
│  ├── 解析用户意图                                                │
│  ├── 判断模式（自由聊天 / 工作执行）                              │
│  ├── 调度工具链:                                                 │
│  │   ├── createProjectTool (requestContext.images → Prisma)     │
│  │   ├── [webSearchTool] (百度 AI 搜索)                         │
│  │   ├── analyzeProductTool → analysis-service                  │
│  │   ├── planSectionsTool → planner-service                     │
│  │   ├── generateHeroImageTool → generation-service             │
│  │   ├── generateDetailImageTool → generation-service           │
│  │   └── editImageTool → generation-service                     │
│  └── 流式返回: text parts + tool-call parts + reasoning parts   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ SSE Stream
                            ▼
┌─ AiAgentWorkspace (useChat) ────────────────────────────────────┐
│  messages 数组实时更新:                                          │
│  ├── text parts → 文本气泡渲染                                   │
│  ├── reasoning parts → "思考中" 面板                             │
│  ├── tool-* parts → 工具调用卡片（状态+结果+图片预览）            │
│  └── file parts → 用户上传图片缩略图                             │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 RequestContext 数据传递链

```
前端 sendMessage body extras
  { platform, style, mode, heroCount, detailCount, webSearch, images }
        │
        ▼
chat/route.ts → new RequestContext(extras entries)
        │
        ▼
Mastra Agent 运行时 → toolCtx.requestContext
        │
        ├── createProjectTool: rc.get("images"), rc.get("heroCount"), rc.get("detailCount")
        └── planSectionsTool:  rc.get("heroCount"), rc.get("detailCount")
```

### 5.3 Memory 线程隔离

```
每个 threadId 对应独立的对话记忆
        │
        ├── chat/route.ts: requestContext.set(MASTRA_THREAD_ID_KEY, threadId)
        │                            .set(MASTRA_RESOURCE_ID_KEY, resourceId)
        │
        ├── Mastra Memory: 按 resourceId + threadId 隔离存储
        │   ├── 存储: LibSQLStore (storage/agent-memory.db)
        │   └── 配置: lastMessages=30, semanticRecall=false
        │
        └── threads/route.ts: memory.listThreads / createThread / deleteThread
```

---

## 6. 关键类与函数说明

### 6.1 Mastra 框架层

| 类/函数 | 文件 | 说明 |
|---------|------|------|
| `Mastra` | `@mastra/core` | Mastra 框架主类，管理 Agent 注册和存储 |
| `Agent` | `@mastra/core/agent` | Agent 定义类，封装 model、instructions、memory、tools |
| `Memory` | `@mastra/memory` | 对话记忆管理，支持 lastMessages 和 semanticRecall |
| `LibSQLStore` | `@mastra/libsql` | 基于 LibSQL (SQLite fork) 的存储后端 |
| `createTool` | `@mastra/core/tools` | 工具定义工厂函数，返回带 Zod Schema 的 Tool 对象 |
| `handleChatStream` | `@mastra/ai-sdk` | 将 Mastra Agent 转为 AI SDK 兼容的流式响应 |
| `RequestContext` | `@mastra/core/di` | 依赖注入容器，在线程间传递上下文数据 |

### 6.2 AI SDK 层

| 类/函数 | 文件 | 说明 |
|---------|------|------|
| `useChat` | `@ai-sdk/react` | React Hook，管理对话状态和流式通信 |
| `DefaultChatTransport` | `ai` | 默认 HTTP 传输层，处理 SSE 流 |
| `createUIMessageStreamResponse` | `ai` | 创建 UI 兼容的流式 HTTP 响应 |
| `createOpenAICompatible` | `@ai-sdk/openai-compatible` | 创建 OpenAI 兼容的模型 Provider 实例 |

### 6.3 项目内部服务层

| 函数 | 文件 | 被哪个 Tool 调用 |
|------|------|------------------|
| `analyzeProject(projectId)` | `lib/services/analysis-service.ts` | `analyzeProductTool` |
| `planSections(projectId, config)` | `lib/services/planner-service.ts` | `planSectionsTool` |
| `generateSectionImage(...)` | `lib/services/generation-service.ts` | `generateHeroImageTool`, `generateDetailImageTool` |
| `editSectionImage(...)` | `lib/services/generation-service.ts` | `editImageTool` |
| `refineSectionImage(...)` | `lib/services/generation-service.ts` | `editImageTool` |
| `getProviderAdapter(role)` | `lib/services/provider-service.ts` | `getAgentModelProvider` |
| `saveUploadAsset(...)` | `lib/storage/asset-manager.ts` | `createProjectTool` |

### 6.4 前端关键函数

| 函数 | 位置 | 说明 |
|------|------|------|
| `handleFormSubmit` | ai-agent-workspace.tsx:239 | 表单提交核心逻辑，构建消息并发送 |
| `handleSelectThread` | ai-agent-workspace.tsx:219 | 切换对话线程，缓存当前线程消息 |
| `handleNewConversation` | ai-agent-workspace.tsx:230 | 新建对话，清空消息列表 |
| `fetchThreads` | conversation-sidebar.tsx:47 | 获取对话列表 |
| `handleCreateThread` | conversation-sidebar.tsx:66 | 创建新对话线程 |
| `handleDeleteThread` | conversation-sidebar.tsx:88 | 删除对话线程 |

---

## 7. 依赖关系

### 7.1 NPM 依赖

```json
{
  "@ai-sdk/openai-compatible": "^2.0.48",   // OpenAI 兼容 Provider
  "@ai-sdk/react": "^3.0.202",              // React useChat Hook
  "@mastra/ai-sdk": "^1.4.4",               // Mastra ↔ AI SDK 桥接
  "@mastra/core": "^1.41.0",                // Mastra 核心框架
  "@mastra/libsql": "^1.12.1",              // LibSQL 存储后端
  "@mastra/memory": "^1.20.2",              // Agent 记忆管理
  "ai": "^x.x.x",                           // Vercel AI SDK
  "zod": "^x.x.x"                           // Schema 校验
}
```

### 7.2 模块间依赖图

```
app/ai-agent/page.tsx
  └── components/ai-agent/ai-agent-workspace.tsx
        ├── @ai-sdk/react (useChat, DefaultChatTransport)
        ├── components/ai-agent/conversation-sidebar.tsx
        ├── components/ui/button.tsx
        └── types/domain.ts (styleCategories, styleLabels, platformLabels)

app/api/ai-agent/chat/route.ts
  ├── @mastra/ai-sdk (handleChatStream)
  ├── @mastra/core/di (RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY)
  ├── ai (createUIMessageStreamResponse)
  └── @/mastra (mastra 实例)

app/api/ai-agent/threads/route.ts
  ├── @/mastra (mastra 实例)
  └── @/lib/utils/route (ok, fail, handleRouteError)

mastra/index.ts
  ├── @mastra/core (Mastra)
  ├── @mastra/libsql (LibSQLStore)
  └── ./agents/ximo-mall-agent

mastra/agents/ximo-mall-agent.ts
  ├── @mastra/core/agent (Agent)
  ├── @mastra/memory (Memory)
  ├── ../model-provider (getAgentModelProvider)
  └── ../tools/* (7 个 Tool)

mastra/model-provider.ts
  ├── @ai-sdk/openai-compatible (createOpenAICompatible)
  └── @/lib/services/provider-service (getProviderAdapter)

mastra/tools/create-project.ts
  ├── @mastra/core/tools (createTool)
  ├── @/lib/db/prisma
  └── @/lib/storage/asset-manager (saveUploadAsset)

mastra/tools/analyze-product.ts
  ├── @mastra/core/tools (createTool)
  └── @/lib/services/analysis-service (analyzeProject)

mastra/tools/plan-sections.ts
  ├── @mastra/core/tools (createTool)
  └── @/lib/services/planner-service (planSections)

mastra/tools/generate-hero-image.ts
  ├── @mastra/core/tools (createTool)
  ├── @/lib/services/generation-service (generateSectionImage)
  └── @/lib/db/prisma

mastra/tools/generate-detail-image.ts
  └── (同 generate-hero-image)

mastra/tools/edit-image.ts
  ├── @mastra/core/tools (createTool)
  └── @/lib/services/generation-service (editSectionImage, refineSectionImage)

mastra/tools/web-search.ts
  ├── @mastra/core/tools (createTool)
  └── 百度千帆 API (fetch)
```

### 7.3 外部 API 依赖

| API | 用途 | 配置方式 |
|-----|------|----------|
| deepseek API (OpenAI 兼容) | 主控模型 + 规划模型 | Provider 管理 → 数据库 |
| doubao API (OpenAI 兼容) | 商品分析视觉模型 | Provider 管理 → 数据库 |
| wan2.7 API (OpenAI 兼容) | 图像生成模型 | Provider 管理 → 数据库 |
| 百度千帆 AI 搜索 | 联网搜索竞品参考 | 环境变量 `BAIDU_AI_SEARCH_API_KEY` |

---

## 8. 项目运行方式

### 8.1 环境准备

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (.env)
DATABASE_URL="file:./prisma/dev.db"
BAIDU_AI_SEARCH_API_KEY="your_baidu_api_key"
# 加密密钥（用于 Provider API Key 加解密）
ENCRYPTION_KEY="your_encryption_key"

# 3. 初始化数据库
npx prisma migrate dev

# 4. 配置 AI Provider
# 启动项目后，在设置 → Provider 管理中配置至少一个
# 包含 deepseek-v4-flash-260425 模型的 Provider
```

### 8.2 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000/ai-agent` 进入 AI Agent 页面。

### 8.3 使用流程

1. **配置 Provider**: 设置 → Provider 管理 → 添加包含 `deepseek-v4-flash-260425` 的 Provider
2. **新建对话**: 点击左侧"新建对话"按钮
3. **选择配置**（可选）:
   - 平台: 抖音电商 / 拼多多 / 淘宝天猫 / 通用电商
   - 风格: 20 种视觉风格任选
   - 模式: 自动模式 / 问答模式
   - 张数: 主图 0-9 张 / 详情 0-12 张
   - 联网搜索: 开启后自动搜索竞品视觉参考
4. **上传图片**: 点击回形针图标上传商品图片（支持多张）
5. **输入需求**: 描述你的电商详情页需求
6. **发送**: 按 Enter 发送，AI 自动执行生成流程

### 8.4 关键文件路径速查

| 用途 | 路径 |
|------|------|
| Agent 定义 | [mastra/agents/ximo-mall-agent.ts](file:///f:/ximo-mall-main/mastra/agents/ximo-mall-agent.ts) |
| 7 个 Tool | [mastra/tools/](file:///f:/ximo-mall-main/mastra/tools/) |
| Model Provider | [mastra/model-provider.ts](file:///f:/ximo-mall-main/mastra/model-provider.ts) |
| Mastra 入口 | [mastra/index.ts](file:///f:/ximo-mall-main/mastra/index.ts) |
| Chat API | [app/api/ai-agent/chat/route.ts](file:///f:/ximo-mall-main/app/api/ai-agent/chat/route.ts) |
| Threads API | [app/api/ai-agent/threads/route.ts](file:///f:/ximo-mall-main/app/api/ai-agent/threads/route.ts) |
| 前端工作台 | [components/ai-agent/ai-agent-workspace.tsx](file:///f:/ximo-mall-main/components/ai-agent/ai-agent-workspace.tsx) |
| 对话侧边栏 | [components/ai-agent/conversation-sidebar.tsx](file:///f:/ximo-mall-main/components/ai-agent/conversation-sidebar.tsx) |
| Agent Memory DB | `storage/agent-memory.db` |
