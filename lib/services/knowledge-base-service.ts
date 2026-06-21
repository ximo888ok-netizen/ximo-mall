import { prisma } from "@/lib/db/prisma";

// ==================== 知识库类型定义 ====================

export interface CreateKnowledgeBaseInput {
  slug: string;
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
  coverImage?: string;
}

export interface KnowledgeBaseListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  imageCount: number;
  knowledgeCount: number;
  summary: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 知识库 CRUD ====================

// 初始化默认知识库
export async function initializeDefaultKnowledgeBases() {
  const defaults = [
    { slug: "banmian", name: "拌面", description: "拌面类产品知识库，包含头图和详情图的风格、布局、文案等知识" },
    { slug: "zhushengmian", name: "竹升面", description: "竹升面类产品知识库，包含头图和详情图的风格、布局、文案等知识" },
    { slug: "laomian", name: "捞面", description: "捞面类产品知识库，包含头图和详情图的风格、布局、文案等知识" },
    { slug: "dawanmian", name: "大碗面", description: "大碗面类产品知识库，包含头图和详情图的风格、布局、文案等知识" },
  ];

  for (const item of defaults) {
    await prisma.noodleKnowledgeBase.upsert({
      where: { slug: item.slug },
      update: {},
      create: item,
    });
  }
}

// 获取所有知识库列表
export async function listKnowledgeBases(): Promise<KnowledgeBaseListItem[]> {
  // 确保默认知识库存在
  await initializeDefaultKnowledgeBases();

  return prisma.noodleKnowledgeBase.findMany({
    orderBy: { createdAt: "asc" },
  });
}

// 根据 slug 获取知识库
export async function getKnowledgeBaseBySlug(slug: string) {
  return prisma.noodleKnowledgeBase.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { images: true, knowledges: true },
      },
    },
  });
}

// 根据 id 获取知识库
export async function getKnowledgeBaseById(id: string) {
  return prisma.noodleKnowledgeBase.findUnique({
    where: { id },
    include: {
      _count: {
        select: { images: true, knowledges: true },
      },
    },
  });
}

// 创建知识库
export async function createKnowledgeBase(input: CreateKnowledgeBaseInput) {
  return prisma.noodleKnowledgeBase.create({
    data: input,
  });
}

// 更新知识库
export async function updateKnowledgeBase(id: string, input: UpdateKnowledgeBaseInput) {
  return prisma.noodleKnowledgeBase.update({
    where: { id },
    data: input,
  });
}

// 删除知识库
export async function deleteKnowledgeBase(id: string) {
  return prisma.noodleKnowledgeBase.delete({
    where: { id },
  });
}

// 更新知识库统计
export async function updateKnowledgeBaseStats(kbId: string) {
  const [imageCount, knowledgeCount] = await Promise.all([
    prisma.noodleKBImage.count({ where: { kbId } }),
    prisma.noodleKBKnowledge.count({ where: { kbId, isActive: true } }),
  ]);

  return prisma.noodleKnowledgeBase.update({
    where: { id: kbId },
    data: { imageCount, knowledgeCount },
  });
}
