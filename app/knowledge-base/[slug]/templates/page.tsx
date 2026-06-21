"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  Layers,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TemplateConfig {
  layout: {
    composition: string;
    productArea: string;
    brandArea: string;
    promoArea: string;
    textAreas: string[];
  };
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    textColor: string;
  };
  typography: {
    titleStyle: string;
    subtitleStyle: string;
    badgeStyle: string;
    bodyStyle: string;
  };
  marketingElements: Array<{
    type: string;
    position: string;
    style: string;
    content: string;
  }>;
  decoration: {
    background: string;
    dividers: string;
    ornaments: string;
  };
  productPresentation: {
    angle: string;
    container: string;
    arrangement: string;
    effects: string;
  };
}

interface Template {
  id: string;
  category: string;
  name: string;
  description: string | null;
  config: TemplateConfig;
  promptSnippets: { positive: string; negative: string } | null;
  tags: string[] | null;
  confidence: number;
  sampleCount: number;
  createdAt: string;
}

export default function KBTemplatesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const catParam = activeTab !== "all" ? `?category=${activeTab}` : "";
      const response = await fetch(`/api/knowledge-base/${slug}/templates${catParam}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data?.templates || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, [slug, activeTab]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const catParam = activeTab !== "all" ? activeTab : "";
      const response = await fetch(`/api/knowledge-base/${slug}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catParam ? { category: catParam } : {}),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`成功生成 ${data.data?.count || 0} 个模板`);
        await loadTemplates();
      } else {
        const error = await response.json();
        alert("生成失败: " + error.error);
      }
    } catch (error) {
      console.error("Generate failed:", error);
      alert("生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm("确定要删除这个模板吗？")) return;
    try {
      const response = await fetch(
        `/api/knowledge-base/${slug}/templates/${templateId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href={`/knowledge-base/${slug}`}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回知识库
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">视觉模板</h1>
            <p className="text-muted-foreground">
              从已学知识中提炼的可复用电商图片模板，可直接用于页面规划
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {generating ? "生成中..." : "生成模板"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部 ({templates.length})</TabsTrigger>
          <TabsTrigger value="HERO">
            头图模板 ({templates.filter((t) => t.category === "HERO").length})
          </TabsTrigger>
          <TabsTrigger value="DETAIL">
            详情图模板 ({templates.filter((t) => t.category === "DETAIL").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Layers className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">暂无模板，请先训练知识库图片，然后生成模板</p>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Layers className="w-4 h-4 mr-2" />
                  )}
                  生成模板
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  expanded={expandedId === template.id}
                  onToggle={() =>
                    setExpandedId(expandedId === template.id ? null : template.id)
                  }
                  onDelete={() => handleDelete(template.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== 模板卡片组件 ====================

function TemplateCard({
  template,
  expanded,
  onToggle,
  onDelete,
}: {
  template: Template;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const config = template.config;
  const colors = config?.colorScheme;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 配色预览色块 */}
            {colors && (
              <div className="flex gap-1">
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: colors.primary }}
                  title={`主色: ${colors.primary}`}
                />
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: colors.secondary }}
                  title={`辅助色: ${colors.secondary}`}
                />
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: colors.accent }}
                  title={`强调色: ${colors.accent}`}
                />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription className="mt-1">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={template.category === "HERO" ? "default" : "secondary"}>
              {template.category === "HERO" ? "头图" : "详情图"}
            </Badge>
            <Badge variant="outline">
              {Math.round(template.confidence * 100)}%
            </Badge>
            <span className="text-sm text-muted-foreground">
              {template.sampleCount} 张图片
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
        {/* 标签 */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex gap-2 mt-2">
            {template.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-4 border-t pt-4">
            {/* 布局配置 */}
            <ConfigSection title="布局结构" icon={<Eye className="w-4 h-4" />}>
              <ConfigRow label="构图方式" value={config?.layout?.composition} />
              <ConfigRow label="产品区域" value={config?.layout?.productArea} />
              <ConfigRow label="品牌区域" value={config?.layout?.brandArea} />
              <ConfigRow label="促销区域" value={config?.layout?.promoArea} />
              {config?.layout?.textAreas?.map((area, i) => (
                <ConfigRow key={i} label={`文字区域 ${i + 1}`} value={area} />
              ))}
            </ConfigSection>

            {/* 配色方案 */}
            <ConfigSection title="配色方案">
              <div className="flex gap-3 mb-2">
                {[
                  { label: "主色", color: colors?.primary },
                  { label: "辅助色", color: colors?.secondary },
                  { label: "强调色", color: colors?.accent },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm">
                      {c.label}: {c.color}
                    </span>
                  </div>
                ))}
              </div>
              <ConfigRow label="背景" value={colors?.background} />
              <ConfigRow label="文字颜色" value={colors?.textColor} />
            </ConfigSection>

            {/* 排版 */}
            <ConfigSection title="文字排版">
              <ConfigRow label="标题" value={config?.typography?.titleStyle} />
              <ConfigRow label="副标题" value={config?.typography?.subtitleStyle} />
              <ConfigRow label="角标" value={config?.typography?.badgeStyle} />
              <ConfigRow label="正文" value={config?.typography?.bodyStyle} />
            </ConfigSection>

            {/* 营销元素 */}
            {config?.marketingElements && config.marketingElements.length > 0 && (
              <ConfigSection title="营销元素">
                {config.marketingElements.map((el, i) => (
                  <div key={i} className="p-2 bg-muted/50 rounded text-sm">
                    <div className="font-medium">{el.type}</div>
                    <div className="text-muted-foreground">
                      位置: {el.position} | 样式: {el.style}
                    </div>
                    <div className="text-muted-foreground">内容: {el.content}</div>
                  </div>
                ))}
              </ConfigSection>
            )}

            {/* 装饰 */}
            <ConfigSection title="装饰元素">
              <ConfigRow label="背景装饰" value={config?.decoration?.background} />
              <ConfigRow label="分隔线" value={config?.decoration?.dividers} />
              <ConfigRow label="其他装饰" value={config?.decoration?.ornaments} />
            </ConfigSection>

            {/* 产品呈现 */}
            <ConfigSection title="产品呈现">
              <ConfigRow label="拍摄角度" value={config?.productPresentation?.angle} />
              <ConfigRow label="容器" value={config?.productPresentation?.container} />
              <ConfigRow label="摆放方式" value={config?.productPresentation?.arrangement} />
              <ConfigRow label="视觉效果" value={config?.productPresentation?.effects} />
            </ConfigSection>

            {/* 提示词 */}
            {template.promptSnippets && (
              <ConfigSection title="AI 生图提示词">
                <div className="p-3 bg-muted/50 rounded text-sm font-mono whitespace-pre-wrap">
                  {template.promptSnippets.positive}
                </div>
                {template.promptSnippets.negative && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 rounded text-sm font-mono whitespace-pre-wrap text-red-700 dark:text-red-400">
                    负面: {template.promptSnippets.negative}
                  </div>
                )}
              </ConfigSection>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ConfigSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-20 shrink-0">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
