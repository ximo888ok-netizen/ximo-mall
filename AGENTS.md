# AGENTS.md — ximo-mall AI 维护规则文档

> **项目**: ximo-mall — AI 电商详情页生成与编辑工作台
> **技术栈**: Next.js 15.5.7 + React 18 + TypeScript + Prisma (SQLite) + Electron + Tailwind CSS
> **最后更新**: 2026-06-21（第七轮升级：在第六轮高密度饱满基础上，将合格电商主图提炼为 **10 项硬约束 HC1-HC10**，写入 `lib/ai/prompts/planning.ts` 的 `HERO CONTENT TEMPLATE` 与 `buildZeroBlankAndLayerRule`，并通过 `hero-style-adaptations.ts` 的 `hardConstraintStyling` 让每种风格自由决定各硬约束的视觉表现形式；主图必须同时满足全部 10 项，副图至少覆盖 6 项且密度不低于主图 80%。风格差异只体现在 LOOK，不删减元素类别）

---

## 目录

1. [核心铁律](#1-核心铁律)
2. [功能快速指南](#2-功能快速指南)
3. [项目架构地图](#3-项目架构地图)
4. [代码规范](#4-代码规范)
5. [API 路由规范](#5-api-路由规范)
6. [数据库规范](#6-数据库规范)
7. [AI Provider 集成规范](#7-ai-provider-集成规范)
8. [前端组件规范](#8-前端组件规范)
9. [Electron 桌面端规范](#9-electron-桌面端规范)
10. [MCP Server 规范](#10-mcp-server-规范)
11. [文件存储规范](#11-文件存储规范)
12. [维护后更新清单](#12-维护后更新清单)

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
- 如果本文件中某个功能的信息与实际代码不一致（例如文件路径变更、新增依赖），以实际代码为准，并在维护完成后按第 12 节主动更新本文件。

### 1.3 维护后必修 AGENTS.md

- 每次完成维护任务后，AI **必须**检查并更新本文件（详见[第 12 节](#12-维护后更新清单)）。
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
| **功能描述** | 基于商品分析结果，AI 规划详情页各个模块（头图、卖点、场景、细节等）的文案和视觉方向。风格模板通过 `buildStyleInstruction()` 注入 7 维度视觉约束；头图（含主图与副图）通过 `buildHeroStyleAdaptation()` 注入 20 种风格的差异化构图/标题/营销/氛围/口味适配规则，并通过 `hardConstraintStyling` 定义各风格下 10 项硬约束的视觉表现形式。**所有风格现在统一执行高密度饱满标准 + 10 项硬约束**：主图必须同时出现 HC1 信息密度100%、HC2 双主体、HC3 三层标题、HC4 侧边卖点条、HC5 底部强对比横幅、HC6 角标徽章、HC7 食材配料、HC8 独立料包、HC9 强色彩分区、HC10 完整品牌信息；副图至少覆盖 6 项且密度 ≥ 主图 80%。风格差异体现在**布局方式、排版风格、配色方向、文案语气、道具类型、背景材质、营销元素形状**——而非删减元素数量或留白。`buildZeroBlankAndLayerRule` 与 `buildQualityFloor` 共同强制零大面积空白 |
| **前端组件** | `components/planner/planner-workspace.tsx` |
| **API 路由** | `app/api/projects/[id]/plan-sections/route.ts` `app/api/projects/[id]/sections/route.ts` `app/api/projects/[id]/sections/[sectionId]/route.ts` `app/api/projects/[id]/init-custom-sections/route.ts` |
| **核心服务** | `lib/services/planner-service.ts` |
| **AI 提示词** | `lib/ai/prompts/planning.ts` `lib/ai/prompts/style-templates.ts`（风格模板数据 + `buildStyleInstruction`） `lib/ai/prompts/hero-style-adaptations.ts`（20 种风格主图差异化适配） |
| **AI Schema** | `lib/ai/schemas/section-plan.ts` |
| **校验** | `lib/validations/section.ts` |

### 2.4 图像生成（Generation）

| 项目 | 内容 |
|------|------|
| **功能描述** | AI 根据规划和文案生成详情页各模块的商品图片（头图、卖点图、场景图、细节图等）。风格模板通过 `buildStyleVisualConstraint()` 注入视觉约束；头图通过 `buildHeroStyleIdentity()` 执行风格身份覆盖。**`isLowDensityHeroStyle()` 已改为永远返回 false**——生成阶段不再有低密度/高密度两套条件分支，所有风格统一走高密度饱满路径（食物占65-75%+3-4个营销标签+20-25%营销覆盖+5-8个道具+零大面积留白），风格差异仅体现在材质/配色/字体/氛围/道具类型（由 `buildHeroStyleIdentity` 覆盖注入） |
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
| **功能描述** | AI Agent 对话式交互入口，基于 Mastra 框架，以 doubao-seed-2-0-lite-260428 为主控模型（支持视觉输入+深度思考）。调度 8 个专用工具（已移除 analyzeProductTool，由主控模型直接分析图片）。支持平台/风格/模式/张数/联网搜索选择器，自动模式执行 5 步流程（创建→搜索→规划→生成→汇报）。支持 heroCount=0 只生成详情页模式。支持图片超分高清放大（upscaleImageTool）。用户上传的图片通过 data URL → FileUIPart → experimental_attachments 管道传递给模型，实现直接视觉理解。模型深度思考链路（reasoning_content）通过 reasoning parts 展示在前端 |
| **前端页面** | `app/ai-agent/page.tsx` |
| **前端组件** | `components/ai-agent/ai-agent-workspace.tsx`（百度式居中输入框 + 对话气泡 + 工具调用展示 + 思考过程展示 + 三组选择器 + 联网搜索开关） |
| **API 路由** | `app/api/ai-agent/chat/route.ts`（前端专用，UIMessageStream 格式） |
| **外部 API** | `app/api/agent/chat/route.ts`（面向本地/内网外部应用，标准 SSE 格式，支持纯文本+图片输入，事件类型：text/tool_call/tool_result/reasoning/done/error） |
| **连接器示例** | `examples/agent-connector.ts`（TypeScript/Node.js） `examples/agent-connector.py`（Python） |
| **Mastra 入口** | `mastra/index.ts` |
| **Agent 定义** | `mastra/agents/ximo-mall-agent.ts`（7 个工具 + 5 步自动流程 instructions，支持 heroCount=0 只生成详情页模式） |
| **Mastra Tools** | `mastra/tools/create-project.ts`（独立 Prisma Tool，创建项目+上传图片+初始化模块+**写入 Agent 视觉分析结果和图片语义标签**，semanticType 对齐 AssetType 枚举：MAIN→MAIN, PACKAGING→PACKAGING, 其余→REFERENCE；**style/platform 优先从 requestContext 读取前端用户选择的英文 key，模型传入的值作为次选**，避免模型传中文 label 导致风格模板匹配失败） `mastra/tools/plan-sections.ts`（deepseek-v4-flash-260425，读取用户张数配置+资产标签，**支持 heroCount=0 只生成详情页**） `mastra/tools/generate-hero-image.ts`（wan2.7-image，支持 referenceSemanticTypes 参数按语义类型筛选参考图） `mastra/tools/generate-detail-image.ts`（wan2.7-image，支持 referenceSemanticTypes 参数） `mastra/tools/edit-image.ts`（wan2.7-image，整体重绘/增强，**支持 referenceSemanticTypes**） `mastra/tools/refine-image.ts`（wan2.7-image，定向微调/P图，**支持 referenceSemanticTypes**） `mastra/tools/web-search.ts`（百度 AI 搜索，单 API Key） |
| **模型 Provider** | `mastra/model-provider.ts`（通过 `getProviderAdapter("agent")` 查找 doubao-seed-2-0-lite-260428 对应的 Provider，`provider-service.ts` 的 PURPOSE_MODELS 新增 `agent` 角色映射） |
| **关联 Prompt** | `lib/ai/prompts/planning.ts` `lib/ai/prompts/generation.ts` `lib/ai/prompts/style-templates.ts` `lib/ai/prompts/hero-style-adaptations.ts`（Agent 自动模式同样复用这些 prompt 约束） |
| **核心依赖** | `@mastra/core` `@mastra/ai-sdk` `@ai-sdk/openai-compatible` `@ai-sdk/react` `ai` |

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

### 2.14b 面条品类知识库（Noodle Knowledge Base）⚠️ 已废弃

| 项目 | 内容 |
|------|------|
| **状态** | **已废弃** — 前端入口已重定向到产品库。后端 API 和数据库模型保留但不再活跃使用 |
| **前端页面** | `app/knowledge-base/page.tsx`（→ 重定向到 /product-library） |
| **API 路由** | `app/api/knowledge-base/`（保留） |
| **核心服务** | `lib/services/knowledge-base-service.ts` `lib/services/kb-training-service.ts` `lib/services/kb-summary-service.ts` |
| **AI 提示词** | `lib/ai/prompts/kb-analysis.ts` |
| **数据模型** | `prisma/schema.prisma` → `NoodleKnowledgeBase`, `NoodleKBImage`, `NoodleKBKnowledge` |

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

### 3.1 目录结构总览

```
ximo-mall/
├── app/                          # Next.js App Router 页面和 API 路由
│   ├── api/                      # API 路由（RESTful）
│   │   ├── assets/               # 资产管理
│   │   ├── files/                # 文件服务
│   │   ├── image-tune/           # 图片精调
│   │   ├── knowledge/            # 知识约束
│   │   ├── knowledge-base/       # 面条品类知识库（已废弃）
│   │   ├── learning/             # AI 学习系统
│   │   ├── library/              # 图片库
│   │   ├── mcp/                  # MCP 集成
│   │   ├── monitor/              # 用量监控
│   │   ├── product-library/      # 🆕 产品库
│   │   ├── projects/             # 项目+分析+规划+生成+导出
│   │   ├── providers/            # AI Provider 管理
│   │   └── tasks/                # 任务管理
│   └── ...                       # 前端页面路由
├── components/                   # React 组件
│   ├── analysis/                 # 商品分析工作台
│   ├── ai-agent/                 # AI Agent
│   ├── editor/                   # 编辑器工作台
│   ├── export/                   # 导出面板
│   ├── image-tune/               # 图片精调
│   ├── layout/                   # 布局组件（AppShell, Theme, API Indicator）
│   ├── mcp/                      # MCP 控制台
│   ├── monitor/                  # 监控组件
│   ├── planner/                  # 文案规划工作台
│   ├── projects/                 # 项目创建/列表
│   ├── providers/                # Provider 设置
│   ├── shared/                   # 通用组件
│   └── ui/                       # 基础 UI 组件（基于 Radix UI）
├── hooks/                        # 自定义 React Hooks
│   ├── use-editor-store.ts       # 编辑器状态（Zustand）
│   └── use-toast.ts              # Toast 通知
├── lib/                          # 核心业务逻辑
│   ├── ai/                       # AI 集成层
│   │   ├── adapters/             # AI Provider 适配器（OpenAI 兼容）
│   │   ├── prompts/              # AI 提示词模板（含 style-templates.ts 风格模板、hero-style-adaptations.ts 主图风格差异化适配）
│   │   ├── schemas/              # AI 输出 Zod Schema
│   │   ├── capability-detector.ts # 模型能力检测
│   │   ├── model-matcher.ts      # 模型角色匹配
│   │   └── provider-client.ts    # 统一 AI 调用客户端
│   ├── db/                       # 数据库
│   │   └── prisma.ts             # Prisma 单例客户端
│   ├── monitor/                  # API 用量监控
│   ├── services/                 # 业务服务层（核心逻辑）
│   ├── storage/                  # 文件存储层
│   ├── utils/                    # 工具函数
│   │   ├── api.ts                # API 响应格式工具
│   │   ├── base64-upload.ts      # Base64 上传处理
│   │   ├── content-language.ts   # 内容语言检测
│   │   ├── crypto.ts             # 加密/解密工具
│   │   ├── env.ts                # 环境变量安全读取
│   │   ├── files.ts              # 文件操作工具
│   │   ├── route.ts              # 路由处理工具（ok/fail/error）
│   │   └── section.ts            # Section 工具函数
│   └── validations/              # Zod 校验 Schema
├── mcp-server/                   # 独立 MCP Server（外部 AI 集成）
├── mastra/                       # Mastra AI Agent 框架（独立于项目常规能力）
│   ├── agents/                   # Agent 定义
│   ├── tools/                    # Agent 工具（7 个，独立封装）
│   ├── index.ts                  # Mastra 入口
│   └── model-provider.ts         # 动态 Provider 实例创建
├── prisma/                       # Prisma Schema + 迁移文件
├── scripts/                      # 构建/运行脚本
├── types/                        # TypeScript 类型定义
│   ├── domain.ts                 # 核心领域类型
│   └── image-library.ts          # 图片库类型
├── storage/                      # 运行时文件存储（生成图片、导出、上传等）
└── desktop/                      # Electron 桌面应用
```

### 3.2 数据流架构

```
用户操作 → React 组件 → API Route → Service 层 → Prisma DB
                                                    ↓
                                            AI Provider Client
                                                    ↓
                                           OpenAI 兼容 API
                                                    ↓
                                            返回结果 → Service → DB → 响应
```

### 3.3 关键依赖关系

- **API Route** → `lib/utils/route.ts`（`ok`, `fail`, `handleRouteError`）
- **API Route** → `lib/utils/api.ts`（`apiSuccess`, `apiError`）
- **Service** → `lib/db/prisma.ts`（Prisma 客户端单例）
- **Service** → `lib/ai/provider-client.ts`（AI 调用）
- **AI 调用** → `lib/ai/adapters/openai-compatible.ts`（适配器）
- **AI 调用** → `lib/ai/capability-detector.ts`（能力检测）
- **AI 调用** → `lib/ai/model-matcher.ts`（模型选择）
- **Provider 管理** → `lib/utils/crypto.ts`（API Key 加解密）
- **文件操作** → `lib/storage/asset-manager.ts`（资产管理）
- **环境变量** → `lib/utils/env.ts`（安全读取）

---

## 4. 代码规范

### 4.1 TypeScript

- 所有新文件必须使用 TypeScript（`.ts` / `.tsx`）。
- 禁止使用 `any`，除非有明确的注释说明原因。
- 类型定义优先放在 `types/` 目录下，组件专用类型可放在组件文件内。
- Zod Schema 用于运行时校验（API 输入/输出），TypeScript 类型用于编译时检查。两者必须保持同步。

### 4.2 文件命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| React 组件 | `kebab-case.tsx` | `editor-workspace.tsx` |
| Service | `kebab-case.service.ts` | `project-service.ts` |
| 工具函数 | `kebab-case.ts` | `crypto.ts` |
| 类型定义 | `kebab-case.ts` | `domain.ts` |
| API 路由 | `route.ts` | `app/api/projects/route.ts` |

### 4.3 导入规范

- 使用 `@/` 路径别名引用项目根目录下的文件。
- 导入顺序：React/Next.js → 第三方库 → 项目内部模块 → 类型。
- 禁止循环依赖。如果出现，使用 `import type` + 延迟加载或提取公共接口到独立文件。

### 4.4 错误处理

- API 路由层统一使用 `lib/utils/route.ts` 的 `handleRouteError(error)` 处理错误。
- 已内置 Provider 错误映射（额度用尽、限流、鉴权失败、超时等），新增 Provider 错误类型需在 `mapProviderError` 中添加。
- Service 层错误应向上抛出，不要在 Service 内静默吞掉错误。
- 前端使用 `sonner` toast 库展示错误信息。

### 4.5 Zod 校验规范

- 所有 API 路由的输入参数必须用 Zod Schema 校验（在 `lib/validations/` 目录下）。
- AI 结构化输出必须用 Zod Schema 定义（在 `lib/ai/schemas/` 目录下）。
- 校验失败统一返回 `VALIDATION_ERROR` 错误码。

---

## 5. API 路由规范

### 5.1 响应格式

所有 API 响应使用统一格式（由 `lib/utils/api.ts` 定义）：

```typescript
// 成功
{ success: true, data: T }

// 失败
{ success: false, error: { code: string, message: string, details?: unknown } }
```

### 5.2 路由处理

- 使用 `ok(data)` 返回成功响应。
- 使用 `fail(code, message, details, status)` 返回错误响应。
- 捕获所有异常统一使用 `handleRouteError(error)`。

### 5.3 错误码规范

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `PROVIDER_AUTH_ERROR` | 401 | Provider 鉴权失败 |
| `SPENDING_LIMIT_REACHED` | 403 | API 额度用尽 |
| `RATE_LIMITED` | 429 | 请求限流 |
| `PROVIDER_TIMEOUT` | 504 | Provider 超时 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 5.4 路由结构原则

- RESTful 风格：资源名复数，嵌套资源体现层级关系。
- 每个 `route.ts` 文件只处理一个资源端点。
- 复杂操作（analyze, export, train 等）使用动词命名子路由。

---

## 6. 数据库规范

### 6.1 Prisma Schema

- Schema 文件位于 `prisma/schema.prisma`。
- 数据库使用 SQLite（`DATABASE_URL` 环境变量配置）。
- 所有迁移文件位于 `prisma/migrations/`，禁止手动修改已有迁移文件。

### 6.2 Model 命名

| 前缀 | 用途 | 示例 |
|------|------|------|
| 无前缀 | 核心业务模型 | `Project`, `ProviderConfig` |
| 动词前缀 | 关联/记录模型 | `AgentKnowledgeApply`, `KnowledgeApplyLog` |

### 6.3 迁移规范

- 修改 Schema 后运行 `npm run prisma:migrate`。
- 新增迁移必须包含可回滚的考虑（在 commit message 中说明如何回滚）。
- 严禁在迁移中直接写原生 SQL（Prisma Migrate 自动生成）。

### 6.4 数据访问规范

- 所有数据库操作通过 `lib/db/prisma.ts` 导出的单例 Prisma 客户端进行。
- Service 层封装所有数据库操作，API Route 不应直接调用 Prisma。
- 使用 Prisma 的事务（`prisma.$transaction`）处理多表写入。

---

## 7. AI Provider 集成规范

### 7.1 适配器模式

- 所有 AI Provider 通过适配器模式接入（`lib/ai/adapters/`）。
- 当前唯一适配器：`openai-compatible.ts`（兼容 OpenAI Chat Completions API）。
- 新增 AI 平台支持时，在 `lib/ai/adapters/` 下创建新适配器，实现与 `OpenAICompatibleAdapter` 相同的接口。

### 7.2 统一客户端

- `lib/ai/provider-client.ts` 提供统一的 AI 调用接口：
  - `structuredCall<T>(req)` — 结构化输出（带 Zod Schema 校验）
  - `textCall(req)` — 纯文本输出
- 所有 AI 调用必须通过此客户端，不得绕过直接调用 HTTP。

### 7.3 模型角色分配

- 每个模型可分配一个或多个角色（`isDefaultAnalysis`, `isDefaultPlanning`, `isDefaultHeroImage`, `isDefaultDetailImage`, `isDefaultImageEdit`）。
- 同一角色可以有多个模型，系统按优先级选择。
- 模型能力由 `capability-detector.ts` 自动检测（text, vision, image_gen, image_edit 等）。

### 7.4 API Key 安全

- API Key 必须使用 AES-256-GCM 加密存储（`lib/utils/crypto.ts`）。
- 加密密钥来自环境变量，不得在代码中硬编码。
- API Key 永远不应出现在日志、错误消息或前端响应中。

---

## 8. 前端组件规范

### 8.1 组件分类

| 目录 | 用途 | 示例 |
|------|------|------|
| `components/ui/` | 基础 UI 组件（基于 Radix UI + Tailwind） | Button, Dialog, Select |
| `components/shared/` | 跨功能共享组件 | PageHeader, ConfirmDialog |
| `components/layout/` | 布局组件 | AppShell, ThemeToggle |
| `components/<feature>/` | 功能专用组件 | analysis-workspace, editor-workspace |

### 8.2 UI 组件规范

- 所有基础 UI 组件在 `components/ui/` 目录下，基于 Radix UI 原语封装。
- 使用 `class-variance-authority`（CVA）管理组件变体。
- 使用 `tailwind-merge` + `clsx` 合并 className（`lib/utils.ts` 的 `cn` 函数）。
- 组件必须支持 `className` prop 以允许外部样式覆盖。

### 8.3 状态管理

- 全局/跨组件状态使用 Zustand（当前仅有 `useEditorStore`）。
- 页面级状态使用 React `useState` / `useReducer`。
- 服务端状态通过 API 调用获取，不在前端缓存（除非有明确的性能需求）。

### 8.4 主题

- 支持亮色/暗色主题切换（`components/layout/theme-toggle.tsx` + `theme-script.tsx`）。
- 使用 Tailwind 的 `dark:` 变体处理暗色模式样式。
- 所有新组件必须同时支持亮色和暗色模式。

---

## 9. Electron 桌面端规范

### 9.1 架构

- Electron 主进程：`desktop/main.cjs`
- 预加载脚本：`desktop/preload.cjs`
- Next.js 作为内置 Web 服务器，Electron 加载本地 URL。

### 9.2 构建

- 桌面端构建：`npm run build:desktop`
- 打包分发：`npm run dist:win`（NSIS 安装包）
- 打包绿色版：`npm run dist:green`（免安装目录）
- 输出目录：`dist-desktop/`

### 9.3 注意事项

- 桌面端使用 `better-sqlite3` 作为 Prisma 的 SQLite 驱动（需在 `next.config.mjs` 中配置 `serverExternalPackages`）。
- 数据库路径由 `scripts/runtime-paths.cjs` 动态解析。
- 桌面端启动时自动执行 Prisma 迁移。

---

## 10. MCP Server 规范

### 10.1 架构

- MCP Server 是独立进程，与 Next.js 主应用分离。
- 通过 stdio 或 HTTP 与外部 AI 工具通信。
- `mcp-server/src/server.ts` 定义 Tools 和 Resources。
- `mcp-server/src/api-client.ts` 封装对 ximo-mall API 的调用。

### 10.2 扩展 MCP Tools

- 新增 MCP Tool 在 `mcp-server/src/server.ts` 中注册。
- 每个 Tool 必须有明确的 `name`, `description`, `inputSchema`。
- Tool 的实现通过 `api-client.ts` 调用主应用 API 路由。

### 10.3 注意事项

- MCP Server 有独立的 `package.json` 和依赖。
- 修改 API 路由时需同步检查 MCP Server 是否受影响。

---

## 11. 文件存储规范

### 11.1 存储目录

所有运行时文件存储在 `storage/` 目录下：

| 子目录 | 用途 |
|--------|------|
| `storage/generated/` | AI 生成的图片 |
| `storage/uploads/` | 用户上传的图片 |
| `storage/exports/` | 导出的文件 |
| `storage/library/` | 图片库资产（originals, thumbnails, converted） |
| `storage/knowledge-base/` | 知识库训练图片 |
| `storage/learning/` | AI 学习系统投喂图片 |
| `storage/monitor/` | API 用量日志（api-usage.jsonl） |

### 11.2 文件操作规范

- 使用 `lib/storage/asset-manager.ts` 管理项目资产的文件操作。
- 使用 `lib/storage/image-library-storage.ts` 管理图片库的文件操作。
- 所有文件路径必须使用 `path` 模块构建，禁止字符串拼接。
- 文件删除前必须检查数据库引用计数，防止孤立文件。

---

## 12. 维护后更新清单

> **每次完成维护任务后，AI 必须逐项检查并更新本文件。**

### 12.1 必须检查的项目

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

### 12.2 更新格式

- 在文件顶部的「最后更新」日期改为当天。
- 如果改动较大，在 commit message 中写明 `docs: update AGENTS.md for <改动摘要>`。

### 12.3 自检问题

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
