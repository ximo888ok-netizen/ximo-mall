"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Tag, UploadCloud, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { fileToBase64Payload } from "@/lib/utils/base64-upload";

const MAX_PRODUCT_FILES = 5;
const MAX_INGREDIENT_FILES = 5;

interface LabeledFile {
  file: File;
  label: string;
}

interface ProductLibraryOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageCount: number;
  knowledgeCount: number;
}

function buildDraftProjectName() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ];

  return `未命名商品项目-${parts.join("")}`;
}

export function QuickStartWorkspace() {
  const router = useRouter();

  const [packagingFile, setPackagingFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<LabeledFile[]>([]);
  const [ingredientFiles, setIngredientFiles] = useState<LabeledFile[]>([]);
  const [infoCardFile, setInfoCardFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<ProductLibraryOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");

  const allFiles = useMemo(() => {
    const list: File[] = [];
    if (packagingFile) list.push(packagingFile);
    list.push(...productFiles.map((f) => f.file));
    list.push(...ingredientFiles.map((f) => f.file));
    if (infoCardFile) list.push(infoCardFile);
    return list;
  }, [packagingFile, productFiles, ingredientFiles, infoCardFile]);

  const previewUrls = useMemo(
    () => allFiles.map((file) => URL.createObjectURL(file)),
    [allFiles],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const res = await fetch("/api/product-library");
        if (!res.ok) return;
        const payload = await res.json();
        if (!cancelled) {
          setProducts((payload.data ?? payload ?? []) as ProductLibraryOption[]);
        }
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
  }, []);

  const handlePackagingSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith("image/")) { toast.error("不支持的文件类型"); return; }
    setPackagingFile(file);
  }, []);

  const handleProductSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setProductFiles((prev) => {
      const combined = [...prev, ...incoming.map((f, i) => ({ file: f, label: `产品实物${prev.length + i + 1}` }))];
      if (combined.length > MAX_PRODUCT_FILES) {
        toast.error(`产品实物最多 ${MAX_PRODUCT_FILES} 张`);
        return prev;
      }
      return combined;
    });
  }, []);

  const handleIngredientSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setIngredientFiles((prev) => {
      const combined = [...prev, ...incoming.map((f, i) => ({ file: f, label: `产品调料${prev.length + i + 1}` }))];
      if (combined.length > MAX_INGREDIENT_FILES) {
        toast.error(`产品调料最多 ${MAX_INGREDIENT_FILES} 张`);
        return prev;
      }
      return combined;
    });
  }, []);

  const handleInfoCardSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith("image/")) { toast.error("不支持的文件类型"); return; }
    setInfoCardFile(file);
  }, []);

  const removeProductFile = useCallback((index: number) => {
    setProductFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeIngredientFile = useCallback((index: number) => {
    setIngredientFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateProductLabel = useCallback((index: number, label: string) => {
    setProductFiles((prev) => prev.map((item, i) => i === index ? { ...item, label } : item));
  }, []);

  const updateIngredientLabel = useCallback((index: number, label: string) => {
    setIngredientFiles((prev) => prev.map((item, i) => i === index ? { ...item, label } : item));
  }, []);

  const packagingPreviewUrl = packagingFile ? URL.createObjectURL(packagingFile) : null;
  const infoCardPreviewUrl = infoCardFile ? URL.createObjectURL(infoCardFile) : null;

  useEffect(() => {
    return () => {
      if (packagingPreviewUrl) URL.revokeObjectURL(packagingPreviewUrl);
      if (infoCardPreviewUrl) URL.revokeObjectURL(infoCardPreviewUrl);
    };
  }, [packagingPreviewUrl, infoCardPreviewUrl]);

  const handleStart = async () => {
    if (!packagingFile) {
      toast.error("请先上传产品外包装图");
      return;
    }

    setSubmitting(true);

    try {
      const createBody: Record<string, unknown> = {
        name: buildDraftProjectName(),
        platform: "general_ecommerce",
        style: "realistic_food_photo",
        description: "由首页快速开始自动创建",
      };
      if (selectedProductId) {
        createBody.productLibraryId = selectedProductId;
      }

      const createResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      const createdPayload = await createResponse.json();
      if (!createdPayload.success) {
        throw new Error(createdPayload.error?.message ?? "创建项目失败");
      }

      const projectId = createdPayload.data.id as string;

      const uploadTasks: Array<{ file: File; type: string; metadata: Record<string, string> }> = [
        { file: packagingFile, type: "PACKAGING", metadata: { imageType: "PACKAGING", label: "产品外包装图" } },
        ...productFiles.map((f) => ({ file: f.file, type: "PRODUCT", metadata: { imageType: "PRODUCT", label: f.label } })),
        ...ingredientFiles.map((f) => ({ file: f.file, type: "INGREDIENT", metadata: { imageType: "INGREDIENT", label: f.label } })),
      ];
      if (infoCardFile) {
        uploadTasks.push({ file: infoCardFile, type: "INFO_CARD", metadata: { imageType: "INFO_CARD", label: "产品信息图" } });
      }

      for (let i = 0; i < uploadTasks.length; i++) {
        const { file, type, metadata } = uploadTasks[i];
        const base64Payload = await fileToBase64Payload(file);
        const uploadResponse = await fetch(`/api/projects/${projectId}/assets/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...base64Payload, metadata }),
        });
        const uploadPayload = await uploadResponse.json();
        if (!uploadPayload.success) {
          throw new Error(uploadPayload.error?.message ?? `第 ${i + 1} 张图片上传失败`);
        }
      }

      const hasKnowledge = !!selectedProductId;

      if (hasKnowledge) {
        toast.success("图片上传完成，已跳转到分析页。");
        router.push(`/projects/${projectId}/analysis?source=quick-start&autoRun=1&knowledgeMode=1`);
        return;
      }

      const analyzeResponse = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasAssociatedImages: false,
          associatedImageCount: 0,
          restrictToAssetTypes: ["PACKAGING", "INFO_CARD"],
        }),
      });
      const analyzePayload = await analyzeResponse.json();

      if (!analyzePayload.success) {
        const rawErrorCode = String(analyzePayload.error?.code ?? "");
        const shouldAutoRetry = rawErrorCode === "PROVIDER_TIMEOUT";
        const errorCode = encodeURIComponent(rawErrorCode);
        const errorMessage = encodeURIComponent(
          String(analyzePayload.error?.message ?? "图片已上传，但自动分析未完成。"),
        );

        toast.warning(
          shouldAutoRetry
            ? "图片已上传，正在为你跳转到分析页继续自动重试。"
            : "图片已上传，已为你跳转到分析页继续处理。",
        );

        router.push(
          `/projects/${projectId}/analysis?source=quick-start${shouldAutoRetry ? "&autoRun=1" : ""}&analysisErrorCode=${errorCode}&analysisErrorMessage=${errorMessage}`,
        );
        return;
      }

      const totalImages = uploadTasks.length;
      toast.success(`${totalImages} 张图片上传完成，AI 已自动完成首轮分析。`);
      router.push(`/projects/${projectId}/analysis`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "快速开始失败");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!packagingFile && !submitting;

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white md:text-5xl">
          上传产品图片
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-500 dark:text-slate-400">
          上传产品外包装与关联图片，AI 将自动分析并生成电商详情页
        </p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white/84 p-6 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/6 md:p-10">
        {/* 产品知识库下拉 */}
        {products.length > 0 && (
          <div className="mb-8">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Search className="h-4 w-4" />
              从产品知识库索引
            </label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20"
              >
                <option value="">— 不指定（仅基于图片分析） —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.knowledgeCount > 0 ? `（${p.knowledgeCount} 条知识）` : "（待录入）"}
                  </option>
                ))}
              </select>
              {productsLoading && (
                <div className="pointer-events-none absolute inset-y-0 right-10 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              选择已录入的产品后，将直接跳过分析，AI 以产品知识库为地面真相进行约束分析
            </p>
          </div>
        )}

        {/* 2×2 网格上传区 */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* 左上：产品外包装 */}
          <UploadSlot
            id="packaging-input"
            label="产品外包装"
            badge="必选"
            badgeColor="blue"
            hint="1 张，白底或纯色背景"
            file={packagingFile}
            previewUrl={packagingPreviewUrl}
            onSelect={handlePackagingSelect}
            onClear={() => setPackagingFile(null)}
          />

          {/* 右上：产品实物 */}
          <MultiUploadSlot
            id="product-input"
            label="产品实物"
            badge="可选"
            badgeColor="slate"
            hint={`最多 ${MAX_PRODUCT_FILES} 张`}
            files={productFiles.map((f) => f.file)}
            labels={productFiles.map((f) => f.label)}
            previewUrls={productFiles.map((f) => URL.createObjectURL(f.file))}
            max={MAX_PRODUCT_FILES}
            onSelect={handleProductSelect}
            onRemove={removeProductFile}
            onLabelChange={updateProductLabel}
          />

          {/* 左下：产品调料 */}
          <MultiUploadSlot
            id="ingredient-input"
            label="产品调料"
            badge="可选"
            badgeColor="slate"
            hint={`最多 ${MAX_INGREDIENT_FILES} 张`}
            files={ingredientFiles.map((f) => f.file)}
            labels={ingredientFiles.map((f) => f.label)}
            previewUrls={ingredientFiles.map((f) => URL.createObjectURL(f.file))}
            max={MAX_INGREDIENT_FILES}
            onSelect={handleIngredientSelect}
            onRemove={removeIngredientFile}
            onLabelChange={updateIngredientLabel}
          />

          {/* 右下：产品信息图 */}
          <UploadSlot
            id="info-card-input"
            label="产品信息图"
            badge="可选"
            badgeColor="slate"
            hint="1 张"
            file={infoCardFile}
            previewUrl={infoCardPreviewUrl}
            onSelect={handleInfoCardSelect}
            onClear={() => setInfoCardFile(null)}
          />
        </div>

        {/* 提交按钮 */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            onClick={handleStart}
            disabled={!canSubmit}
            className="min-w-[220px] rounded-full px-8"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {submitting
              ? (selectedProductId ? "正在上传并跳转…" : "正在上传并自动分析…")
              : (selectedProductId ? "开始（知识库模式）" : "开始分析")}
          </Button>

          {!packagingFile && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              请先上传产品外包装图
            </p>
          )}

          {packagingFile && selectedProductId && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              🧠 知识库模式：将直接跳转分析页，AI 以产品知识库为地面真相进行约束分析
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function UploadSlot({
  id,
  label,
  badge,
  badgeColor,
  hint,
  file,
  previewUrl,
  onSelect,
  onClear,
}: {
  id: string;
  label: string;
  badge: string;
  badgeColor: "blue" | "slate";
  hint: string;
  file: File | null;
  previewUrl: string | null;
  onSelect: (list: FileList | null) => void;
  onClear: () => void;
}) {
  const colorClasses = badgeColor === "blue"
    ? "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/[0.04]"
    : "border-slate-300 bg-white/50 dark:border-white/10 dark:bg-white/[0.03]";
  const badgeClasses = badgeColor === "blue"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400";
  const iconClasses = badgeColor === "blue"
    ? "border-blue-200 bg-white text-blue-500 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
    : "border-slate-300 bg-white text-slate-400 shadow-sm dark:border-white/15 dark:bg-white/5 dark:text-slate-500";

  return (
    <div className={`rounded-[1.75rem] border border-dashed p-4 ${colorClasses}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClasses}`}>
          {badge}
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      </div>

      <Input id={id} type="file" accept="image/*" onChange={(e) => onSelect(e.target.files)} className="hidden" />

      {previewUrl ? (
        <div className="flex flex-col items-center">
          <label htmlFor={id} className="group relative w-full max-w-[180px] cursor-pointer overflow-hidden rounded-[1rem] bg-slate-100 shadow-sm dark:bg-white/8">
            <div className="aspect-square">
              <img src={previewUrl} alt={file!.name} className="h-full w-full object-cover transition group-hover:opacity-90" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 opacity-0 transition group-hover:opacity-100">点击更换</span>
            </div>
          </label>
          <button type="button" onClick={onClear} className="mt-2 text-xs text-slate-400 underline-offset-2 hover:text-red-500 hover:underline dark:text-slate-500 dark:hover:text-red-400">
            移除
          </button>
        </div>
      ) : (
        <label htmlFor={id} className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] transition hover:bg-white/60 dark:hover:bg-white/[0.04]">
          <div className={`flex h-14 w-14 items-center justify-center rounded-[1.25rem] border-2 ${iconClasses}`}>
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">点击上传{label}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        </label>
      )}
    </div>
  );
}

function MultiUploadSlot({
  id,
  label,
  badge,
  badgeColor,
  hint,
  files,
  labels,
  previewUrls,
  max,
  onSelect,
  onRemove,
  onLabelChange,
}: {
  id: string;
  label: string;
  badge: string;
  badgeColor: "blue" | "slate";
  hint: string;
  files: File[];
  labels: string[];
  previewUrls: string[];
  max: number;
  onSelect: (list: FileList | null) => void;
  onRemove: (index: number) => void;
  onLabelChange?: (index: number, label: string) => void;
}) {
  const colorClasses = badgeColor === "blue"
    ? "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/[0.04]"
    : "border-slate-300 bg-white/50 dark:border-white/10 dark:bg-white/[0.03]";
  const badgeClasses = badgeColor === "blue"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400";
  const iconClasses = badgeColor === "blue"
    ? "border-blue-200 bg-white text-blue-500 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
    : "border-slate-300 bg-white text-slate-400 shadow-sm dark:border-white/15 dark:bg-white/5 dark:text-slate-500";

  return (
    <div className={`rounded-[1.75rem] border border-dashed p-4 ${colorClasses}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClasses}`}>{badge}</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {files.length > 0 && (
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{files.length}/{max}</span>
        )}
      </div>

      <Input id={id} type="file" accept="image/*" multiple onChange={(e) => onSelect(e.target.files)} className="hidden" />

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="group flex w-[100px] flex-col items-center gap-1.5">
              <div className="relative w-full overflow-hidden rounded-lg bg-slate-100 shadow-sm dark:bg-white/8">
                <div className="aspect-square">
                  <img src={previewUrls[idx]} alt={file.name} className="h-full w-full object-cover" />
                </div>
                <button type="button" onClick={() => onRemove(idx)} className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100" title="移除">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              {onLabelChange ? (
                <div className="relative w-full">
                  <Tag className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={labels[idx] ?? ""}
                    onChange={(e) => onLabelChange(idx, e.target.value)}
                    placeholder="自定义标签"
                    className="w-full rounded-md border border-slate-200 bg-white/80 py-1 pl-6 pr-1.5 text-[11px] text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{idx + 1}</span>
              )}
            </div>
          ))}
          {files.length < max && (
            <label htmlFor={id} className="flex w-[100px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 transition hover:border-slate-400 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-white/25">
              <div className="aspect-square flex flex-col items-center justify-center p-1 text-center">
                <ImagePlus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">添加</span>
              </div>
            </label>
          )}
        </div>
      ) : (
        <label htmlFor={id} className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] transition hover:bg-slate-50/80 dark:hover:bg-white/[0.04]">
          <div className={`flex h-12 w-12 items-center justify-center rounded-[1rem] border-2 border-dashed ${iconClasses}`}>
            <ImagePlus className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">添加{label}图</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
          {onLabelChange && (
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">上传后可为每张图自定义标签</p>
          )}
        </label>
      )}
    </div>
  );
}
