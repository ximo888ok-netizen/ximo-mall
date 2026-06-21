import { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { handleRouteError, ok } from "@/lib/utils/route";
import { normalizeContentLanguage } from "@/lib/utils/content-language";

/**
 * 为 AI Agent 模式创建空白模块结构
 * 所有字段留空，让用户100%自主编辑
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;

    // 验证项目存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return handleRouteError(new Error("项目不存在"));
    }

    // 定义空白模块结构（3个头图 + 6个详情图），所有内容字段为空
    const defaultHeroCount = 3;
    const defaultDetailCount = 6;

    const heroTemplates = [
      {
        type: "HERO",
        sectionKey: "hero_01",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "HERO",
        sectionKey: "hero_02",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "HERO",
        sectionKey: "hero_03",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
    ];

    const detailTemplates = [
      {
        type: "SELLING_POINTS",
        sectionKey: "detail_01_selling_points",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "DETAIL_CLOSEUP",
        sectionKey: "detail_02_detail_closeup",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "SCENARIO",
        sectionKey: "detail_03_scenario",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "SPECS",
        sectionKey: "detail_04_specs",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "MATERIAL",
        sectionKey: "detail_05_material",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
      {
        type: "SUMMARY",
        sectionKey: "detail_06_summary",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        editableData: {},
      },
    ];

    // 删除已有的模块（如果有）
    await prisma.pageSection.deleteMany({
      where: { projectId },
    });

    // 创建空白模块
    const sectionsData = [
      ...heroTemplates.slice(0, defaultHeroCount),
      ...detailTemplates.slice(0, defaultDetailCount),
    ].map((template, index) => ({
      projectId,
      sectionKey: template.sectionKey,
      type: template.type as any,
      title: template.title,
      goal: template.goal,
      copy: template.copy,
      visualPrompt: template.visualPrompt,
      order: index,
      editableData: template.editableData as any,
      status: "IDLE" as const,
    }));

    await prisma.pageSection.createMany({
      data: sectionsData,
    });

    // 更新项目状态和预览配置
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "EDITING",
        modelSnapshot: {
          previewConfig: {
            heroImageCount: defaultHeroCount,
            detailSectionCount: defaultDetailCount,
            imageAspectRatio: "9:16",
            contentLanguage: normalizeContentLanguage("zh-CN"),
          },
        },
      },
    });

    // 获取创建后的模块
    const sections = await prisma.pageSection.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    return ok({
      sections,
      message: "空白模块创建成功",
      previewConfig: {
        heroImageCount: defaultHeroCount,
        detailSectionCount: defaultDetailCount,
        imageAspectRatio: "9:16",
        contentLanguage: "zh-CN",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
