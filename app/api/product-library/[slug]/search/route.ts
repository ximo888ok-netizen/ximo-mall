import { NextRequest } from "next/server";

import { searchKnowledge } from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { query, topK, minScore, category } = body;

    if (!query || typeof query !== "string") {
      return handleRouteError(new Error("查询内容不能为空"));
    }

    const results = await searchKnowledge(query, {
      // 通过 slug 查找的 productId 在服务层处理
      // 这里先不限定 productId，让搜索跨产品
      category,
      topK: topK ?? 10,
      minScore: minScore ?? 0.3,
    });

    return ok(results);
  } catch (error) {
    return handleRouteError(error);
  }
}
