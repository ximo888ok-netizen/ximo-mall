/**
 * 图片学习 Agent 首页
 * 展示两个固定学习库入口：头图库、详情图库
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ImageIcon, BookOpen, ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  {
    slug: "hero",
    name: "头图学习库",
    description: "投喂商品头图（主图/副图），学习模板布局、视觉风格和文案排版",
    icon: "🖼️",
    color: "from-blue-500 to-indigo-600",
    gradient: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
  },
  {
    slug: "detail",
    name: "详情图学习库",
    description: "投喂商品详情页图片，学习模板布局、视觉风格和文案排版",
    icon: "📄",
    color: "from-emerald-500 to-teal-600",
    gradient: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
  },
];

export default function LearningPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, { images: number; knowledges: number; status: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      const results: Record<string, { images: number; knowledges: number; status: string }> = {};
      for (const cat of ["hero", "detail"]) {
        try {
          const res = await fetch(`/api/learning/category/${cat}`);
          if (res.ok) {
            const data = await res.json();
            results[cat] = {
              images: data.session.images.length,
              knowledges: data.session.knowledges.length,
              status: data.session.status,
            };
          }
        } catch {
          // 忽略
        }
      }
      if (!cancelled) {
        setStats(results);
        setIsLoading(false);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 页面标题 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <ImageIcon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">图片学习 Agent</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          投喂商品图片，AI 自动学习模板布局、视觉风格和文案排版，
          赋能给商品图片生成工作流
        </p>
      </div>

      {/* 两个固定入口 */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {CATEGORIES.map((cat) => {
          const stat = stats[cat.slug];
          return (
            <Card
              key={cat.slug}
              className={`group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden ${cat.gradient} border-2 hover:border-primary/30`}
              onClick={() => router.push(`/learning/${cat.slug}`)}
            >
              <div className={`h-2 bg-gradient-to-r ${cat.color}`} />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{cat.icon}</span>
                    <div>
                      <CardTitle className="text-2xl">{cat.name}</CardTitle>
                      <CardDescription className="text-sm mt-1 max-w-sm">
                        {cat.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {stat ? stat.images : 0} 张图片
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {stat ? stat.knowledges : 0} 条知识
                    </span>
                  </div>
                  {stat && (
                    <Badge
                      variant={
                        stat.status === "LEARNING"
                          ? "default"
                          : stat.status === "REVIEW_PENDING"
                          ? "outline"
                          : "outline"
                      }
                      className="ml-auto"
                    >
                      {stat.status === "PENDING" && "待学习"}
                      {stat.status === "LEARNING" && "学习中"}
                      {stat.status === "REVIEW_PENDING" && "待审查"}
                      {stat.status === "APPROVED" && "已批准"}
                      {stat.status === "REJECTED" && "已拒绝"}
                      {stat.status === "COMPLETED" && "已完成"}
                      {stat.status === "FAILED" && "失败"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
