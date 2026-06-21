# Ximo Mall

**AI 电商详情页生成与编辑工作台**

> 本项目基于 [banana-mall](https://github.com/) 二次开发，在原项目基础上进行了品牌更名、主图硬约束体系升级、风格差异化增强、文字准确性强化等改进。
>
> This project is a secondary development based on [banana-mall](https://github.com/), with brand renaming, hero image hard-constraint system upgrades, style differentiation enhancements, text accuracy reinforcement, and other improvements.

---

## 中文说明

### 项目简介

Ximo Mall 是一款 AI 驱动的电商详情页自动生成与编辑工具。用户只需上传商品图片，AI 即可自动完成商品分析、文案规划、图片生成全流程，输出可直接用于电商平台的高质量详情页。

支持 5 大电商平台、20 种视觉风格、10 项主图硬约束，通过 AI Agent 对话式交互实现"一句话生成详情页"。

### 核心功能

#### 1. AI Agent 对话式生成

基于 Mastra 框架的 AI Agent，以 doubao-seed-2-0-lite-260428 为主控模型（支持视觉输入 + 深度思考），调度 7 个专用工具自动执行 5 步流程：

- **创建项目** → 上传图片 + AI 视觉分析 + 图片语义标签（MAIN/PACKAGING/REFERENCE）
- **联网搜索** → 百度 AI 搜索获取市场情报
- **文案规划** → deepseek-v4-flash 规划详情页各模块文案和视觉方向
- **图片生成** → wan2.7-image 生成头图和详情页图片
- **结果汇报** → 汇总生成结果

支持两种模式：
- **自动模式**：一键执行全流程，无需人工干预
- **问答模式**：逐步确认，每步可调整

支持前端选择器：平台 / 风格 / 模式 / 头图张数 / 联网搜索开关。支持 `heroCount=0` 只生成详情页不生成头图。

模型深度思考链路（reasoning_content）实时展示在前端，工具调用过程可视化。

#### 2. 20 种视觉风格

5 大风格分类，20 种差异化视觉风格，每种风格通过 7 维度视觉约束（配色/排版/材质/灯光/氛围/道具/营销元素）+ 主图风格适配（构图/标题/营销/氛围/口味）+ 硬约束风格化执行（`hardConstraintStyling`）实现真正的视觉差异化：

| 分类 | 风格 |
|------|------|
| **摄影写实** | 极简主义、浓郁食欲/街潮、真实诱人美食摄影、日系清新/文艺、精修产品/高端质感、健康/轻食代餐 |
| **插画艺术** | 国潮插画、复古中国风、创意手绘/涂鸦、憨萌卡通/童趣 |
| **促销营销** | 节日促销/大促氛围 |
| **场景叙事** | 温暖家常/亲民、地域风情/城市记忆、简约实景/生活化场景、母婴亲子/宝宝辅食 |
| **概念创意** | 意境山水/水墨、现代信息图表、C4D/3D 立体、参数化/科技几何、动态/短视频风格 |

**风格差异化机制**：风格只决定视觉表现形式（颜色/字体/材质/形状/布局位置），不删减元素数量或留白。同一种产品在不同风格下，硬约束元素类别完全一致，但视觉呈现截然不同。

#### 3. 10 项主图硬约束（HC1-HC10）

从合格电商主图中提炼的 10 项必备元素，强制注入规划和生成全流程：

| 编号 | 硬约束 | 说明 |
|------|--------|------|
| HC1 | 信息密度 100% | 每个角落都有视觉或文字内容，禁止 >5% 无内容空白区 |
| HC2 | 双主体展示 | 产品包装 3D 透视 + 成品食物大图同时出现 |
| HC3 | 三层标题系统 | 品牌名+Logo / 主标题+副标题 / 顶部 2-3 个胶囊卖点条 |
| HC4 | 侧边卖点条 | 左/右侧 4-5 个图标+文字卖点条 |
| HC5 | 底部强对比横幅 | 贯穿画面的强对比色横幅，含 3-4 个核心卖点关键词 |
| HC6 | 角标/徽章系统 | 至少 3 个不同位置的角标/徽章 |
| HC7 | 食材/配料可视化 | 5-8 个真实食材/配料散落画面周围 |
| HC8 | 调味料包独立展示 | 1-2 个调味料包作为独立视觉元素 |
| HC9 | 强色彩分区 | 2-3 色主调，色块/背景/横幅视觉分区 |
| HC10 | 品牌信息完整 | 品牌 Logo / 品牌名 / 产品名 / 净含量至少 3 项可视化 |

- **主图 hero_01**：必须同时满足全部 10 项硬约束
- **副图 hero_02-05**：按角色侧重不同硬约束子集（至少 6 项），信息密度 ≥ 主图 80%

硬约束在三个阶段强制注入：
- **规划阶段**：`planning.ts` 的 `HERO CONTENT TEMPLATE` + `buildZeroBlankAndLayerRule`
- **生成阶段**：`generation.ts` 的 `buildHeroIdentityInstruction` + `buildHeroFrameFullnessInstruction` + `buildMarketingElementLayoutInstruction` + `FINAL STYLE ENFORCEMENT`
- **审核阶段**：Agent instructions 中的 10 项硬约束审核清单，缺失则自动用 `updateSectionTool` 补齐

#### 4. 产品知识库

用户可自由创建产品条目，上传多张产品图片。AI 逐张调用商品分析模型提取产品核心信息，自动拆分为知识条目：

- **分析流水线**：上传 N 张图片 → 逐张分析 → 自动拆分为知识条目 → 存入知识库
- **知识分类**：使用场景 / 核心卖点 / 产品规格 / 材质 / 目标人群 / 品牌信息 / 其他
- **约束生成**：选择知识库后，全链路（分析→规划→生成）强制约束卖点/规格/场景等事实性内容来自知识库
- **检索方式**：关键词搜索

#### 5. 商品 AI 分析

AI 分析商品图片，提取结构化信息：
- 商品名称、类目、材质
- 核心卖点（3-5 个）
- 目标人群画像
- 使用场景（3-5 个）
- 口味/风味特征
- 视觉关键词

知识库模式下通过 `analyzeWithKnowledgeConstraint` 以知识库为地面真相进行约束分析，确保 AI 不脱离事实。

#### 6. 文案规划

基于商品分析结果，AI 规划详情页各个模块的文案和视觉方向：
- **10 种模块类型**：头图主视觉、卖点模块、场景展示、细节特写、规格参数、材质工艺、对比说明、送礼场景、品牌信任、总结收口
- **风格模板注入**：7 维度视觉约束（配色/排版/材质/灯光/氛围/道具/营销元素）
- **主图风格适配**：20 种风格的差异化构图/标题/营销/氛围/口味规则
- **硬约束风格化执行**：`hardConstraintStyling` 定义每种风格下 10 项硬约束的视觉表现形式
- **零空白规则**：4 层深度（前景配料/中景产品/背景环境/营销覆盖层），每层必须有内容

#### 7. 图像生成

AI 根据规划和文案生成详情页各模块图片：
- **头图生成**：wan2.7-image，支持 referenceSemanticTypes 按语义类型筛选参考图
- **详情页生成**：wan2.7-image，各模块独立生成
- **风格视觉约束**：`buildStyleVisualConstraint()` + `buildHeroStyleIdentity()` 双重注入
- **统一高密度路径**：`isLowDensityHeroStyle()` 永远返回 false，所有风格统一走高密度饱满标准
- **文字准确性**：TEXT ACCURACY RULE 减少生成图中的错别字

#### 8. 图片精调

对已生成的图片进行 AI 精调/编辑：
- **整体重绘/增强**（edit-image）：整体风格调整、画质增强
- **定向微调/P 图**（refine-image）：局部修改、细节调整
- **图片超分**（upscale-image）：高清放大
- 均支持 `referenceSemanticTypes` 按语义类型筛选参考图

#### 9. 编辑器工作台

可视化编辑详情页各模块：
- 编辑文案、视觉提示词、图片
- 版本管理
- 参考图选择器（按语义类型筛选）

#### 10. AI 学习系统

用户投喂商品图片，AI 学习风格、配色、布局、文案等知识：
- 完整的学习 → 审查 → 应用工作流
- 知识约束控制（置信度阈值、频率限制、类型白名单/黑名单）
- 跨 Agent 知识应用追踪

#### 11. 图片库

集中管理所有上传的图片资产：
- 分类、标签、集合
- 搜索
- 统计

#### 12. Provider 管理

配置 AI 服务提供商（OpenAI 兼容 API）：
- 自动发现模型列表
- 自动检测模型能力（text / vision / image_gen / image_edit / structured_output）
- 模型角色分配（分析 / 规划 / 头图生成 / 详情图生成 / 图片编辑）
- 连接测试
- API Key AES-256-GCM 加密存储

#### 13. MCP Server

标准 MCP (Model Context Protocol) Server，允许外部 AI 工具调用 Ximo Mall 功能：
- 支持 Claude Desktop / Cursor 等工具通过标准协议调用
- 支持 stdio 和 HTTP 两种传输方式
- 独立进程，与主应用分离
- 内置 Web UI 控制台

#### 14. 外部 Agent API

面向本地/内网外部应用的标准化 API：
- 标准 SSE 格式
- 支持纯文本 + 图片输入
- 事件类型：text / tool_call / tool_result / reasoning / done / error
- 提供 TypeScript 和 Python 连接器示例

#### 15. 导出

将生成的详情页导出为图片或 JSON 结构数据。

#### 16. API 用量监控

记录和展示 API 调用量、Token 消耗等使用指标。

#### 17. Electron 桌面端

Windows 桌面应用：
- 内置 Next.js 服务，自动启动
- 自动执行 Prisma 迁移
- 支持 NSIS 安装包和绿色免安装版
- 使用 better-sqlite3 作为 SQLite 驱动

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15.5.7 + React 18 + TypeScript + Tailwind CSS + Radix UI |
| **后端** | Next.js API Routes + Prisma (SQLite) |
| **AI 框架** | Mastra Agent + @ai-sdk |
| **AI 模型** | doubao-seed-2-0-lite-260428（主控/分析）、deepseek-v4-flash-260425（规划）、wan2.7-image（图像生成/编辑） |
| **状态管理** | Zustand |
| **桌面端** | Electron |
| **协议** | MCP (Model Context Protocol) |
| **数据库** | SQLite (Prisma ORM) |
| **加密** | AES-256-GCM |
| **校验** | Zod |

### 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入：
#   DATABASE_URL       — SQLite 数据库路径
#   ENCRYPTION_KEY     — API Key 加密密钥
#   以及各 AI Provider 的 API Key

# 3. 初始化数据库
npm run prisma:migrate

# 4. 启动开发服务器
npm run dev

# 5. 打开浏览器访问
# http://localhost:3000
```

### 桌面端构建

```bash
# 构建 Windows 安装包（NSIS）
npm run dist:win

# 构建绿色免安装版
npm run dist:green
```

### 项目结构

```
ximo-mall/
├── app/                          # Next.js App Router 页面和 API 路由
│   ├── api/                      # RESTful API 路由
│   │   ├── ai-agent/             # AI Agent 前端 API（UIMessageStream）
│   │   ├── agent/                # 外部 Agent API（标准 SSE）
│   │   ├── assets/               # 资产管理
│   │   ├── files/                # 文件服务
│   │   ├── image-tune/           # 图片精调
│   │   ├── knowledge/            # 知识约束
│   │   ├── learning/             # AI 学习系统
│   │   ├── library/              # 图片库
│   │   ├── mcp/                  # MCP 集成
│   │   ├── monitor/              # 用量监控
│   │   ├── product-library/      # 产品知识库
│   │   ├── projects/             # 项目+分析+规划+生成+导出
│   │   ├── providers/            # AI Provider 管理
│   │   └── tasks/                # 异步任务管理
│   ├── ai-agent/                 # AI Agent 页面
│   ├── image-tune/               # 图片精调页面
│   ├── learning/                 # AI 学习页面
│   ├── library/                  # 图片库页面
│   ├── mcp/                      # MCP 控制台页面
│   ├── product-library/          # 产品知识库页面
│   ├── projects/                 # 项目管理页面
│   └── settings/                 # 设置页面
├── components/                   # React 组件
│   ├── ai-agent/                 # AI Agent 工作台
│   ├── analysis/                 # 商品分析工作台
│   ├── editor/                   # 编辑器工作台
│   ├── export/                   # 导出面板
│   ├── image-tune/               # 图片精调
│   ├── layout/                   # 布局组件（AppShell, Theme, API Indicator）
│   ├── mcp/                      # MCP 控制台
│   ├── planner/                  # 文案规划工作台
│   ├── projects/                 # 项目创建/列表
│   ├── providers/                # Provider 设置
│   ├── shared/                   # 通用组件
│   └── ui/                       # 基础 UI 组件（Radix UI + Tailwind）
├── hooks/                        # 自定义 React Hooks
├── lib/                          # 核心业务逻辑
│   ├── ai/                       # AI 集成层
│   │   ├── adapters/             # AI Provider 适配器（OpenAI 兼容）
│   │   ├── prompts/              # AI 提示词模板
│   │   │   ├── style-templates.ts        # 20 种风格 7 维度视觉约束
│   │   │   ├── hero-style-adaptations.ts # 20 种风格主图差异化适配 + 硬约束风格化
│   │   │   ├── planning.ts               # 规划阶段 prompt + 10 项硬约束框架
│   │   │   └── generation.ts             # 生成阶段 prompt + 硬约束强制执行
│   │   ├── schemas/              # AI 输出 Zod Schema
│   │   ├── capability-detector.ts # 模型能力自动检测
│   │   ├── model-matcher.ts      # 模型角色匹配
│   │   └── provider-client.ts    # 统一 AI 调用客户端
│   ├── db/                       # 数据库（Prisma 单例）
│   ├── monitor/                  # API 用量监控
│   ├── services/                 # 业务服务层
│   ├── storage/                  # 文件存储层
│   ├── utils/                    # 工具函数（加密/路由/校验等）
│   └── validations/              # Zod 校验 Schema
├── mastra/                       # Mastra AI Agent 框架
│   ├── agents/                   # Agent 定义（ximo-mall-agent）
│   ├── tools/                    # 7 个 Agent 工具
│   │   ├── create-project.ts     # 创建项目 + 视觉分析 + 语义标签
│   │   ├── plan-sections.ts      # 文案规划
│   │   ├── generate-hero-image.ts # 头图生成
│   │   ├── generate-detail-image.ts # 详情图生成
│   │   ├── edit-image.ts         # 整体重绘/增强
│   │   ├── refine-image.ts       # 定向微调/P图
│   │   └── web-search.ts         # 百度 AI 搜索
│   ├── index.ts                  # Mastra 入口
│   └── model-provider.ts         # 动态 Provider 实例创建
├── mcp-server/                   # 独立 MCP Server
│   ├── src/                      # Server 实现（stdio + HTTP）
│   └── ui/                       # Web 控制台
├── prisma/                       # Prisma Schema + 迁移文件
├── desktop/                      # Electron 桌面应用
├── scripts/                      # 构建/运行脚本
├── types/                        # TypeScript 类型定义
├── examples/                     # 外部连接器示例（TypeScript + Python）
└── storage/                      # 运行时文件存储（git 忽略）
```

### 数据流

```
用户上传图片 → AI Agent / 手动操作
                    ↓
            商品分析（doubao-seed）
                    ↓
            文案规划（deepseek-v4-flash）
            ├── 风格模板 7 维度约束
            ├── 主图风格适配（20 种）
            ├── 10 项硬约束框架
            └── 零空白 + 4 层深度规则
                    ↓
            图像生成（wan2.7-image）
            ├── 风格视觉约束
            ├── 硬约束强制执行（HC1-HC10）
            ├── 画面饱满度量化
            ├── 营销元素布局规范
            └── 文字准确性规则
                    ↓
            图片精调（可选）
                    ↓
            导出（图片 / JSON）
```

### 与 banana-mall 的主要差异

1. **品牌更名**：banana-mall → ximo-mall
2. **主图硬约束体系**：新增 10 项硬约束（HC1-HC10），所有风格统一执行高密度饱满标准，主图必须同时满足全部 10 项
3. **风格差异化增强**：通过 `hardConstraintStyling` 让每种风格自由决定硬约束的视觉表现形式，风格只改"样子"不改"存在"
4. **副图硬约束**：hero_02-05 按角色明确必须覆盖的硬约束子集（至少 6 项），信息密度 ≥ 主图 80%
5. **生成阶段硬约束**：`generation.ts` 全面重写主图/副图指令，从旧的"左区/右区/顶部/底部"分区改为 HC1-HC10 硬约束框架
6. **文字准确性强化**：新增 TEXT ACCURACY RULE，列出高频错别字模式和准确性策略
7. **零空白规则升级**：`buildZeroBlankAndLayerRule` 与硬约束对齐，禁止 >5% 无内容区域，营销覆盖层必须包含顶部横幅+底部横幅+侧边条+角标
8. **Agent 审核清单**：Agent instructions 中新增 10 项硬约束审核，规划完成后逐项检查 visualPrompt，缺项自动补齐

---

## English README

### Overview

Ximo Mall is an AI-powered e-commerce detail page generation and editing workspace. Simply upload product images, and the AI automatically handles product analysis, copywriting, layout planning, and image generation — producing high-quality detail pages ready for e-commerce platforms.

Supports 5 e-commerce platforms, 20 visual styles, and 10 hero image hard constraints, achieving "generate a detail page with one sentence" through AI Agent conversational interaction.

### Key Features

#### 1. AI Agent Chat-based Generation

Built on the Mastra framework with doubao-seed-2-0-lite-260428 as the main model (vision + deep thinking), orchestrating 7 specialized tools in a 5-step pipeline:

- **Create Project** → Upload images + AI visual analysis + semantic tags (MAIN/PACKAGING/REFERENCE)
- **Web Search** → Baidu AI Search for market intelligence
- **Section Planning** → deepseek-v4-flash plans copy and visual direction for each module
- **Image Generation** → wan2.7-image generates hero and detail page images
- **Result Report** → Summarize generation results

Two modes supported:
- **Auto mode**: One-click full pipeline, no manual intervention
- **Q&A mode**: Step-by-step confirmation, adjustable at each step

Front-end selectors: Platform / Style / Mode / Hero count / Web search toggle. Supports `heroCount=0` for detail-page-only generation.

Model deep-thinking chain (reasoning_content) displayed in real-time; tool calls visualized.

#### 2. 20 Visual Styles

5 style categories, 20 differentiated visual styles. Each style implements true visual differentiation through 7-dimension visual constraints + hero style adaptation + hard constraint styling (`hardConstraintStyling`):

| Category | Styles |
|----------|--------|
| **Photographic** | Minimalist, Street Appetite, Realistic Food Photo, Japanese Fresh, Premium Product, Healthy Light |
| **Illustration** | Guochao Illustration, Vintage Chinese, Creative Hand-drawn, Cute Cartoon |
| **Promotional** | Festival Promo |
| **Narrative** | Warm Homestyle, Regional Memory, Lifestyle Scene, Baby Parenting |
| **Conceptual** | Ink Wash, Infographic, C4D/3D, Tech Geometric, Dynamic Video |

**Style differentiation mechanism**: Styles only determine visual expression (color/font/material/shape/layout), NOT element count or whitespace. The same product under different styles has identical hard constraint element categories but completely different visual presentations.

#### 3. 10 Hero Image Hard Constraints (HC1-HC10)

10 mandatory elements distilled from qualified e-commerce hero images, enforced throughout planning and generation:

| # | Hard Constraint | Description |
|---|----------------|-------------|
| HC1 | 100% Info Density | Every corner has visual/text content; no >5% blank zones |
| HC2 | Dual Subjects | Product packaging 3D perspective + finished food hero shot simultaneously |
| HC3 | 3-Layer Title System | Brand name+Logo / Main headline+Sub-headline / Top 2-3 capsule selling-point tags |
| HC4 | Side Selling-Point Bar | 4-5 icon+text selling points on left/right side |
| HC5 | Bottom High-Contrast Banner | Full-width high-contrast banner with 3-4 core selling-point keywords |
| HC6 | Badge/Corner-Tag System | At least 3 badges/corner tags in different positions |
| HC7 | Ingredient Visualization | 5-8 real food ingredients/garnishes scattered around the product |
| HC8 | Seasoning Packet Display | 1-2 seasoning packets as independent visual elements |
| HC9 | Strong Color Zoning | 2-3 dominant colors with clear visual zoning |
| HC10 | Complete Brand Info | At least 3 of: brand Logo, brand name, product name, net weight/specs |

- **Primary hero (hero_01)**: Must satisfy ALL 10 hard constraints
- **Secondary heroes (hero_02-05)**: Must cover at least 6 role-specific constraints; info density ≥ 80% of primary

Hard constraints enforced at three stages:
- **Planning**: `planning.ts` HERO CONTENT TEMPLATE + `buildZeroBlankAndLayerRule`
- **Generation**: `generation.ts` `buildHeroIdentityInstruction` + `buildHeroFrameFullnessInstruction` + `buildMarketingElementLayoutInstruction` + `FINAL STYLE ENFORCEMENT`
- **Review**: Agent instructions include 10-item hard constraint checklist; missing items auto-filled via `updateSectionTool`

#### 4. Product Knowledge Base

Create product entries, upload multiple product images. AI analyzes each image to extract core product information and auto-splits into knowledge entries:

- **Analysis Pipeline**: Upload N images → per-image analysis → auto-split into knowledge entries → store
- **Knowledge Categories**: Usage Scenario / Selling Point / Specification / Material / Target Audience / Brand Info / Other
- **Constrained Generation**: After selecting a knowledge base, the entire pipeline (analysis→planning→generation) constrains factual content to knowledge base facts
- **Search**: Keyword search

#### 5. AI Product Analysis

AI analyzes product images to extract structured information:
- Product name, category, material
- Core selling points (3-5)
- Target audience profile
- Usage scenarios (3-5)
- Flavor/taste characteristics
- Visual keywords

In knowledge base mode, `analyzeWithKnowledgeConstraint` uses the knowledge base as ground truth for constrained analysis.

#### 6. Copywriting & Layout Planning

AI plans copy and visual direction for each detail page module:
- **10 module types**: Hero, Selling Points, Scenario, Detail Close-up, Specs, Material, Comparison, Gift Scene, Brand Trust, Summary
- **Style template injection**: 7-dimension visual constraints
- **Hero style adaptation**: Differentiated composition/title/marketing/atmosphere/flavor rules for 20 styles
- **Hard constraint styling**: `hardConstraintStyling` defines visual expression of 10 hard constraints per style
- **Zero-blank rule**: 4 depth layers (foreground garnish / midground product / background environment / marketing overlay), each must have content

#### 7. Image Generation

AI generates detail page images based on planning and copy:
- **Hero generation**: wan2.7-image with `referenceSemanticTypes` for semantic reference image filtering
- **Detail page generation**: wan2.7-image, independent per module
- **Style visual constraints**: `buildStyleVisualConstraint()` + `buildHeroStyleIdentity()` dual injection
- **Unified high-density path**: `isLowDensityHeroStyle()` always returns false
- **Text accuracy**: TEXT ACCURACY RULE reduces typos in generated images

#### 8. Image Refinement

AI-powered image editing:
- **Full repaint/enhance** (edit-image): Overall style adjustment, quality enhancement
- **Targeted refinement** (refine-image): Local modifications, detail adjustments
- **Super-resolution** (upscale-image): HD upscaling
- All support `referenceSemanticTypes` for semantic reference image filtering

#### 9. Editor Workspace

Visual editing of detail page modules:
- Edit copy, visual prompts, images
- Version management
- Reference image selector (filtered by semantic type)

#### 10. AI Learning System

Feed product images for AI to learn style, color, layout, and copywriting patterns:
- Complete learn → review → apply workflow
- Knowledge constraint control (confidence threshold, frequency limits, type allowlist/blocklist)
- Cross-agent knowledge application tracking

#### 11. Image Library

Centralized management of uploaded image assets:
- Categories, tags, collections
- Search
- Statistics

#### 12. Provider Management

Configure AI service providers (OpenAI-compatible API):
- Auto-discover model list
- Auto-detect model capabilities (text / vision / image_gen / image_edit / structured_output)
- Model role assignment (analysis / planning / hero image / detail image / image edit)
- Connection testing
- API Key AES-256-GCM encrypted storage

#### 13. MCP Server

Standard MCP (Model Context Protocol) Server for external AI tool integration:
- Works with Claude Desktop, Cursor, and other MCP-compatible tools
- Supports stdio and HTTP transport
- Independent process, separate from main application
- Built-in Web UI console

#### 14. External Agent API

Standardized API for local/intranet external applications:
- Standard SSE format
- Supports text + image input
- Event types: text / tool_call / tool_result / reasoning / done / error
- TypeScript and Python connector examples provided

#### 15. Export

Export generated detail pages as images or JSON structural data.

#### 16. API Usage Monitoring

Record and display API call volume, token consumption, and other usage metrics.

#### 17. Electron Desktop

Windows desktop application:
- Built-in Next.js server, auto-start
- Auto-executes Prisma migrations
- NSIS installer and portable versions
- Uses better-sqlite3 as SQLite driver

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15.5.7 + React 18 + TypeScript + Tailwind CSS + Radix UI |
| **Backend** | Next.js API Routes + Prisma (SQLite) |
| **AI Framework** | Mastra Agent + @ai-sdk |
| **AI Models** | doubao-seed-2-0-lite-260428 (main/analysis), deepseek-v4-flash-260425 (planning), wan2.7-image (image gen/edit) |
| **State Management** | Zustand |
| **Desktop** | Electron |
| **Protocol** | MCP (Model Context Protocol) |
| **Database** | SQLite (Prisma ORM) |
| **Encryption** | AES-256-GCM |
| **Validation** | Zod |

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with:
#   DATABASE_URL       — SQLite database path
#   ENCRYPTION_KEY     — API Key encryption key
#   AI Provider API Keys

# 3. Initialize database
npm run prisma:migrate

# 4. Start dev server
npm run dev

# 5. Open browser
# http://localhost:3000
```

### Desktop Build

```bash
# Windows installer (NSIS)
npm run dist:win

# Portable (no-install) version
npm run dist:green
```

### Data Flow

```
User uploads images → AI Agent / Manual operation
                        ↓
                Product Analysis (doubao-seed)
                        ↓
                Section Planning (deepseek-v4-flash)
                ├── Style template 7-dimension constraints
                ├── Hero style adaptation (20 styles)
                ├── 10 hard constraint framework
                └── Zero-blank + 4-layer depth rules
                        ↓
                Image Generation (wan2.7-image)
                ├── Style visual constraints
                ├── Hard constraint enforcement (HC1-HC10)
                ├── Frame fullness quantification
                ├── Marketing element layout rules
                └── Text accuracy rules
                        ↓
                Image Refinement (optional)
                        ↓
                Export (Images / JSON)
```

### Key Differences from banana-mall

1. **Brand Rename**: banana-mall → ximo-mall
2. **Hero Hard-Constraint System**: Added 10 hard constraints (HC1-HC10) — all styles enforce high-density, full-coverage standards; primary hero must satisfy all 10
3. **Style Differentiation Enhancement**: `hardConstraintStyling` lets each style freely determine the visual expression of hard constraints — style changes LOOK, not EXISTENCE
4. **Secondary Hero Constraints**: hero_02-05 have role-specific hard constraint subsets (at least 6); info density ≥ 80% of primary
5. **Generation-Stage Hard Constraints**: `generation.ts` fully rewritten — from old "left/right/top/bottom zone" to HC1-HC10 hard constraint framework
6. **Text Accuracy Reinforcement**: Added TEXT ACCURACY RULE with common typo patterns and accuracy strategies
7. **Zero-Blank Rule Upgrade**: `buildZeroBlankAndLayerRule` aligned with hard constraints; no >5% blank zones; marketing overlay must include top banner + bottom banner + side bar + badges
8. **Agent Review Checklist**: Agent instructions include 10-item hard constraint review; after planning, visualPrompt is checked item by item; missing items auto-filled

---

## License

Private — All rights reserved.

## Acknowledgements

- Based on [banana-mall](https://github.com/) — original AI e-commerce detail page generation platform
