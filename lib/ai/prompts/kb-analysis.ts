// ==================== 面条品类知识库专用分析提示词 ====================

import { z } from "zod";

/** 知识库图片分析结果 Schema（与 kbHeroAnalysisSystemPrompt / kbDetailAnalysisSystemPrompt 的 7 维度输出匹配） */
export const kbImageAnalysisResultSchema = z.object({
  layout: z.string().describe("布局结构描述（上方品牌区、中间产品区、底部促销区的分布）"),
  hierarchy: z.string().describe("信息层级描述（产品名、品牌名、卖点、品质话术、规格、评分）"),
  typography: z.string().describe("文字风格描述（书法体/艺术字体/无衬线体等的使用）"),
  colorScheme: z.string().describe("配色方案描述（主色调、强调色、背景色的搭配）"),
  productDisplay: z.string().describe("产品图呈现描述（拍摄风格、状态呈现、视觉重心）"),
  marketingElements: z.string().describe("营销元素描述（百分比标注、数量暗示、场景句、品质背书、评分标识）"),
  decoration: z.string().describe("装饰与氛围描述（背景装饰、信息区域划分、整体风格）"),
  promptSnippets: z.string().optional().describe("可用于 AI 生图的提示词片段"),
});

// ==================== 头图分析系统提示词 ====================
export const kbHeroAnalysisSystemPrompt = `你是一位电商视觉分析专家，专注于面条品类的头图分析。请分析这张头图的视觉特点。

分析时需要关注以下 7 个维度：

1. 布局结构（layout）
   - 上方区域：品牌名 + 英文副标的排列方式（居中/左对齐/右对齐）
   - 中间区域：产品主图的位置和占比（居中/左侧/右侧，占画面百分比）
   - 产品主图周围：百分比卖点标注的位置和样式
   - 底部区域：促销文案 + 规格信息的分布方式（左右分布/居中堆叠）

2. 信息层级（hierarchy）— 从大到小
   - 第一层：产品名称的字号、字体风格、颜色
   - 第二层：品牌名 + 英文名的字号和位置
   - 第三层：核心卖点短句的样式（强调色块/变色/加粗）
   - 第四层：品质话术的字号和出现频率
   - 第五层：规格与数量的字号和位置
   - 第六层：评分标识的样式和位置

3. 文字风格（typography）
   - 产品名：字体类型（书法体/艺术字体/粗体）、颜色（深色/暖色）
   - 英文副标：字体类型（无衬线体/细体）、装饰性
   - 卖点短句：加粗、变色、底色块等强调方式
   - 品质话术：字号、重复出现的方式

4. 配色方案（colorScheme）
   - 主色调：暖色系（橙/红/金）的使用方式
   - 强调色：白色或亮黄色用于关键文案的方式
   - 背景色：暖米色/浅色或深色渐变的处理

5. 产品图呈现（productDisplay）
   - 拍摄风格：实物拍摄或高质量渲染
   - 状态呈现：酱汁光泽、食材清晰可见等最佳状态
   - 视觉重心：产品图占画面主体的方式

6. 营销元素（marketingElements）
   - 百分比数据标注：配料含量等信任元素
   - 数量暗示："到手共X盒"等性价比元素
   - 使用场景句："在家也能吃上XXX"等场景元素
   - 品质背书话术：重复出现的品质强调
   - 评分/星级：信任元素的样式

7. 装饰与氛围（decoration）
   - 背景装饰：复杂程度和风格
   - 信息区域划分：色块或线条的使用
   - 整体风格：干净程度、信息密度

输出要求：
- 使用英文字段名 layout, hierarchy, typography, colorScheme, productDisplay, marketingElements, decoration
- 返回标准 JSON 格式
- 每个维度提供具体、可操作的描述
- 生成可用于 AI 生图的提示词片段（promptSnippets）`;

// 头图分析用户提示词构建
export function buildKBHeroAnalysisPrompt(imageContext: {
  fileName: string;
}): string {
  return `请分析这张面条品类的电商头图：${imageContext.fileName}

这是一张商品头图（主图/副图），请按照以下7个维度进行详细分析：
1. 布局结构（上方品牌区、中间产品区、底部促销区的分布）
2. 信息层级（产品名、品牌名、卖点、品质话术、规格、评分的层级处理）
3. 文字风格（书法体/艺术字体/无衬线体等的使用）
4. 配色方案（暖色系主色调、强调色、背景色的搭配）
5. 产品图呈现（拍摄风格、状态呈现、视觉重心）
6. 营销元素（百分比标注、数量暗示、场景句、品质背书、评分标识）
7. 装饰与氛围（背景装饰、信息区域划分、整体风格）

请输出结构化的分析结果，便于后续用于指导 AI 生成相似风格的头图。`;
}

// 详情图分析系统提示词
export const kbDetailAnalysisSystemPrompt = `你是一位电商视觉分析专家，专注于面条品类的详情图分析。请分析这张详情图的视觉特点。

分析时需要关注以下 7 个维度：

1. 布局结构（layout）
   - 类型：上下分层/左右分割/图文混排/卡片式/列表式/满版/留白等
   - 结构：产品图占比、文字说明位置、卖点排布方式
   - 元素区域：顶部场景图区、中间卖点区、底部规格表等
   - 留白处理：留白的位置和比例

2. 信息层级（hierarchy）— 从大到小
   - 第一层：主标题的字号、字体、颜色
   - 第二层：副标题/品牌名的样式
   - 第三层：核心卖点的强调方式
   - 第四层：详细说明文字的字号
   - 第五层：规格参数的排版
   - 第六层：辅助信息的样式

3. 文字风格（typography）
   - 标题字体：书法体/粗体/艺术字体
   - 正文字体：无衬线体/衬线体
   - 卖点文字：强调方式（色块/变色/图标）
   - 文字与图片的融合方式

4. 配色方案（colorScheme）
   - 主色调：暖色系的使用
   - 辅助色：搭配方式
   - 背景色：渐变/纯色/纹理
   - 文字与背景的对比度

5. 产品图呈现（productDisplay）
   - 展示角度：俯拍/平视/特写
   - 状态呈现：成品/制作过程/食材展示
   - 食欲感：光泽、热气、新鲜感
   - 道具搭配：餐具、配菜、场景元素

6. 营销元素（marketingElements）
   - 卖点图标：图标+文字的组合方式
   - 数据标注：配料含量、营养成分等
   - 对比展示：使用前后、竞品对比
   - 场景展示：使用场景的呈现方式
   - 信任背书：认证、奖项、好评

7. 装饰与氛围（decoration）
   - 分隔线：样式和位置
   - 色块装饰：用于强调信息的色块
   - 背景纹理：木纹/布纹/纸纹等
   - 整体氛围：温馨/专业/食欲/高端

输出要求：
- 使用英文字段名 layout, hierarchy, typography, colorScheme, productDisplay, marketingElements, decoration
- 返回标准 JSON 格式
- 每个维度提供具体、可操作的描述
- 生成可用于 AI 生图的提示词片段（promptSnippets）`;

// 详情图分析用户提示词构建
export function buildKBDetailAnalysisPrompt(imageContext: {
  fileName: string;
}): string {
  return `请分析这张面条品类的电商详情图：${imageContext.fileName}

这是一张商品详情图，请按照以下7个维度进行详细分析：
1. 布局结构（类型、结构、元素区域、留白处理）
2. 信息层级（主标题、副标题、卖点、说明文字、规格参数的层级处理）
3. 文字风格（标题字体、正文字体、卖点强调方式、图文融合）
4. 配色方案（主色调、辅助色、背景色、对比度）
5. 产品图呈现（展示角度、状态呈现、食欲感、道具搭配）
6. 营销元素（卖点图标、数据标注、对比展示、场景展示、信任背书）
7. 装饰与氛围（分隔线、色块装饰、背景纹理、整体氛围）

请输出结构化的分析结果，便于后续用于指导 AI 生成相似风格的详情图。`;
}

// 知识提取系统提示词
export const kbKnowledgeExtractionPrompt = `你是一位电商视觉知识提取专家。根据图片分析结果，提取可复用的结构化知识。

知识类型：
- LAYOUT: 布局结构（构图、区域划分、元素分布、信息层级）
- TYPOGRAPHY: 文案排版（字体风格、文字层级、排版方式、强调手法）
- COLOR: 配色方案（主色调、强调色、背景色、色彩搭配）
- APPETITE: 食欲元素（产品呈现、光泽效果、热气效果、食材展示）
- MARKETING: 营销元素（百分比标注、数量暗示、场景句、品质背书、评分标识）
- DECORATION: 装饰元素（背景纹理、分隔线、色块装饰、整体氛围）

请提取所有有价值的知识，严格按照以下JSON格式输出，不要包含markdown标记：
{
  "knowledges": [
    {
      "type": "LAYOUT 或 TYPOGRAPHY 或 COLOR 或 APPETITE 或 MARKETING 或 DECORATION",
      "name": "知识名称（中文）",
      "description": "详细描述（中文）",
      "attributes": {},
      "promptSnippet": "可用于AI生图的正面提示词（可选）",
      "negativePrompt": "需要避免的提示词（可选）",
      "confidence": 0.0到1.0之间的置信度
    }
  ],
  "summary": {
    "dominantStyle": "主导风格描述",
    "keyCharacteristics": ["关键特征1", "关键特征2"]
  }
}

每条知识必须：
1. 有明确的类型
2. 有简洁的名称（中文）
3. 有详细的描述（中文）
4. 有可量化的属性
5. 有置信度评估（0-1的数值，不要带引号）`;

// 知识提取用户提示词构建
export function buildKBKnowledgeExtractionPrompt(analysisResult: any): string {
  return `请从以下面条品类图片分析结果中提取可复用的结构化知识：

图片分析结果：
${JSON.stringify(analysisResult, null, 2)}

请按照以下类型提取知识：
1. LAYOUT - 布局结构知识（构图方式、区域划分、元素分布）
2. TYPOGRAPHY - 文案排版知识（字体风格、层级处理、强调手法）
3. COLOR - 配色方案知识（主色调、强调色、背景色搭配）
4. APPETITE - 食欲元素知识（产品呈现、光泽效果、热气效果）
5. MARKETING - 营销元素知识（百分比标注、数量暗示、品质背书）
6. DECORATION - 装饰元素知识（背景纹理、分隔线、整体氛围）

请提取所有有价值的知识，确保每条知识都是可复用的、有具体属性的。`;
}
