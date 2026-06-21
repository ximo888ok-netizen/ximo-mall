"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Filter,
  FolderOpen,
  ImagePlus,
  Images,
  Loader2,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

type LibraryItem = {
  id: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  title: string | null;
  description: string | null;
  isPublic: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string | null }[];
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
};

type TagItem = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  itemCount: number;
};

type SearchResult = {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatFileSize(bytes: number | null) {
  if (bytes == null) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(width: number | null, height: number | null) {
  if (width == null || height == null) return null;
  return `${width} × ${height}`;
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      selectedTags.forEach((t) => params.append("tagIds", t));
      params.set("page", String(page));
      params.set("pageSize", "24");

      const res = await fetch(`/api/library?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data as SearchResult;
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      toast.error("加载素材失败");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedTags, page]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/library/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch {
      // silent
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/library/tags");
      const json = await res.json();
      if (json.success) setTags(json.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, [fetchCategories, fetchTags]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (selectedCategory) formData.append("categoryId", selectedCategory);
        selectedTags.forEach((t) => formData.append("tagIds", t));

        const res = await fetch("/api/library", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (json.success) successCount++;
      } catch {
        // continue
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 张图片`);
      fetchItems();
      fetchCategories();
      fetchTags();
    } else {
      toast.error("上传失败，请重试");
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const res = await fetch(`/api/library/${itemId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("已删除");
        setPreviewItem(null);
        fetchItems();
        fetchCategories();
        fetchTags();
      } else {
        toast.error(json.error?.message ?? "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/library/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("分类已创建");
        setNewCategoryName("");
        setShowCategoryInput(false);
        fetchCategories();
      } else {
        toast.error(json.error?.message ?? "创建失败");
      }
    } catch {
      toast.error("创建失败");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await fetch("/api/library/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("标签已创建");
        setNewTagName("");
        setShowTagInput(false);
        fetchTags();
      } else {
        toast.error(json.error?.message ?? "创建失败");
      }
    } catch {
      toast.error("创建失败");
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="素材管理"
        title="图片知识库"
        description="上传、分类、标签化管理你的图片素材，随时调用到详情页项目中。"
        actions={
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "上传中..." : "上传图片"}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4" />
                搜索
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="搜索素材名称..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4" />
                分类
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryInput(!showCategoryInput)}
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {showCategoryInput && (
                <div className="flex gap-2">
                  <Input
                    placeholder="新分类名称"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" onClick={handleCreateCategory} className="h-8 text-xs">
                    确定
                  </Button>
                </div>
              )}
              <button
                onClick={() => { setSelectedCategory(""); setPage(1); }}
                className={cn(
                  "w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                  !selectedCategory
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/8",
                )}
              >
                全部 ({total})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                    selectedCategory === cat.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/8",
                  )}
                >
                  <span>{cat.name}</span>
                  <span className="text-xs opacity-60">{cat.itemCount}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4" />
                标签
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagInput(!showTagInput)}
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {showTagInput && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="新标签名称"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                      className="h-8 text-xs"
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border"
                    />
                  </div>
                  <Button size="sm" onClick={handleCreateTag} className="h-8 w-full text-xs">
                    创建标签
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                      selectedTags.includes(tag.id)
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/15",
                    )}
                  >
                    {tag.name}
                    <span className="opacity-50">{tag.itemCount}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Images className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
                  知识库为空
                </p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                  点击右上角"上传图片"按钮添加素材
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPreviewItem(item)}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                  >
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.title ?? item.fileName}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Images className="h-8 w-8 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-xs font-medium text-white">
                        {item.title ?? item.fileName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative mx-4 flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {previewItem.title ?? previewItem.fileName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewItem.fileName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (previewItem.url) {
                      window.open(previewItem.url, "_blank");
                    }
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  原图
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(previewItem.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewItem(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-6 overflow-auto p-6 md:grid-cols-[1fr_280px]">
              <div className="flex items-center justify-center rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
                {previewItem.url ? (
                  <img
                    src={previewItem.url}
                    alt={previewItem.title ?? previewItem.fileName}
                    className="max-h-[60vh] rounded-xl object-contain"
                  />
                ) : (
                  <Images className="h-24 w-24 text-slate-300" />
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-500">尺寸</Label>
                  <p className="text-sm font-medium">
                    {formatDimensions(previewItem.width, previewItem.height) ?? "未知"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">文件大小</Label>
                  <p className="text-sm font-medium">{formatFileSize(previewItem.fileSize)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">格式</Label>
                  <p className="text-sm font-medium">{previewItem.mimeType ?? "未知"}</p>
                </div>
                {previewItem.category && (
                  <div>
                    <Label className="text-xs text-slate-500">分类</Label>
                    <Badge variant="secondary" className="mt-1">
                      {previewItem.category.name}
                    </Badge>
                  </div>
                )}
                {previewItem.tags.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-500">标签</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {previewItem.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-slate-500">上传时间</Label>
                  <p className="text-sm font-medium">{formatDate(previewItem.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}