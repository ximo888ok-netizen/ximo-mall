import { z } from "zod";

export const imageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
] as const;

export type ImageMimeType = (typeof imageMimeTypes)[number];

export const imageCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(60),
  description: z.string().max(300).optional(),
  parentId: z.string().optional(),
});

export const imageTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "颜色格式不正确").optional(),
});

export const imageCollectionSchema = z.object({
  name: z.string().min(1, "合集名称不能为空").max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  itemIds: z.array(z.string()).optional(),
});

export const imageLibraryItemSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

export const imageLibrarySearchSchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  mimeTypes: z.array(z.enum(imageMimeTypes)).optional(),
  isPublic: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "fileName", "fileSize"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const imageLibraryBulkSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(500),
  addTagIds: z.array(z.string()).optional(),
  removeTagIds: z.array(z.string()).optional(),
  setCategoryId: z.string().optional(),
  addToCollectionId: z.string().optional(),
});

export type ImageCategoryInput = z.infer<typeof imageCategorySchema>;
export type ImageTagInput = z.infer<typeof imageTagSchema>;
export type ImageCollectionInput = z.infer<typeof imageCollectionSchema>;
export type ImageLibraryItemInput = z.infer<typeof imageLibraryItemSchema>;
export type ImageLibrarySearchInput = z.infer<typeof imageLibrarySearchSchema>;
export type ImageLibraryBulkInput = z.infer<typeof imageLibraryBulkSchema>;
