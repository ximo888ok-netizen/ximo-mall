"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Upload,
  Trash2,
  Play,
  Loader2,
  ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface KBImage {
  id: string;
  filePath: string;
  fileName: string;
  category: string;
  status: string;
  analysisResult: any;
  createdAt: string;
}

export default function KBImagesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [images, setImages] = useState<KBImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputEmptyRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    try {
      const categoryParam = activeTab !== "all" ? `?category=${activeTab.toUpperCase()}` : "";
      const response = await fetch(`/api/knowledge-base/${slug}/images${categoryParam}`);
      if (response.ok) {
        const data = await response.json();
        setImages(data.data?.items || data.items || []);
      }
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setLoading(false);
    }
  }, [slug, activeTab]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", activeTab === "detail" ? "DETAIL" : "HERO");

        const response = await fetch(`/api/knowledge-base/${slug}/images`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      await loadImages();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("上传失败: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(imageId: string) {
    if (!confirm("确定要删除这张图片吗？")) return;

    try {
      const response = await fetch(`/api/knowledge-base/${slug}/images/${imageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadImages();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }

  async function handleTrain(imageId?: string) {
    setTraining(true);
    try {
      const response = await fetch(`/api/knowledge-base/${slug}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imageId ? { imageId } : {}),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`训练完成！成功: ${result.success || 1}, 失败: ${result.failed || 0}`);
        await loadImages();
      } else {
        const error = await response.json();
        alert("训练失败: " + error.error);
      }
    } catch (error) {
      console.error("Train failed:", error);
      alert("训练失败");
    } finally {
      setTraining(false);
    }
  }

  const statusIcons: Record<string, React.ReactNode> = {
    PENDING: <Clock className="w-4 h-4 text-yellow-500" />,
    ANALYZED: <CheckCircle className="w-4 h-4 text-green-500" />,
    FAILED: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const statusLabels: Record<string, string> = {
    PENDING: "待分析",
    ANALYZED: "已分析",
    FAILED: "分析失败",
  };

  const pendingCount = images.filter((img) => img.status === "PENDING").length;

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
            <h1 className="text-3xl font-bold mb-2">图片管理</h1>
            <p className="text-muted-foreground">
              上传和管理训练图片，支持头图和详情图分类
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleTrain()}
              disabled={training || pendingCount === 0}
            >
              {training ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              训练全部 ({pendingCount})
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              上传图片
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部 ({images.length})</TabsTrigger>
          <TabsTrigger value="hero">头图</TabsTrigger>
          <TabsTrigger value="detail">详情图</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {images.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">暂无图片，请上传训练图片</p>
                <Button onClick={() => fileInputEmptyRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  上传图片
                </Button>
                <input
                  ref={fileInputEmptyRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    <Image
                      src={`/api/files/${image.filePath}`}
                      alt={image.fileName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate">{image.fileName}</p>
                      <Badge variant="outline" className="ml-2">
                        {image.category === "HERO" ? "头图" : "详情图"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {statusIcons[image.status]}
                        <span className="text-xs text-muted-foreground">
                          {statusLabels[image.status]}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {image.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTrain(image.id)}
                            disabled={training}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(image.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
