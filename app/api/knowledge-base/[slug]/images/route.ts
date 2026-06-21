import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBaseBySlug } from "@/lib/services/knowledge-base-service";
import {
  addImageToKB,
  listKBImages,
} from "@/lib/services/kb-training-service";
import { handleRouteError, ok } from "@/lib/utils/route";
import { env } from "@/lib/utils/env";
import fs from "fs/promises";
import path from "path";

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

// GET /api/knowledge-base/[slug]/images - 获取知识库图片列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const images = await listKBImages(kb.id, category);
    return ok({ items: images });
  } catch (error) {
    return handleRouteError(error);
  }
}

// POST /api/knowledge-base/[slug]/images - 上传图片到知识库
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const kb = await getKnowledgeBaseBySlug(slug);
    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "HERO";

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // 保存文件到 knowledge-base/{kbId}/ 目录
    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(rootDir(), "knowledge-base", kb.id);
    await fs.mkdir(dir, { recursive: true });
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(dir, safeName);
    await fs.writeFile(filePath, buffer);

    // 存储相对路径（统一使用正斜杠，确保跨平台兼容性和 URL 可用性）
    const relativePath = path.join("knowledge-base", kb.id, safeName).replace(/\\/g, "/");

    // 添加到知识库
    const image = await addImageToKB({
      kbId: kb.id,
      filePath: relativePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      category: category as "HERO" | "DETAIL",
    });

    return ok(image, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
