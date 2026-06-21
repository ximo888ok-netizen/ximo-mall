import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { saveLibraryImage, libraryPublicUrl, deleteLibraryItem, deleteLibraryItems } from "@/lib/storage/image-library-storage";
import type {
  ImageCategoryInput,
  ImageTagInput,
  ImageCollectionInput,
  ImageLibraryItemInput,
  ImageLibrarySearchInput,
  ImageLibraryBulkInput,
} from "@/types/image-library";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function computedSlug(input: { name: string; existingSlug?: string | null }) {
  return input.existingSlug || slugify(input.name) || `item-${Date.now()}`;
}

function hydrateItem(item: any) {
  if (!item) return null;

  return {
    ...item,
    url: libraryPublicUrl(item),
    tags: (item.tags ?? []).map((jt: any) => jt.tag ?? jt),
    category: item.category ?? null,
  };
}

function hydrateItems(items: any[]) {
  return items.map(hydrateItem);
}

function hydrateCollection(collection: any) {
  if (!collection) return null;

  return {
    ...collection,
    items: (collection.items ?? []).map((ci: any) => ({
      ...ci,
      item: hydrateItem(ci.item),
    })),
    coverImageUrl: collection.coverImageId
      ? libraryPublicUrl(collection.items?.find((ci: any) => ci.itemId === collection.coverImageId)?.item ?? null)
      : null,
  };
}

export async function getLibraryItems(search: ImageLibrarySearchInput) {
  const where: Prisma.ImageLibraryItemWhereInput = {};

  if (search.query) {
    where.OR = [
      { title: { contains: search.query } },
      { description: { contains: search.query } },
      { fileName: { contains: search.query } },
    ];
  }

  if (search.categoryId) {
    where.categoryId = search.categoryId;
  }

  if (search.tagIds && search.tagIds.length > 0) {
    where.tags = {
      some: {
        tagId: { in: search.tagIds },
      },
    };
  }

  if (search.mimeTypes && search.mimeTypes.length > 0) {
    where.mimeType = { in: search.mimeTypes };
  }

  if (search.isPublic !== undefined) {
    where.isPublic = search.isPublic;
  }

  const [items, total] = await Promise.all([
    prisma.imageLibraryItem.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        category: true,
      },
      orderBy: { [search.sortBy]: search.sortOrder },
      skip: (search.page - 1) * search.pageSize,
      take: search.pageSize,
    }),
    prisma.imageLibraryItem.count({ where }),
  ]);

  return {
    items: hydrateItems(items),
    total,
    page: search.page,
    pageSize: search.pageSize,
    totalPages: Math.ceil(total / search.pageSize),
  };
}

export async function getLibraryItem(itemId: string) {
  const item = await prisma.imageLibraryItem.findUnique({
    where: { id: itemId },
    include: {
      tags: { include: { tag: true } },
      category: true,
      collectionItems: {
        include: { collection: true },
      },
    },
  });

  if (!item) {
    throw new Error("素材未找到");
  }

  return {
    ...hydrateItem(item),
    collections: (item.collectionItems ?? []).map((ci) => ci.collection),
  };
}

export async function uploadLibraryImage(params: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  tagIds?: string[];
  isPublic?: boolean;
}) {
  const saved = await saveLibraryImage({
    fileBuffer: params.fileBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
  });

  const updateData: Prisma.ImageLibraryItemUpdateInput = {};

  if (params.title) updateData.title = params.title;
  if (params.description) updateData.description = params.description;
  if (params.isPublic !== undefined) updateData.isPublic = params.isPublic;
  if (params.categoryId) updateData.category = { connect: { id: params.categoryId } };

  if (Object.keys(updateData).length > 0) {
    await prisma.imageLibraryItem.update({
      where: { id: saved.id },
      data: updateData,
    });
  }

  if (params.tagIds && params.tagIds.length > 0) {
    await prisma.imageLibraryItemTag.createMany({
      data: params.tagIds.map((tagId) => ({
        itemId: saved.id,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  return getLibraryItem(saved.id);
}

export async function updateLibraryItem(itemId: string, input: ImageLibraryItemInput) {
  const existing = await prisma.imageLibraryItem.findUnique({
    where: { id: itemId },
  });

  if (!existing) {
    throw new Error("素材未找到");
  }

  const updateData: Prisma.ImageLibraryItemUpdateInput = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
  if (input.categoryId !== undefined) {
    updateData.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.imageLibraryItem.update({
      where: { id: itemId },
      data: updateData,
    });
  }

  if (input.tagIds !== undefined) {
    await prisma.imageLibraryItemTag.deleteMany({
      where: { itemId },
    });

    if (input.tagIds.length > 0) {
      await prisma.imageLibraryItemTag.createMany({
        data: input.tagIds.map((tagId) => ({
          itemId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return getLibraryItem(itemId);
}

export async function removeLibraryItem(itemId: string) {
  const result = await deleteLibraryItem(itemId);
  return result;
}

export async function bulkUpdateLibraryItems(input: ImageLibraryBulkInput) {
  const results: { itemId: string; success: boolean }[] = [];

  for (const itemId of input.itemIds) {
    try {
      const exists = await prisma.imageLibraryItem.findUnique({
        where: { id: itemId },
      });

      if (!exists) {
        results.push({ itemId, success: false });
        continue;
      }

      if (input.addTagIds && input.addTagIds.length > 0) {
        await prisma.imageLibraryItemTag.createMany({
          data: input.addTagIds.map((tagId) => ({ itemId, tagId })),
          skipDuplicates: true,
        });
      }

      if (input.removeTagIds && input.removeTagIds.length > 0) {
        await prisma.imageLibraryItemTag.deleteMany({
          where: {
            itemId,
            tagId: { in: input.removeTagIds },
          },
        });
      }

      if (input.setCategoryId !== undefined) {
        await prisma.imageLibraryItem.update({
          where: { id: itemId },
          data: {
            category: input.setCategoryId
              ? { connect: { id: input.setCategoryId } }
              : { disconnect: true },
          },
        });
      }

      if (input.addToCollectionId) {
        const maxOrder = await prisma.imageCollectionItem.findFirst({
          where: { collectionId: input.addToCollectionId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        await prisma.imageCollectionItem.create({
          data: {
            collectionId: input.addToCollectionId,
            itemId,
            sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
          },
        });
      }

      results.push({ itemId, success: true });
    } catch {
      results.push({ itemId, success: false });
    }
  }

  return results;
}

export async function getCategories() {
  const categories = await prisma.imageCategory.findMany({
    include: {
      children: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => ({
    ...cat,
    itemCount: cat._count.items,
  }));
}

export async function createCategory(input: ImageCategoryInput) {
  const slug = slugify(input.name);
  const exists = await prisma.imageCategory.findUnique({ where: { slug } });
  if (exists) {
    throw new Error(`分类 "${input.name}" 已存在`);
  }

  return prisma.imageCategory.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      parentId: input.parentId,
    },
  });
}

export async function updateCategory(categoryId: string, input: Partial<ImageCategoryInput>) {
  const existing = await prisma.imageCategory.findUnique({
    where: { id: categoryId },
  });

  if (!existing) {
    throw new Error("分类未找到");
  }

  const data: Prisma.ImageCategoryUpdateInput = {};
  if (input.name) {
    data.name = input.name;
    data.slug = slugify(input.name);
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.parentId !== undefined) {
    if (input.parentId === categoryId) {
      throw new Error("分类不能作为自身的父分类");
    }
    data.parent = input.parentId
      ? { connect: { id: input.parentId } }
      : { disconnect: true };
  }

  return prisma.imageCategory.update({
    where: { id: categoryId },
    data,
  });
}

export async function deleteCategory(categoryId: string) {
  const existing = await prisma.imageCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { items: true, children: true } } },
  });

  if (!existing) {
    throw new Error("分类未找到");
  }

  if (existing._count.items > 0 || existing._count.children > 0) {
    throw new Error("分类下仍有素材或子分类，请先清空后再删除");
  }

  return prisma.imageCategory.delete({
    where: { id: categoryId },
  });
}

export async function getTags() {
  const tags = await prisma.imageTag.findMany({
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return tags.map((tag) => ({
    ...tag,
    itemCount: tag._count.items,
  }));
}

export async function createTag(input: ImageTagInput) {
  const slug = slugify(input.name);
  const exists = await prisma.imageTag.findUnique({ where: { slug } });
  if (exists) {
    throw new Error(`标签 "${input.name}" 已存在`);
  }

  return prisma.imageTag.create({
    data: {
      name: input.name,
      slug,
      color: input.color,
    },
  });
}

export async function updateTag(tagId: string, input: Partial<ImageTagInput>) {
  const existing = await prisma.imageTag.findUnique({
    where: { id: tagId },
  });

  if (!existing) {
    throw new Error("标签未找到");
  }

  const data: Prisma.ImageTagUpdateInput = {};
  if (input.name) {
    data.name = input.name;
    data.slug = slugify(input.name);
  }
  if (input.color !== undefined) data.color = input.color;

  return prisma.imageTag.update({
    where: { id: tagId },
    data,
  });
}

export async function deleteTag(tagId: string) {
  const existing = await prisma.imageTag.findUnique({
    where: { id: tagId },
  });

  if (!existing) {
    throw new Error("标签未找到");
  }

  await prisma.imageLibraryItemTag.deleteMany({
    where: { tagId },
  });

  return prisma.imageTag.delete({
    where: { id: tagId },
  });
}

export async function getCollections() {
  const collections = await prisma.imageCollection.findMany({
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return collections.map((c) => ({
    ...c,
    itemCount: c._count.items,
  }));
}

export async function getCollection(collectionId: string) {
  const collection = await prisma.imageCollection.findUnique({
    where: { id: collectionId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            include: {
              tags: { include: { tag: true } },
              category: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    throw new Error("合集未找到");
  }

  return hydrateCollection(collection);
}

export async function createCollection(input: ImageCollectionInput) {
  const collection = await prisma.imageCollection.create({
    data: {
      name: input.name,
      description: input.description,
      isPublic: input.isPublic ?? true,
    },
  });

  if (input.itemIds && input.itemIds.length > 0) {
    await prisma.imageCollectionItem.createMany({
      data: input.itemIds.map((itemId, index) => ({
        collectionId: collection.id,
        itemId,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });

    if (input.itemIds.length > 0) {
      await prisma.imageCollection.update({
        where: { id: collection.id },
        data: { coverImageId: input.itemIds[0] },
      });
    }
  }

  return getCollection(collection.id);
}

export async function updateCollection(collectionId: string, input: Partial<ImageCollectionInput>) {
  const existing = await prisma.imageCollection.findUnique({
    where: { id: collectionId },
  });

  if (!existing) {
    throw new Error("合集未找到");
  }

  const data: Prisma.ImageCollectionUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;

  await prisma.imageCollection.update({
    where: { id: collectionId },
    data,
  });

  if (input.itemIds !== undefined) {
    await prisma.imageCollectionItem.deleteMany({
      where: { collectionId },
    });

    if (input.itemIds.length > 0) {
      await prisma.imageCollectionItem.createMany({
        data: input.itemIds.map((itemId, index) => ({
          collectionId,
          itemId,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }
  }

  return getCollection(collectionId);
}

export async function deleteCollection(collectionId: string) {
  const existing = await prisma.imageCollection.findUnique({
    where: { id: collectionId },
  });

  if (!existing) {
    throw new Error("合集未找到");
  }

  return prisma.imageCollection.delete({
    where: { id: collectionId },
  });
}

export async function addToCollection(collectionId: string, itemId: string) {
  const maxOrder = await prisma.imageCollectionItem.findFirst({
    where: { collectionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.imageCollectionItem.create({
    data: {
      collectionId,
      itemId,
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
    },
  });

  return getCollection(collectionId);
}

export async function removeFromCollection(collectionId: string, itemId: string) {
  await prisma.imageCollectionItem.deleteMany({
    where: { collectionId, itemId },
  });

  return getCollection(collectionId);
}

export async function reorderCollectionItems(collectionId: string, itemIds: string[]) {
  await prisma.$transaction(
    itemIds.map((itemId, index) =>
      prisma.imageCollectionItem.updateMany({
        where: { collectionId, itemId },
        data: { sortOrder: index },
      }),
    ),
  );

  return getCollection(collectionId);
}

export async function getLibraryStats() {
  const [totalItems, totalCategories, totalTags, totalCollections, totalSize] =
    await Promise.all([
      prisma.imageLibraryItem.count(),
      prisma.imageCategory.count(),
      prisma.imageTag.count(),
      prisma.imageCollection.count(),
      prisma.imageLibraryItem.aggregate({
        _sum: { fileSize: true },
      }),
    ]);

  const mimeTypeDistribution = await prisma.imageLibraryItem.groupBy({
    by: ["mimeType"],
    _count: true,
    orderBy: { _count: { mimeType: "desc" } },
  });

  return {
    totalItems,
    totalCategories,
    totalTags,
    totalCollections,
    totalSizeBytes: totalSize._sum.fileSize ?? 0,
    mimeTypeDistribution: mimeTypeDistribution.map((item) => ({
      mimeType: item.mimeType,
      count: item._count,
    })),
  };
}
