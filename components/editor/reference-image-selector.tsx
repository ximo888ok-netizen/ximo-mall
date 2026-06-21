"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, ImagePlus, Images, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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

interface ReferenceImageSelectorProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  projectAssets: any[];
}

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

export function ReferenceImageSelector({ selectedIds, onSelect, projectAssets }: ReferenceImageSelectorProps) {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const fetchLibraryItems = useCallback(async () => {
    if (showLibrary) {
      setLoading(true);
      try {
        const res = await fetch("/api/library?pageSize=50");
        const json = await res.json();
        if (json.success) {
          setLibraryItems(json.data.items);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
  }, [showLibrary]);

  useEffect(() => {
    fetchLibraryItems();
  }, [fetchLibraryItems]);

  const toggleSelection = (itemId: string, fromLibrary: boolean) => {
    if (fromLibrary) {
      const libKey = `library:${itemId}`;
      onSelect(
        selectedIds.includes(libKey)
          ? selectedIds.filter((id) => id !== libKey)
          : [...selectedIds, libKey],
      );
    } else {
      onSelect(
        selectedIds.includes(itemId)
          ? selectedIds.filter((id) => id !== itemId)
          : [...selectedIds, itemId],
      );
    }
  };

  const projectReferenceAssets = projectAssets.filter((asset: any) =>
    ["REFERENCE", "DETAIL", "ANGLE"].includes(asset.type),
  );

  const selectedLibraryKeys = useMemo(
    () => selectedIds.filter((id) => id.startsWith("library:")),
    [selectedIds],
  );

  const selectedLibraryRawIds = useMemo(
    () => new Set(selectedLibraryKeys.map((key) => key.slice("library:".length))),
    [selectedLibraryKeys],
  );

  const selectedLibraryCount = selectedLibraryRawIds.size;

  const selectedLibraryPreviewItems = useMemo(
    () => libraryItems.filter((item) => selectedLibraryRawIds.has(item.id)).slice(0, 6),
    [libraryItems, selectedLibraryRawIds],
  );

  const totalSelectedCount = selectedIds.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">参考图</span>
          {totalSelectedCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
              {totalSelectedCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLibrary(!showLibrary)}
          className="gap-1"
        >
          <Images className="h-3.5 w-3.5" />
          {showLibrary ? "收起知识库" : "从知识库选择"}
          {showLibrary ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border p-3">
        {projectReferenceAssets.length === 0 && selectedLibraryCount === 0 && !showLibrary && (
          <p className="text-sm text-muted-foreground">
            当前项目没有可选参考图，可从知识库选择或上传
          </p>
        )}

        {projectReferenceAssets.map((asset: any) => (
          <label
            key={asset.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-2 py-2 transition-colors cursor-pointer",
              selectedIds.includes(asset.id)
                ? "border-primary bg-primary/5"
                : "border-transparent hover:border-border hover:bg-muted/40",
            )}
          >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {asset.url ? (
                <img src={asset.url} alt={asset.fileName} className="h-full w-full object-cover" />
              ) : (
                <Images className="m-auto h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="flex-1 truncate text-sm">{asset.fileName}</span>
            <input
              type="checkbox"
              checked={selectedIds.includes(asset.id)}
              onChange={() => toggleSelection(asset.id, false)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}

        {selectedLibraryPreviewItems.length > 0 && !showLibrary && (
          <div className="flex items-center gap-2 pt-1">
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              知识库已选 {selectedLibraryCount} 张：
            </span>
            <div className="flex gap-1">
              {selectedLibraryPreviewItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPreviewItem(item)}
                  className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-border hover:border-primary transition-colors"
                  title={item.title ?? item.fileName}
                >
                  {item.url ? (
                    <img src={item.url} alt={item.title ?? item.fileName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ImagePlus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </button>
              ))}
              {selectedLibraryCount > 6 && (
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">
                  +{selectedLibraryCount - 6}
                </span>
              )}
            </div>
          </div>
        )}

        {showLibrary && (
          <div className="border-t border-border pt-3 mt-3">
            {selectedLibraryCount > 0 && (
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  已选择 <span className="font-medium text-foreground">{selectedLibraryCount}</span> 张知识库图片
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const projectOnly = selectedIds.filter((id) => !id.startsWith("library:"));
                    onSelect(projectOnly);
                  }}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  清空知识库选择
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
              </div>
            ) : libraryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">知识库中暂无图片</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {libraryItems.map((item) => {
                  const isSelected = selectedLibraryRawIds.has(item.id);
                  return (
                    <div key={item.id} className="relative">
                      <button
                        onClick={() => toggleSelection(item.id, true)}
                        className={cn(
                          "relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.title ?? item.fileName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <Images className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/15" />
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(item);
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 hover:bg-black/20 hover:opacity-100 transition-opacity"
                          type="button"
                        >
                          <Eye className="h-5 w-5 text-white drop-shadow" />
                        </button>
                      </button>

                      <div
                        onClick={() => toggleSelection(item.id, true)}
                        className={cn(
                          "absolute top-1.5 right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-white/80 bg-black/20 hover:border-white",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <p className="mt-1 truncate text-[10px] text-muted-foreground leading-tight">
                        {item.title ?? item.fileName}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        勾选的参考图会作为产品主体图的<strong>附属品</strong>出现在生成图片中（如装饰道具、辅助元素），
        不会改变产品主体、布局构图和风格色调。最多 6 张。
      </p>

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
                <p className="text-xs text-slate-500 dark:text-slate-400">图片知识库</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedLibraryRawIds.has(previewItem.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSelection(previewItem.id, true)}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {selectedLibraryRawIds.has(previewItem.id) ? "已选为参考图" : "选为参考图"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewItem(null)}>
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
                  <label className="text-xs text-slate-500">尺寸</label>
                  <p className="text-sm font-medium">
                    {formatDimensions(previewItem.width, previewItem.height) ?? "未知"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">文件大小</label>
                  <p className="text-sm font-medium">{formatFileSize(previewItem.fileSize)}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">格式</label>
                  <p className="text-sm font-medium">{previewItem.mimeType ?? "未知"}</p>
                </div>
                {previewItem.category && (
                  <div>
                    <label className="text-xs text-slate-500">分类</label>
                    <span className="inline-block mt-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/8 dark:text-slate-400">
                      {previewItem.category.name}
                    </span>
                  </div>
                )}
                {previewItem.tags.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500">标签</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {previewItem.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/8 dark:text-slate-400"
                          style={
                            tag.color
                              ? { backgroundColor: `${tag.color}20`, color: tag.color }
                              : undefined
                          }
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500">添加时间</label>
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
