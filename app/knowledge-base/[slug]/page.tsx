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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  Brain,
  BarChart3,
  Upload,
  Loader2,
  ArrowLeft,
  Layers,
} from "lucide-react";

interface KnowledgeBase {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageCount: number;
  knowledgeCount: number;
  summary: any;
  status: string;
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKnowledgeBase();
  }, [slug]);

  async function loadKnowledgeBase() {
    try {
      const response = await fetch(`/api/knowledge-base/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setKb(data.data || data);
      }
    } catch (error) {
      console.error("Failed to load knowledge base:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">知识库不存在</h1>
          <Link href="/knowledge-base">
            <Button>返回知识库列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/knowledge-base" className="flex items-center text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回知识库列表
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{kb.name}知识库</h1>
            <p className="text-muted-foreground">
              {kb.description || "暂无描述"}
            </p>
          </div>
          <Badge variant={kb.status === "ACTIVE" ? "default" : "secondary"}>
            {kb.status === "ACTIVE" ? "活跃" : "归档"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">图片数量</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kb.imageCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">知识数量</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kb.knowledgeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总结状态</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kb.summary ? "已生成" : "未生成"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="images" className="space-y-4">
        <TabsList>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            图片管理
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            量化总结
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            视觉模板
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle>图片管理</CardTitle>
              <CardDescription>
                上传和管理知识库中的训练图片
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/knowledge-base/${slug}/images`}>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  管理图片
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>量化总结</CardTitle>
              <CardDescription>
                查看知识库的量化统计数据
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link href={`/knowledge-base/${slug}/summary`}>
                  <Button variant="outline">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    总览总结
                  </Button>
                </Link>
                <Link href={`/knowledge-base/${slug}/summary/hero`}>
                  <Button>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    头图量化
                  </Button>
                </Link>
                <Link href={`/knowledge-base/${slug}/summary/detail`}>
                  <Button>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    详情图量化
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>视觉模板</CardTitle>
              <CardDescription>
                从已学知识中提炼的可复用电商图片模板
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/knowledge-base/${slug}/templates`}>
                <Button>
                  <Layers className="w-4 h-4 mr-2" />
                  管理模板
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
