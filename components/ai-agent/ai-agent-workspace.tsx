"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Send,
  X,
  Wrench,
  ChevronDown,
  ChevronUp,
  Monitor,
  Palette,
  Zap,
  Camera,
  Globe,
  Brain,
  CheckCircle2,
  XCircle,
  Ratio,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { Button } from "@/components/ui/button";
import { styleCategories, styleLabels, platformLabels } from "@/types/domain";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatMessageItem } from "./chat-message-item";
import { ChatTextarea, type ChatTextareaHandle } from "./chat-textarea";

const PLATFORM_OPTIONS = [
  "douyin_ecommerce",
  "pinduoduo",
  "taobao_tmall",
  "general_ecommerce",
] as const;

const MODE_OPTIONS = [
  { key: "auto", label: "自动模式", desc: "全自动完成全部流程" },
  { key: "interactive", label: "问答模式", desc: "每步确认后再继续" },
] as const;

const HERO_SIZE_OPTIONS = [
  { key: "auto", ratio: "智能", label: "智能比例", desc: "头图1:1 / 详情9:16" },
  { key: "1440x1440", ratio: "1:1", label: "1440 × 1440" },
  { key: "800x800", ratio: "1:1", label: "800 × 800" },
  { key: "750x750", ratio: "1:1", label: "750 × 750" },
  { key: "750x1000", ratio: "3:4", label: "750 × 1000" },
] as const;

type HeroSizeKey = (typeof HERO_SIZE_OPTIONS)[number]["key"];

const MSG_CACHE_PREFIX = "banana-agent-msgs-";
const THREAD_ID_CACHE_KEY = "banana-agent-current-thread";

function loadMessagesFromCache(threadId: string) {
  try {
    const raw = localStorage.getItem(MSG_CACHE_PREFIX + threadId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMessagesToCache(threadId: string, msgs: unknown[]) {
  try {
    localStorage.setItem(MSG_CACHE_PREFIX + threadId, JSON.stringify(msgs));
  } catch {
    // localStorage full or inaccessible — silently skip
  }
}

function removeMessagesFromCache(threadId: string) {
  try {
    localStorage.removeItem(MSG_CACHE_PREFIX + threadId);
  } catch {
    // ignore
  }
}

async function fetchMessagesFromServer(threadId: string) {
  try {
    const res = await fetch(`/api/ai-agent/threads/${threadId}/messages`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data?.messages)) return null;

    // Convert server format to UI messages that useChat can display
    return data.data.messages.map(
      (m: { id: string; role: string; text: string }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.text ? [{ type: "text" as const, text: m.text }] : [],
      }),
    );
  } catch {
    return null;
  }
}

type PlatformKey = (typeof PLATFORM_OPTIONS)[number];
type ModeKey = (typeof MODE_OPTIONS)[number]["key"];

const chatTransport = new DefaultChatTransport({
  api: "/api/ai-agent/chat",
});

export function AiAgentWorkspace() {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ file: File; label: string }>
  >([]);
  const [hasInputText, setHasInputText] = useState(false);
  const [platform, setPlatform] = useState<PlatformKey | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeKey | null>(null);
  const [heroCount, setHeroCount] = useState(3);
  const [detailCount, setDetailCount] = useState(6);
  const [heroImageSize, setHeroImageSize] = useState<HeroSizeKey>("auto");
  const [webSearch, setWebSearch] = useState(false);
  const [expandedSelector, setExpandedSelector] = useState<
    "platform" | "style" | "mode" | "count" | "size" | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectorPanelRef = useRef<HTMLDivElement>(null);
  const inputTextRef = useRef("");
  const textareaHandleRef = useRef<ChatTextareaHandle>(null);

  // Active option state for 问答模式 interactive choice UI (Step 2+)
  const [activeOption, setActiveOption] = useState<{
    messageId: string;
    leafLetter: string;
    selectedLetter: string;
    selectedLabel: string;
  } | null>(null);
  const [optionInputText, setOptionInputText] = useState("");

  // Active form state for 问答模式 product info form (Step 1)
  const [activeForm, setActiveForm] = useState<{
    messageId: string;
    fields: Array<{ index: number; label: string; optional: boolean }>;
  } | null>(null);
  const [formValues, setFormValues] = useState<Record<number, string>>({});

  const hasConfig =
    platform !== null || style !== null || mode !== null || webSearch;

  // Track all blob URLs created during the component's lifetime.
  // They are only revoked on unmount so that file parts injected into
  // sent messages remain valid for rendering.
  const allBlobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = allBlobUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewUrls = useMemo(() => {
    const entries = attachedFiles.map((f) => ({
      url: URL.createObjectURL(f.file),
      label: f.label,
      name: f.file.name,
    }));
    entries.forEach((e) => allBlobUrlsRef.current.push(e.url));
    return entries;
  }, [attachedFiles]);

  useEffect(() => {
    if (!expandedSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        selectorPanelRef.current &&
        !selectorPanelRef.current.contains(e.target as Node)
      ) {
        setExpandedSelector(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedSelector]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: chatTransport,
  });

  const handleOptionConfirm = useCallback(() => {
    if (!activeOption) return;
    const text = optionInputText.trim()
      ? `${activeOption.selectedLetter}\n${optionInputText.trim()}`
      : activeOption.selectedLetter;
    sendMessage(
      { text },
      {
        body: {
          threadId: currentThreadId,
          resourceId: "ximo-mall-user",
        },
      },
    );
    setActiveOption(null);
    setOptionInputText("");
  }, [activeOption, optionInputText, sendMessage, currentThreadId]);

  const handleOptionCancel = useCallback(() => {
    setActiveOption(null);
    setOptionInputText("");
  }, []);

  const handleProductFormSubmit = useCallback(() => {
    if (!activeForm) return;
    const lines: string[] = [];
    activeForm.fields.forEach((f) => {
      const val = (formValues[f.index] ?? "").trim();
      lines.push(`${f.index}. ${f.label}：${val || "（未填写）"}`);
    });
    const text = lines.join("\n");
    sendMessage(
      { text },
      {
        body: {
          threadId: currentThreadId,
          resourceId: "ximo-mall-user",
        },
      },
    );
    setActiveForm(null);
    setFormValues({});
  }, [activeForm, formValues, sendMessage, currentThreadId]);

  const handleProductFormCancel = useCallback(() => {
    setActiveForm(null);
    setFormValues({});
  }, []);

  const hasMessages = messages.length > 0;

  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages]);

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    setAttachedFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, label } : f)),
    );
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map((file, i) => ({
      file,
      label: attachedFiles.length + i === 0 ? "主图" : `第${attachedFiles.length + i + 1}张`,
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };

  // Cache messages per threadId so switching threads restores history in the same session
  const threadMessagesCacheRef = useRef<Map<string, typeof messages>>(new Map());

  const handleSelectThread = async (threadId: string) => {
    // Save current thread's messages before switching
    if (currentThreadId) {
      threadMessagesCacheRef.current.set(currentThreadId, messages);
      saveMessagesToCache(currentThreadId, messages);
    }
    // Restore from memory cache first, then localStorage, then server
    let cached = threadMessagesCacheRef.current.get(threadId);
    if (!cached) {
      const stored = loadMessagesFromCache(threadId);
      if (stored) {
        cached = stored;
        threadMessagesCacheRef.current.set(threadId, stored);
      }
    }
    if (!cached) {
      // Last resort: load from Mastra server storage
      cached = await fetchMessagesFromServer(threadId);
      if (cached) {
        threadMessagesCacheRef.current.set(threadId, cached);
        saveMessagesToCache(threadId, cached);
      }
    }
    setMessages(cached ?? []);
    setCurrentThreadId(threadId);
  };

  // Persist messages to localStorage whenever they change so history
  // survives page refresh / navigation away and back.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentThreadId && messages.length > 0) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveMessagesToCache(currentThreadId, messages);
      }, 1000);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // On unmount / before effect re-run, save immediately to prevent
      // data loss when navigating away within the debounce window.
      if (currentThreadId && messages.length > 0) {
        saveMessagesToCache(currentThreadId, messages);
      }
    };
  }, [messages, currentThreadId]);

  // Persist currentThreadId to localStorage so it survives refresh/navigation
  useEffect(() => {
    if (currentThreadId) {
      try {
        localStorage.setItem(THREAD_ID_CACHE_KEY, currentThreadId);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(THREAD_ID_CACHE_KEY);
      } catch {
        // ignore
      }
    }
  }, [currentThreadId]);

  // On mount: restore last active thread and its messages
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedThreadId = localStorage.getItem(THREAD_ID_CACHE_KEY);
    if (!savedThreadId) return;

    // Try localStorage first (instant)
    const cached = loadMessagesFromCache(savedThreadId);
    if (cached) {
      threadMessagesCacheRef.current.set(savedThreadId, cached);
      setMessages(cached);
      setCurrentThreadId(savedThreadId);
      return;
    }

    // Fall back to server if localStorage doesn't have messages
    fetchMessagesFromServer(savedThreadId).then((serverMsgs) => {
      if (serverMsgs) {
        threadMessagesCacheRef.current.set(savedThreadId, serverMsgs);
        saveMessagesToCache(savedThreadId, serverMsgs);
        setMessages(serverMsgs);
      }
      setCurrentThreadId(savedThreadId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewConversation = (threadId?: string | null) => {
    // Save current thread's messages
    if (currentThreadId) {
      threadMessagesCacheRef.current.set(currentThreadId, messages);
      saveMessagesToCache(currentThreadId, messages);
    }
    setCurrentThreadId(threadId || null);
    setMessages([]);
  };

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const _text = inputTextRef.current;
      if (!_text.trim() && attachedFiles.length === 0) return;

      // Optimistic: show user message immediately before async work
      const _optId = `opt_${Date.now()}`;
      const _optParts = [{ type: "text" as const, text: _text.trim() }];
      setMessages((prev: any[]) => [...prev, { id: _optId, role: "user" as const, parts: _optParts, createdAt: new Date() }]);

      // Auto-create thread if none exists
      let threadId = currentThreadId;
      if (!threadId) {
        const res = await fetch("/api/ai-agent/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `新对话 ${new Date().toLocaleString("zh-CN")}`,
          }),
        });
        const data = await res.json();
        if (data.success) {
          threadId = data.data.id;
          setCurrentThreadId(threadId);
          window.dispatchEvent(new CustomEvent("thread-created"));
        } else {
          console.error("Failed to create thread");
          return;
        }
      }

      const parts: string[] = [];
      if (platform) parts.push(`平台: ${platformLabels[platform]}`);
      if (style) {
        const label =
          styleLabels[style as keyof typeof styleLabels] ?? style;
        parts.push(`风格: ${label}`);
      }
      if (mode) {
        parts.push(`模式: ${mode === "auto" ? "自动模式" : "问答模式"}`);
      }
      if (platform || style) {
        parts.push(`主图: ${heroCount}张`);
        const sizeOpt = HERO_SIZE_OPTIONS.find(o => o.key === heroImageSize);
        if (heroImageSize === "auto") {
          parts.push(`主图尺寸: 智能比例（头图1:1 / 详情9:16）`);
        } else {
          parts.push(`主图尺寸: ${sizeOpt?.ratio ?? heroImageSize} (${sizeOpt?.label ?? heroImageSize})`);
        }
        parts.push(`详情: ${detailCount}张`);
      }
      if (webSearch) parts.push("联网搜索");

      const prefix = parts.length > 0 ? `[${parts.join(" | ")}]` : "";

      const extras: Record<string, string> = {};
      if (platform) extras.platform = platform;
      if (style) extras.style = style;
      if (mode) extras.mode = mode;
      if (platform || style) {
        extras.heroCount = String(heroCount);
        extras.detailCount = String(detailCount);
        // 智能比例不传 heroImageSize，让服务端使用默认尺寸（头图1:1，详情9:16）
        if (heroImageSize !== "auto") {
          extras.heroImageSize = heroImageSize;
        }
      }
      extras.webSearch = String(webSearch);

      const messageText = (prefix ? `${prefix} ${_text}` : _text);

      // Process attached images: extract base64 + label for each.
      // Image data flows through:
      // 1. body extras → requestContext → createProjectTool (for project creation)
      // 2. file parts with data URLs → model (for direct visual understanding)
      const dataUrls: Array<{ dataUrl: string; mimeType: string; fileName: string; label: string }> = [];
      if (attachedFiles.length > 0) {
        const imagesData: Array<{
          base64: string;
          fileName: string;
          mimeType: string;
          label: string;
        }> = [];

        for (const f of attachedFiles) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () =>
              reject(reader.error ?? new Error("无法读取文件"));
            reader.readAsDataURL(f.file);
          });
          const mimeType = f.file.type || "image/png";
          const base64Match = dataUrl.match(/^data:.+;base64,(.+)$/);
          imagesData.push({
            base64: base64Match?.[1] ?? dataUrl,
            fileName: f.file.name,
            mimeType,
            label: f.label,
          });
          dataUrls.push({ dataUrl, mimeType, fileName: f.file.name, label: f.label });
        }
        extras.images = JSON.stringify(imagesData);
      }

      const finalText =
        attachedFiles.length > 0
          ? `${messageText}\n[用户上传了图片: ${attachedFiles.map((f) => f.label || f.file.name).join(", ")}]`
          : messageText;

      // Build FileUIPart[] with data URLs so the server-side model can access
      // the image content. sendMessage({ text, files }) natively includes these
      // in the UI message parts (for rendering) and serializes them in the
      // request body (for server-side processing via experimental_attachments).
      const fileParts = dataUrls.map((d) => ({
        type: "file" as const,
        url: d.dataUrl,
        mediaType: d.mimeType,
        filename: d.fileName,
      }));

      // Remove optimistic message before SDK sends the real one
      setMessages((prev: any[]) => prev.filter((m: any) => m.id !== _optId));

      sendMessage(
        { text: finalText, files: fileParts.length > 0 ? fileParts : undefined },
        {
          body: {
            ...extras,
            threadId,
            resourceId: "ximo-mall-user",
          },
        },
      );
      inputTextRef.current = "";
      textareaHandleRef.current?.reset();
      setAttachedFiles([]);
    },
    [attachedFiles, platform, style, mode, heroCount, detailCount, heroImageSize, webSearch, sendMessage, currentThreadId, setCurrentThreadId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const toggleSelector = (
    selector: "platform" | "style" | "mode" | "count" | "size",
  ) => {
    setExpandedSelector((prev) => (prev === selector ? null : selector));
  };

  const isStreaming = status === "submitted" || status === "streaming";

  const platformLabel = platform ? platformLabels[platform] : "平台";
  const styleLabel = style
    ? (styleLabels[style as keyof typeof styleLabels] ?? style)
    : "风格";
  const modeLabel = mode
    ? mode === "auto"
      ? "自动模式"
      : "问答模式"
    : "模式";

  const selectorTrigger = (label: string, isSet: boolean) =>
    isSet
      ? label
      : `选择${label}`;

  const messageContext = useMemo(() => ({
    isStreaming,
    activeForm,
    activeOption,
    formValues,
    setActiveForm,
    setActiveOption,
    setFormValues,
    setOptionInputText,
    handleProductFormSubmit,
    handleProductFormCancel,
    handleOptionConfirm,
    handleOptionCancel,
  }), [isStreaming, activeForm, activeOption, formValues, handleProductFormSubmit, handleProductFormCancel, handleOptionConfirm, handleOptionCancel]);

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">
      {/* 左侧对话列表 */}
      <ConversationSidebar
        currentThreadId={currentThreadId}
        onSelectThread={handleSelectThread}
        onNewConversation={handleNewConversation}
        onDeleteThread={removeMessagesFromCache}
      />

      {/* 右侧对话区 */}
      <div className="flex flex-1 flex-col">
        {/* 消息区 或 空状态 */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          {!currentThreadId && !hasMessages ? (
            <div className="flex h-full items-center justify-center">
              <div className="mb-8 space-y-3 text-center">
                <h1 className="text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white md:text-5xl">
                  AI Agent
                </h1>
                <p className="mx-auto max-w-lg text-lg leading-8 text-slate-500 dark:text-slate-400">
                  上传产品图片，描述你的需求，AI 为你生成电商详情页
                </p>
              </div>
            </div>
          ) : (
            hasMessages && (
                <div className="mx-auto max-w-3xl space-y-6 py-4">
                  {messages.map((message, msgIdx) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      msgIdx={msgIdx}
                      totalMessages={messages.length}
                      context={messageContext}
                    />
                  ))}

                  {/* Thinking indicator: after last user message, before assistant arrives */}
                  {isStreaming &&
                    messages.length > 0 &&
                    messages[messages.length - 1].role === "user" && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/6">
                          <div className="flex items-center gap-2.5">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms] dark:bg-slate-500" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms] dark:bg-slate-500" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms] dark:bg-slate-500" />
                            </div>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              AI 正在思考...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  <div ref={messagesEndRef} />
                </div>
              ))}
            </div>

            <form
              onSubmit={handleFormSubmit}
              className={`w-full ${hasMessages ? "max-w-4xl" : "max-w-3xl"}`}
            >
              <div
                ref={selectorPanelRef}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/6"
              >
                {previewUrls.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-white/5">
                    {previewUrls.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="relative">
                          <img
                            src={p.url}
                            alt={`预览 ${idx + 1}`}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-700 dark:bg-white/20 dark:hover:bg-white/30"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {idx === 0 ? (
                          <span className="max-w-[120px] truncate text-xs text-slate-400 dark:text-slate-500">
                            主图
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={attachedFiles[idx]?.label ?? ""}
                            onChange={(e) => updateLabel(idx, e.target.value)}
                            placeholder={`第${idx + 1}张`}
                            className="w-20 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:placeholder:text-slate-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 px-4 py-3">
                  <input
                    id="ai-agent-file"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => addFiles(event.target.files)}
                    className="hidden"
                  />

                  <label
                    htmlFor="ai-agent-file"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/8 dark:hover:text-slate-300"
                  >
                    <Paperclip className="h-5 w-5" />
                  </label>

                  <ChatTextarea
                    ref={textareaHandleRef}
                    placeholder={
                      hasConfig
                        ? "输入你的需求，按 Enter 发送..."
                        : "自由聊天、讨论、设定 Agent 行为..."
                    }
                    disabled={isStreaming}
                    onEnterPress={handleKeyDown}
                    onTextChange={(val) => { inputTextRef.current = val; setHasInputText(val.trim().length > 0); }}
                  />

                  <Button
                    type="submit"
                    disabled={isStreaming || (!hasInputText && attachedFiles.length === 0)}
                    className="h-9 w-9 shrink-0 rounded-xl p-0"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

          {/* 选择器触发按钮行 */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2 dark:border-white/5">
            <button
              type="button"
              onClick={() => toggleSelector("platform")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                expandedSelector === "platform"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>{selectorTrigger(platformLabel, platform !== null)}</span>
              {expandedSelector === "platform" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleSelector("style")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                expandedSelector === "style"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>{selectorTrigger(styleLabel, style !== null)}</span>
              {expandedSelector === "style" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleSelector("mode")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                expandedSelector === "mode"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{selectorTrigger(modeLabel, mode !== null)}</span>
              {expandedSelector === "mode" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleSelector("count")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                expandedSelector === "count"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>主图{heroCount}/详情{detailCount}张</span>
              {expandedSelector === "count" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleSelector("size")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                expandedSelector === "size"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Ratio className="h-3.5 w-3.5" />
              <span>{heroImageSize === "auto" ? "智能比例" : `主图${HERO_SIZE_OPTIONS.find(o => o.key === heroImageSize)?.label ?? heroImageSize}`}</span>
              {expandedSelector === "size" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <label
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                webSearch
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>联网搜索</span>
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
                className="hidden"
              />
            </label>
          </div>

          {/* 展开的选择面板 */}
          {expandedSelector && (
            <div className="border-t border-slate-100 px-4 py-3 dark:border-white/5">
              {/* 平台选择器 */}
              {expandedSelector === "platform" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform(null);
                      setExpandedSelector(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      platform === null
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/12"
                    }`}
                  >
                    未设置
                  </button>
                  {PLATFORM_OPTIONS.map((key) => {
                    const isSelected = platform === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPlatform(key);
                          setExpandedSelector(null);
                        }}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                        }`}
                      >
                        {platformLabels[key]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 风格选择器 */}
              {expandedSelector === "style" && (
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setStyle(null);
                      setExpandedSelector(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      style === null
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/12"
                    }`}
                  >
                    未设置
                  </button>
                  {Object.entries(styleCategories).map(([category, keys]) => (
                    <div key={category}>
                      <p className="mb-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {category}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {keys.map((key) => {
                          const isSelected = style === key;
                          const label =
                            styleLabels[
                              key as keyof typeof styleLabels
                            ] ?? key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setStyle(key);
                                setExpandedSelector(null);
                              }}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                isSelected
                                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 模式选择器 */}
              {expandedSelector === "mode" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(null);
                      setExpandedSelector(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      mode === null
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/12"
                    }`}
                  >
                    未设置
                  </button>
                  {MODE_OPTIONS.map((opt) => {
                    const isSelected = mode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setMode(opt.key);
                          setExpandedSelector(null);
                        }}
                        className={`rounded-lg px-3 py-2 text-left transition ${
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                        }`}
                      >
                        <p className="text-xs font-medium">{opt.label}</p>
                        <p
                          className={`mt-0.5 text-[10px] ${isSelected ? "text-white/70 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"}`}
                        >
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 生成张数选择器 */}
              {expandedSelector === "count" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      主图张数
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setHeroCount((c) => Math.max(0, c - 1))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      >
                        -
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-900 dark:text-white">
                        {heroCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setHeroCount((c) => Math.min(9, c + 1))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      详情页张数
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDetailCount((c) => Math.max(0, c - 1))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      >
                        -
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-900 dark:text-white">
                        {detailCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailCount((c) => Math.min(12, c + 1))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 主图尺寸选择器 */}
              {expandedSelector === "size" && (
                <div className="flex flex-wrap gap-2">
                  {HERO_SIZE_OPTIONS.map((opt) => {
                    const isSelected = heroImageSize === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setHeroImageSize(opt.key);
                          setExpandedSelector(null);
                        }}
                        className={`rounded-lg px-3 py-2 text-left transition ${
                          isSelected
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                        }`}
                      >
                        <p className="text-xs font-medium">{opt.ratio}</p>
                        <p
                          className={`mt-0.5 text-[10px] ${isSelected ? "text-white/70 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"}`}
                        >
                          {opt.label}
                        </p>
                        {'desc' in opt && opt.desc && (
                          <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">{opt.desc}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

              <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                Enter 发送，Shift+Enter 换行
              </p>
            </form>
          </div>
        </div>
  );
}
