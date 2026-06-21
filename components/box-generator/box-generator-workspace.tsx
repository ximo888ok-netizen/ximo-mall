"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  ImagePlus,
  Layout,
  Loader2,
  Package,
  Palette,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";
import type { BoxAnalysisOutput } from "@/lib/ai/schemas/box-analysis";
import type { BoxPlanningOutput } from "@/lib/ai/schemas/box-planning";

const steps = [
  { id: 0, label: "产品信息", icon: Package },
  { id: 1, label: "包装配置", icon: Box },
  { id: 2, label: "视觉设计", icon: Palette },
  { id: 3, label: "AI 分析", icon: Brain },
  { id: 4, label: "面规划", icon: Layout },
  { id: 5, label: "预览确认", icon: Eye },
  { id: 6, label: "生成导出", icon: Sparkles },
];

const boxTypeOptions = [
  { value: "folding-box", label: "折叠盒" },
  { value: "tian-di-gai", label: "天地盖" },
  { value: "drawer-box", label: "抽屉式" },
  { value: "window-box", label: "开窗盒" },
  { value: "handle-box", label: "手提盒" },
  { value: "book-box", label: "书型盒" },
];

const materialOptions = [
  { value: "coated-paper", label: "铜版纸" },
  { value: "white-card", label: "白卡纸" },
  { value: "kraft-paper", label: "牛皮纸" },
  { value: "specialty-paper", label: "特种纸" },
  { value: "corrugated", label: "瓦楞纸" },
  { value: "gold-card", label: "金卡/银卡" },
];

const finishOptions = [
  { value: "gloss-lamination", label: "覆光膜" },
  { value: "matte-lamination", label: "覆哑膜" },
  { value: "hot-stamping", label: "烫金/烫银" },
  { value: "uv-spot", label: "局部UV" },
  { value: "embossing", label: "压纹/凹凸" },
];

const styleOptions = [
  { value: "minimal-modern", label: "简约现代", desc: "简洁线条、大面积留白" },
  { value: "luxury", label: "奢华高端", desc: "金色点缀、精致工艺" },
  { value: "vintage", label: "复古怀旧", desc: "经典字体、温暖色调" },
  { value: "tech", label: "科技感", desc: "几何图形、冷色调" },
  { value: "natural", label: "自然环保", desc: "绿色系、自然元素" },
  { value: "cute", label: "清新可爱", desc: "柔和色系、圆润元素" },
  { value: "guochao", label: "国潮风格", desc: "东方美学、传统元素" },
  { value: "festive", label: "节日限定", desc: "节日元素、喜庆配色" },
];

const fontStyleOptions = [
  { value: "sans-serif", label: "黑体（现代简洁）" },
  { value: "serif", label: "宋体（传统典雅）" },
  { value: "handwriting", label: "手写体（亲切自然）" },
  { value: "decorative", label: "装饰字体（个性突出）" },
];

const viewOptions = [
  { value: "front", label: "正面" },
  { value: "back", label: "背面" },
  { value: "side", label: "侧面" },
  { value: "top", label: "顶面" },
  { value: "bottom", label: "底面" },
  { value: "perspective", label: "立体透视" },
];

const faceLabels: Record<string, string> = {
  front: "正面",
  back: "背面",
  side: "侧面",
  top: "顶面",
  bottom: "底面",
  perspective: "立体透视",
};

// --- localStorage persistence ---
type FaceStatus = "pending" | "generating" | "done" | "error";
interface FaceResult {
  base64Data: string;
  usedModel: string;
}
interface PersistedData {
  [viewKey: string]: {
    base64Data: string;
    usedModel: string;
    timestamp: number;
  };
}

function getStorageKey(productName: string) {
  return `box-gen:${productName || "__unnamed__"}`;
}

function loadPersistedResults(productName: string): PersistedData {
  try {
    const raw = localStorage.getItem(getStorageKey(productName));
    if (!raw) return {};
    return JSON.parse(raw) as PersistedData;
  } catch {
    return {};
  }
}

function savePersistedResult(productName: string, viewKey: string, result: FaceResult) {
  try {
    const existing = loadPersistedResults(productName);
    existing[viewKey] = { ...result, timestamp: Date.now() };
    localStorage.setItem(getStorageKey(productName), JSON.stringify(existing));
  } catch {
    // localStorage full — silently ignore
  }
}

function clearPersistedResults(productName: string) {
  try {
    localStorage.removeItem(getStorageKey(productName));
  } catch {
    // ignore
  }
}

const categoryOptions = [
  { value: "food-instant-noodle", label: "食品·速食面" },
  { value: "food-snack", label: "食品·零食糕点" },
  { value: "food-beverage", label: "食品·饮料" },
  { value: "food-seasoning", label: "食品·调味料" },
  { value: "beauty-skincare", label: "美妆·护肤品" },
  { value: "beauty-makeup", label: "美妆·彩妆" },
  { value: "electronics", label: "数码电子" },
  { value: "home", label: "家居用品" },
  { value: "gift", label: "礼品礼盒" },
  { value: "other", label: "其他品类" },
];

export function BoxGeneratorWorkspace() {
  const [currentStep, setCurrentStep] = useState(0);

  const [productImage, setProductImage] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
    width: number;
    height: number;
  } | null>(null);
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productDimensions, setProductDimensions] = useState({ width: 0, height: 0, depth: 0 });

  const [boxType, setBoxType] = useState("folding-box");
  const [boxDimensions, setBoxDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const [material, setMaterial] = useState("coated-paper");
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);

  const [style, setStyle] = useState("minimal-modern");
  const [primaryColor, setPrimaryColor] = useState("#E64A19");
  const [secondaryColorsStr, setSecondaryColorsStr] = useState("");
  const [fontStyle, setFontStyle] = useState("sans-serif");

  const [customInstruction, setCustomInstruction] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BoxAnalysisOutput | null>(null);

  const [planning, setPlanning] = useState(false);
  const [plannedFaces, setPlannedFaces] = useState<Array<{ face: string; visualPrompt: string; layoutNotes?: string; copy?: string }> | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});

  const [generating, setGenerating] = useState(false);
  const [dielineStatus, setDielineStatus] = useState<FaceStatus>("pending");
  const [dielineResult, setDielineResult] = useState<FaceResult | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [upscaling, setUpscaling] = useState(false);
  const [upscaledResult, setUpscaledResult] = useState<FaceResult | null>(null);

  // Restore persisted results on mount
  useEffect(() => {
    const name = analysisResult?.productName ?? productName;
    const persisted = loadPersistedResults(name);
    if (Object.keys(persisted).length > 0) {
      const dieline = persisted["dieline"];
      if (dieline) {
        setDielineStatus("done");
        setDielineResult({ base64Data: dieline.base64Data, usedModel: dieline.usedModel });
      }
      const upscaled = persisted["dieline_upscaled"];
      if (upscaled) {
        setUpscaledResult({ base64Data: upscaled.base64Data, usedModel: upscaled.usedModel });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const secondaryColors = useMemo(() => {
    return secondaryColorsStr
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [secondaryColorsStr]);

  const isLastStep = currentStep === 6;
  const canNext = useMemo(() => {
    switch (currentStep) {
      case 0:
        return !!productImage && !!productName;
      case 1:
        return boxDimensions.width > 0 && boxDimensions.height > 0 && boxDimensions.depth > 0;
      default:
        return true;
    }
  }, [currentStep, productImage, productName, boxDimensions]);

  const previewUrl = useMemo(
    () => (productImage ? `data:${productImage.mimeType};base64,${productImage.base64}` : null),
    [productImage],
  );

  const effectivePrompts = useMemo(() => {
    if (!plannedFaces) return {};
    const map: Record<string, string> = {};
    for (const pf of plannedFaces) {
      map[pf.face] = editedPrompts[pf.face] ?? pf.visualPrompt;
    }
    return map;
  }, [plannedFaces, editedPrompts]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    try {
      const payload = await fileToBase64Payload(file);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = `data:${payload.mimeType};base64,${payload.base64Data}`;
      });
      setProductImage({
        base64: payload.base64Data,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch {
      toast.error("图片读取失败，请重试");
    }
    if (e.target) e.target.value = "";
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!productImage) {
      toast.error("请先上传产品图片");
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const response = await fetch("/api/box-generator/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImageBase64: `data:${productImage.mimeType};base64,${productImage.base64}`,
          productName,
          brandName,
          productCategory,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "分析请求失败");
      }
      setAnalysisResult(payload.data);
      toast.success("产品分析完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分析失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  }, [productImage, productName, brandName, productCategory]);

  const handlePlanFaces = useCallback(async () => {
    if (!analysisResult) {
      toast.error("请先完成产品分析");
      return;
    }
    setPlanning(true);
    setPlannedFaces(null);
    setEditedPrompts({});
    try {
      const response = await fetch("/api/box-generator/plan-faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: analysisResult.productName,
          brandName: analysisResult.brandInferred,
          productCategory: analysisResult.productCategory,
          specifications: analysisResult.specifications,
          coreSellingPoints: analysisResult.coreSellingPoints,
          productDescription: analysisResult.productDescription,
          slogan: analysisResult.slogan,
          boxType,
          boxDimensions,
          material,
          finish: selectedFinishes.join(","),
          style,
          primaryColor,
          secondaryColors,
          fontStyle,
          customInstruction,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "规划请求失败");
      }
      // New format: single object with visualPrompt and layoutNotes
      // Convert to array with face field for consistency
      setPlannedFaces([{ face: "dieline", ...payload.data }]);
      toast.success("刀版图规划完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "规划失败，请重试");
    } finally {
      setPlanning(false);
    }
  }, [analysisResult, boxType, boxDimensions, material, selectedFinishes,
    style, primaryColor, secondaryColors, fontStyle, customInstruction]);

  const handleGenerateDieline = useCallback(async () => {
    if (!productImage) {
      toast.error("请先上传产品图片");
      return;
    }

    setGenerating(true);
    setDielineStatus("generating");
    setUpscaledResult(null);

    const finalFaces = plannedFaces?.map((pf) => ({
      face: pf.face || "dieline",
      copy: pf.copy,
      visualPrompt: editedPrompts["dieline"] ?? pf.visualPrompt,
      layoutNotes: pf.layoutNotes,
    }));

    const currentProductName = analysisResult?.productName ?? productName;

    try {
      const response = await fetch("/api/box-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImageBase64: `data:${productImage.mimeType};base64,${productImage.base64}`,
          productName: currentProductName,
          brandName: analysisResult?.brandInferred ?? brandName,
          productCategory: analysisResult?.productCategory ?? productCategory,
          boxType,
          boxDimensions,
          material,
          finish: selectedFinishes.join(","),
          style,
          primaryColor,
          secondaryColors,
          fontStyle,
          views: ["dieline"],
          customInstruction,
          plannedFaces: finalFaces,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => null);
        throw new Error(errPayload?.error?.message ?? `请求失败 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setDielineStatus("generating");
            } else if (msg.type === "result") {
              const result: FaceResult = { base64Data: msg.base64Data, usedModel: msg.usedModel };
              setDielineResult(result);
              setDielineStatus("done");
              savePersistedResult(currentProductName, "dieline", result);
              toast.success("刀版图生成完成");
            } else if (msg.type === "error") {
              setDielineStatus("error");
            } else if (msg.type === "fatal") {
              throw new Error(msg.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  }, [
    productImage, productName, brandName, productCategory,
    analysisResult, plannedFaces, editedPrompts,
    boxType, boxDimensions, material, selectedFinishes,
    style, primaryColor, secondaryColors, fontStyle,
    customInstruction,
  ]);

  const handleUpscale = useCallback(async () => {
    if (!dielineResult) {
      toast.error("请先生成刀版图");
      return;
    }
    setUpscaling(true);
    try {
      const response = await fetch("/api/image-upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: `data:image/png;base64,${dielineResult.base64Data}`,
          upscaleFactor,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "超分请求失败");
      }
      const result: FaceResult = {
        base64Data: payload.data.b64Json ?? "",
        usedModel: "wanx2.1-imageedit",
      };
      // If we got a URL instead of b64Json, we need to fetch it
      if (!result.base64Data && payload.data.url) {
        const imgResp = await fetch(payload.data.url);
        const buf = await imgResp.arrayBuffer();
        result.base64Data = Buffer.from(buf).toString("base64");
      }
      setUpscaledResult(result);
      const currentProductName = analysisResult?.productName ?? productName;
      savePersistedResult(currentProductName, "dieline_upscaled", result);
      toast.success(`刀版图超分完成（${upscaleFactor}倍）`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "超分失败，请重试");
    } finally {
      setUpscaling(false);
    }
  }, [dielineResult, upscaleFactor, productName, analysisResult]);

  const handleDownload = useCallback(async (key: string) => {
    const result = key === "upscaled" ? upscaledResult : dielineResult;
    if (!result) return;
    try {
      const blob = await (await fetch(`data:image/png;base64,${result.base64Data}`)).blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `包装盒刀版图-${productName || "未命名"}-${key}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("图片已下载");
    } catch {
      toast.error("图片下载失败");
    }
  }, [dielineResult, upscaledResult, productName]);

  const handleClearCache = useCallback(() => {
    const name = analysisResult?.productName ?? productName;
    clearPersistedResults(name);
    setDielineStatus("pending");
    setDielineResult(null);
    setUpscaledResult(null);
    toast.success("已清除缓存");
  }, [productName, analysisResult]);

  const toggleFinish = useCallback((value: string) => {
    setSelectedFinishes((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  }, []);

  const handleNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(6, prev + 1));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            包装盒生成器
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            上传产品图片 → AI 分析 → 面规划 → 生成多视图包装盒
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => { if (isDone) setCurrentStep(step.id); }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                isActive && "bg-violet-500 text-white shadow-sm",
                isDone && "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 cursor-pointer",
                !isActive && !isDone && "bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-400 cursor-default",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/84 p-6 shadow-sm dark:border-white/10 dark:bg-white/6">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">产品图片 *</label>
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="box-product-image" />
              <label
                htmlFor="box-product-image"
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition hover:bg-slate-50/80 dark:hover:bg-white/[0.04]",
                  productImage
                    ? "border-violet-300 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5"
                    : "border-slate-300 dark:border-white/10",
                )}
              >
                {previewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-40 overflow-hidden rounded-xl shadow-md">
                      <div className="aspect-square">
                        <Image src={previewUrl} alt="产品图预览" width={160} height={160} className="h-full w-full object-cover" unoptimized />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {productImage?.fileName} ({productImage?.width}x{productImage?.height})
                    </p>
                    <p className="text-xs text-violet-500">点击重新选择</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                    <ImagePlus className="h-10 w-10" />
                    <p className="text-sm">点击上传产品图片</p>
                    <p className="text-xs">支持 JPG、PNG、WEBP 格式</p>
                  </div>
                )}
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">产品名称 *</label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="如：经典番茄肉酱意面" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">品牌名称</label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="如：良面优品" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">产品品类</label>
                <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20">
                  <option value="">请选择品类</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">产品尺寸 (cm)</label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="长" value={productDimensions.width || ""} onChange={(e) => setProductDimensions((prev) => ({ ...prev, width: Number(e.target.value) }))} className="w-20 rounded-xl text-center" />
                  <span className="text-xs text-slate-400">×</span>
                  <Input type="number" placeholder="宽" value={productDimensions.height || ""} onChange={(e) => setProductDimensions((prev) => ({ ...prev, height: Number(e.target.value) }))} className="w-20 rounded-xl text-center" />
                  <span className="text-xs text-slate-400">×</span>
                  <Input type="number" placeholder="高" value={productDimensions.depth || ""} onChange={(e) => setProductDimensions((prev) => ({ ...prev, depth: Number(e.target.value) }))} className="w-20 rounded-xl text-center" />
                  <span className="text-xs text-slate-400">cm</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">盒型结构 *</label>
              <div className="grid grid-cols-3 gap-3">
                {boxTypeOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setBoxType(opt.value)} className={cn("rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200", boxType === opt.value ? "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/20 dark:text-violet-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:text-slate-400")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">包装盒尺寸 * (cm)</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">长</span><Input type="number" value={boxDimensions.width || ""} onChange={(e) => setBoxDimensions((prev) => ({ ...prev, width: Number(e.target.value) }))} className="w-24 rounded-xl text-center" min={0} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">宽</span><Input type="number" value={boxDimensions.height || ""} onChange={(e) => setBoxDimensions((prev) => ({ ...prev, height: Number(e.target.value) }))} className="w-24 rounded-xl text-center" min={0} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">高</span><Input type="number" value={boxDimensions.depth || ""} onChange={(e) => setBoxDimensions((prev) => ({ ...prev, depth: Number(e.target.value) }))} className="w-24 rounded-xl text-center" min={0} /></div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">材质选择</label>
              <div className="grid grid-cols-3 gap-3">
                {materialOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setMaterial(opt.value)} className={cn("rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200", material === opt.value ? "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/20 dark:text-violet-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:text-slate-400")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">工艺效果（可多选）</label>
              <div className="flex flex-wrap gap-3">
                {finishOptions.map((opt) => (
                  <button key={opt.value} onClick={() => toggleFinish(opt.value)} className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200", selectedFinishes.includes(opt.value) ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-500/20 dark:text-amber-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:text-slate-400")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">设计风格 *</label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {styleOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setStyle(opt.value)} className={cn("rounded-xl border px-4 py-4 text-left transition-all duration-200", style === opt.value ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-500/20" : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-black/10")}>
                    <p className={cn("text-sm font-medium", style === opt.value ? "text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-slate-300")}>{opt.label}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">主色调</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="h-10 w-10 cursor-pointer rounded-lg border-2 border-slate-200 shadow-sm transition hover:scale-105 dark:border-white/10"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => document.getElementById("box-primary-color-picker")?.click()}
                    />
                    <input
                      id="box-primary-color-picker"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-0 h-0 w-0 opacity-0"
                    />
                  </div>
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#E64A19" className="flex-1 rounded-xl font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">辅助色（逗号分隔）</label>
                <Input value={secondaryColorsStr} onChange={(e) => setSecondaryColorsStr(e.target.value)} placeholder="#FFFFFF, #FFE0B2" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">字体风格</label>
                <div className="grid grid-cols-2 gap-2">
                  {fontStyleOptions.map((opt) => (
                    <button key={opt.value} onClick={() => setFontStyle(opt.value)} className={cn("rounded-lg border px-3 py-2 text-sm transition-all duration-200", fontStyle === opt.value ? "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/20 dark:text-violet-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:text-slate-400")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">分析上下文</h3>
              <div className="mt-2 grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                {previewUrl && (
                  <div className="flex items-center gap-3">
                    <Image src={previewUrl} alt="产品" width={48} height={48} className="rounded-lg object-cover" unoptimized />
                    <span>产品图片已就绪</span>
                  </div>
                )}
                <div>产品名称：<strong className="text-slate-700 dark:text-slate-300">{productName}</strong></div>
                {brandName && <div>品牌：<strong className="text-slate-700 dark:text-slate-300">{brandName}</strong></div>}
                {productCategory && <div>品类：<strong className="text-slate-700 dark:text-slate-300">{productCategory}</strong></div>}
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !productImage}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 py-5 text-base font-semibold hover:from-violet-600 hover:to-purple-600"
            >
              {analyzing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />AI 正在分析产品...</>
              ) : (
                <><Brain className="mr-2 h-5 w-5" />开始 AI 分析</>
              )}
            </Button>

            {analysisResult && (
              <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300">分析结果（可编辑）</h3>
                  <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing} className="h-7 gap-1 rounded-lg text-xs">
                    {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    重新分析
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">产品名称</label>
                    <Input value={analysisResult.productName} onChange={(e) => setAnalysisResult({ ...analysisResult, productName: e.target.value })} className="h-8 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">品牌</label>
                    <Input value={analysisResult.brandInferred} onChange={(e) => setAnalysisResult({ ...analysisResult, brandInferred: e.target.value })} className="h-8 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-500">Slogan</label>
                    <Input value={analysisResult.slogan} onChange={(e) => setAnalysisResult({ ...analysisResult, slogan: e.target.value })} className="h-8 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-500">核心卖点（逗号分隔）</label>
                    <Input value={analysisResult.coreSellingPoints.join("，")} onChange={(e) => setAnalysisResult({ ...analysisResult, coreSellingPoints: e.target.value.split(/[,，、]/g).map((s) => s.trim()).filter(Boolean) })} className="h-8 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-500">产品介绍</label>
                    <Textarea value={analysisResult.productDescription} onChange={(e) => setAnalysisResult({ ...analysisResult, productDescription: e.target.value })} className="min-h-[60px] rounded-lg text-sm" rows={2} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">规格</label>
                    <Input value={analysisResult.specifications} onChange={(e) => setAnalysisResult({ ...analysisResult, specifications: e.target.value })} className="h-8 rounded-lg text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">配色方案</label>
                    <Input value={analysisResult.colorPalette.join("，")} onChange={(e) => setAnalysisResult({ ...analysisResult, colorPalette: e.target.value.split(/[,，、]/g).map((s) => s.trim()).filter(Boolean) })} className="h-8 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            {!analysisResult && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center dark:border-amber-500/20 dark:bg-amber-500/5">
                <p className="text-sm text-amber-700 dark:text-amber-300">请先在上一步完成「AI 分析」</p>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)} className="mt-2 h-7 rounded-lg text-xs">返回上一步</Button>
              </div>
            )}

            {analysisResult && (
              <>
                <Button
                  onClick={handlePlanFaces}
                  disabled={planning}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-5 text-base font-semibold hover:from-indigo-600 hover:to-blue-600"
                >
                  {planning ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />AI 正在规划刀版图...</>
                  ) : (
                    <><Layout className="mr-2 h-5 w-5" />开始刀版图规划</>
                  )}
                </Button>

                {plannedFaces && plannedFaces.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">刀版图 visualPrompt（可编辑）</h3>
                      <Button variant="outline" size="sm" onClick={handlePlanFaces} disabled={planning} className="h-7 gap-1 rounded-lg text-xs">
                        {planning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layout className="h-3 w-3" />}
                        重新规划
                      </Button>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          刀版展开图
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{plannedFaces[0].layoutNotes}</span>
                      </div>
                      <Textarea
                        value={editedPrompts["dieline"] ?? plannedFaces[0].visualPrompt}
                        onChange={(e) => setEditedPrompts((prev) => ({ ...prev, dieline: e.target.value }))}
                        className="min-h-[120px] rounded-lg text-xs font-mono"
                        rows={6}
                        placeholder="visualPrompt..."
                      />
                      {plannedFaces[0].copy && (
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Copy: {plannedFaces[0].copy}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">配置预览确认</h3>
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2">
              <div><span className="text-slate-400">产品名称：</span><strong>{analysisResult?.productName ?? productName}</strong></div>
              <div><span className="text-slate-400">品牌：</span><strong>{analysisResult?.brandInferred ?? brandName}</strong></div>
              <div><span className="text-slate-400">盒型：</span><strong>{boxTypeOptions.find((o) => o.value === boxType)?.label ?? boxType}</strong></div>
              <div><span className="text-slate-400">尺寸：</span><strong>{boxDimensions.width}×{boxDimensions.height}×{boxDimensions.depth} cm</strong></div>
              <div><span className="text-slate-400">材质：</span><strong>{materialOptions.find((o) => o.value === material)?.label ?? material}</strong></div>
              <div><span className="text-slate-400">风格：</span><strong>{styleOptions.find((o) => o.value === style)?.label ?? style}</strong></div>
              <div><span className="text-slate-400">主色：</span><span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: primaryColor }} />{primaryColor}</span></div>
              <div><span className="text-slate-400">进度：</span><strong>分析完成{plannedFaces ? " + 规划完成" : ""}</strong></div>
            </div>
            <Button onClick={handleNextStep} className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 py-5 text-base font-semibold hover:from-green-600 hover:to-emerald-600">
              确认并进入生成 → Step 6
            </Button>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">自定义指令（可选）</label>
              <Textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="对 AI 生成的特殊要求，如：在包装盒上加入小熊图案"
                className="min-h-[60px] rounded-xl"
                rows={2}
              />
            </div>

            {/* Dieline generation card */}
            <div className={cn(
              "overflow-hidden rounded-2xl border transition-all duration-200",
              dielineStatus === "done"
                ? "border-green-200 bg-white dark:border-green-500/30 dark:bg-white/[0.04]"
                : dielineStatus === "error"
                ? "border-red-200 bg-white dark:border-red-500/30 dark:bg-white/[0.04]"
                : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]",
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">刀版展开图</h3>
                  {dielineStatus === "generating" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  {dielineStatus === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {dielineStatus === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
                {dielineResult && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-lg text-xs text-slate-400 hover:text-slate-600"
                    onClick={() => handleDownload("dieline")}
                  >
                    <Download className="h-3 w-3" />
                    下载原图
                  </Button>
                )}
              </div>

              <div className="p-4">
                {dielineStatus === "generating" && (
                  <div className="flex h-64 items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />
                      <p className="mt-3 text-sm text-blue-500">AI 正在生成刀版展开图...</p>
                      <p className="mt-1 text-xs text-slate-400">包含所有面 + 尺寸标注 + 折叠线</p>
                    </div>
                  </div>
                )}
                {dielineStatus === "pending" && !dielineResult && (
                  <div className="flex h-64 items-center justify-center">
                    <p className="text-sm text-slate-400">未生成</p>
                  </div>
                )}
                {dielineStatus === "error" && (
                  <div className="flex h-64 items-center justify-center">
                    <div className="text-center">
                      <XCircle className="mx-auto h-10 w-10 text-red-400" />
                      <p className="mt-3 text-sm text-red-400">生成失败</p>
                    </div>
                  </div>
                )}
                {dielineStatus === "done" && dielineResult && (
                  <div className="relative">
                    <Image
                      src={`data:image/png;base64,${dielineResult.base64Data}`}
                      alt="刀版展开图"
                      width={600}
                      height={400}
                      className="w-full rounded-lg object-contain"
                      unoptimized
                    />
                    <p className="mt-2 text-xs text-slate-400">模型：{dielineResult.usedModel}</p>
                  </div>
                )}

                <Button
                  onClick={handleGenerateDieline}
                  disabled={generating || !productImage}
                  className={cn(
                    "mt-3 w-full rounded-xl py-3 text-sm font-medium",
                    dielineStatus === "done"
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600",
                  )}
                >
                  {dielineStatus === "generating" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成中...</>
                  ) : dielineStatus === "done" ? (
                    <><Sparkles className="mr-2 h-4 w-4" />重新生成刀版图</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />生成刀版展开图</>
                  )}
                </Button>
              </div>
            </div>

            {/* Upscale section */}
            {dielineStatus === "done" && dielineResult && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">超分高清放大</h3>
                    {upscaling && <Loader2 className="h-4 w-4 animate-spin text-purple-500" />}
                    {upscaledResult && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                  {upscaledResult && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 rounded-lg text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => handleDownload("upscaled")}
                    >
                      <Download className="h-3 w-3" />
                      下载超分图
                    </Button>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <label className="text-xs text-slate-500">放大倍数：</label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map((factor) => (
                        <button
                          key={factor}
                          onClick={() => setUpscaleFactor(factor)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            upscaleFactor === factor
                              ? "border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-500/20 dark:text-purple-300"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-black/10 dark:text-slate-400",
                          )}
                        >
                          {factor}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {upscaling && (
                    <div className="flex h-48 items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
                        <p className="mt-2 text-xs text-purple-500">超分处理中（{upscaleFactor}倍放大）...</p>
                      </div>
                    </div>
                  )}

                  {!upscaling && upscaledResult && (
                    <div className="relative">
                      <Image
                        src={`data:image/png;base64,${upscaledResult.base64Data}`}
                        alt="超分刀版图"
                        width={800}
                        height={600}
                        className="w-full rounded-lg object-contain"
                        unoptimized
                      />
                      <p className="mt-2 text-xs text-slate-400">模型：{upscaledResult.usedModel} | 放大：{upscaleFactor}x</p>
                    </div>
                  )}

                  {!upscaling && !upscaledResult && (
                    <p className="text-xs text-slate-400">点击按钮开始超分处理</p>
                  )}

                  <Button
                    onClick={handleUpscale}
                    disabled={upscaling || !dielineResult}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 py-3 text-sm font-medium text-white hover:from-purple-600 hover:to-violet-600"
                  >
                    {upscaling ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />超分处理中...</>
                    ) : upscaledResult ? (
                      <><Sparkles className="mr-2 h-4 w-4" />重新超分（{upscaleFactor}x）</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />超分高清放大（{upscaleFactor}x）</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Clear cache button */}
            {(dielineResult || upscaledResult) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={generating || upscaling}
                  className="h-8 gap-1.5 rounded-xl text-xs text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清除所有缓存
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="gap-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          上一步
        </Button>

        {!isLastStep && (
          <Button
            onClick={handleNextStep}
            disabled={!canNext}
            className="gap-2 rounded-xl"
          >
            下一步
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
