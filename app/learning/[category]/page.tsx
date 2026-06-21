/**
 * 分类学习库详情页
 * /learning/[category]  (category = hero | detail)
 * 头图库或详情图库的图片上传、管理、知识审查
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Upload, ImageIcon, BookOpen, Trash2, Play, Eye,
  ArrowLeft, CheckCircle2, ThumbsUp, XCircle, Clock, AlertCircle,
} from "lucide-react";
import { LearningStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// ==================== 类型定义 ====================

interface LearningImage {
  id: string;
  fileName: string;
  filePath: string;
  category: string | null;
  status: string;
  analyzedAt: string | null;
  createdAt: string;
}

interface StyleKnowledge {
  id: string;
  type: string;
  name: string;
  description: string;
  category: string | null;
  confidence: number;
  sampleCount: number;
  promptSnippet: string | null;
  isActive: boolean;
  createdAt: string;
  sources: Array<{
    id: string;
    image: { fileName: string };
  }>;
}

interface SessionData {
  id: string;
  name: string;
  status: string;
  images: LearningImage[];
  knowledges: StyleKnowledge[];
}

interface CategoryData {
  session: SessionData;
  progress: {
    totalImages: number;
    analyzedImages: number;
    pendingImages: number;
    heroImageCount: number;
    detailImageCount: number;
    heroKnowledges: number;
    detailKnowledges: number;
    currentStage: string;
  };
}

const CATEGORY_META: Record<string, { name: string; icon: string; color: string }> = {
  hero: { name: "头图学习库", icon: "🖼️", color: "from-blue-500 to-indigo-600" },
  detail: { name: "详情图学习库", icon: "📄", color: "from-emerald-500 to-teal-600" },
};

export default function CategoryLearningPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const category = params.category as string;
  const meta = CATEGORY_META[category] || { name: "学习库", icon: "📁", color: "from-gray-500 to-gray-600" };

  const [data, setData] = useState<CategoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载数据
  const loadData = async () => {
    try {
      const res = await fetch(`/api/learning/category/${category}`);
      if (res.ok) setData(await res.json());
    } catch {
      // 忽略
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 定时刷新
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [category]);

  // 上传图片
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    let success = 0;
    let fail = 0;

    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/learning/category/${category}/images`, { method: "POST", body: fd });
        if (res.ok) success++;
        else fail++;
      } catch {
        fail++;
      }
    }

    setIsUploading(false);
    if (success > 0) {
      toast({ title: "上传完成", description: `成功 ${success} 张${fail > 0 ? `，失败 ${fail} 张` : ""}` });
      loadData();
    } else {
      toast({ title: "上传失败", description: "请检查文件格式后重试", variant: "destructive" });
    }
    e.target.value = "";
  };

  // 删除图片
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("确定删除这张图片？")) return;
    try {
      const res = await fetch(`/api/learning/category/${category}/images?imageId=${imageId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "删除成功" });
        loadData();
      }
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  // 开始学习
  const handleStartLearning = async () => {
    if (!data?.session.images.length) {
      toast({ title: "请先添加图片", variant: "destructive" });
      return;
    }
    setIsStarting(true);
    try {
      const res = await fetch(`/api/learning/category/${category}`, { method: "POST" });
      if (res.ok) {
        toast({ title: "学习已启动", description: "AI 正在分析图片并提取知识" });
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "启动失败");
      }
    } catch (error) {
      toast({ title: "启动失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  // 停止学习
  const handleStopLearning = async () => {
    if (!confirm("确定停止当前学习？已分析的图片会保留，进行中的图片将重置。")) return;
    setIsStopping(true);
    try {
      const res = await fetch(`/api/learning/category/${category}?action=stop`, { method: "POST" });
      if (res.ok) {
        toast({ title: "已停止学习" });
        loadData();
      }
    } catch {
      toast({ title: "停止失败", variant: "destructive" });
    } finally {
      setIsStopping(false);
    }
  };

  // 重试失败图片
  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/learning/category/${category}?action=retry`, { method: "POST" });
      if (res.ok) {
        toast({ title: "重试已启动", description: "正在重新分析失败的图片" });
        loadData();
      }
    } catch {
      toast({ title: "重试失败", variant: "destructive" });
    } finally {
      setIsRetrying(false);
    }
  };

  // 批准知识
  const handleApprove = async (knowledgeIds?: string[]) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/learning/category/${category}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", approvedKnowledgeIds: knowledgeIds }),
      });
      if (res.ok) {
        toast({ title: knowledgeIds ? "已批准选中的知识" : "已批准全部知识" });
        setSelectedKnowledgeIds([]);
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "操作失败");
      }
    } catch (error) {
      toast({ title: "操作失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsApproving(false);
    }
  };

  // 拒绝知识
  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/learning/category/${category}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) {
        toast({ title: "已拒绝" });
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "操作失败");
      }
    } catch (error) {
      toast({ title: "操作失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsRejecting(false);
    }
  };

  // 切换知识选中状态
  const toggleKnowledgeSelection = (id: string) => {
    setSelectedKnowledgeIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  // 知识类型标签
  const knowledgeTypeLabel: Record<string, string> = {
    LAYOUT: "模板布局",
    STYLE: "视觉风格",
    TYPOGRAPHY: "文案排版",
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const session = data?.session;
  const progress = data?.progress;
  const isInLearning = session?.status === "LEARNING";
  const isReviewPending = session?.status === "REVIEW_PENDING";

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/learning")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{meta.name}</h1>
            <p className="text-sm text-muted-foreground">
              共 {session?.images.length || 0} 张图片
              {progress && ` · ${progress.analyzedImages} 张已分析`}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 学习中 → 停止按钮 */}
          {isInLearning && (
            <Button onClick={handleStopLearning} disabled={isStopping} variant="destructive" size="sm" className="gap-2">
              {isStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {isStopping ? "停止中..." : "停止学习"}
            </Button>
          )}
          {/* 重试失败按钮（有 FAILED 图片时） */}
          {!isInLearning && session && session.images.some((img) => img.status === "FAILED") && (
            <Button onClick={handleRetryFailed} disabled={isRetrying} variant="outline" size="sm" className="gap-2 border-amber-400 text-amber-600">
              {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
              {isRetrying ? "重试中..." : "重试失败图片"}
            </Button>
          )}
          {/* 开始学习按钮（有 PENDING 图片时，且不在学习中） */}
          {!isInLearning && session && session.images.some((img) => img.status === "PENDING") && (
            <Button onClick={handleStartLearning} disabled={isStarting} className="gap-2">
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isStarting ? "启动中..." : "开始学习"}
            </Button>
          )}
          {/* 上传按钮 */}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            id="image-upload"
            disabled={isUploading}
            ref={fileInputRef}
          />
          <Button
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? "上传中..." : "上传图片"}
          </Button>
        </div>
      </div>

      {/* 学习进度提示 */}
      {isInLearning && progress && (
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.currentStage}
              </span>
              <span className="text-muted-foreground">
                {progress.analyzedImages}/{progress.totalImages}
              </span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all rounded-full"
                style={{
                  width: `${progress.totalImages > 0 ? (progress.analyzedImages / progress.totalImages) * 100 : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 待审查提示 */}
      {isReviewPending && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium">知识提取完成，需要您审查</p>
                <p className="text-sm text-muted-foreground">
                  以下知识条目已从投喂的图片中提取，请批准或拒绝
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => window.location.reload()}
              >
                刷新状态
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主内容：图片标签 + 知识标签 */}
      <Tabs defaultValue="images" className="space-y-6">
        <TabsList>
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            投喂图片 ({session?.images.length || 0})
          </TabsTrigger>
          <TabsTrigger value="knowledges" className="gap-2">
            <BookOpen className="h-4 w-4" />
            提取知识 ({session?.knowledges.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* ====== 图片标签 ====== */}
        <TabsContent value="images" className="space-y-4">
          {!session?.images.length ? (
            <Card className="border-dashed p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">还没有图片</h3>
              <p className="text-muted-foreground mb-4">
                点击右上角「上传图片」投喂{category === "hero" ? "头图" : "详情图"}
              </p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                选择图片上传
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {session.images.map((image) => (
                <Card key={image.id} className="overflow-hidden group">
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center text-muted-foreground text-sm relative overflow-hidden">
                    <img
                      src={`/api/files/${image.filePath}`}
                      alt={image.fileName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <ImageIcon className="h-8 w-8 hidden absolute inset-0 m-auto" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive bg-background/80"
                      onClick={() => handleDeleteImage(image.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm truncate" title={image.fileName}>{image.fileName}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {image.status === "PENDING" && "待分析"}
                        {image.status === "LEARNING" && "分析中..."}
                        {image.status === "COMPLETED" && "已分析"}
                        {image.status === "FAILED" && "分析失败"}
                      </p>
                      {image.status === "FAILED" && !isInLearning && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-xs text-amber-500 hover:text-amber-600"
                          onClick={handleRetryFailed}
                        >
                          <AlertCircle className="h-3 w-3 mr-0.5" />
                          重试
                        </Button>
                      )}
                      {image.category && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {image.category === "HERO" ? "头图" : "详情图"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ====== 知识标签 ====== */}
        <TabsContent value="knowledges" className="space-y-4">
          {/* 审查操作栏 */}
          {isReviewPending && session.knowledges.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">
                      {selectedKnowledgeIds.length > 0
                        ? `已选择 ${selectedKnowledgeIds.length} 条知识`
                        : "请审查以下知识条目，批准或拒绝"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                      disabled={isApproving}
                      onClick={() => handleApprove(selectedKnowledgeIds.length > 0 ? selectedKnowledgeIds : undefined)}
                    >
                      {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                      {selectedKnowledgeIds.length > 0 ? "批准选中" : "全部批准"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                      disabled={isRejecting}
                      onClick={handleReject}
                    >
                      {isRejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      全部拒绝
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!session?.knowledges?.length ? (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">还没有知识</h3>
              <p className="text-muted-foreground">
                上传图片并开始学习后，AI 将自动提取模板布局、视觉风格和文案排版知识
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {session?.knowledges.map((knowledge) => (
                <Card
                  key={knowledge.id}
                  className={`
                    ${!knowledge.isActive ? "opacity-60" : ""}
                    ${isReviewPending ? "cursor-pointer hover:border-primary/40" : ""} transition-all
                  `}
                  onClick={() => isReviewPending && toggleKnowledgeSelection(knowledge.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* 审查模式下的勾选框 */}
                        {isReviewPending && (
                          <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            selectedKnowledgeIds.includes(knowledge.id)
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 hover:border-primary/60"
                          }`}
                            onClick={(e) => { e.stopPropagation(); toggleKnowledgeSelection(knowledge.id); }}
                          >
                            {selectedKnowledgeIds.includes(knowledge.id) && (
                              <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                            )}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">
                              {knowledgeTypeLabel[knowledge.type] || knowledge.type}
                            </Badge>
                            {knowledge.category && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {knowledge.category === "HERO" ? "头图" : "详情图"}
                              </Badge>
                            )}
                            {/* 状态标签 */}
                            {isReviewPending && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-300 text-[10px]">
                                待审查
                              </Badge>
                            )}
                            {!isReviewPending && knowledge.isActive && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                已批准
                              </Badge>
                            )}
                            {!knowledge.isActive && (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                已拒绝
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              置信度: {Math.round(knowledge.confidence * 100)}%
                            </span>
                          </div>
                          <CardTitle className="text-lg">{knowledge.name}</CardTitle>
                        </div>
                      </div>
                      {knowledge.sampleCount > 1 && (
                        <Badge variant="outline" className="text-xs">
                          基于 {knowledge.sampleCount} 张图片
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{knowledge.description}</p>
                    {knowledge.promptSnippet && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">生成提示词：</p>
                        <p className="text-sm font-mono">{knowledge.promptSnippet}</p>
                      </div>
                    )}
                    {knowledge.sources.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        来源：{knowledge.sources.map((s) => s.image.fileName).join("、")}
                      </p>
                    )}
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
