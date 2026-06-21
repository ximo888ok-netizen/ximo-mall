import { NextRequest } from "next/server";

import { getProductBySlug } from "@/lib/services/product-library-service";
import {
  listKnowledgeEntries,
  addManualKnowledgeEntry,
} from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const product = await getProductBySlug(slug);
    if (!product) {
      return handleRouteError(new Error("产品不存在"));
    }

    const entries = await listKnowledgeEntries(product.id, category);
    return ok(entries);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) {
      return handleRouteError(new Error("产品不存在"));
    }

    const body = await request.json();
    const { category, title, content, metadata } = body;

    if (!category || !title || !content) {
      return handleRouteError(new Error("分类、标题和内容不能为空"));
    }

    const entry = await addManualKnowledgeEntry({
      productId: product.id,
      category,
      title,
      content,
      metadata,
    });

    return ok(entry, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
