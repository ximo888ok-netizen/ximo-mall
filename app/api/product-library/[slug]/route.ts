import { NextRequest } from "next/server";

import {
  getProductBySlug,
  updateProduct,
  deleteProduct,
} from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) {
      return handleRouteError(new Error("产品不存在"));
    }
    return ok(product);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
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
    const updated = await updateProduct(product.id, {
      name: body.name,
      description: body.description,
      coverImage: body.coverImage,
    });
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) {
      return handleRouteError(new Error("产品不存在"));
    }

    await deleteProduct(product.id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
