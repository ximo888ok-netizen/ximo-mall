import { NextRequest } from "next/server";

import { getProductBySlug } from "@/lib/services/product-library-service";
import { addProductImage, listProductImages } from "@/lib/services/product-library-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { env } from "@/lib/utils/env";
import fs from "fs/promises";
import path from "path";

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const product = await getProductBySlug(slug);
    if (!product) {
      return handleRouteError(new Error("产品不存在"));
    }

    const images = await listProductImages(product.id);
    return ok(images);
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return handleRouteError(new Error("请选择要上传的图片"));
    }

    // 保存到 product-library/{productId}/ 目录
    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(rootDir(), "product-library", product.id);
    await fs.mkdir(dir, { recursive: true });
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(dir, safeName);
    await fs.writeFile(filePath, buffer);

    const relativePath = path.join("product-library", product.id, safeName).replace(/\\/g, "/");

    const image = await addProductImage({
      productId: product.id,
      filePath: relativePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    return ok(image, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
