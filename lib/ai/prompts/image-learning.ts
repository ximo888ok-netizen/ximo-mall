/**
 * 图片学习 Agent 的 Prompt 模板
 * 精简版：只分析模板布局、视觉风格、文案排版，不分析光影/亮度/质感等细节
 */

import { z } from "zod";

// ==================== Schema 定义 ====================

/** 单张图片分析结果 Schema */
export const imageAnalysisResultSchema = z.object({
  layout: z.object({
    type: z.string().describe("布局类型"),
    structure: z.string().describe("版面结构描述"),
    elementAreas: z.array(z.string()).describe("元素区域列表"),
    negativeSpace: z.string().describe("留白处理方式"),
    balance: z.string().describe("画面平衡感"),
  }),
  style: z.object({
    visualStyle: z.string().describe("整体视觉风格"),
    colorScheme: z.string().describe("配色风格"),
    primaryColor: z.string().describe("主色调"),
    secondaryColor: z.string().describe("辅助色"),
    atmosphere: z.string().describe("氛围感"),
    borderFrames: z.string().describe("边框效果"),
    marketingElements: z.array(z.string()).describe("营销图形元素列表"),
    watermarks: z.string().describe("水印/Logo/品牌标识"),
    decorativeBg: z.string().describe("装饰性背景/底纹/叠层效果"),
  }),
  typography: z.object({
    fontStyle: z.string().describe("字体风格"),
    textLayout: z.string().describe("文字布局"),
    hierarchy: z.string().describe("层级关系"),
    hasText: z.boolean().describe("是否包含文字"),
    integration: z.string().describe("图文融合方式"),
  }),
  promptSnippets: z.string().optional().describe("可用于 AI 生图的提示词片段"),
});

/** 知识提取结果 Schema */
export const knowledgeExtractionResultSchema = z.object({
  knowledges: z.array(
    z.object({
      type: z.string().describe("知识类型: LAYOUT/STYLE/TYPOGRAPHY/APPETITE/CONTENT/DECORATION"),
      name: z.string().describe("知识名称"),
      description: z.string().describe("详细描述"),
      attributes: z.record(z.any()).describe("属性数据"),
      promptSnippet: z.string().optional().describe("正面提示词"),
      negativePrompt: z.string().optional().describe("负面提示词"),
      confidence: z.number().min(0).max(1).describe("置信度"),
    })
  ),
  summary: z
    .object({
      dominantStyle: z.string().describe("主导风格描述"),
      keyCharacteristics: z.array(z.string()).describe("关键特征列表"),
    })
    .optional(),
});

// ==================== 头图分析 ====================

export const heroAnalysisSystemPrompt = `你是一位电商视觉分析专家。请分析这张**头图（主图/副图）**的电商视觉特点。

分析时严格遵守以下 3 个维度，**不要分析光影、亮度、对比度、质感、纹理等细节**：

1. 模板布局（layout）
   - type: 布局类型（居中构图/左右分割/上下分层/满版/留白/对角/对称等）
   - structure: 版面结构描述（图片占多少比例、文字区域在哪、产品在什么位置）
   - elementAreas: 元素区域列表（如 ["顶部标题区", "中间产品区", "底部价格区", "左上角Logo"]）
   - negativeSpace: 留白处理方式
   - balance: 画面平衡感

2. 视觉风格（style）— 只分析非产品的营销图形元素
   - 不要分析产品本身的造型、质感、材质、光影
   - 重点识别所有位于图片上但**不属于产品本身**的营销/装饰/品牌图形元素
   - visualStyle: 整体视觉风格（如简约现代/轻奢/国潮/日系/欧美/温馨/活力等）
   - colorScheme: 配色风格（如黑白灰/暖色调/莫兰迪/高饱和撞色/渐变等）
   - primaryColor: 主色调
   - secondaryColor: 辅助色
   - atmosphere: 氛围感（如高级感/亲和力/科技感/烟火气等）
   - borderFrames: 边框效果（细线框/粗边框/圆角框/不规则框/双线框/无边框等）
   - marketingElements: **逐一列出**图片中所有非产品的营销图形元素（如["右上角红色\"满减\"角标","底部蓝色飘带","左上角品牌Logo","半透明水印\"xx官方\"","金色分割线","圆点装饰底纹","渐变光效叠层"]），**不得遗漏**
   - watermarks: 水印/Logo/品牌标识的位置和样式
   - decorativeBg: 装饰性背景/底纹/叠层效果（如纯色渐变背景/几何纹理/光效/纹理叠加等）

3. 文案排版（typography）
   - fontStyle: 字体风格（如粗体无衬线/手写体/衬线体/圆体等）
   - textLayout: 文字布局（如标题居中/左对齐/环绕/竖排/分段式等）
   - hierarchy: 层级关系（标题 > 副标题 > 卖点 > 价格 的层级处理方式）
   - hasText: 图片中是否包含文字（true/false）
   - integration: 图文融合方式（文字浮于图上/文字在色块内/文字在背景区等）

输出要求：
- 使用英文字段名 layout, style, typography
- 返回标准 JSON 格式
- 每个维度提供具体、可操作的描述
- 生成可用于 AI 生图的提示词片段（promptSnippets）`;

export function buildHeroAnalysisPrompt(imageContext: {
  fileName: string;
  userTags?: string | null;
  userNotes?: string | null;
}): string {
  const parts = [
    `请分析这张电商头图：${imageContext.fileName}`,
    "",
    "这是一张商品头图（主图/副图），请重点分析它的模板布局、视觉风格和文案排版方式。",
    "注意识别所有非产品的营销图形元素：边框、角标、飘带、水印、标签、贴纸、装饰线条等。",
    "",
  ];
  if (imageContext.userTags) parts.push(`用户标签：${imageContext.userTags}`);
  if (imageContext.userNotes) parts.push(`用户备注：${imageContext.userNotes}`);
  parts.push("", "请输出结构化的分析结果，便于后续用于指导 AI 生成相似风格的头图。");
  return parts.join("\n");
}

// ==================== 详情图分析 ====================

export const detailAnalysisSystemPrompt = `你是一位电商视觉分析专家。请分析这张**详情图**的电商视觉特点。

分析时严格遵守以下 3 个维度，**不要分析光影、亮度、对比度、质感、纹理等细节**：

1. 模板布局（layout）
   - type: 布局类型（上下分层/左右分割/图文混排/卡片式/列表式/满版/留白等）
   - structure: 版面结构描述（产品图占多少、文字说明在哪、卖点如何排布）
   - elementAreas: 元素区域列表（如 ["顶部场景图", "中间卖点区", "底部规格表"]）
   - negativeSpace: 留白处理方式
   - balance: 画面平衡感

2. 视觉风格（style）— 只分析非产品的营销图形元素
   - 不要分析产品本身的造型、质感、材质、光影
   - 重点识别所有位于图片上但**不属于产品本身**的营销/装饰/品牌图形元素
   - visualStyle: 整体视觉风格（如简约现代/轻奢/国潮/日系/欧美/温馨/活力等）
   - colorScheme: 配色风格（如黑白灰/暖色调/莫兰迪/高饱和撞色/渐变等）
   - primaryColor: 主色调
   - secondaryColor: 辅助色
   - atmosphere: 氛围感（如高级感/亲和力/科技感/烟火气等）
   - borderFrames: 边框效果（细线框/粗边框/圆角框/不规则框/双线框/无边框等）
   - marketingElements: **逐一列出**图片中所有非产品的营销图形元素（如["右上角红色\"满减\"角标","底部蓝色飘带","左上角品牌Logo","半透明水印\"xx官方\"","金色分割线","圆点装饰底纹","渐变光效叠层"]），**不得遗漏**
   - watermarks: 水印/Logo/品牌标识的位置和样式
   - decorativeBg: 装饰性背景/底纹/叠层效果（如纯色渐变背景/几何纹理/光效/纹理叠加等）

3. 文案排版（typography）
   - fontStyle: 字体风格（如粗体无衬线/手写体/衬线体/圆体等）
   - textLayout: 文字布局（如标题居中/左对齐/竖排/图文环绕/分段式等）
   - hierarchy: 层级关系（主标题 > 副标题 > 卖点 > 说明文字 的层级处理方式）
   - hasText: 图片中是否包含文字（true/false）
   - integration: 图文融合方式（文字浮于图上/文字在色块内/文字在背景区等）

输出要求：
- 使用英文字段名 layout, style, typography
- 返回标准 JSON 格式
- 每个维度提供具体、可操作的描述
- 生成可用于 AI 生图的提示词片段（promptSnippets）`;

export function buildDetailAnalysisPrompt(imageContext: {
  fileName: string;
  userTags?: string | null;
  userNotes?: string | null;
}): string {
  const parts = [
    `请分析这张电商详情图：${imageContext.fileName}`,
    "",
    "这是一张商品详情页图片，请重点分析它的模板布局、视觉风格和文案排版方式。",
    "注意识别所有非产品的营销图形元素：边框、角标、飘带、水印、标签、贴纸、装饰线条等。",
    "",
  ];
  if (imageContext.userTags) parts.push(`用户标签：${imageContext.userTags}`);
  if (imageContext.userNotes) parts.push(`用户备注：${imageContext.userNotes}`);
  parts.push("", "请输出结构化的分析结果，便于后续用于指导 AI 生成相似风格的详情图。");
  return parts.join("\n");
}

// ==================== 知识提取（按分类） ====================

export const knowledgeExtractionSystemPrompt = `你是一位电商视觉知识提炼专家。任务是从多张**同一分类**的图片分析结果中，提取共同的视觉特征和规律，形成可复用的知识。

提炼原则：
1. 找出多张图片共有的模板布局特征
2. 识别最突出的视觉风格元素
3. 提取文案排版的共同规律
4. 为每个知识点标注置信度

输出格式：
{
  "knowledges": [
    {
      "category": "HERO 或 DETAIL",
      "type": "LAYOUT 或 STYLE 或 TYPOGRAPHY",
      "name": "知识名称（如：左侧产品右侧文字的左右分割布局）",
      "description": "详细描述这个知识的特点",
      "attributes": {"关键属性": "值"},
      "promptSnippet": "可用于AI生图的正面提示词",
      "negativePrompt": "需要避免的提示词（可选）",
      "confidence": 0.0到1.0之间的置信度,
      "sampleCount": 出现这个知识的图片数量
    }
  ],
  "summary": {
    "dominantStyle": "主导风格描述",
    "keyCharacteristics": ["关键特征1", "关键特征2"]
  }
}`;

export function buildKnowledgeExtractionPrompt(
  category: "HERO" | "DETAIL",
  imageResults: Array<{
    fileName: string;
    analysisResult: unknown;
  }>
): string {
  const categoryLabel = category === "HERO" ? "头图（主图/副图）" : "详情图";

  const parts = [
    `请从以下 ${imageResults.length} 张${categoryLabel}的分析结果中，提取共同的视觉知识。`,
    "",
    `${categoryLabel}分析结果：`,
    "",
  ];

  imageResults.forEach((result, index) => {
    parts.push(`--- 图片 ${index + 1}: ${result.fileName} ---`);
    parts.push(JSON.stringify(result.analysisResult, null, 2));
    parts.push("");
  });

  parts.push(
    "",
    `请仔细分析这些${categoryLabel}的共同特征，提炼出2-4个有价值的知识条目。`,
    "每个知识条目应包含具体的属性值和可用于 AI 生图的提示词片段。",
  );
  return parts.join("\n");
}
