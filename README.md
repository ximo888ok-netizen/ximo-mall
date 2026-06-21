# Ximo Mall 🛒

**AI 电商详情页生成与编辑工作台**

> ⚠️ 本项目基于 [banana-mall](https://github.com/) 二次开发，在原项目基础上进行了品牌更名、主图硬约束体系升级、风格差异化增强等改进。
>
> ⚠️ This project is a secondary development based on [banana-mall](https://github.com/), with brand renaming, hero image hard-constraint system upgrades, style differentiation enhancements, and other improvements.

---

## 中文说明

### 项目简介

Ximo Mall 是一款 AI 驱动的电商详情页自动生成与编辑工具。用户只需上传商品图片，AI 即可自动完成商品分析、文案规划、图片生成全流程，输出可直接用于电商平台的高质量详情页。

### 核心功能

| 功能 | 说明 |
|------|------|
| **AI Agent 对话式生成** | 上传图片 → AI 自动分析 → 规划 → 生成，支持自动/问答两种模式 |
| **20 种视觉风格** | 街潮食欲、国潮纹样、水墨意境、健康轻食、极简留白等，风格决定视觉表现形式 |
| **10 项主图硬约束** | 双主体展示、三层标题、侧边卖点条、底部横幅、角标徽章、配料可视化、料包展示、色彩分区、品牌信息、100% 信息密度 |
| **产品知识库** | 上传产品图片自动提取知识条目，约束 AI 生成不脱离事实 |
| **图片精调** | 整体重绘、定向微调、超分放大 |
| **MCP Server** | 标准 MCP 协议，支持 Claude Desktop / Cursor 等外部 AI 工具调用 |
| **Electron 桌面端** | Windows 桌面应用，内置 Next.js 服务 |

### 技术栈

- **前端**: Next.js 15 + React 18 + TypeScript + Tailwind CSS + Radix UI
- **后端**: Next.js API Routes + Prisma (SQLite)
- **AI 框架**: Mastra Agent + 多模型调度（doubao / deepseek / wan2.7-image 等）
- **桌面端**: Electron
- **协议**: MCP (Model Context Protocol)

### 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL、加密密钥等

# 3. 初始化数据库
npm run prisma:migrate

# 4. 启动开发服务器
npm run dev

# 5. 打开浏览器访问
# http://localhost:3000
```

### 桌面端构建

```bash
# 构建 Windows 安装包
npm run dist:win

# 构建绿色免安装版
npm run dist:green
```

### 项目结构

```
ximo-mall/
├── app/                    # Next.js 页面和 API 路由
├── components/             # React 组件
├── hooks/                  # 自定义 Hooks
├── lib/                    # 核心业务逻辑（服务层、AI 提示词、校验等）
├── mastra/                 # Mastra AI Agent 框架
│   ├── agents/             # Agent 定义
│   └── tools/              # Agent 工具
├── mcp-server/             # 独立 MCP Server
├── prisma/                 # 数据库 Schema + 迁移
├── desktop/                # Electron 桌面应用
├── types/                  # TypeScript 类型定义
└── storage/                # 运行时文件存储（git 忽略）
```

### 与 banana-mall 的主要差异

1. **品牌更名**: banana-mall → ximo-mall
2. **主图硬约束体系**: 新增 10 项硬约束（HC1-HC10），所有风格统一执行高密度饱满标准
3. **风格差异化增强**: 通过 `hardConstraintStyling` 让每种风格自由决定硬约束的视觉表现形式
4. **文字准确性强化**: 新增 TEXT ACCURACY RULE，减少图像生成中的错别字
5. **副图硬约束**: hero_02-05 按角色明确必须覆盖的硬约束子集

---

## English README

### Overview

Ximo Mall is an AI-powered e-commerce detail page generation and editing workspace. Simply upload product images, and the AI automatically handles product analysis, copywriting, layout planning, and image generation — producing high-quality detail pages ready for e-commerce platforms.

### Key Features

| Feature | Description |
|---------|-------------|
| **AI Agent Chat-based Generation** | Upload images → AI auto-analysis → planning → generation, with auto/Q&A modes |
| **20 Visual Styles** | Street appetite, Guochao illustration, ink wash, healthy light, minimalist, etc. — style determines visual expression |
| **10 Hero Image Hard Constraints** | Dual subjects, 3-layer title system, side selling-point bar, bottom banner, badge system, ingredient visualization, seasoning packet display, color zoning, brand info, 100% info density |
| **Product Knowledge Base** | Upload product images to auto-extract knowledge entries, constraining AI generation to factual accuracy |
| **Image Refinement** | Full repaint, targeted refinement, super-resolution upscaling |
| **MCP Server** | Standard MCP protocol — integrate with Claude Desktop, Cursor, and other AI tools |
| **Electron Desktop** | Windows desktop app with built-in Next.js server |

### Tech Stack

- **Frontend**: Next.js 15 + React 18 + TypeScript + Tailwind CSS + Radix UI
- **Backend**: Next.js API Routes + Prisma (SQLite)
- **AI Framework**: Mastra Agent + multi-model orchestration (doubao / deepseek / wan2.7-image, etc.)
- **Desktop**: Electron
- **Protocol**: MCP (Model Context Protocol)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with DATABASE_URL, encryption keys, etc.

# 3. Initialize database
npm run prisma:migrate

# 4. Start dev server
npm run dev

# 5. Open browser
# http://localhost:3000
```

### Desktop Build

```bash
# Windows installer
npm run dist:win

# Portable (no-install) version
npm run dist:green
```

### Project Structure

```
ximo-mall/
├── app/                    # Next.js pages and API routes
├── components/             # React components
├── hooks/                  # Custom hooks
├── lib/                    # Core business logic (services, AI prompts, validations)
├── mastra/                 # Mastra AI Agent framework
│   ├── agents/             # Agent definitions
│   └── tools/              # Agent tools
├── mcp-server/             # Standalone MCP Server
├── prisma/                 # Database schema + migrations
├── desktop/                # Electron desktop app
├── types/                  # TypeScript type definitions
└── storage/                # Runtime file storage (git-ignored)
```

### Key Differences from banana-mall

1. **Brand Rename**: banana-mall → ximo-mall
2. **Hero Hard-Constraint System**: Added 10 hard constraints (HC1-HC10) — all styles enforce high-density, full-coverage standards
3. **Style Differentiation Enhancement**: `hardConstraintStyling` lets each style freely determine the visual expression of hard constraints
4. **Text Accuracy Reinforcement**: Added TEXT ACCURACY RULE to reduce typos in generated images
5. **Secondary Hero Constraints**: hero_02-05 have role-specific hard constraint subsets

---

## License

Private — All rights reserved.

## Acknowledgements

- Based on [banana-mall](https://github.com/) — original AI e-commerce detail page generation platform
