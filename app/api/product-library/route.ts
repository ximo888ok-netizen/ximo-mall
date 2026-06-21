import { NextRequest } from "next/server";

import { listProducts, createProduct } from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function GET() {
  try {
    const products = await listProducts();
    return ok(products);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return handleRouteError(new Error("产品名称不能为空"));
    }

    const product = await createProduct({ name: name.trim(), description });
    return ok(product, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
