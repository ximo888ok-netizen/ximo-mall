"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { ProviderSettings } from "@/components/providers/provider-settings";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

type ProviderPageData = Array<{
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  maskedApiKey: string;
  isActive: boolean;
  updatedAt: string | Date;
  decryptionFailed?: boolean;
  models: Array<{
    modelId: string;
    label: string;
    capabilities: Record<string, unknown>;
    roles: Record<string, unknown>;
    quality?: string | null;
    latency?: string | null;
    cost?: string | null;
    isAvailable: boolean;
    endpointSupport?: {
      imageGeneration: string;
      imageEdit: string;
      note?: string | null;
    };
    isDefaultAnalysis: boolean;
    isDefaultPlanning: boolean;
    isDefaultHeroImage: boolean;
    isDefaultDetailImage: boolean;
    isDefaultImageEdit: boolean;
  }>;
}>;

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载 AI 配置...
      </CardContent>
    </Card>
  );
}

export default function ProviderSettingsPageClient() {
  const [mounted, setMounted] = useState(false);
  const [providers, setProviders] = useState<ProviderPageData>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let aborted = false;

    async function loadProviders() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/providers", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "加载 AI 配置失败");
        }

        if (!aborted) {
          setProviders(payload.data ?? []);
        }
      } catch (err) {
        if (!aborted) {
          setError(err instanceof Error ? err.message : "加载 AI 配置失败");
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    loadProviders();

    return () => {
      aborted = true;
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="space-y-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );
  }

  const hasDecryptionFailure = providers.some((p) => p.decryptionFailed);

  return (
    <div className="space-y-8" suppressHydrationWarning>
      <PageHeader
        eyebrow="模型服务配置"
        title="Provider 与模型配置中心"
        description="页面会优先展示已保存的历史服务与模型快照，方便你快速切换。需要从当前代理商重新发现模型并探测能力时，再点击“发现模型并探测”。"
      />

      {hasDecryptionFailure && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">检测到配置解密失败</p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                部分已保存的服务配置无法正确解密，可能是由于应用数据迁移或密钥变更导致。请重新输入 API Key 并保存配置。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Card>
          <CardContent className="min-h-[180px] space-y-2 pt-6 text-sm">
            <p className="font-medium text-destructive">加载失败</p>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <ProviderSettings initialProviders={providers} />
      )}
    </div>
  );
}
