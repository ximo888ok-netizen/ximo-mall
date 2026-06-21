import { prisma } from "@/lib/db/prisma";
import { OpenAICompatibleAdapter } from "@/lib/ai/adapters/openai-compatible";
import { normalizeDetectedModels } from "@/lib/ai/capability-detector";
import { recommendDefaultModels } from "@/lib/ai/model-matcher";
import { decryptSecret, encryptSecret } from "@/lib/utils/crypto";
import type { ProviderConnectionInput } from "@/types/domain";

type RuntimeProviderModel = {
  id: string;
  providerConfigId: string;
  modelId: string;
  label: string;
  capabilities: Record<string, unknown>;
  roles: Record<string, unknown>;
  quality: string | null;
  latency: string | null;
  cost: string | null;
  isAvailable: boolean;
  isDefaultAnalysis: boolean;
  isDefaultPlanning: boolean;
  isDefaultHeroImage: boolean;
  isDefaultDetailImage: boolean;
  isDefaultImageEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
  endpointSupport: {
    imageGeneration: string;
    imageEdit: string;
    note: string | null;
  };
};

type ProviderAdapterContext = {
  provider: {
    id: string;
    name: string;
    baseUrl: string;
    apiKeyEncrypted: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    models: RuntimeProviderModel[];
  };
  apiKey: string;
  adapter: OpenAICompatibleAdapter;
};

function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}***${trimmed.slice(-4)}`;
}

function readEndpointSupport(capabilities: Record<string, unknown> | null | undefined) {
  return {
    imageGeneration: (capabilities?.__imageGenerationStatus as string | undefined) ?? "unknown",
    imageEdit: (capabilities?.__imageEditStatus as string | undefined) ?? "unknown",
    note: (capabilities?.__probeNote as string | undefined) ?? null,
  };
}

function hydrateProviderModels<T extends { capabilities: any }>(models: T[]) {
  return models.map((model) => ({
    ...model,
    endpointSupport: readEndpointSupport(model.capabilities as Record<string, unknown> | undefined),
  }));
}

function scoreImageProbePriority(modelId: string) {
  let score = 0;
  const id = modelId.toLowerCase();

  if (/gemini|imagen|banana|nano-banana|flux|recraft/.test(id)) score += 8;
  if (/image|imagen|edit|inpaint/.test(id)) score += 6;
  if (/pro|ultra|max/.test(id)) score += 2;
  if (/preview|experimental|beta|test/.test(id)) score -= 2;
  if (/deprecated|old|legacy/.test(id)) score -= 4;

  return score;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => consume());
  await Promise.all(workers);
  return results;
}

async function enrichModelEndpointSupport(
  adapter: OpenAICompatibleAdapter,
  models: ReturnType<typeof normalizeDetectedModels>,
) {
  const enriched = models.map((model) => ({ ...model }));
  const imageCandidates = enriched
    .filter((model) => model.capabilities.image_gen || model.capabilities.image_edit)
    .sort((left, right) => scoreImageProbePriority(right.modelId) - scoreImageProbePriority(left.modelId));

  const maxProbeCount = Math.min(12, imageCandidates.length);
  const toProbe = imageCandidates.slice(0, maxProbeCount);
  const skipped = imageCandidates.slice(maxProbeCount);

  for (const model of enriched) {
    if (!model.capabilities.image_gen && !model.capabilities.image_edit) {
      model.endpointSupport = {
        imageGeneration: "not_applicable",
        imageEdit: "not_applicable",
        note: null,
      };
      continue;
    }

    model.endpointSupport = {
      imageGeneration: "unknown",
      imageEdit: "unknown",
      note: "等待探测",
    };
    (model.capabilities as Record<string, unknown>).__imageGenerationStatus = "unknown";
    (model.capabilities as Record<string, unknown>).__imageEditStatus = "unknown";
    (model.capabilities as Record<string, unknown>).__probeNote = "等待探测";
  }

  await runWithConcurrency(toProbe, 4, async (model) => {
    try {
      const support = await adapter.probeImageEndpointSupport(model.modelId);
      model.endpointSupport = support;
      model.capabilities.real_image_gen = support.imageGeneration !== "unavailable";
      model.capabilities.real_image_edit = support.imageEdit !== "unavailable";
      (model.capabilities as Record<string, unknown>).__imageGenerationStatus = support.imageGeneration;
      (model.capabilities as Record<string, unknown>).__imageEditStatus = support.imageEdit;
      (model.capabilities as Record<string, unknown>).__probeNote = support.note ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown probe error";
      model.endpointSupport = {
        imageGeneration: "unknown",
        imageEdit: "unknown",
        note: message,
      };
      (model.capabilities as Record<string, unknown>).__imageGenerationStatus = "unknown";
      (model.capabilities as Record<string, unknown>).__imageEditStatus = "unknown";
      (model.capabilities as Record<string, unknown>).__probeNote = message;
    }
  });

  for (const model of skipped) {
    const note = "为了保证速度，本次仅探测优先级更高的图片模型。";
    model.endpointSupport = {
      imageGeneration: "unknown",
      imageEdit: "unknown",
      note,
    };
    (model.capabilities as Record<string, unknown>).__imageGenerationStatus = "unknown";
    (model.capabilities as Record<string, unknown>).__imageEditStatus = "unknown";
    (model.capabilities as Record<string, unknown>).__probeNote = note;
  }

  return enriched;
}

async function replaceProviderModels(
  providerConfigId: string,
  models: Awaited<ReturnType<typeof discoverProviderModels>>["models"],
  defaults: {
    analysisModelId?: string | null;
    planningModelId?: string | null;
    heroImageModelId?: string | null;
    detailImageModelId?: string | null;
    imageEditModelId?: string | null;
  },
) {
  await prisma.modelProfile.deleteMany({
    where: { providerConfigId },
  });

  await prisma.modelProfile.createMany({
    data: models.map((model) => ({
      providerConfigId,
      modelId: model.modelId,
      label: model.label,
      capabilities: model.capabilities,
      roles: model.roles,
      quality: model.quality,
      latency: model.latency,
      cost: model.cost,
      isAvailable: model.isAvailable,
      isDefaultAnalysis: defaults.analysisModelId === model.modelId,
      isDefaultPlanning: defaults.planningModelId === model.modelId,
      isDefaultHeroImage: defaults.heroImageModelId === model.modelId,
      isDefaultDetailImage: defaults.detailImageModelId === model.modelId,
      isDefaultImageEdit: defaults.imageEditModelId === model.modelId,
    })),
  });
}

export async function testProviderConnection(input: ProviderConnectionInput) {
  const adapter = new OpenAICompatibleAdapter(input.baseUrl, input.apiKey);
  return adapter.testConnection();
}

export async function resolveProviderConnectionInput(
  input: Omit<ProviderConnectionInput, "apiKey"> & { apiKey?: string | null; id?: string | null },
): Promise<ProviderConnectionInput> {
  const trimmedKey = input.apiKey?.trim() ?? "";
  if (trimmedKey.length >= 6) {
    return {
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: trimmedKey,
    };
  }

  const matchedProvider =
    (input.id
      ? await prisma.providerConfig.findUnique({
          where: { id: input.id },
        })
      : await prisma.providerConfig.findFirst({
          where: {
            OR: [{ baseUrl: input.baseUrl }, { isActive: true }],
          },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        })) ?? null;

  if (!matchedProvider) {
    throw new Error("当前没有可复用的已保存 API Key，请重新输入 API Key 后再试。");
  }

  return {
    name: input.name,
    baseUrl: input.baseUrl,
    apiKey: decryptSecret(matchedProvider.apiKeyEncrypted),
  };
}

export async function discoverProviderModels(input: ProviderConnectionInput) {
  const adapter = new OpenAICompatibleAdapter(input.baseUrl, input.apiKey);
  const models = await adapter.listModels();
  const normalized = await enrichModelEndpointSupport(adapter, normalizeDetectedModels(models));
  return {
    models: normalized,
    recommendations: recommendDefaultModels(normalized),
  };
}

export async function saveProviderConfig(
  input: ProviderConnectionInput & {
    id?: string | null;
    isActive?: boolean;
    defaultAssignments?: {
      analysisModelId?: string | null;
      planningModelId?: string | null;
      heroImageModelId?: string | null;
      detailImageModelId?: string | null;
      imageEditModelId?: string | null;
    };
    /**
     * 如果为 true，表示前端已完成模型发现，直接复用已有模型列表而不重新拉取。
     * 这样可以确保用户在 UI 中设置的默认模型分配（defaultAssignments）不会因为
     * 重新拉取而导致模型 ID 不匹配（API 返回的模型列表可能已变化）。
     */
    reuseExistingModels?: boolean;
  },
) {
  const nextIsActive = input.isActive ?? true;

  // 如果需要复用已有模型，直接从 DB 读取并只更新 defaultAssignments
  let discovered: { models: ReturnType<typeof normalizeDetectedModels>; recommendations: ReturnType<typeof recommendDefaultModels> };
  if (input.reuseExistingModels && input.id) {
    const existing = await prisma.providerConfig.findUnique({
      where: { id: input.id },
      include: { models: { orderBy: { modelId: "asc" } } },
    });
    if (existing && existing.models.length > 0) {
      // 从 DB 还原模型，不重新拉取 API
      const restoredModels = existing.models.map((m) => ({
        modelId: m.modelId,
        label: m.label,
        capabilities: m.capabilities as Record<string, unknown>,
        roles: m.roles as Record<string, unknown>,
        quality: m.quality,
        latency: m.latency,
        cost: m.cost,
        isAvailable: m.isAvailable,
      }));
      discovered = {
        models: restoredModels as ReturnType<typeof normalizeDetectedModels>,
        recommendations: recommendDefaultModels(
          restoredModels as ReturnType<typeof normalizeDetectedModels>,
        ),
      };
    } else {
      // 现有 provider 没有模型，回退到重新发现
      discovered = await discoverProviderModels(input);
    }
  } else {
    discovered = await discoverProviderModels(input);
  }

  if (nextIsActive) {
    await prisma.providerConfig.updateMany({
      data: { isActive: false },
    });
  }

  const provider = input.id
    ? await prisma.providerConfig.update({
        where: { id: input.id },
        data: {
          name: input.name,
          baseUrl: input.baseUrl,
          apiKeyEncrypted: encryptSecret(input.apiKey),
          isActive: nextIsActive,
        },
      })
    : await prisma.providerConfig.create({
        data: {
          name: input.name,
          baseUrl: input.baseUrl,
          apiKeyEncrypted: encryptSecret(input.apiKey),
          isActive: nextIsActive,
        },
      });

  // 用户的 defaultAssignments 优先级高于 AI 自动推荐
  const defaults = {
    ...discovered.recommendations,
    ...(input.defaultAssignments ?? {}),
  };

  // 验证用户选择的模型 ID 确实存在于模型列表中，不匹配则警告但不阻止保存
  const modelIds = new Set(discovered.models.map((m) => m.modelId));
  if (defaults.planningModelId && !modelIds.has(defaults.planningModelId)) {
    console.warn(
      `[saveProviderConfig] 用户选择的规划模型 "${defaults.planningModelId}" 不在当前模型列表中，将回退到 AI 推荐。`,
    );
    defaults.planningModelId = discovered.recommendations.planningModelId ?? "";
  }
  if (defaults.analysisModelId && !modelIds.has(defaults.analysisModelId)) {
    console.warn(
      `[saveProviderConfig] 用户选择的分析模型 "${defaults.analysisModelId}" 不在当前模型列表中，将回退到 AI 推荐。`,
    );
    defaults.analysisModelId = discovered.recommendations.analysisModelId ?? "";
  }
  if (defaults.heroImageModelId && !modelIds.has(defaults.heroImageModelId)) {
    console.warn(
      `[saveProviderConfig] 用户选择的头图模型 "${defaults.heroImageModelId}" 不在当前模型列表中。`,
    );
  }
  if (defaults.detailImageModelId && !modelIds.has(defaults.detailImageModelId)) {
    console.warn(
      `[saveProviderConfig] 用户选择的详情图模型 "${defaults.detailImageModelId}" 不在当前模型列表中。`,
    );
  }
  if (defaults.imageEditModelId && !modelIds.has(defaults.imageEditModelId)) {
    console.warn(
      `[saveProviderConfig] 用户选择的编辑模型 "${defaults.imageEditModelId}" 不在当前模型列表中。`,
    );
  }

  await replaceProviderModels(provider.id, discovered.models, defaults);
  return provider.id;
}

export async function getAllProviderConfigs() {
  const providers = await prisma.providerConfig.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      models: {
        orderBy: { modelId: "asc" },
      },
    },
  });

  return providers.map((provider) => {
    let apiKey: string;
    try {
      apiKey = decryptSecret(provider.apiKeyEncrypted);
    } catch {
      apiKey = "";
    }
    return {
      ...provider,
      apiKey,
      maskedApiKey: apiKey ? maskApiKey(apiKey) : "",
      models: hydrateProviderModels(provider.models),
      decryptionFailed: !apiKey,
    };
  });
}

export async function getActiveProviderConfig() {
  const provider = await prisma.providerConfig.findFirst({
    where: { isActive: true },
    include: {
      models: {
        orderBy: { modelId: "asc" },
      },
    },
  });

  if (!provider) return null;

  let apiKey: string;
  try {
    apiKey = decryptSecret(provider.apiKeyEncrypted);
  } catch {
    apiKey = "";
  }
  return {
    ...provider,
    apiKey,
    maskedApiKey: apiKey ? maskApiKey(apiKey) : "",
    models: hydrateProviderModels(provider.models),
    decryptionFailed: !apiKey,
  };
}

export async function activateProviderConfig(providerId: string) {
  const provider = await prisma.providerConfig.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error("未找到要切换的历史服务配置。");
  }

  await prisma.providerConfig.updateMany({
    data: { isActive: false },
  });

  await prisma.providerConfig.update({
    where: { id: providerId },
    data: { isActive: true },
  });

  return getAllProviderConfigs();
}

export async function getProviderAdapter(
  providerIdOrPurpose?: string | "analysis" | "planning" | "image" | "box",
): Promise<ProviderAdapterContext> {
  // 硬编码模型映射
  const PURPOSE_MODELS: Record<string, string> = {
    analysis: "doubao-seed-2-0-lite-260428",
    planning: "deepseek-v4-flash-260425",
    agent: "doubao-seed-2-0-lite-260428",
    image: "wan2.7-image",
    box: "wan2.7-image",
  };

  // 智能路由：根据 purpose 在所有 Provider 中查找匹配的
  if (typeof providerIdOrPurpose === "string" && PURPOSE_MODELS[providerIdOrPurpose]) {
    const targetModel = PURPOSE_MODELS[providerIdOrPurpose];
    const allProviders = await prisma.providerConfig.findMany({
      include: { models: true },
    });
    const matchedProvider = allProviders.find((p) =>
      p.models.some((m) => m.modelId === targetModel),
    );
    if (matchedProvider) {
      const apiKey = decryptSecret(matchedProvider.apiKeyEncrypted);
      const runtimeModels = hydrateProviderModels(matchedProvider.models) as unknown as RuntimeProviderModel[];
      return {
        provider: { ...matchedProvider, models: runtimeModels },
        apiKey,
        adapter: new OpenAICompatibleAdapter(matchedProvider.baseUrl, apiKey),
      };
    }
    // 没找到匹配 Provider，继续走默认逻辑
  }

  // 默认：按 providerId 或 isActive 查找
  const provider =
    (typeof providerIdOrPurpose === "string" && !PURPOSE_MODELS[providerIdOrPurpose]
      ? await prisma.providerConfig.findUnique({
          where: { id: providerIdOrPurpose },
          include: { models: true },
        })
      : await prisma.providerConfig.findFirst({
          where: { isActive: true },
          include: { models: true },
        })) ?? null;

  if (!provider) {
    throw new Error("No active provider config found.");
  }

  const apiKey = decryptSecret(provider.apiKeyEncrypted);
  const runtimeModels = hydrateProviderModels(provider.models) as unknown as RuntimeProviderModel[];

  return {
    provider: {
      ...provider,
      models: runtimeModels,
    },
    apiKey,
    adapter: new OpenAICompatibleAdapter(provider.baseUrl, apiKey),
  };
}
