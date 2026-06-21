"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Send, Sparkles, Download, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fileToBase64Payload } from "@/lib/utils/base64-upload";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text?: string;
  imageBase64?: string;
  imageWidth?: number;
  imageHeight?: number;
  referenceImageBase64?: string;
  resultImageBase64?: string;
  resultUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  loading?: boolean;
  error?: string;
}

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `msg_${messageCounter}_${Date.now()}`;
}

export function ImageTuneWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nextId(),
      role: "system",
      text: "欢迎使用图片微调功能！上传一张需要编辑的主图，可选再上传一张参考图提供样式灵感，然后用自然语言描述你的需求。",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
    width: number;
    height: number;
  } | null>(null);
  const [referenceImage, setReferenceImage] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>("original");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages]);

  const readFileAsDimensions = (base64: string, mimeType: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image for dimension detection"));
      img.src = `data:${mimeType};base64,${base64}`;
    });

  // 压缩图片：限制最大边长和文件大小，避免 DashScope 20MB 限制
  // Uses Web Worker with OffscreenCanvas when available to avoid main thread blocking
  const compressImage = (base64: string, mimeType: string, maxDim = 2048, maxBytes = 16 * 1024 * 1024) =>
    new Promise<{ base64Data: string; mimeType: string; width: number; height: number }>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => {
        let { naturalWidth: w, naturalHeight: h } = img;

        // 如果图片尺寸在限制内且 base64 不超限，直接返回
        const currentBytes = Math.ceil((base64.length * 3) / 4);
        if (w <= maxDim && h <= maxDim && currentBytes <= maxBytes) {
          resolve({ base64Data: base64, mimeType, width: w, height: h });
          return;
        }

        // 按比例缩放
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        // Try Web Worker with OffscreenCanvas for non-blocking compression
        if (typeof window !== "undefined" && typeof OffscreenCanvas !== "undefined") {
          try {
            createImageBitmap(img).then((bitmap) => {
              const worker = new Worker("/image-compress.worker.js");
              worker.onmessage = (e: MessageEvent) => {
                worker.terminate();
                if (e.data.error) {
                  reject(new Error(e.data.error));
                } else {
                  resolve({ base64Data: e.data.base64Data, mimeType: "image/jpeg", width: w, height: h });
                }
              };
              worker.onerror = () => {
                worker.terminate();
                // Fallback to main thread on worker error
                compressOnMainThread(img, w, h, maxBytes, resolve, reject);
              };
              worker.postMessage({ imageBitmap: bitmap, width: w, height: h, maxBytes }, [bitmap]);
            }).catch(() => {
              compressOnMainThread(img, w, h, maxBytes, resolve, reject);
            });
            return;
          } catch {
            // Fallback if Worker creation fails
          }
        }

        compressOnMainThread(img, w, h, maxBytes, resolve, reject);
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = `data:${mimeType};base64,${base64}`;
    });

  function compressOnMainThread(
    img: HTMLImageElement, w: number, h: number, maxBytes: number,
    resolve: (v: { base64Data: string; mimeType: string; width: number; height: number }) => void,
    reject: (e: Error) => void,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas not supported")); return; }
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.92;
    let result = canvas.toDataURL("image/jpeg", quality);
    let resultBytes = Math.ceil(((result.split(",")[1] ?? "").length * 3) / 4);

    while (resultBytes > maxBytes && quality > 0.3) {
      quality -= 0.1;
      result = canvas.toDataURL("image/jpeg", quality);
      resultBytes = Math.ceil(((result.split(",")[1] ?? "").length * 3) / 4);
    }

    const compressedBase64 = result.replace(/^data:image\/\w+;base64,/, "");
    resolve({ base64Data: compressedBase64, mimeType: "image/jpeg", width: w, height: h });
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    try {
      const payload = await fileToBase64Payload(file);
      const compressed = await compressImage(payload.base64Data, payload.mimeType);

      setSelectedImage({
        base64: compressed.base64Data,
        mimeType: compressed.mimeType,
        fileName: payload.fileName,
        width: compressed.width,
        height: compressed.height,
      });
      toast.success(`已选择主图：${file.name}（${compressed.width}x${compressed.height}）`);
    } catch {
      toast.error("图片读取失败，请重试");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleReferenceSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    try {
      const payload = await fileToBase64Payload(file);
      const compressed = await compressImage(payload.base64Data, payload.mimeType);
      setReferenceImage({
        base64: compressed.base64Data,
        mimeType: compressed.mimeType,
        fileName: payload.fileName,
      });
      toast.success(`已选择参考图：${file.name}`);
    } catch {
      toast.error("参考图读取失败，请重试");
    }

    if (refFileInputRef.current) {
      refFileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !selectedImage) return;
    if (sending) return;

    const userInstruction = text || "请帮我微调这张图片";

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      text: userInstruction,
      imageBase64: selectedImage?.base64,
      imageWidth: selectedImage?.width,
      imageHeight: selectedImage?.height,
      referenceImageBase64: referenceImage?.base64,
    };

    const aiMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setSending(true);

    try {
      const response = await fetch("/api/image-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selectedImage?.base64 ?? "",
          instruction: userInstruction,
          referenceBase64: referenceImage?.base64 ?? undefined,
          mimeType: selectedImage?.mimeType ?? "image/png",
          width: selectedImage?.width,
          height: selectedImage?.height,
          aspectRatio: aspectRatio === "original" ? undefined : aspectRatio,
        }),
      });

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error?.message ?? "微调请求失败");
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsg.id
            ? {
                ...msg,
                loading: false,
                text: `微调完成！根据你的描述「${text}」对图片进行了调整。`,
                resultImageBase64: payload.data.base64Data ?? undefined,
                resultUrl: payload.data.url ?? undefined,
                resultWidth: payload.data.originalWidth ?? undefined,
                resultHeight: payload.data.originalHeight ?? undefined,
              }
            : msg,
        ),
      );

      setSelectedImage(null);
      setReferenceImage(null);
      setInputText("");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "微调失败，请重试";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsg.id
            ? { ...msg, loading: false, error: errorMsg }
            : msg,
        ),
      );
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
  };

  const handleDownload = async (base64?: string, url?: string, width?: number, height?: number) => {
    try {
      let blob: Blob;
      if (base64) {
        blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      } else if (url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`下载失败 (${response.status})`);
        }
        blob = await response.blob();
      } else {
        toast.error("无可导出的图片数据");
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const sizeLabel = width && height ? `_${width}x${height}` : "";
      a.href = objectUrl;
      a.download = `ximo-mall_image_tune${sizeLabel}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("图片已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出图片失败");
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            图片微调
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            上传主图和可选的参考图，用自然语言描述修改需求，AI 只调整你描述的部分
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] p-4 space-y-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} onRetry={handleSend} onDownload={handleDownload} />
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="mt-3 space-y-2">
        {/* 已选择的图片预览区 */}
        {(selectedImage || referenceImage) && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 p-3 shadow-sm">
            {/* 主图预览 */}
            {selectedImage && (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-violet-300 dark:border-violet-500/50">
                  <Image
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`}
                    alt="主图"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                    <p className="truncate text-sm font-medium text-violet-700 dark:text-violet-300">主图</p>
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {selectedImage.fileName} · {selectedImage.width}x{selectedImage.height}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeSelectedImage}
                  className="h-7 w-7 rounded-full p-0 text-slate-400 hover:text-red-500"
                >
                  ✕
                </Button>
              </div>
            )}

            {/* 参考图预览 */}
            {referenceImage && (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-amber-300 dark:border-amber-500/50">
                  <Image
                    src={`data:${referenceImage.mimeType};base64,${referenceImage.base64}`}
                    alt="参考图"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <p className="truncate text-sm font-medium text-amber-700 dark:text-amber-300">参考图</p>
                  </div>
                  <p className="truncate text-xs text-slate-400">{referenceImage.fileName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeReferenceImage}
                  className="h-7 w-7 rounded-full p-0 text-slate-400 hover:text-red-500"
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={refFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReferenceSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 shrink-0 rounded-xl border-slate-200 bg-white dark:border-white/10 dark:bg-black/30"
            title="上传主图"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => refFileInputRef.current?.click()}
            className={cn(
              "h-10 w-10 shrink-0 rounded-xl border-slate-200 bg-white dark:border-white/10 dark:bg-black/30",
              referenceImage && "border-violet-300 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10",
            )}
            title={referenceImage ? `参考图：${referenceImage.fileName}` : "上传参考图（可选）"}
          >
            <Repeat className={cn("h-4 w-4", referenceImage && "text-violet-500")} />
          </Button>

          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
            title="输出宽高比"
          >
            <option value="original">原图比例</option>
            <option value="1:1">1:1</option>
            <option value="3:4">3:4</option>
            <option value="4:3">4:3</option>
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="2:3">2:3</option>
            <option value="3:2">3:2</option>
          </select>

          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedImage
                ? "描述你想要修改的地方，例如：把背景换成暖色调..."
                : "先上传一张主图，然后输入微调指令..."
            }
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl bg-white dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-sm"
            rows={1}
          />

          <Button
            onClick={handleSend}
            disabled={sending || (!inputText.trim() && !selectedImage)}
            className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message, onRetry, onDownload }: { message: ChatMessage; onRetry: () => void; onDownload: (base64?: string, url?: string, width?: number, height?: number) => void }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-xl bg-violet-50 dark:bg-violet-500/10 px-4 py-2.5 text-center">
          <p className="text-sm text-violet-700 dark:text-violet-300">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] space-y-2 rounded-2xl px-4 py-3",
          isUser
            ? "bg-violet-500 text-white rounded-br-md"
            : "bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/10 rounded-bl-md shadow-sm",
        )}
      >
        {message.imageBase64 && (
          <div className="space-y-2">
            {/* 主图 */}
            <div className="relative w-full max-w-[240px] overflow-hidden rounded-xl border-2 border-violet-300 dark:border-violet-500/50 bg-violet-50/50 dark:bg-violet-500/10">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-100/80 dark:bg-violet-500/20 border-b border-violet-200 dark:border-violet-500/30">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
                <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300">主图（将被修改）</span>
              </div>
              <div className="p-1">
                <Image
                  src={`data:image/png;base64,${message.imageBase64}`}
                  alt="主图"
                  width={240}
                  height={240}
                  className="w-full object-cover rounded-lg"
                  unoptimized
                />
              </div>
            </div>

            {/* 参考图 */}
            {message.referenceImageBase64 && (
              <div className="relative w-full max-w-[240px] overflow-hidden rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100/80 dark:bg-amber-500/20 border-b border-amber-200 dark:border-amber-500/30">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">参考图（提供风格/元素）</span>
                </div>
                <div className="p-1">
                  <Image
                    src={`data:image/png;base64,${message.referenceImageBase64}`}
                    alt="参考图"
                    width={240}
                    height={240}
                    className="w-full object-cover rounded-lg"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {message.text && (
          <p className={cn("text-sm whitespace-pre-wrap break-words", isUser ? "text-white/95" : "text-slate-700 dark:text-slate-200")}>
            {message.text}
          </p>
        )}

        {message.loading && (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm text-slate-500">AI 正在微调图片...</span>
          </div>
        )}

        {message.error && (
          <div className="space-y-2">
            <p className="text-sm text-red-500">{message.error}</p>
            <button
              onClick={onRetry}
              className="text-xs text-violet-500 hover:text-violet-600 underline"
            >
              重新发送
            </button>
          </div>
        )}

        {(message.resultImageBase64 || message.resultUrl) && (
          <div className="space-y-2">
            <div className="relative w-full max-w-[280px] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              <Image
                src={
                  message.resultUrl ??
                  `data:image/png;base64,${message.resultImageBase64}`
                }
                alt="result"
                width={280}
                height={280}
                className="w-full object-cover"
                unoptimized
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-lg text-xs"
              onClick={() => {
                onDownload(message.resultImageBase64, message.resultUrl ?? undefined, message.resultWidth, message.resultHeight);
              }}
            >
              <Download className="h-3 w-3" />
              导出图片
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">我</span>
        </div>
      )}
    </div>
  );
}
