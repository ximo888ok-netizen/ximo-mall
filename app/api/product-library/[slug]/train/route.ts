import { NextRequest } from "next/server";

import { getProductBySlug } from "@/lib/services/product-library-service";
import {
  trainProductImage,
  trainAllProductImages,
} from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

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

    const body = await request.json().catch(() => ({}));
    const { imageId } = body;

    // 指定 imageId: 只分析单张
    if (imageId) {
      const result = await trainProductImage(imageId);
      return ok(result);
    }

    // 默认: 分析所有待分析图片
    const result = await trainAllProductImages(product.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
