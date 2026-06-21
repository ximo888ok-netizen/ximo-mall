"use client";

import { useEffect, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Brain,
  Palette,
  Layout,
  Type,
  Utensils,
  Package,
} from "lucide-react";

interface SummaryData {
  totalImages: number;
  heroImages: number;
  detailImages: number;
  totalKnowledges: number;
  knowledgeByType: Record<string, number>;
  styleStats: {
    dominantColors: { color: string; frequency: number }[];
    moodDistribution: { mood: string; count: number }[];
  };
  layoutStats: {
    commonLayouts: { layout: string; count: number }[];
  };
  typographyStats: {
    fontStyles: { style: string; count: number }[];
  };
  appetiteStats: {
    steamFrequency: number;
    garnishTypes: { type: string; count: number }[];
  };
  marketingStats: {
    percentageLabels: { label: string; count: number }[];
    quantityHints: { hint: string; count: number }[];
    scenePhrases: { phrase: string; count: number }[];
    trustBadges: { badge: string; count: number }[];
  };
  topKnowledges: {
    id: string;
    type: string;
    name: string;
    description: string;
    confidence: number;
  }[];
}

interface SummaryViewProps {
  category?: "HERO" | "DETAIL";
  title: string;
  description: string;
}

export function SummaryView({ category, title, description }: SummaryViewProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [slug]);

  async function loadSummary() {
    try {
      const catParam = category ? `?category=${category}` : "";
      const response = await fetch(`/api/knowledge-base/${slug}/summary${catParam}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.data?.summary || data.summary);
      }
    } catch (error) {
      console.error("Failed to load summary:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const catParam = category ? `?category=${category}` : "";
      const response = await fetch(`/api/knowledge-base/${slug}/summary${catParam}`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.data?.summary || data.summary);
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

  const typeLabels: Record<string, string> = {
    STYLE: "风格美学",
    LAYOUT: "模板布局",
    TYPOGRAPHY: "文案排版",
    APPETITE: "食欲元素",
    CONTENT: "营销元素",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    STYLE: <Palette className="w-4 h-4" />,
    LAYOUT: <Layout className="w-4 h-4" />,
    TYPOGRAPHY: <Type className="w-4 h-4" />,
    APPETITE: <Utensils className="w-4 h-4" />,
    CONTENT: <Package className="w-4 h-4" />,
  };

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
        <Link href={`/knowledge-base/${slug}`} className="flex items-center text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回知识库
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {summary ? "重新生成" : "生成总结"}
          </Button>
        </div>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无总结数据，请先生成总结</p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              生成总结
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 概览统计 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总图片数</CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalImages}</div>
                {!category && (
                  <p className="text-xs text-muted-foreground">
                    头图: {summary.heroImages} | 详情图: {summary.detailImages}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总知识数</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalKnowledges}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">蒸汽出现率</CardTitle>
                <Utensils className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(summary.appetiteStats.steamFrequency * 100)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">知识类型数</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(summary.knowledgeByType).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 知识类型分布 */}
          <Card>
            <CardHeader>
              <CardTitle>知识类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(summary.knowledgeByType).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-32">
                      {typeIcons[type]}
                      <span className="text-sm font-medium">{typeLabels[type] || type}</span>
                    </div>
                    <Progress value={(count / summary.totalKnowledges) * 100} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 置信度最高的知识 */}
          <Card>
            <CardHeader>
              <CardTitle>高置信度知识</CardTitle>
              <CardDescription>置信度最高的知识条目</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.topKnowledges.map((k) => (
                  <div key={k.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {typeIcons[k.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{k.name}</span>
                        <Badge variant="outline">{typeLabels[k.type] || k.type}</Badge>
                        <Badge variant="secondary">{Math.round(k.confidence * 100)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{k.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 营销元素统计 */}
          {summary.marketingStats && (
            <Card>
              <CardHeader>
                <CardTitle>营销元素统计</CardTitle>
                <CardDescription>百分比标注、数量暗示、场景句、信任徽章</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {summary.marketingStats.percentageLabels.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">百分比标注</h4>
                      <div className="space-y-2">
                        {summary.marketingStats.percentageLabels.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.label}</span>
                            <span className="text-muted-foreground">{item.count}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.marketingStats.quantityHints.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">数量暗示</h4>
                      <div className="space-y-2">
                        {summary.marketingStats.quantityHints.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.hint}</span>
                            <span className="text-muted-foreground">{item.count}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.marketingStats.scenePhrases.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">场景句</h4>
                      <div className="space-y-2">
                        {summary.marketingStats.scenePhrases.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.phrase}</span>
                            <span className="text-muted-foreground">{item.count}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.marketingStats.trustBadges.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">信任徽章</h4>
                      <div className="space-y-2">
                        {summary.marketingStats.trustBadges.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.badge}</span>
                            <span className="text-muted-foreground">{item.count}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
