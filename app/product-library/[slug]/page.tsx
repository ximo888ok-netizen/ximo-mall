"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  Upload,
  Sparkles,
  Trash2,
  BookOpen,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface ProductImage {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  analysisStatus: string;
  rawAnalysisResult: any;
  createdAt: string;
}

interface KnowledgeEntry {
  id: string;
  productId: string;
  sourceImageId: string | null;
  category: string;
  title: string;
  content: string;
  metadata: any;
  embedding: any;
  createdAt: string;
}

interface SearchResult {
  id: string;
  productId: string;
  sourceImageId: string | null;
  category: string;
  title: string;
  content: string;
  metadata: any;
  score: number;
  createdAt: string;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageCount: number;
  knowledgeCount: number;
  status: string;
  images: ProductImage[];
  knowledgeEntries: KnowledgeEntry[];
}

type TabKey = "images" | "knowledge" | "search";

const CATEGORY_LABELS: Record<string, string> = {
  USAGE_SCENARIO: "使用场景",
  SELLING_POINT: "核心卖点",
  SPECIFICATION: "产品规格",
  MATERIAL: "材质/原料",
  TARGET_AUDIENCE: "目标人群",
  BRAND_INFO: "品牌信息",
  OTHER: "其他",
};

const CATEGORY_COLORS: Record<string, string> = {
  USAGE_SCENARIO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  SELLING_POINT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  SPECIFICATION: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  MATERIAL: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  TARGET_AUDIENCE: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  BRAND_INFO: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function ProductLibraryDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("images");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // 知识检索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 手动添加知识条目
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntryCategory, setNewEntryCategory] = useState("OTHER");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadProduct(); }, [slug]);

  async function loadProduct() {
    try {
      const response = await fetch(`/api/product-library/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data.data || data);
      }
    } catch (error) {
      console.error("加载产品失败:", error);
    } finally {
      setLoading(false);
    }
  }

  const analysisStats = useMemo(() => {
    if (!product) return { total: 0, analyzed: 0, pending: 0, failed: 0 };
    return {
      total: product.images.length,
      analyzed: product.images.filter((i) => i.analysisStatus === "ANALYZED").length,
      pending: product.images.filter((i) => i.analysisStatus === "PENDING").length,
      failed: product.images.filter((i) => i.analysisStatus === "FAILED").length,
    };
  }, [product]);

  const filteredEntries = useMemo(() => {
    if (!product) return [];
    if (categoryFilter === "ALL") return product.knowledgeEntries;
    return product.knowledgeEntries.filter((e) => e.category === categoryFilter);
  }, [product, categoryFilter]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`/api/product-library/${slug}/images`, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!payload.success) throw new Error(payload.error?.message || "上传失败");
      }
      toast.success(`已上传 ${files.length} 张图片`);
      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    try {
      const response = await fetch(`/api/product-library/${slug}/images/${imageId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "删除失败");
      toast.success("图片已删除");
      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function handleAnalyzeAll() {
    if (analysisStats.pending === 0) {
      toast.error("没有待分析的图片");
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/product-library/${slug}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message || "分析失败");
      }

      const trainResult = payload.data;
      if (trainResult) {
        if (trainResult.failed > 0) {
          const failedResults = (trainResult.results || []).filter((r: any) => !r.success);
          const firstError = failedResults[0]?.error || "请查看后端日志";
          toast.error(
            `分析完成：${trainResult.success}/${trainResult.total} 成功，${trainResult.failed} 失败\n首条失败原因：${firstError}`,
            { duration: 10000 },
          );
        } else {
          toast.success(
            `分析完成：${trainResult.success}/${trainResult.total} 成功`,
          );
        }
      }

      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      toast.error("请输入查询内容");
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/product-library/${slug}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), topK: 10 }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "检索失败");
      setSearchResults(payload.data || []);
      if ((payload.data || []).length === 0) {
        toast.info("未找到相关知识条目");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "检索失败");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddEntry() {
    if (!newEntryTitle.trim() || !newEntryContent.trim()) {
      toast.error("标题和内容不能为空");
      return;
    }
    setAdding(true);
    try {
      const response = await fetch(`/api/product-library/${slug}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newEntryCategory,
          title: newEntryTitle.trim(),
          content: newEntryContent.trim(),
        }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "添加失败");
      toast.success("知识条目已添加");
      setAddDialogOpen(false);
      setNewEntryTitle("");
      setNewEntryContent("");
      setNewEntryCategory("OTHER");
      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      const response = await fetch(`/api/product-library/knowledge/${entryId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "删除失败");
      toast.success("知识条目已删除");
      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function renderStatusBadge(status: string) {
    const config: Record<string, { variant: "default" | "outline" | "destructive" | "warning"; icon: React.ReactNode; label: string }> = {
      PENDING:   { variant: "outline", icon: <Clock className="w-3 h-3" />, label: "待分析" },
      ANALYZING: { variant: "warning", icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "分析中" },
      ANALYZED:  { variant: "default", icon: <CheckCircle2 className="w-3 h-3" />, label: "已分析" },
      FAILED:    { variant: "destructive", icon: <XCircle className="w-3 h-3" />, label: "失败" },
    };
    const c = config[status] || config.PENDING;
    return <Badge variant={c.variant}>{c.icon}<span className="ml-1">{c.label}</span></Badge>;
  }

  // ====== 主渲染 ======
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">产品不存在</h1>
        <Link href="/product-library"><Button>返回产品知识库</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 顶部导航 */}
      <div className="mb-6">
        <Link href="/product-library" className="flex items-center text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回产品知识库
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            <p className="text-muted-foreground">{product.description || "暂无描述"}</p>
          </div>
        </div>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">图片总数</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{analysisStats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">已分析</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{analysisStats.analyzed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">知识条目</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{product.knowledgeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">检索就绪</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {product.knowledgeEntries.some((e) => e.embedding) ? "✅" : "⏳"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          disabled={uploading}
          onClick={() => {
            const input = document.getElementById("product-image-upload") as HTMLInputElement;
            input?.click();
          }}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "上传中..." : "上传图片"}
        </Button>
        <Input
          id="product-image-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <Button onClick={handleAnalyzeAll} disabled={analyzing || analysisStats.pending === 0}>
          {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {analyzing ? "识别中..." : "一键识别"}
        </Button>
        <Button
          onClick={() => setAddDialogOpen(true)}
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          手动添加知识
        </Button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 border-b pb-2">
        {[
          { key: "images" as TabKey, label: "图片管理", icon: <ImageIcon className="w-4 h-4" /> },
          { key: "knowledge" as TabKey, label: "知识条目", icon: <BookOpen className="w-4 h-4" /> },
          { key: "search" as TabKey, label: "知识检索", icon: <Search className="w-4 h-4" /> },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.key)}
            className="gap-2"
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ====== Tab: 图片管理 ====== */}
      {activeTab === "images" && (
        <div className="space-y-4">
          {product.images.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">还没有图片</h3>
                <p className="text-muted-foreground">点击上方"上传图片"按钮添加产品图片</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {product.images.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    <img
                      src={`/api/files/${image.filePath}`}
                      alt={image.fileName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <ImageIcon className="w-12 h-12 text-muted-foreground hidden" />
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      {renderStatusBadge(image.analysisStatus)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{image.fileName}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-rose-500 hover:text-rose-600"
                      onClick={() => handleDeleteImage(image.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      删除
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== Tab: 知识条目 ====== */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2">
            {["ALL", ...Object.keys(CATEGORY_LABELS)].map((cat) => (
              <Badge
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "ALL" ? "全部" : CATEGORY_LABELS[cat]}
              </Badge>
            ))}
          </div>

          {filteredEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无知识条目</h3>
                <p className="text-muted-foreground">上传图片并识别后，知识条目将自动生成</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={CATEGORY_COLORS[entry.category] || ""}>
                            {CATEGORY_LABELS[entry.category] || entry.category}
                          </Badge>
                          {entry.embedding && (
                            <Badge variant="outline" className="text-xs">已向量化</Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm mb-1">{entry.title}</h4>
                        <p className="text-sm text-muted-foreground">{entry.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-600 shrink-0"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== Tab: 知识检索 ====== */}
      {activeTab === "search" && (
        <div className="space-y-6">
          {/* 搜索框 */}
          <div className="flex gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='输入查询内容，如"适合加班吃的面"'
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              检索
            </Button>
          </div>

          {/* 搜索结果 */}
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">找到 {searchResults.length} 条相关知识</p>
              {searchResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={CATEGORY_COLORS[result.category] || ""}>
                            {CATEGORY_LABELS[result.category] || result.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            相似度 {(result.score * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm mb-1">{result.title}</h4>
                        <p className="text-sm text-muted-foreground">{result.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">输入查询内容开始检索</h3>
                <p className="text-muted-foreground">系统将基于向量相似度返回最相关的知识条目</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">输入查询内容开始检索</h3>
                <p className="text-muted-foreground">系统将基于向量相似度返回最相关的知识条目</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 手动添加知识条目弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动添加知识条目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>分类 *</Label>
              <Select value={newEntryCategory} onValueChange={setNewEntryCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="简短概括，如'红烧牛肉面 - 使用场景：加班夜宵'"
              />
            </div>
            <div className="space-y-2">
              <Label>内容 *</Label>
              <Textarea
                value={newEntryContent}
                onChange={(e) => setNewEntryContent(e.target.value)}
                placeholder="详细描述，用于知识检索"
                rows={3}
              />
            </div>
            <Button onClick={handleAddEntry} disabled={adding} className="w-full">
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
