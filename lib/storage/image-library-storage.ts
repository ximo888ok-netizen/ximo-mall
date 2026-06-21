import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/utils/env";
import { extFromMime, sanitizeFileName } from "@/lib/utils/files";

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

function libraryDir(...rest: string[]) {
  return path.join(rootDir(), "library", ...rest);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureLibraryScaffold() {
  await Promise.all([
    ensureDir(libraryDir("originals")),
    ensureDir(libraryDir("thumbnails")),
    ensureDir(libraryDir("converted")),
  ]);
}

function detectDimensionsFromBuffer(buffer: Buffer): { width: number | null; height: number | null } {
  try {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        const marker = buffer.readUInt16BE(offset);
        offset += 2;
        const length = buffer.readUInt16BE(offset);
        offset += 2;

        if ((marker >= 0xffc0 && marker <= 0xffc3) || (marker >= 0xffc5 && marker <= 0xffc7)) {
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          return { width, height };
        }

        offset += length - 2;
      }
      return { width: null, height: null };
    }

    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      const width = buffer.readUInt16LE(26);
      const height = buffer.readUInt16LE(30);
      return { width: width || null, height: height || null };
    }

    if (
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
    ) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }

    return { width: null, height: null };
  } catch {
    return { width: null, height: null };
  }
}

function generateFileName(originalName: string) {
  const ext = path.extname(originalName) || ".bin";
  const base = sanitizeFileName(path.basename(originalName, ext));
  return `${Date.now()}-${nanoid(8)}-${base}${ext}`;
}

export async function saveLibraryImage(params: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}) {
  await ensureLibraryScaffold();

  const safeName = generateFileName(params.fileName);
  const relativePath = path.join("library", "originals", safeName).replace(/\\/g, "/");
  const absolutePath = path.join(rootDir(), relativePath);

  await fs.writeFile(absolutePath, params.fileBuffer);

  const dimensions = detectDimensionsFromBuffer(params.fileBuffer);

  const record = await prisma.imageLibraryItem.create({
    data: {
      filePath: relativePath,
      fileName: params.fileName,
      mimeType: params.mimeType ?? "image/png",
      width: dimensions.width,
      height: dimensions.height,
      fileSize: params.fileBuffer.byteLength,
    },
  });

  return {
    ...record,
    url: libraryPublicUrl(record),
  };
}

export async function readLibraryFile(relativePath: string) {
  return fs.readFile(path.join(rootDir(), relativePath));
}

export function libraryPublicUrl(
  asset: { filePath: string } | null | undefined,
) {
  if (!asset) {
    return null;
  }

  return `/api/files/${asset.filePath.replace(/\\/g, "/")}`;
}

export async function statLibraryFile(relativePath: string) {
  return fs.stat(path.join(rootDir(), relativePath));
}

export async function deleteLibraryItem(itemId: string) {
  const item = await prisma.imageLibraryItem.findUnique({
    where: { id: itemId },
    include: {
      tags: true,
      collectionItems: true,
    },
  });

  if (!item) {
    return null;
  }

  const filesToDelete: string[] = [item.filePath];

  if (item.metadata) {
    const meta = item.metadata as Record<string, unknown>;
    if (typeof meta.thumbnailPath === "string") {
      filesToDelete.push(meta.thumbnailPath);
    }
  }

  await Promise.all(
    filesToDelete.map((fp) =>
      fs.rm(path.join(rootDir(), fp), { force: true }),
    ),
  );

  await prisma.imageLibraryItem.delete({
    where: { id: itemId },
  });

  return item;
}

export async function deleteLibraryItems(itemIds: string[]) {
  const results = await Promise.allSettled(
    itemIds.map((id) => deleteLibraryItem(id)),
  );

  return {
    deletedCount: results.filter((r) => r.status === "fulfilled" && r.value !== null).length,
    failedCount: results.filter((r) => r.status === "rejected").length,
  };
}
