import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const upscaleImageTool = createTool({
  id: "upscale-image",
  description:
    "对图片进行超分辨率高清放大。使用通义万相 wanx2.1-imageedit 的 super_resolution 功能，支持 1-4 倍放大。当用户说「放大图片」「提高分辨率」「让图片更清晰」「高清化」时调用此工具。",
  inputSchema: z.object({
    projectId: z.string().describe("项目 ID"),
    imageAssetId: z.string().describe("要放大的图片资产 ID"),
    upscaleFactor: z
      .number()
      .int()
      .min(1)
      .max(4)
      .default(2)
      .describe("放大倍数，1-4，默认 2。1 倍仅高清处理不放大，2 倍放大 2 倍，以此类推"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    imageAssetId: z.string().optional(),
    imageUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getProviderAdapter } = await import("@/lib/services/provider-service");
    const { ensureStorageScaffold } = await import("@/lib/storage/asset-manager");
    const { nanoid } = await import("nanoid");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    try {
      // 获取图片资产
      const asset = await prisma.productAsset.findUnique({
        where: { id: inputData.imageAssetId },
      });

      if (!asset) {
        return { success: false, error: "图片资产不存在" };
      }

      // 读取图片文件并转为 data URL（远程 API 无法访问本地路径）
      const { readStorageFile } = await import("@/lib/storage/asset-manager");
      const fileBuffer = await readStorageFile(asset.filePath);
      const mimeType = asset.mimeType || "image/png";
      const imageDataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

      // 调用超分 API
      const adapterCtx = await getProviderAdapter("image");
      const result = await adapterCtx.adapter.upscaleImage({
        model: "wanx2.1-imageedit",
        image: imageDataUrl,
        upscaleFactor: inputData.upscaleFactor,
        monitor: {
          projectId: inputData.projectId,
          operation: "agent_upscale_image",
        },
      });

      if (!result.url && !result.b64Json) {
        return { success: false, error: "超分处理未返回图片" };
      }

      // 下载并保存超分后的图片
      await ensureStorageScaffold();
      const rootDir = path.join(process.cwd(), "storage");
      const dir = path.join(rootDir, "generated", inputData.projectId, "upscaled");
      await fs.mkdir(dir, { recursive: true });

      const fileName = `${Date.now()}-${nanoid(6)}.png`;
      const relativePath = path.join("generated", inputData.projectId, "upscaled", fileName).replace(/\\/g, "/");
      const absolutePath = path.join(dir, fileName);

      if (result.b64Json) {
        await fs.writeFile(absolutePath, Buffer.from(result.b64Json, "base64"));
      } else if (result.url) {
        const response = await fetch(result.url);
        if (!response.ok) {
          throw new Error(`Failed to download upscaled image: ${response.status}`);
        }
        await fs.writeFile(absolutePath, Buffer.from(await response.arrayBuffer()));
      }

      // 创建资产记录
      const newAsset = await prisma.productAsset.create({
        data: {
          projectId: inputData.projectId,
          type: "GENERATED",
          filePath: relativePath,
          fileName,
          mimeType: "image/png",
          sortOrder: 0,
          metadata: {
            sourceAssetId: asset.id,
            upscaleFactor: inputData.upscaleFactor,
            operation: "upscale",
          },
        },
      });

      const newImageUrl = `/api/files/${newAsset.filePath.replace(/\\/g, "/")}`;
      return { success: true, imageAssetId: newAsset.id, imageUrl: newImageUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "图片超分失败",
      };
    }
  },
});
