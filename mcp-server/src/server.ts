/**
 * Ximo Mall MCP Server - 核心服务器工厂
 *
 * 创建并配置 McpServer 实例，注册所有与 Ximo Mall Next.js API 交互的工具。
 * 所有工具名称、描述和参数均为中文，便于外部 AI Agent 识别和调用。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "./api-client.js";

// ---------------------------------------------------------------------------
// 共享 API 客户端实例
// ---------------------------------------------------------------------------

const api = new ApiClient();

// ---------------------------------------------------------------------------
// 辅助函数：格式化工具响应
// ---------------------------------------------------------------------------

function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

function err(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// 服务器工厂
// ---------------------------------------------------------------------------

export function createBananaMallMcpServer(): McpServer {
  const server = new McpServer({
    name: "ximo-mall",
    version: "1.0.0",
  });

  // =======================================================================
  // 📁 项目管理
  // =======================================================================

  server.tool(
    "列出所有项目",
    "获取 Ximo Mall 中所有项目的列表",
    {},
    async () => {
      try {
        const data = await api.listProjects();
        return ok(data);
      } catch (e) {
        return err(`列出项目失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建新项目",
    "创建一个新的 Ximo Mall 电商详情页项目",
    {
      项目名称: z.string().describe("项目的名称，例如：'夏季连衣裙详情页'"),
      目标平台: z.enum(["taobao_tmall", "pinduoduo", "xiaohongshu", "douyin_ecommerce", "general_ecommerce"]).describe("目标电商平台：淘宝天猫(taobao_tmall)、拼多多(pinduoduo)、小红书(xiaohongshu)、抖音电商(douyin_ecommerce)、通用电商(general_ecommerce)"),
      视觉风格: z.enum(["minimalist", "guochao_illustration", "vintage_chinese", "creative_handdrawn", "ink_wash", "infographic", "c4d_3d", "street_appetite", "realistic_food_photo", "japanese_fresh", "warm_homestyle", "regional_memory", "lifestyle_scene", "premium_product", "festival_promo", "healthy_light", "cute_cartoon", "baby_parenting", "tech_geometric", "dynamic_video"]).describe("视觉风格：极简主义风(minimalist)、国潮插画风(guochao_illustration)、复古中国风(vintage_chinese)、创意手绘风(creative_handdrawn)、水墨风(ink_wash)、信息图表风(infographic)、C4D/3D风(c4d_3d)、浓郁食欲风(street_appetite)、真实美食摄影(realistic_food_photo)、日系清新(japanese_fresh)、温暖家常(warm_homestyle)、地域风情(regional_memory)、生活化场景(lifestyle_scene)、精修高端(premium_product)、节日促销(festival_promo)、健康轻食(healthy_light)、憨萌卡通(cute_cartoon)、母婴亲子(baby_parenting)、科技几何(tech_geometric)、动态短视频(dynamic_video)"),
      项目描述: z.string().optional().describe("可选的项目描述信息"),
    },
    async ({ 项目名称, 目标平台, 视觉风格, 项目描述 }) => {
      try {
        const data = await api.createProject({ 
          name: 项目名称, 
          platform: 目标平台, 
          style: 视觉风格, 
          description: 项目描述 
        });
        return ok(data);
      } catch (e) {
        return err(`创建项目失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取项目详情",
    "获取指定项目的详细信息，包括所有模块和素材",
    {
      项目ID: z.string().describe("要查询的项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.getProject(项目ID);
        return ok(data);
      } catch (e) {
        return err(`获取项目详情失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新项目",
    "更新项目的属性，如名称、平台、风格、描述等",
    {
      项目ID: z.string().describe("要更新的项目 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段，例如：{\"name\": \"新名称\", \"description\": \"新描述\"}"),
    },
    async ({ 项目ID, 更新字段 }) => {
      try {
        const result = await api.updateProject(项目ID, 更新字段);
        return ok(result);
      } catch (e) {
        return err(`更新项目失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除项目",
    "永久删除指定项目及其所有关联数据",
    {
      项目ID: z.string().describe("要删除的项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.deleteProject(项目ID);
        return ok(data);
      } catch (e) {
        return err(`删除项目失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🔍 商品分析
  // =======================================================================

  server.tool(
    "AI分析商品",
    "使用 AI 分析项目中的商品图片，提取商品特征、卖点等信息",
    {
      项目ID: z.string().describe("要分析的项目 ID"),
      模型ID: z.string().optional().describe("可选：指定使用的 AI 模型 ID"),
    },
    async ({ 项目ID, 模型ID }) => {
      try {
        const data = await api.analyzeProject(项目ID, 模型ID);
        return ok(data);
      } catch (e) {
        return err(`分析商品失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新分析结果",
    "手动更新项目的标准化分析结果",
    {
      项目ID: z.string().describe("项目 ID"),
      分析结果: z.record(z.unknown()).describe("标准化的分析结果对象，包含商品名称、品类、材质、卖点等"),
    },
    async ({ 项目ID, 分析结果 }) => {
      try {
        const data = await api.updateAnalysis(项目ID, 分析结果);
        return ok(data);
      } catch (e) {
        return err(`更新分析结果失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 📐 AI 规划
  // =======================================================================

  server.tool(
    "AI规划详情页",
    "根据商品分析结果，AI 自动生成详情页的模块结构和布局",
    {
      项目ID: z.string().describe("要规划的项目 ID"),
      规划选项: z.object({
        头图数量: z.number().min(3).max(5).optional().describe("头图数量，3-5张"),
        详情模块数量: z.number().min(4).max(10).optional().describe("详情模块数量，4-10个"),
        图片比例: z.enum(["3:4", "9:16"]).optional().describe("图片宽高比"),
        内容语言: z.enum(["zh-CN", "en-US", "ja-JP", "ko-KR"]).optional().describe("内容语言"),
      }).optional().describe("可选的规划配置"),
    },
    async ({ 项目ID, 规划选项 }) => {
      try {
        const data = await api.planSections(项目ID, 规划选项);
        return ok(data);
      } catch (e) {
        return err(`规划详情页失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "初始化自定义模块",
    "为项目创建空白的自定义模块结构（3个头图 + 6个详情模块）",
    {
      项目ID: z.string().describe("项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.initCustomSections(项目ID);
        return ok(data);
      } catch (e) {
        return err(`初始化模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🧩 模块管理
  // =======================================================================

  server.tool(
    "列出所有模块",
    "获取项目中所有详情页模块的列表",
    {
      项目ID: z.string().describe("项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.listSections(项目ID);
        return ok(data);
      } catch (e) {
        return err(`列出模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建模块",
    "在项目中创建一个新的详情页模块",
    {
      项目ID: z.string().describe("项目 ID"),
      模块类型: z.enum(["HERO", "SELLING_POINTS", "SCENARIO", "DETAIL_CLOSEUP", "SPECS", "MATERIAL", "COMPARISON", "GIFT_SCENE", "BRAND_TRUST", "SUMMARY", "CUSTOM"]).describe("模块类型：头图(HERO)、卖点(SELLING_POINTS)、场景(SCENARIO)、细节特写(DETAIL_CLOSEUP)、规格(SPECS)、材质(MATERIAL)、对比(COMPARISON)、送礼场景(GIFT_SCENE)、品牌信任(BRAND_TRUST)、总结(SUMMARY)、自定义(CUSTOM)"),
      标题: z.string().describe("模块标题"),
      目标: z.string().describe("模块的目标和内容方向"),
      文案: z.string().optional().describe("可选的文案内容"),
      视觉提示词: z.string().optional().describe("可选的 AI 图片生成提示词"),
    },
    async ({ 项目ID, 模块类型, 标题, 目标, 文案, 视觉提示词 }) => {
      try {
        const data = await api.createSection(项目ID, { 
          type: 模块类型, 
          title: 标题, 
          goal: 目标, 
          copy: 文案, 
          visualPrompt: 视觉提示词 
        });
        return ok(data);
      } catch (e) {
        return err(`创建模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新模块",
    "更新指定模块的内容，如标题、文案、视觉提示词等",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("要更新的模块 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段，例如：{\"title\": \"新标题\", \"copy\": \"新文案\"}"),
    },
    async ({ 项目ID, 模块ID, 更新字段 }) => {
      try {
        const data = await api.updateSection(项目ID, 模块ID, 更新字段);
        return ok(data);
      } catch (e) {
        return err(`更新模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除模块",
    "删除指定的详情页模块",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("要删除的模块 ID"),
    },
    async ({ 项目ID, 模块ID }) => {
      try {
        const data = await api.deleteSection(项目ID, 模块ID);
        return ok(data);
      } catch (e) {
        return err(`删除模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "排序模块",
    "调整项目中模块的显示顺序",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID列表: z.array(z.string()).describe("按新顺序排列的模块 ID 数组"),
    },
    async ({ 项目ID, 模块ID列表 }) => {
      try {
        const data = await api.reorderSections(项目ID, 模块ID列表);
        return ok(data);
      } catch (e) {
        return err(`排序模块失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🎨 图片生成
  // =======================================================================

  server.tool(
    "生成模块图片",
    "为指定模块生成 AI 图片，基于模块的视觉提示词",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("要生成图片的模块 ID"),
      模型ID: z.string().optional().describe("可选：指定使用的图片生成模型"),
      参考素材ID列表: z.array(z.string()).optional().describe("可选：参考图片的素材 ID 列表"),
    },
    async ({ 项目ID, 模块ID, 模型ID, 参考素材ID列表 }) => {
      try {
        const data = await api.generateSectionImage(项目ID, 模块ID, 模型ID, 参考素材ID列表);
        return ok(data);
      } catch (e) {
        return err(`生成图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "重新生成图片",
    "重新为模块生成图片，可使用不同的模型或参考图",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("模块 ID"),
      选项: z.object({
        模型ID: z.string().optional().describe("图片生成模型 ID"),
        参考素材ID列表: z.array(z.string()).optional().describe("参考图片 ID 列表"),
      }).optional().describe("可选的生成选项"),
    },
    async ({ 项目ID, 模块ID, 选项 }) => {
      try {
        const data = await api.regenerateSectionImage(项目ID, 模块ID, 选项);
        return ok(data);
      } catch (e) {
        return err(`重新生成图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "精修图片",
    "对已生成的图片进行精细调整，如修改细节、调整风格等",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("模块 ID"),
      精修指令: z.string().describe("精修的具体要求，例如：'将背景改为浅蓝色'、'增加产品倒影'"),
      参考素材ID列表: z.array(z.string()).optional().describe("可选：参考图片 ID 列表"),
    },
    async ({ 项目ID, 模块ID, 精修指令, 参考素材ID列表 }) => {
      try {
        const data = await api.refineSectionImage(项目ID, 模块ID, { 
          instruction: 精修指令, 
          referenceAssetIds: 参考素材ID列表 
        });
        return ok(data);
      } catch (e) {
        return err(`精修图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "编辑图片",
    "对模块图片进行编辑，支持重绘和增强两种模式",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("模块 ID"),
      编辑模式: z.enum(["repaint", "enhance"]).optional().describe("编辑模式：重绘(repaint) 或 增强(enhance)"),
      参考素材ID列表: z.array(z.string()).optional().describe("可选：参考图片 ID 列表"),
    },
    async ({ 项目ID, 模块ID, 编辑模式, 参考素材ID列表 }) => {
      try {
        const data = await api.editSectionImage(项目ID, 模块ID, { 
          editMode: 编辑模式, 
          referenceAssetIds: 参考素材ID列表 
        });
        return ok(data);
      } catch (e) {
        return err(`编辑图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "图片微调",
    "对任意图片进行 AI 微调处理，支持指定宽高比和参考图",
    {
      图片数据: z.string().describe("图片的 Base64 编码数据"),
      微调指令: z.string().describe("微调的具体要求"),
      参考图片: z.string().optional().describe("可选：参考图片的 Base64 数据"),
      宽高比: z.enum(["1:1", "3:4", "9:16"]).optional().describe("输出图片的宽高比，默认 9:16"),
    },
    async ({ 图片数据, 微调指令, 参考图片, 宽高比 }) => {
      try {
        const data = await api.tuneImage({ 
          imageBase64: 图片数据, 
          instruction: 微调指令, 
          referenceBase64: 参考图片, 
          aspectRatio: 宽高比 
        });
        return ok(data);
      } catch (e) {
        return err(`图片微调失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 📑 版本管理
  // =======================================================================

  server.tool(
    "列出版本历史",
    "获取指定模块的所有版本历史记录",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("模块 ID"),
    },
    async ({ 项目ID, 模块ID }) => {
      try {
        const data = await api.listSectionVersions(项目ID, 模块ID);
        return ok(data);
      } catch (e) {
        return err(`列出版本失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "激活版本",
    "将模块恢复到指定的历史版本",
    {
      项目ID: z.string().describe("项目 ID"),
      模块ID: z.string().describe("模块 ID"),
      版本ID: z.string().describe("要激活的版本 ID"),
    },
    async ({ 项目ID, 模块ID, 版本ID }) => {
      try {
        const data = await api.activateVersion(项目ID, 模块ID, 版本ID);
        return ok(data);
      } catch (e) {
        return err(`激活版本失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🖼️ 素材管理
  // =======================================================================

  server.tool(
    "上传素材",
    "上传商品图片素材到项目中",
    {
      项目ID: z.string().describe("项目 ID"),
      素材类型: z.enum(["MAIN", "ANGLE", "DETAIL", "REFERENCE"]).describe("素材类型：主图(MAIN)、多角度图(ANGLE)、细节图(DETAIL)、参考图(REFERENCE)"),
      文件名: z.string().describe("文件名"),
      MIME类型: z.string().describe("文件的 MIME 类型，如 image/png, image/jpeg"),
      Base64数据: z.string().describe("文件的 Base64 编码数据"),
    },
    async ({ 项目ID, 素材类型, 文件名, MIME类型, Base64数据 }) => {
      try {
        const data = await api.uploadAsset(项目ID, { 
          type: 素材类型, 
          fileName: 文件名, 
          mimeType: MIME类型, 
          base64Data: Base64数据 
        });
        return ok(data);
      } catch (e) {
        return err(`上传素材失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除素材",
    "删除指定的素材文件",
    {
      素材ID: z.string().describe("要删除的素材 ID"),
    },
    async ({ 素材ID }) => {
      try {
        const data = await api.deleteAsset(素材ID);
        return ok(data);
      } catch (e) {
        return err(`删除素材失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "设为主图",
    "将指定素材设置为项目的主图",
    {
      素材ID: z.string().describe("要设为主图的素材 ID"),
    },
    async ({ 素材ID }) => {
      try {
        const data = await api.setMainAsset(素材ID);
        return ok(data);
      } catch (e) {
        return err(`设为主图失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "导出项目JSON",
    "将项目数据导出为 JSON 格式",
    {
      项目ID: z.string().describe("要导出的项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.exportProjectJson(项目ID);
        return ok(data);
      } catch (e) {
        return err(`导出 JSON 失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "导出项目图片包",
    "将项目的所有图片打包导出为 ZIP 文件",
    {
      项目ID: z.string().describe("要导出的项目 ID"),
    },
    async ({ 项目ID }) => {
      try {
        const data = await api.exportProjectImages(项目ID);
        return ok(data);
      } catch (e) {
        return err(`导出图片包失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 📚 图片知识库
  // =======================================================================

  server.tool(
    "列出知识库图片",
    "分页查询图片知识库中的图片，支持搜索和筛选",
    {
      搜索关键词: z.string().optional().describe("可选：搜索关键词"),
      分类ID: z.string().optional().describe("可选：按分类筛选"),
      页码: z.number().optional().describe("页码，默认 1"),
      每页数量: z.number().optional().describe("每页数量，默认 20，最大 100"),
    },
    async ({ 搜索关键词, 分类ID, 页码, 每页数量 }) => {
      try {
        const data = await api.listLibraryItems({ 
          query: 搜索关键词, 
          categoryId: 分类ID, 
          page: 页码, 
          pageSize: 每页数量 
        });
        return ok(data);
      } catch (e) {
        return err(`列出知识库图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取知识库图片详情",
    "获取知识库中单张图片的详细信息",
    {
      图片ID: z.string().describe("图片 ID"),
    },
    async ({ 图片ID }) => {
      try {
        const data = await api.getLibraryItem(图片ID);
        return ok(data);
      } catch (e) {
        return err(`获取图片详情失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新知识库图片",
    "更新知识库图片的元数据，如标题、描述、分类、标签等",
    {
      图片ID: z.string().describe("图片 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段，例如：{\"title\": \"新标题\", \"categoryId\": \"分类ID\"}"),
    },
    async ({ 图片ID, 更新字段 }) => {
      try {
        const data = await api.updateLibraryItem(图片ID, 更新字段);
        return ok(data);
      } catch (e) {
        return err(`更新图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除知识库图片",
    "从知识库中删除指定图片",
    {
      图片ID: z.string().describe("要删除的图片 ID"),
    },
    async ({ 图片ID }) => {
      try {
        const data = await api.deleteLibraryItem(图片ID);
        return ok(data);
      } catch (e) {
        return err(`删除图片失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取知识库统计",
    "获取图片知识库的整体统计信息",
    {},
    async () => {
      try {
        const data = await api.getLibraryStats();
        return ok(data);
      } catch (e) {
        return err(`获取统计信息失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // 分类管理
  server.tool(
    "列出图片分类",
    "获取知识库中所有图片分类的列表",
    {},
    async () => {
      try {
        const data = await api.listCategories();
        return ok(data);
      } catch (e) {
        return err(`列出分类失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建图片分类",
    "在知识库中创建新的图片分类",
    {
      分类数据: z.object({
        name: z.string().describe("分类名称"),
        description: z.string().optional().describe("分类描述"),
        parentId: z.string().optional().describe("父分类 ID，用于创建子分类"),
      }).describe("分类信息"),
    },
    async ({ 分类数据 }) => {
      try {
        const data = await api.createCategory(分类数据);
        return ok(data);
      } catch (e) {
        return err(`创建分类失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新图片分类",
    "更新指定分类的信息",
    {
      分类ID: z.string().describe("分类 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段"),
    },
    async ({ 分类ID, 更新字段 }) => {
      try {
        const data = await api.updateCategory(分类ID, 更新字段);
        return ok(data);
      } catch (e) {
        return err(`更新分类失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除图片分类",
    "删除指定的图片分类",
    {
      分类ID: z.string().describe("要删除的分类 ID"),
    },
    async ({ 分类ID }) => {
      try {
        const data = await api.deleteCategory(分类ID);
        return ok(data);
      } catch (e) {
        return err(`删除分类失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // 标签管理
  server.tool(
    "列出图片标签",
    "获取知识库中所有标签的列表",
    {},
    async () => {
      try {
        const data = await api.listTags();
        return ok(data);
      } catch (e) {
        return err(`列出标签失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建图片标签",
    "创建新的图片标签",
    {
      标签数据: z.object({
        name: z.string().describe("标签名称"),
        color: z.string().optional().describe("标签颜色，十六进制色值，如 #FF5733"),
      }).describe("标签信息"),
    },
    async ({ 标签数据 }) => {
      try {
        const data = await api.createTag(标签数据);
        return ok(data);
      } catch (e) {
        return err(`创建标签失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新图片标签",
    "更新指定标签的信息",
    {
      标签ID: z.string().describe("标签 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段"),
    },
    async ({ 标签ID, 更新字段 }) => {
      try {
        const data = await api.updateTag(标签ID, 更新字段);
        return ok(data);
      } catch (e) {
        return err(`更新标签失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除图片标签",
    "删除指定的图片标签",
    {
      标签ID: z.string().describe("要删除的标签 ID"),
    },
    async ({ 标签ID }) => {
      try {
        const data = await api.deleteTag(标签ID);
        return ok(data);
      } catch (e) {
        return err(`删除标签失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // 合集管理
  server.tool(
    "列出图片合集",
    "获取知识库中所有图片合集的列表",
    {},
    async () => {
      try {
        const data = await api.listCollections();
        return ok(data);
      } catch (e) {
        return err(`列出合集失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建图片合集",
    "创建新的图片合集，可同时添加图片",
    {
      合集数据: z.object({
        name: z.string().describe("合集名称"),
        description: z.string().optional().describe("合集描述"),
        isPublic: z.boolean().optional().describe("是否公开"),
        itemIds: z.array(z.string()).optional().describe("初始图片 ID 列表"),
      }).describe("合集信息"),
    },
    async ({ 合集数据 }) => {
      try {
        const data = await api.createCollection(合集数据);
        return ok(data);
      } catch (e) {
        return err(`创建合集失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取图片合集详情",
    "获取指定合集的详细信息，包含其中的图片列表",
    {
      合集ID: z.string().describe("合集 ID"),
    },
    async ({ 合集ID }) => {
      try {
        const data = await api.getCollection(合集ID);
        return ok(data);
      } catch (e) {
        return err(`获取合集详情失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新图片合集",
    "更新合集信息，或对合集中的图片进行添加、移除、排序操作",
    {
      合集ID: z.string().describe("合集 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段或操作参数"),
      操作类型: z.enum(["addItem", "removeItem", "reorder"]).optional().describe("操作类型：添加图片(addItem)、移除图片(removeItem)、重新排序(reorder)"),
    },
    async ({ 合集ID, 更新字段, 操作类型 }) => {
      try {
        const data = await api.updateCollection(合集ID, 更新字段, 操作类型);
        return ok(data);
      } catch (e) {
        return err(`更新合集失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除图片合集",
    "删除指定的图片合集",
    {
      合集ID: z.string().describe("要删除的合集 ID"),
    },
    async ({ 合集ID }) => {
      try {
        const data = await api.deleteCollection(合集ID);
        return ok(data);
      } catch (e) {
        return err(`删除合集失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🧠 AI 学习系统
  // =======================================================================

  server.tool(
    "列出学习会话",
    "获取所有 AI 学习会话的列表，可查看知识统计",
    {
      会话ID: z.string().optional().describe("可选：指定会话 ID 获取单个会话详情"),
      返回统计: z.boolean().optional().describe("是否返回知识统计数据"),
    },
    async ({ 会话ID, 返回统计 }) => {
      try {
        const data = await api.listLearningSessions({ 
          sessionId: 会话ID, 
          stats: 返回统计 
        });
        return ok(data);
      } catch (e) {
        return err(`列出学习会话失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "创建学习会话",
    "创建一个新的 AI 学习会话，用于学习图片风格和布局",
    {
      会话名称: z.string().describe("学习会话的名称"),
      会话描述: z.string().optional().describe("可选：会话描述"),
      自动应用: z.boolean().optional().describe("学习完成后是否自动应用知识"),
    },
    async ({ 会话名称, 会话描述, 自动应用 }) => {
      try {
        const data = await api.createLearningSession({ 
          name: 会话名称, 
          description: 会话描述, 
          autoApply: 自动应用 
        });
        return ok(data);
      } catch (e) {
        return err(`创建学习会话失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新学习会话",
    "更新学习会话的配置信息",
    {
      会话ID: z.string().describe("会话 ID"),
      更新字段: z.record(z.unknown()).describe("要更新的字段"),
    },
    async ({ 会话ID, 更新字段 }) => {
      try {
        const data = await api.updateLearningSession(会话ID, 更新字段);
        return ok(data);
      } catch (e) {
        return err(`更新学习会话失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "删除学习会话",
    "删除指定的学习会话",
    {
      会话ID: z.string().describe("要删除的会话 ID"),
    },
    async ({ 会话ID }) => {
      try {
        const data = await api.deleteLearningSession(会话ID);
        return ok(data);
      } catch (e) {
        return err(`删除学习会话失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取分类学习",
    "获取指定分类（头图/详情图）的学习会话和进度",
    {
      分类: z.enum(["hero", "detail"]).describe("学习分类：头图(hero) 或 详情图(detail)"),
    },
    async ({ 分类 }) => {
      try {
        const data = await api.getCategorySession(分类);
        return ok(data);
      } catch (e) {
        return err(`获取分类学习失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "控制学习过程",
    "启动、停止或重试指定分类的学习过程",
    {
      分类: z.enum(["hero", "detail"]).describe("学习分类：头图(hero) 或 详情图(detail)"),
      操作: z.enum(["start", "stop", "retry"]).optional().describe("操作类型：启动(start)、停止(stop)、重试失败项(retry)，默认 start"),
    },
    async ({ 分类, 操作 }) => {
      try {
        const data = await api.startLearning(分类, 操作);
        return ok(data);
      } catch (e) {
        return err(`控制学习过程失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "审查学习结果",
    "审批或拒绝学习会话中生成的知识",
    {
      分类: z.enum(["hero", "detail"]).describe("学习分类"),
      操作: z.enum(["approve", "reject"]).describe("审批操作：批准(approve) 或 拒绝(reject)"),
      批准的知识ID列表: z.array(z.string()).optional().describe("批准时：要批准的知识 ID 列表"),
      拒绝原因: z.string().optional().describe("拒绝时：拒绝原因"),
    },
    async ({ 分类, 操作, 批准的知识ID列表, 拒绝原因 }) => {
      try {
        const data = await api.reviewLearning(分类, { 
          action: 操作, 
          approvedKnowledgeIds: 批准的知识ID列表, 
          rejectReason: 拒绝原因 
        });
        return ok(data);
      } catch (e) {
        return err(`审查学习结果失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "列出知识条目",
    "获取 AI 学习系统中提取的知识条目",
    {
      会话ID: z.string().optional().describe("可选：按会话筛选"),
      知识类型: z.enum(["STYLE", "LAYOUT", "TYPOGRAPHY", "COLOR", "SCENE", "CONTENT"]).optional().describe("知识类型：风格(STYLE)、布局(LAYOUT)、排版(TYPOGRAPHY)、配色(COLOR)、场景(SCENE)、内容(CONTENT)"),
      返回统计: z.boolean().optional().describe("是否返回统计数据"),
    },
    async ({ 会话ID, 知识类型, 返回统计 }) => {
      try {
        const data = await api.listKnowledges({ 
          sessionId: 会话ID, 
          type: 知识类型, 
          stats: 返回统计 
        });
        return ok(data);
      } catch (e) {
        return err(`列出知识条目失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "切换知识状态",
    "启用或禁用指定的知识条目",
    {
      知识ID: z.string().describe("知识条目 ID"),
      是否启用: z.boolean().describe("true 启用，false 禁用"),
    },
    async ({ 知识ID, 是否启用 }) => {
      try {
        const data = await api.toggleKnowledge(知识ID, 是否启用);
        return ok(data);
      } catch (e) {
        return err(`切换知识状态失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // 🤖 AI 提供商配置
  // =======================================================================

  server.tool(
    "列出AI提供商",
    "获取所有已配置的 AI 提供商列表",
    {},
    async () => {
      try {
        const data = await api.listProviders();
        return ok(data);
      } catch (e) {
        return err(`列出提供商失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "保存AI提供商",
    "保存或更新 AI 提供商配置（支持 OpenAI 兼容 API）",
    {
      提供商配置: z.object({
        name: z.string().describe("提供商名称，如 'OpenAI', 'Claude', 'Gemini'"),
        baseUrl: z.string().describe("API 基础 URL，如 'https://api.openai.com/v1'"),
        apiKey: z.string().optional().describe("API Key"),
        id: z.string().optional().describe("提供商 ID，更新时需要"),
        isActive: z.boolean().optional().describe("是否设为活跃提供商"),
      }).describe("提供商配置信息"),
    },
    async ({ 提供商配置 }) => {
      try {
        const data = await api.saveProvider(提供商配置);
        return ok(data);
      } catch (e) {
        return err(`保存提供商失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "激活AI提供商",
    "将指定提供商设为当前活跃的 AI 提供商",
    {
      提供商ID: z.string().describe("要激活的提供商 ID"),
    },
    async ({ 提供商ID }) => {
      try {
        const data = await api.activateProvider(提供商ID);
        return ok(data);
      } catch (e) {
        return err(`激活提供商失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "测试提供商连接",
    "测试 AI 提供商的连接是否正常",
    {
      连接信息: z.object({
        name: z.string().describe("提供商名称"),
        baseUrl: z.string().describe("API 基础 URL"),
        apiKey: z.string().optional().describe("API Key"),
      }).describe("连接信息"),
    },
    async ({ 连接信息 }) => {
      try {
        const data = await api.testProvider(连接信息);
        return ok(data);
      } catch (e) {
        return err(`测试连接失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "发现可用模型",
    "从提供商获取可用的 AI 模型列表",
    {
      提供商信息: z.object({
        name: z.string().describe("提供商名称"),
        baseUrl: z.string().describe("API 基础 URL"),
        apiKey: z.string().optional().describe("API Key"),
      }).describe("提供商连接信息"),
    },
    async ({ 提供商信息 }) => {
      try {
        const data = await api.discoverModels(提供商信息);
        return ok(data);
      } catch (e) {
        return err(`发现模型失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "检测模型能力",
    "检测 AI 模型支持的能力（文本生成、图片生成、图片编辑等）",
    {
      模型信息: z.object({
        name: z.string().describe("提供商名称"),
        baseUrl: z.string().describe("API 基础 URL"),
        apiKey: z.string().optional().describe("API Key"),
      }).describe("提供商或模型信息"),
    },
    async ({ 模型信息 }) => {
      try {
        const data = await api.detectCapabilities(模型信息);
        return ok(data);
      } catch (e) {
        return err(`检测能力失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =======================================================================
  // ⚙️ 系统管理
  // =======================================================================

  server.tool(
    "获取知识约束配置",
    "获取 AI 学习系统的知识应用约束配置",
    {},
    async () => {
      try {
        const data = await api.getConstraints();
        return ok(data);
      } catch (e) {
        return err(`获取约束配置失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "更新知识约束配置",
    "更新 AI 学习系统的知识应用约束规则",
    {
      约束配置: z.object({
        agentType: z.enum(["ANALYSIS", "PLANNING", "GENERATION", "REVIEW"]).describe("智能体类型：分析(ANALYSIS)、规划(PLANNING)、生成(GENERATION)、审查(REVIEW)"),
        minConfidence: z.number().min(0).max(1).optional().describe("最低置信度阈值"),
        maxConfidence: z.number().min(0).max(1).optional().describe("最高置信度阈值"),
        maxAppliesPerDay: z.number().optional().describe("每日最大应用次数"),
        maxAppliesPerSession: z.number().optional().describe("每会话最大应用次数"),
        allowedTypes: z.array(z.string()).optional().describe("允许的知识类型"),
        blockedTypes: z.array(z.string()).optional().describe("禁止的知识类型"),
        isActive: z.boolean().optional().describe("是否启用约束"),
      }).describe("约束配置"),
    },
    async ({ 约束配置 }) => {
      try {
        const data = await api.updateConstraints(约束配置);
        return ok(data);
      } catch (e) {
        return err(`更新约束配置失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "获取API用量统计",
    "获取 MCP 服务器的 API 调用用量统计信息",
    {
      查询小时数: z.number().min(1).max(720).optional().describe("查询最近N小时的数据，默认 24"),
      每页数量: z.number().min(1).max(200).optional().describe("每页数量，默认 20"),
      页码: z.number().optional().describe("页码，默认 1"),
    },
    async ({ 查询小时数, 每页数量, 页码 }) => {
      try {
        const data = await api.getUsageStats({ 
          hours: 查询小时数, 
          limit: 每页数量, 
          page: 页码 
        });
        return ok(data);
      } catch (e) {
        return err(`获取用量统计失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    "查询任务状态",
    "查询异步任务的执行状态（如图片生成、分析等）",
    {
      任务ID: z.string().describe("任务 ID"),
    },
    async ({ 任务ID }) => {
      try {
        const data = await api.getTaskStatus(任务ID);
        return ok(data);
      } catch (e) {
        return err(`查询任务状态失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  return server;
}
