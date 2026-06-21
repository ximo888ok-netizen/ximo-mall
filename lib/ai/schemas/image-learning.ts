/**
 * 图片学习 Agent 的 Zod Schema 定义
 * 精简版：只分析模板布局、视觉风格、文案排版
 */

import { z } from "zod";

// ==================== 图片分析结果 Schema（通用基础） ====================

// 模板布局 — 分析图片的版面结构、元素区域划分
export const layoutSchema = z.object({
  type: z.string().optional().describe("布局类型：居中构图/左右分割/上下分层/满版/留白/对角/对称等"),
  structure: z.string().optional().describe("版面结构描述：图片占X%，文字区域在哪，产品位置在哪"),
  elementAreas: z.array(z.string()).optional().describe("元素区域列表：如['顶部标题区','中间产品区','底部价格区']"),
  negativeSpace: z.string().optional().describe("留白处理方式"),
  balance: z.string().optional().describe("画面平衡感"),
});

// 视觉风格 — 聚焦非产品的营销图形元素
export const styleSchema = z.object({
  visualStyle: z.string().optional().describe("整体视觉风格：如简约现代/轻奢/国潮/日系/欧美/温馨/活力等"),
  colorScheme: z.string().optional().describe("配色风格：如黑白灰/暖色调/莫兰迪/高饱和撞色/渐变等"),
  primaryColor: z.string().optional().describe("主色调"),
  secondaryColor: z.string().optional().describe("辅助色"),
  atmosphere: z.string().optional().describe("氛围感：如高级感/亲和力/科技感/烟火气等"),
  // 新增：营销图形元素
  borderFrames: z.string().optional().describe("边框/外框/内框效果：如细线框、粗边框、圆角框、不规则框、双线框、无边框等"),
  marketingElements: z.array(z.string()).optional().describe("非产品营销图形元素列表：如['角标','飘带','标签','贴纸','优惠券','印章','徽章','水印','底纹','装饰线条','分割线','气泡','箭头','光效叠层','纹理背景','几何图案']等，列出所有出现的"),
  watermarks: z.string().optional().describe("水印/Logo/品牌标识：位置和样式，如'右下角半透明品牌Logo'"),
  decorativeBg: z.string().optional().describe("装饰性背景/底纹/叠层效果"),
});

// 文案排版 — 图片中的文字处理方式
export const typographySchema = z.object({
  fontStyle: z.string().optional().describe("字体风格：如粗体无衬线/手写体/衬线体/圆体等"),
  textLayout: z.string().optional().describe("文字布局：如标题居中/左对齐/环绕/竖排/分段式等"),
  hierarchy: z.string().optional().describe("层级关系：标题>副标题>卖点>价格 的层级处理方式"),
  hasText: z.boolean().optional().describe("图片中是否包含文字"),
  integration: z.string().optional().describe("图文融合方式：如文字浮于图上/文字在色块内/文字在背景区等"),
});

// 完整分析结果
export const imageAnalysisResultSchema = z.object({
  kind: z.enum(["HERO", "DETAIL"]).optional().describe("图片分类：头图或详情图"),
  layout: layoutSchema,
  style: styleSchema,
  typography: typographySchema,
  promptSnippets: z.object({
    layout: z.string().optional().describe("布局提示词"),
    style: z.string().optional().describe("风格提示词"),
    typography: z.string().optional().describe("排版提示词"),
    negative: z.string().optional().describe("负面提示词"),
  }).optional().or(z.any()),
}).passthrough();

export type ImageAnalysisResult = z.infer<typeof imageAnalysisResultSchema>;

// ==================== 知识提取结果 Schema ====================

export const knowledgeExtractionResultSchema = z.object({
  knowledges: z.array(
    z.object({
      category: z.string().describe("分类：HERO 或 DETAIL"),
      type: z.string().describe("知识类型：STYLE, LAYOUT, TYPOGRAPHY"),
      name: z.string().describe("知识名称"),
      description: z.string().describe("详细描述"),
      attributes: z.any().optional().describe("结构化属性"),
      promptSnippet: z.string().optional().describe("提示词片段"),
      negativePrompt: z.string().optional().describe("负面提示词"),
      confidence: z.number().min(0).max(1).optional().describe("置信度"),
      sampleCount: z.number().optional().describe("样本数量"),
    })
  ).optional().default([]),
  summary: z.object({
    dominantStyle: z.string().optional().describe("主导风格"),
    keyCharacteristics: z.array(z.string()).optional().describe("关键特征"),
  }).optional().default({}),
});

export type KnowledgeExtractionResult = z.infer<typeof knowledgeExtractionResultSchema>;

// ==================== 学习进度 Schema ====================

export const learningProgressSchema = z.object({
  sessionId: z.string(),
  totalImages: z.number(),
  analyzedImages: z.number(),
  pendingImages: z.number(),
  heroImageCount: z.number(),
  detailImageCount: z.number(),
  heroKnowledges: z.number(),
  detailKnowledges: z.number(),
  status: z.enum(["PENDING", "LEARNING", "COMPLETED", "FAILED"]),
  currentStage: z.string().optional(),
});

export type LearningProgress = z.infer<typeof learningProgressSchema>;
