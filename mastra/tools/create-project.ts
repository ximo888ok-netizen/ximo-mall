import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const stringToArrayOrArray = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      return val.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
    return val;
  },
  z.array(z.string()),
).optional();

const DETAIL_TYPE_POOL = [
  "SELLING_POINTS",
  "DETAIL_CLOSEUP",
  "SCENARIO",
  "SPECS",
  "MATERIAL",
  "COMPARISON",
  "GIFT_SCENE",
  "BRAND_TRUST",
  "SUMMARY",
  "CUSTOM",
  "CUSTOM",
  "CUSTOM",
] as const;

export const createProjectTool = createTool({
  id: "create-project",
  description:
    "创建电商详情页项目，上传主商品图，初始化空白模块。这是生成详情页的第一步，必须先调用此工具获取 projectId 后才能调用其他工具。必须传入 productAnalysis（你对商品图片的视觉分析结果，只写真实看到的信息，禁止猜测）和 imageLabels（每张图的语义标签，来自用户标注或你的识别）。如果之前用 searchProductLibraryTool 查询到匹配的产品知识库，必须传入 productLibraryId 以启用知识库约束。",
  inputSchema: z.object({
    name: z.string().describe("项目名称"),
    platform: z.string().describe("目标电商平台"),
    style: z.string().describe("视觉风格"),
    description: z.string().optional().describe("项目描述/用户需求"),
    productLibraryId: z.string().optional().describe(
      "产品知识库 ID。如果 searchProductLibraryTool 查询到匹配的产品，必须传入此 ID。传入后，后续的规划（planSectionsTool）和图像生成（generateHeroImageTool/generateDetailImageTool）会自动从产品知识库读取卖点/规格/场景等约束信息，确保事实准确性。未命中则不传。",
    ),
    productAnalysis: z.object({
      productName: z.string().describe("商品名称"),
      category: z.string().describe("品类"),
      subcategory: z.string().optional().describe("子品类"),
      material: z.string().optional().describe("材质"),
      color: z.string().optional().describe("主色调"),
      specifications: z.string().optional().describe("规格"),
      styleTags: stringToArrayOrArray.describe("风格标签"),
      targetAudience: stringToArrayOrArray.describe("目标人群"),
      usageScenarios: stringToArrayOrArray.describe("使用场景"),
      coreSellingPoints: stringToArrayOrArray.describe("核心卖点"),
      differentiationPoints: stringToArrayOrArray.describe("差异化卖点"),
      userConcerns: stringToArrayOrArray.describe("用户关注点"),
      recommendedFocusPoints: stringToArrayOrArray.describe("推荐聚焦点"),
    }).describe("你对商品图片的视觉分析结果，必须填写。只写你真实看到的信息，看不出来的字段写'未识别'或留空，禁止猜测、推断、补充"),
    imageLabels: z.array(z.object({
      index: z.number().describe("图片序号，从0开始"),
      label: z.string().describe("用户标注的标签或你识别的图片内容描述"),
      semanticType: z.enum(["MAIN_PRODUCT", "REFERENCE", "DETAIL", "SCENARIO", "MATERIAL", "PACKAGING", "COMPARISON", "OTHER"]).describe("图片的语义用途类型"),
    })).optional().describe("每张图的语义标签，来自用户标注或你的识别。第1张(index=0)默认为主图，其余根据内容判断"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    projectId: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData, toolCtx) => {
    const { prisma } = await import("@/lib/db/prisma");

    // 过滤无效的 productLibraryId（Agent 可能传入字符串 "null" 或空串）
    const validProductLibraryId =
      inputData.productLibraryId &&
      inputData.productLibraryId !== "null" &&
      inputData.productLibraryId.trim() !== ""
        ? inputData.productLibraryId
        : undefined;

    const requestCtx = toolCtx?.requestContext as Record<string, unknown> | undefined;

    // Try direct property access first (matching generate-hero-image pattern), then .get()
    const readFromCtx = (k: string): string | undefined => {
      if (!requestCtx) return undefined;
      const direct = (requestCtx as Record<string, unknown>)[k];
      if (typeof direct === "string") return direct;
      const viaGet =
        typeof (requestCtx as { get?: unknown }).get === "function"
          ? (requestCtx as { get: (key: string) => unknown }).get(k)
          : undefined;
      return typeof viaGet === "string" ? viaGet : undefined;
    };

    // 优先使用 requestContext 中的 style/platform（前端用户选择的英文 key），
    // 模型从消息前缀推断的值作为次选（模型可能传中文 label 导致风格模板匹配失败）
    const effectiveStyle = readFromCtx("style") || inputData.style;
    const effectivePlatform = readFromCtx("platform") || inputData.platform;

    const project = await prisma.project.create({
      data: {
        name: inputData.name,
        platform: effectivePlatform,
        style: effectiveStyle,
        description: inputData.description ?? null,
        ...(validProductLibraryId ? { productLibraryId: validProductLibraryId } : {}),
      },
    });

    // 读取多图数据（新格式）或单图（向后兼容旧格式）
    const imagesJson = readFromCtx("images");
    let imageEntries: Array<{
      base64: string;
      fileName: string;
      mimeType: string;
      label: string;
    }> = [];

    if (imagesJson) {
      try {
        imageEntries = JSON.parse(imagesJson);
      } catch {
        // JSON 解析失败则回退到单图
      }
    }

    // 向后兼容：旧单图格式
    if (imageEntries.length === 0) {
      const legacyBase64 = readFromCtx("imageBase64");
      if (legacyBase64) {
        imageEntries.push({
          base64: legacyBase64,
          fileName: readFromCtx("imageFileName") || "product.png",
          mimeType: readFromCtx("imageMimeType") || "image/png",
          label: "",
        });
      }
    }

    // Build a lookup map from imageLabels for semantic type resolution
    const labelMap = new Map<number, { label: string; semanticType: string }>();
    if (inputData.imageLabels) {
      for (const il of inputData.imageLabels) {
        labelMap.set(il.index, { label: il.label, semanticType: il.semanticType });
      }
    }

    // semanticType → ProductAsset AssetType mapping
    // Must align with AssetType enum and mergeReferenceAssets in generation-service.ts
    // which specifically picks up: MAIN, PACKAGING, PRODUCT, INGREDIENT, INFO_CARD, REFERENCE
    const semanticToAssetType = (semanticType: string): string => {
      switch (semanticType) {
        case "MAIN_PRODUCT": return "MAIN";
        case "REFERENCE":    return "REFERENCE";
        case "SCENARIO":     return "REFERENCE";
        case "MATERIAL":     return "REFERENCE";
        case "PACKAGING":    return "PACKAGING";
        case "COMPARISON":   return "REFERENCE";
        case "DETAIL":       return "DETAIL";
        default:             return "REFERENCE";
      }
    };

    if (imageEntries.length > 0) {
      const { saveUploadAsset } = await import(
        "@/lib/storage/asset-manager"
      );
      const existingCount = await prisma.productAsset.count({
        where: { projectId: project.id },
      });

      for (let i = 0; i < imageEntries.length; i++) {
        const entry = imageEntries[i];
        const isMain = i === 0;
        const userLabel = entry.label?.trim() || "";
        const labelInfo = labelMap.get(i);

        // Use semanticType from Agent if available, otherwise fall back to label heuristics
        let type: string;
        if (labelInfo) {
          type = semanticToAssetType(labelInfo.semanticType);
        } else if (isMain) {
          type = "MAIN";
        } else if (/参考|素材|reference/i.test(userLabel)) {
          type = "REFERENCE";
        } else {
          type = "DETAIL";
        }

        // Merge user label + Agent semantic label for rich metadata
        const effectiveLabel = labelInfo
          ? `${labelInfo.label}${userLabel && userLabel !== labelInfo.label ? ` (${userLabel})` : ""}`
          : userLabel;

        await saveUploadAsset({
          projectId: project.id,
          type: type as never,
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          fileBuffer: Buffer.from(entry.base64, "base64"),
          sortOrder: existingCount + i,
          isMain,
          extraMetadata: {
            label: effectiveLabel || undefined,
            semanticType: labelInfo?.semanticType || undefined,
          },
        });
      }
    }

    // Write product analysis to database so planSectionsTool and generation can consume it
    const analysis = inputData.productAnalysis;
    await prisma.productAnalysis.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        rawResult: JSON.stringify({ source: "agent_visual_analysis", ...analysis }),
        normalizedResult: {
          productName: analysis.productName,
          category: analysis.category,
          subcategory: analysis.subcategory ?? "",
          material: analysis.material ?? "",
          color: analysis.color ?? "",
          specifications: analysis.specifications ?? "",
          styleTags: analysis.styleTags ?? [],
          targetAudience: analysis.targetAudience ?? [],
          usageScenarios: analysis.usageScenarios ?? [],
          coreSellingPoints: analysis.coreSellingPoints ?? [],
          differentiationPoints: analysis.differentiationPoints ?? [],
          userConcerns: analysis.userConcerns ?? [],
          recommendedFocusPoints: analysis.recommendedFocusPoints ?? [],
          suggestedSectionPlan: [],
          associatedImageContexts: (inputData.imageLabels ?? []).map((il, idx) => ({
            index: idx,
            fileName: `image_${idx}`,
            sceneDescription: il.label,
            productRelationship: il.semanticType,
            visualElements: [],
            compositionStyle: "",
            lightingAndColor: "",
            propsAndEnvironment: [],
            usageScenario: il.semanticType === "SCENARIO" ? il.label : "",
          })),
        },
      },
      update: {
        rawResult: JSON.stringify({ source: "agent_visual_analysis", ...analysis }),
        normalizedResult: {
          productName: analysis.productName,
          category: analysis.category,
          subcategory: analysis.subcategory ?? "",
          material: analysis.material ?? "",
          color: analysis.color ?? "",
          specifications: analysis.specifications ?? "",
          styleTags: analysis.styleTags ?? [],
          targetAudience: analysis.targetAudience ?? [],
          usageScenarios: analysis.usageScenarios ?? [],
          coreSellingPoints: analysis.coreSellingPoints ?? [],
          differentiationPoints: analysis.differentiationPoints ?? [],
          userConcerns: analysis.userConcerns ?? [],
          recommendedFocusPoints: analysis.recommendedFocusPoints ?? [],
          suggestedSectionPlan: [],
          associatedImageContexts: (inputData.imageLabels ?? []).map((il, idx) => ({
            index: idx,
            fileName: `image_${idx}`,
            sceneDescription: il.label,
            productRelationship: il.semanticType,
            visualElements: [],
            compositionStyle: "",
            lightingAndColor: "",
            propsAndEnvironment: [],
            usageScenario: il.semanticType === "SCENARIO" ? il.label : "",
          })),
        },
      },
    });

    const heroCount = Number(readFromCtx("heroCount") || 3);
    const detailCount = Number(readFromCtx("detailCount") || 6);

    await prisma.pageSection.deleteMany({
      where: { projectId: project.id },
    });

    const sectionsData: Array<{
      projectId: string;
      sectionKey: string;
      type: string;
      title: string;
      goal: string;
      copy: string;
      visualPrompt: string;
      order: number;
      editableData: Record<string, unknown>;
      status: string;
    }> = [];

    for (let i = 0; i < heroCount; i++) {
      sectionsData.push({
        projectId: project.id,
        sectionKey: `hero_${String(i + 1).padStart(2, "0")}`,
        type: "HERO",
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        order: i,
        editableData: {},
        status: "IDLE",
      });
    }

    for (let i = 0; i < detailCount; i++) {
      const detailType =
        DETAIL_TYPE_POOL[i] ?? DETAIL_TYPE_POOL[DETAIL_TYPE_POOL.length - 1];
      sectionsData.push({
        projectId: project.id,
        sectionKey: `detail_${String(i + 1).padStart(2, "0")}_${detailType.toLowerCase()}`,
        type: detailType,
        title: "",
        goal: "",
        copy: "",
        visualPrompt: "",
        order: heroCount + i,
        editableData: {},
        status: "IDLE",
      });
    }

    await prisma.pageSection.createMany({ data: sectionsData });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: "ANALYZED",
        modelSnapshot: {
          previewConfig: {
            heroImageCount: heroCount,
            detailSectionCount: detailCount,
            imageAspectRatio: "9:16",
            contentLanguage: "zh-CN",
          },
        },
      },
    });

    return {
      success: true,
      projectId: project.id,
      message: `项目创建成功，已初始化 ${heroCount} 个头图模块和 ${detailCount} 个详情模块`,
    };
  },
});
