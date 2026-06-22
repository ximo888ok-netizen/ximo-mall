# AGENTS.md — ximo-mall AI 维护规则文档

> **项目**: ximo-mall — AI 电商详情页生成与编辑工作台
> **技术栈**: Next.js 15.5 + React 18 + TypeScript + Prisma (SQLite) + Electron + Tailwind CSS
> **最后更新**: 2026-06-22（v8 — 精简版，详见 git log）

---

## TL;DR（AI 维护者 30 秒速览）

1. **定位目标功能** → 看下方「功能快速指南」表格，找到对应文件清单
2. **改代码** → 只改目标功能涉及的文件，禁止顺手重构无关代码（铁律 1.1）
3. **改完更新本文** → 按第 5 节清单逐项检查并更新本文
4. **安全底线** → API Key 必须加密存储、禁止 SQL 拼接、禁止路径穿越、禁止 XSS

---

## 目录

1. [核心铁律](#1-核心铁律)
2. [功能快速指南](#2-功能快速指南)
3. [项目架构地图](#3-项目架构地图)
4. [代码规范速查](#4-代码规范速查)
5. [维护后更新清单](#5-维护后更新清单)

---

## 1. 核心铁律

### 1.1 禁止破坏既有业务逻辑（最高优先级）

> **铁律**: 维护任何一个功能模块时，严禁修改、删除或破坏与该功能无关的任何文件中的业务逻辑。

- 修改范围必须严格限定在目标功能涉及的文件之内。
- 禁止"顺手重构"无关代码、禁止"顺便优化"无关模块、禁止"顺手修一下"无关 bug。
- 如果一个改动涉及多个模块，必须先在 AGENTS.md 中标注影响范围，并在 commit message 中明确列出所有被修改的文件及其修改原因。
- 任何跨模块的改动都需要在 PR/commit 中提供「影响分析」：说明为什么必须跨模块、哪些文件被改动、每个文件的改动目的。

**违反此铁律的典型场景（禁止）**：
- ❌ 修一个 API 路由的 bug，顺手改了 `lib/utils/route.ts` 的公共工具函数
- ❌ 加一个前端组件，顺手调整了 `tailwind.config.ts` 的全局样式配置
- ❌ 改 Prisma schema 加了一个字段，顺手改了无关 model 的索引或关系
- ❌ 重构某个 service 时，改了它引用的公共类型定义，导致其他 service 的类型推断变化

### 1.2 改动前必读 AGENTS.md

- 任何 AI 在开始维护前，**必须首先完整阅读本文件**。
- 通过「功能快速指南」定位到目标功能，然后阅读对应章节了解该功能的文件清单和注意事项。
- 如果本文件中某个功能的信息与实际代码不一致（例如文件路径变更、新增依赖），以实际代码为准，并在维护完成后按第 5 节主动更新本文件。

### 1.3 维护后必修 AGENTS.md

- 每次完成维护任务后，AI **必须**检查并更新本文件（详见[第 5 节](#5-维护后更新清单)）。
- 如果新增了功能、添加了新文件、修改了模块职责、调整了数据流，必须同步更新「功能快速指南」和「架构地图」。
- 如果发现本文件中存在过时信息，必须在本次维护中修正。

### 1.4 安全红线

- **API Key 加密**: 所有 Provider API Key 必须通过 `lib/utils/crypto.ts` 的 `encryptSecret` / `decryptSecret` 加密存储，严禁明文落盘。
- **环境变量**: 敏感配置（DATABASE_URL, 加密密钥等）只能在 `.env` 中使用，严禁硬编码或提交到版本控制。
- **SQL 注入**: 所有数据库操作必须通过 Prisma Client 进行，严禁拼接原生 SQL 字符串。
- **路径穿越**: 所有文件读写操作必须校验路径在项目允许的目录范围内（`storage/` 目录下）。
- **XSS**: React 的 JSX 自动转义已覆盖大部分场景，但 `dangerouslySetInnerHTML` 严禁使用，除非有明确的安全审查。

---

## 2. 功能快速指南

> **用途**: AI 维护者通过此指南快速定位到需要维护的功能模块及其核心文件。

### 2.1 项目管理（Project）

| 项目 | 内容 |
|------|------|
| **功能描述** | 创建、编辑、删除 AI 电商项目，管理项目状态流转（DRAFT → ANALYZED → PLANNED → EDITING → COMPLETED）。快速开始支持知识库模式：选择产品知识库后，调用后端 `analyzeWithKnowledgeConstraint` 以知识库为地面真相进行 AI 约束分析，全链路（分析→规划→生成）强制约束卖点/规格/场景等事实性内容来自知识库 |
| **前端页面** | `app/projects/new/` — 新建项目；`app/projects/[id]/` — 项目详情 |
| **前端组件** | `components/projects/project-creator.tsx` `components/projects/quick-start-workspace.tsx` `components/projects/recent-project-list.tsx` |
| **API 路由** | `app/api/projects/route.ts`（列表+创建） `app/api/projects/[id]/route.ts`（单个CRUD） |
| **核心服务** | `lib/services/project-service.ts` |
| **数据模型** | `prisma/schema.prisma` → `Project`, `ProductAsset`, `ProductAnalysis`, `PageSection` |
| **领域类型** | `types/domain.ts`（`platformOptions`, `styleOptions`（20种风格）, `styleCategories`, `StyleTemplate`, `ProjectStatus` 等） |
| **校验** | `lib/validations/project.ts` |

### 2.2 商品分析（Analysis）

| 项目 | 内容 |
|------|------|
| **功能描述** | AI 分析商品图片，提取商品名称、类目、材质、卖点、目标人群、使用场景等结构化信息。知识库模式下通过 `analyzeWithKnowledgeConstraint` 以知识库为地面真相进行约束分析，仅使用 PACKAGING/MAIN 资产作视觉确认 |
| **前端组件** | `components/analysis/analysis-workspace.tsx` |
| **API 路由** | `app/api/projects/[id]/analyze/route.ts` `app/api/projects/[id]/analysis/route.ts` |
| **核心服务** | `lib/services/analysis-service.ts` |
| **AI 提示词** | `lib/ai/prompts/analysis.ts` |
| **AI Schema** | `lib/ai/schemas/product-analysis.ts` |
| **校验** | `lib/validations/analysis.ts` |

### 2.3 文案规划（Planner / Section Planning）

| 项目 | 内容 |
|------|------|
| **功能描述** | 基于商品分析结果，AI 规划详情页各模块的文案和视觉方向。支持 10 种模块类型。风格模板注入 7 维度视觉约束，头图通过风格适配实现 20 种差异化。所有风格统一执行高密度饱满标准 + 10 项硬约束，风格差异仅体现在视觉表现形式而非元素数量 |
| **前端组件** | `components/planner/planner-workspace.tsx` |
| **API 路由** | `app/api/projects/[id]/plan-sections/route.ts` `app/api/projects/[id]/sections/route.ts` `app/api/projects/[id]/sections/[sectionId]/route.ts` `app/api/projects/[id]/init-custom-sections/route.ts` |
| **核心服务** | `lib/services/planner-service.ts` |
| **AI 提示词** | `lib/ai/prompts/planning.ts` `lib/ai/prompts/style-templates.ts`（风格模板数据 + `buildStyleInstruction`） `lib/ai/prompts/hero-style-adaptations.ts`（20 种风格主图差异化适配） |
| **AI Schema** | `lib/ai/schemas/section-plan.ts` |
| **校验** | `lib/validations/section.ts` |

### 2.4 图像生成（Generation）

| 项目 | 内容 |
|------|------|
| **功能描述** | AI 根据规划和文案生成详情页各模块图片。所有风格统一走高密度饱满路径，风格差异仅体现在材质/配色/字体/氛围/道具类型。内置文字准确性规则减少错别字 |
| **前端组件** | `components/editor/editor-workspace.tsx`（含生成触发） |
| **API 路由** | `app/api/projects/[id]/sections/[sectionId]/route.ts`（含生成状态更新） |
| **核心服务** | `lib/services/generation-service.ts` |
| **AI 提示词** | `lib/ai/prompts/generation.ts` `lib/ai/prompts/style-templates.ts`（`buildStyleVisualConstraint`） `lib/ai/prompts/hero-style-adaptations.ts`（生成阶段头图风格身份覆盖） |
| **校验** | `lib/validations/generation.ts` |

### 2.5 编辑器工作台（Editor）

| 项目 | 内容 |
|------|------|
| **功能描述** | 可视化编辑详情页各模块的文案、视觉提示词、图片，支持版本管理和参考图选择 |
| **前端组件** | `components/editor/editor-workspace.tsx` `components/editor/reference-image-selector.tsx` |
| **状态管理** | `hooks/use-editor-store.ts`（Zustand） |
| **关联服务** | `lib/services/generation-service.ts`（触发生成） |

### 2.6 图片精调（Image Tune）

| 项目 | 内容 |
|------|------|
| **功能描述** | 对已生成的图片进行 AI 精调/编辑（局部修改、风格调整等） |
| **前端页面** | `app/image-tune/page.tsx` |
| **前端组件** | `components/image-tune/image-tune-workspace.tsx` |
| **API 路由** | `app/api/image-tune/route.ts` `app/api/image-tune/imitate/` |

### 2.7 AI Agent

| 项目 | 内容 |
|------|------|
| **功能描述** | AI Agent 对话式交互入口，基于 Mastra 框架。调度 7 个专用工具，支持自动/问答两种模式。支持平台/风格/模式/张数/联网搜索选择器。模型深度思考链路实时展示在前端 |
| **前端页面** | `app/ai-agent/page.tsx` |
| **前端组件** | `components/ai-agent/ai-agent-workspace.tsx` |
| **API 路由** | `app/api/ai-agent/chat/route.ts`（前端 UIMessageStream） |
| **外部 API** | `app/api/agent/chat/route.ts`（标准 SSE，支持文本+图片，事件类型 text/tool_call/tool_result/reasoning/done/error） |
| **连接器示例** | `examples/agent-connector.ts` `examples/agent-connector.py` |
| **Mastra 入口** | `mastra/index.ts` |
| **Agent 定义** | `mastra/agents/ximo-mall-agent.ts` |
| **Mastra Tools** | 见下方子表 |
| **模型 Provider** | `mastra/model-provider.ts` |
| **关联 Prompt** | `lib/ai/prompts/planning.ts` `lib/ai/prompts/generation.ts` `lib/ai/prompts/style-templates.ts` `lib/ai/prompts/hero-style-adaptations.ts` |
| **核心依赖** | `@mastra/core` `@mastra/ai-sdk` `@ai-sdk/openai-compatible` `@ai-sdk/react` `ai` |

**Mastra Tools 明细：**

| 工具 | 文件 | 模型 | 说明 |
|------|------|------|------|
| create-project | `mastra/tools/create-project.ts` | 主控模型 | 创建项目+上传图片+视觉分析+语义标签 |
| plan-sections | `mastra/tools/plan-sections.ts` | deepseek-v4-flash | 文案规划，支持 heroCount=0 |
| generate-hero-image | `mastra/tools/generate-hero-image.ts` | wan2.7-image | 头图生成，支持 referenceSemanticTypes |
| generate-detail-image | `mastra/tools/generate-detail-image.ts` | wan2.7-image | 详情图生成，支持 referenceSemanticTypes |
| edit-image | `mastra/tools/edit-image.ts` | wan2.7-image | 整体重绘/增强，支持 referenceSemanticTypes |
| refine-image | `mastra/tools/refine-image.ts` | wan2.7-image | 定向微调/P图，支持 referenceSemanticTypes |
| web-search | `mastra/tools/web-search.ts` | 百度 AI 搜索 | 联网搜索市场情报 |

### 2.8 Provider 管理（Providers）

| 项目 | 内容 |
|------|------|
| **功能描述** | 配置 AI 服务提供商（OpenAI 兼容 API），发现和管理模型，测试连接 |
| **前端页面** | `app/settings/providers/` |
| **前端组件** | `components/providers/provider-settings.tsx` `components/providers/provider-settings-page-client.tsx` |
| **API 路由** | `app/api/providers/route.ts` `app/api/providers/discover-models/route.ts` `app/api/providers/detect-capabilities/route.ts` `app/api/providers/test/route.ts` |
| **核心服务** | `lib/services/provider-service.ts` |
| **AI 适配器** | `lib/ai/adapters/openai-compatible.ts` |
| **AI 客户端** | `lib/ai/provider-client.ts` |
| **模型匹配** | `lib/ai/model-matcher.ts` |
| **能力检测** | `lib/ai/capability-detector.ts` |
| **校验** | `lib/validations/provider.ts` |

### 2.10 图片库（Image Library）

| 项目 | 内容 |
|------|------|
| **功能描述** | 集中管理所有上传的图片资产，支持分类、标签、集合、搜索 |
| **前端页面** | `app/library/page.tsx` |
| **API 路由** | `app/api/library/route.ts` `app/api/library/[id]/route.ts` `app/api/library/categories/` `app/api/library/tags/` `app/api/library/collections/` `app/api/library/stats/route.ts` |
| **核心服务** | `lib/services/image-library-service.ts` |
| **存储** | `lib/storage/image-library-storage.ts` |
| **类型** | `types/image-library.ts` |

### 2.11 AI 学习系统（Learning / Style Knowledge）

| 项目 | 内容 |
|------|------|
| **功能描述** | 用户投喂商品图片，AI 学习风格、配色、布局、文案等知识，用于增强后续生成效果。包含完整的学习→审查→应用工作流 |
| **前端页面** | `app/learning/[category]/page.tsx` |
| **API 路由** | `app/api/learning/route.ts` `app/api/learning/knowledges/route.ts` `app/api/learning/category/[category]/route.ts` |
| **核心服务** | `lib/services/image-learning-service.ts` |
| **AI 提示词** | `lib/ai/prompts/image-learning.ts` |
| **AI Schema** | `lib/ai/schemas/image-learning.ts` |
| **数据模型** | `prisma/schema.prisma` → `LearningSession`, `LearningImage`, `StyleKnowledge`, `KnowledgeSource` |
| **关联服务** | `lib/services/knowledge-sharing-service.ts` `lib/services/knowledge-constraints-service.ts` |

### 2.12 知识约束（Knowledge Constraints）

| 项目 | 内容 |
|------|------|
| **功能描述** | 控制 AI Agent 如何使用已学习的知识（置信度阈值、频率限制、类型白名单/黑名单） |
| **API 路由** | `app/api/knowledge/constraints/route.ts` |
| **核心服务** | `lib/services/knowledge-constraints-service.ts` |
| **数据模型** | `prisma/schema.prisma` → `KnowledgeConstraints`, `KnowledgeApplyLog`, `AgentKnowledgeApply` |

### 2.13 知识共享（Knowledge Sharing）

| 项目 | 内容 |
|------|------|
| **功能描述** | 跨 Agent 知识应用追踪，记录知识在分析、规划、生成阶段的使用情况和效果反馈 |
| **核心服务** | `lib/services/knowledge-sharing-service.ts` |

### 2.14 产品知识库（Product Knowledge Base）🆕

| 项目 | 内容 |
|------|------|
| **功能描述** | 产品知识库系统，用户可自由创建产品条目，上传多张产品图片。AI 逐张调用商品分析模型（doubao-seed-2-0-lite-260428）提取产品核心信息（使用场景、核心卖点、产品规格等），自动拆分为知识条目，支持关键词检索 |
| **分析流水线** | 上传N张图片 → 逐张分析（提取核心产品信息）→ 自动拆分为知识条目 → 存入知识库 |
| **检索方式** | 关键词搜索（向量语义检索已禁用） |
| **前端页面** | `app/product-library/page.tsx` `app/product-library/[slug]/page.tsx` |
| **旧入口重定向** | `app/knowledge-base/page.tsx` → 自动跳转 `/product-library` |
| **API 路由** | `app/api/product-library/route.ts` `app/api/product-library/[slug]/route.ts` `app/api/product-library/[slug]/images/route.ts` `app/api/product-library/[slug]/images/[imageId]/route.ts` `app/api/product-library/[slug]/train/route.ts` `app/api/product-library/[slug]/knowledge/route.ts` `app/api/product-library/[slug]/search/route.ts` `app/api/product-library/knowledge/[entryId]/route.ts` |
| **核心服务** | `lib/services/product-library-service.ts` |
| **AI 提示词** | `lib/ai/prompts/product-library.ts` |
| **向量工具** | `lib/utils/vector.ts`（余弦相似度 + TopK 检索，已禁用） |
| **数据模型** | `prisma/schema.prisma` → `ProductLibrary`, `ProductLibraryImage`, `ProductKnowledgeEntry` |
| **分析模型** | `doubao-seed-2-0-lite-260428`（逐张分析，硬编码） |
| **Embedding 模型** | 已禁用 |
| **知识分类** | `KnowledgeCategory` 枚举：USAGE_SCENARIO / SELLING_POINT / SPECIFICATION / MATERIAL / TARGET_AUDIENCE / BRAND_INFO / OTHER |

### 2.14b 面条品类知识库 ⚠️ 已废弃 — 前端入口已重定向到产品库，后端 API 和数据库模型保留但不再活跃使用

### 2.15 API 用量监控（Monitor / API Usage）

| 项目 | 内容 |
|------|------|
| **功能描述** | 记录和展示 API 调用量、Token 消耗等使用指标 |
| **前端页面** | `app/monitor/usage/` |
| **前端组件** | `components/monitor/clear-usage-button.tsx` `components/monitor/delete-usage-entry-button.tsx` `components/layout/api-usage-indicator.tsx` |
| **API 路由** | `app/api/monitor/usage/route.ts` |
| **核心服务** | `lib/monitor/api-usage.ts` |

### 2.16 导出（Export）

| 项目 | 内容 |
|------|------|
| **功能描述** | 将生成的详情页导出为图片或 JSON 结构数据 |
| **前端组件** | `components/export/export-panel.tsx` |
| **API 路由** | `app/api/projects/[id]/export/images/` `app/api/projects/[id]/export/json/` |
| **核心服务** | `lib/services/export-service.ts` |

### 2.17 MCP 集成（Model Context Protocol）

| 项目 | 内容 |
|------|------|
| **功能描述** | 提供 MCP Server，允许外部 AI 工具（Claude Desktop 等）通过标准协议调用 ximo-mall 的功能 |
| **前端页面** | `app/mcp/page.tsx` |
| **前端组件** | `components/mcp/mcp-dashboard.tsx` |
| **API 路由** | `app/api/mcp/route.ts` |
| **MCP Server** | `mcp-server/src/index.ts`（stdio 入口） `mcp-server/src/server.ts`（server 实现） `mcp-server/src/api-client.ts`（API 调用客户端） `mcp-server/src/http.ts`（HTTP 传输） |

### 2.18 任务管理（Tasks）

| 项目 | 内容 |
|------|------|
| **功能描述** | 异步任务追踪（分析、规划、生成、重生成、导出等任务的执行状态） |
| **API 路由** | `app/api/tasks/[taskId]/route.ts` |
| **核心服务** | `lib/services/task-service.ts` |
| **数据模型** | `prisma/schema.prisma` → `GenerationTask` |

### 2.19 历史记录（History）

| 项目 | 内容 |
|------|------|
| **功能描述** | 查看历史项目列表 |
| **前端页面** | `app/history/page.tsx` |

### 2.20 桌面端（Electron Desktop）

| 项目 | 内容 |
|------|------|
| **功能描述** | Windows 桌面应用包装，内置 Next.js 服务和自动启动 |
| **核心文件** | `desktop/main.cjs`（主进程） `desktop/preload.cjs`（预加载） `scripts/build-desktop.cjs` `scripts/run-next-safe.cjs` `scripts/runtime-paths.cjs` |

---

## 3. 项目架构地图

### 3.1 数据流

```
用户操作 → React 组件 → API Route → Service 层 → Prisma DB
                                                    ↓
                                            AI Provider Client
                                                    ↓
                                           OpenAI 兼容 API
                                                    ↓
                                            返回结果 → Service → DB → 响应
```

### 3.2 关键依赖关系

- **API Route** → `lib/utils/route.ts`（`ok`, `fail`, `handleRouteError`）
- **Service** → `lib/db/prisma.ts`（Prisma 单例）→ `lib/ai/provider-client.ts`（AI 调用）
- **AI 调用** → `lib/ai/adapters/openai-compatible.ts` → `lib/ai/capability-detector.ts` → `lib/ai/model-matcher.ts`
- **Provider 管理** → `lib/utils/crypto.ts`（API Key 加解密）
- **文件操作** → `lib/storage/asset-manager.ts`
- **环境变量** → `lib/utils/env.ts`

### 3.3 目录速查

| 目录 | 用途 |
|------|------|
| `app/api/` | RESTful API 路由（按功能分子目录） |
| `components/` | React 组件（按功能分子目录，`ui/` 为基础组件） |
| `lib/ai/prompts/` | AI 提示词模板（planning/generation/style-templates/hero-style-adaptations） |
| `lib/ai/schemas/` | AI 输出 Zod Schema |
| `lib/services/` | 业务服务层 |
| `lib/validations/` | Zod 校验 Schema |
| `mastra/` | Mastra AI Agent 框架（agents + tools） |
| `mcp-server/` | 独立 MCP Server |
| `prisma/` | Prisma Schema + 迁移 |
| `types/` | TypeScript 类型定义 |
| `storage/` | 运行时文件存储（git 忽略） |

---

## 4. 代码规范速查

### 4.1 必须遵守

- **TypeScript 强制**：所有新文件 `.ts/.tsx`，禁止 `any`（除非注释说明）
- **文件命名**：组件 `kebab-case.tsx`、Service `kebab-case.service.ts`、工具 `kebab-case.ts`、API 路由 `route.ts`
- **导入**：使用 `@/` 别名，顺序：React/Next.js → 第三方 → 项目内部 → 类型。禁止循环依赖
- **错误处理**：API 层用 `handleRouteError(error)`，Service 层向上抛出不静默吞错，前端用 `sonner` toast
- **Zod 校验**：API 输入 → `lib/validations/`，AI 输出 → `lib/ai/schemas/`，失败返回 `VALIDATION_ERROR`

### 4.2 API 路由

- 统一响应格式：`{ success: true, data }` / `{ success: false, error: { code, message } }`
- 使用 `ok(data)` / `fail(code, message, details, status)` / `handleRouteError(error)`
- RESTful 风格，资源名复数，复杂操作用动词子路由

**错误码**：`VALIDATION_ERROR`(400) `NOT_FOUND`(404) `PROVIDER_AUTH_ERROR`(401) `SPENDING_LIMIT_REACHED`(403) `RATE_LIMITED`(429) `PROVIDER_TIMEOUT`(504) `INTERNAL_ERROR`(500)

### 4.3 数据库

- SQLite + Prisma，Schema 在 `prisma/schema.prisma`，迁移文件禁止手动修改
- 所有 DB 操作通过 Service 层封装，API Route 不直接调 Prisma
- 多表写入用 `prisma.$transaction`，改 Schema 后运行 `npm run prisma:migrate`

### 4.4 AI Provider

- 适配器模式：`lib/ai/adapters/openai-compatible.ts`
- 统一客户端 `lib/ai/provider-client.ts`：`structuredCall<T>()` / `textCall()`
- 模型角色：`isDefaultAnalysis` / `isDefaultPlanning` / `isDefaultHeroImage` / `isDefaultDetailImage` / `isDefaultImageEdit`
- API Key 必须 AES-256-GCM 加密（`lib/utils/crypto.ts`），禁止出现在日志/前端

### 4.5 前端组件

- `components/ui/` 基础 UI（Radix UI + Tailwind + CVA + `cn()`），必须支持 `className` prop
- 状态管理：全局用 Zustand，页面级用 `useState`/`useReducer`
- 所有组件必须支持亮色/暗色主题（`dark:` 变体）

### 4.6 Electron 桌面端

- 主进程 `desktop/main.cjs`，预加载 `desktop/preload.cjs`，Next.js 内置 Web 服务器
- 构建：`npm run dist:win`（NSIS）/ `npm run dist:green`（免安装），输出 `dist-desktop/`
- 使用 `better-sqlite3` 驱动，启动时自动执行 Prisma 迁移

### 4.7 MCP Server

- 独立进程，stdio/HTTP 双传输，`mcp-server/src/server.ts` 定义 Tools
- 新增 Tool 通过 `api-client.ts` 调用主应用 API，修改 API 路由时需同步检查 MCP Server

### 4.8 文件存储

- 所有运行时文件在 `storage/` 下：`generated/` `uploads/` `exports/` `library/` `knowledge-base/` `learning/` `monitor/`
- 用 `asset-manager.ts` / `image-library-storage.ts` 操作，路径用 `path` 模块构建，删除前检查引用计数

---

## 5. 维护后更新清单

> **每次完成维护任务后，AI 必须逐项检查并更新本文件。**

### 5.1 必须检查的项目

| # | 检查项 | 操作 |
|---|--------|------|
| 1 | **新增了功能吗？** | 在「功能快速指南」中添加新条目，包含功能描述、核心文件清单 |
| 2 | **新增了文件吗？** | 更新对应功能的「核心文件」列表 |
| 3 | **删除了文件吗？** | 从对应功能的「核心文件」列表中移除 |
| 4 | **修改了模块职责吗？** | 更新功能描述和架构地图 |
| 5 | **新增了 API 路由吗？** | 更新对应功能的 API 路由清单 |
| 6 | **修改了 Prisma Schema 吗？** | 更新数据模型引用 |
| 7 | **新增了依赖吗？** | 在项目概述中标注（如为关键依赖） |
| 8 | **修改了数据流吗？** | 更新架构地图中的数据流图 |
| 9 | **修改了 AI 提示词吗？** | 更新对应功能的 AI 提示词文件引用 |
| 10 | **新增了环境变量吗？** | 在「安全红线」相关章节标注 |
| 11 | **修改了错误处理吗？** | 更新错误码规范表 |
| 12 | **修改了存储路径吗？** | 更新文件存储规范 |

### 5.2 更新格式

- 在文件顶部的「最后更新」日期改为当天。
- 如果改动较大，在 commit message 中写明 `docs: update AGENTS.md for <改动摘要>`。

### 5.3 自检问题

维护完成后，AI 应自问：

1. ✅ 我是否只修改了目标功能涉及的文件？
2. ✅ 我是否阅读了本文件中的相关章节？
3. ✅ 我是否更新了本文件中受影响的章节？
4. ✅ 我是否遵守了所有安全红线？
5. ✅ 我是否使用了统一的 API 响应格式？
6. ✅ 新增代码是否通过了 TypeScript 类型检查？
7. ✅ 如果涉及 AI 调用，是否通过统一客户端进行？

---

> **本文件是 ximo-mall 项目的 AI 维护宪法。所有 AI 维护者必须遵守。最后更新者负有保持本文件准确的责任。**
