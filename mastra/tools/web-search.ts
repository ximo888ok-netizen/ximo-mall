import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/** System prompt injected into every search to guide Baidu AI toward visual design extraction. */
const VISUAL_ANALYSIS_SYSTEM_PROMPT = `你是一个电商详情页视觉设计分析助手。请基于搜索结果，重点提取竞品详情页在以下 7 个维度的视觉设计信息：

1. 图片视觉 — 主图风格（实拍/渲染/模特/静物）、视觉重心位置、画面张力和层次感
2. 整图布局 — 模块排列顺序、版式结构（F型/Z型/对称/非对称/瀑布流）、留白比例与呼吸感
3. 元素排版 — 图文比例、标题/描述/价格/行动按钮的层级关系、信息阅读动线
4. 元素样式 — 按钮形状与颜色、促销标签样式、icon 风格、分割线与装饰元素
5. 文案样式 — 字体风格（衬线/无衬线/手写）、字号大小对比、文字颜色、强调手法（加粗/描边/阴影/高亮）
6. 整图色调分配 — 主色占比、辅色与点缀色分配、冷暖调性、色彩对比策略（互补/邻近/单色）
7. 产品主体关联物 — 产品与道具/场景/模特的空间关系、比例关系、前景中景背景层次

对每个维度给出具体的视觉描述和常见设计手法，以 markdown 列表格式输出，每条前标注所属维度编号（如【1.图片视觉】xxx）。如果搜索结果中某维度信息不足，请基于行业常识给出合理的电商设计建议。`;

async function searchViaChatCompletions(query: string, apiKey: string, productContext?: string) {
  // Baidu AI Search chat/completions only supports "user" role — merge system prompt into user message
  const searchInstruction = productContext
    ? `搜索电商详情页视觉设计参考：${query}。产品背景：${productContext}。请重点分析竞品详情页的图片视觉、布局排版、配色、文案风格等视觉设计细节。`
    : `搜索电商详情页视觉设计参考：${query}。请重点分析竞品详情页的图片视觉、布局排版、配色、文案风格等视觉设计细节。`;

  const response = await fetch(
    "https://qianfan.baidubce.com/v2/ai_search/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: `${VISUAL_ANALYSIS_SYSTEM_PROMPT}\n\n---\n\n搜索任务：${searchInstruction}` },
        ],
        model: "ernie-4.5-turbo-128k",
        max_completion_tokens: 12288,
        search_source: "baidu_search_v2",
        resource_type_filter: [{ type: "web", top_k: 10 }],
        search_mode: "auto",
        enable_corner_markers: true,
        enable_web_page_safety: true,
        safety_level: "standard",
        response_format: { type: "text" },
        stream: false,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    return {
      success: false as const,
      error:
        data.error?.message || `搜索生成失败 (HTTP ${response.status})`,
    };
  }

  const content =
    data.choices?.[0]?.message?.content || "";
  const refs = (data.references || []).map(
    (ref: Record<string, unknown>) => ({
      title: String(ref.title || ""),
      url: String(ref.url || ""),
      content: String(ref.content || ""),
      date: ref.date ? String(ref.date) : undefined,
    }),
  );

  return {
    success: true as const,
    results: refs,
    generatedText: content || undefined,
    source: "智能搜索生成" as const,
  };
}

export const webSearchTool = createTool({
  id: "web-search",
  description:
    "搜索竞品电商详情页的视觉设计参考。自动分析图片视觉、整图布局、元素排版、元素样式、文案样式、整图色调分配、产品主体关联物 7 个维度，返回结构化视觉设计洞察。当用户启用「联网搜索」时调用。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词（产品名称、类目、竞品品牌等）"),
    productContext: z
      .string()
      .optional()
      .describe("产品上下文（品类/平台/风格等），用于构造更精准的视觉搜索 query"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z
      .array(
        z.object({
          title: z.string(),
          url: z.string(),
          content: z.string(),
          date: z.string().optional(),
        }),
      )
      .optional(),
    generatedText: z.string().optional(),
    source: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const apiKey = process.env.BAIDU_AI_SEARCH_API_KEY;
    if (!apiKey) {
      return { success: false, error: "百度搜索 API Key 未配置" };
    }

    return searchViaChatCompletions(inputData.query, apiKey, inputData.productContext);
  },
});
