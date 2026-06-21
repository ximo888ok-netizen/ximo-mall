"use client";

import React, { useState } from "react";
import { Brain, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";

export const TOOL_LABELS: Record<string, string> = {
  createProjectTool: "创建项目",
  planSectionsTool: "页面规划",
  generateHeroImageTool: "头图生成",
  generateDetailImageTool: "详情图生成",
  editImageTool: "图像编辑",
  webSearchTool: "联网搜索",
};

export const TOOL_STATE_LABELS: Record<string, string> = {
  "input-streaming": "准备中",
  "input-available": "执行中",
  "approval-requested": "等待确认",
  "approval-responded": "继续执行",
  "output-available": "已完成",
  "output-error": "出错",
  "output-denied": "已拒绝",
};

export function isToolRunning(state: string) {
  return state === "input-streaming" || state === "input-available";
}

export function getToolResultSummary(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const obj = output as Record<string, unknown>;
  if (obj.message && typeof obj.message === "string") return obj.message;
  if (obj.projectId) return `项目 ${String(obj.projectId).slice(0, 8)}`;
  // web search: summarize the generatedText
  if (typeof obj.generatedText === "string" && obj.generatedText) {
    const firstLine = obj.generatedText.split("\n")[0]?.replace(/^【\d+\.\S+】/, "").trim();
    return firstLine ? `搜索完成：${firstLine.slice(0, 60)}…` : "搜索完成，已提取 7 维度视觉洞察";
  }
  return "";
}

interface ChatMessageItemProps {
  message: any; // UIMessage from @ai-sdk/react
  msgIdx: number;
  totalMessages: number;
  context: {
    isStreaming: boolean;
    activeForm: any;
    activeOption: any;
    formValues: Record<number, string>;
    setActiveForm: (v: any) => void;
    setActiveOption: (v: any) => void;
    setFormValues: (v: any) => void;
    setOptionInputText: (v: string) => void;
    handleProductFormSubmit: () => void;
    handleProductFormCancel: () => void;
    handleOptionConfirm: () => void;
    handleOptionCancel: () => void;
  };
}

export const ChatMessageItem = React.memo(function ChatMessageItem({
  message,
  msgIdx,
  totalMessages,
  context,
}: ChatMessageItemProps) {
  const [optionInputText, setOptionInputText] = useState("");

  const isLastAssistant =
    message.role === "assistant" &&
    msgIdx === totalMessages - 1;
  const hasTextParts = message.parts?.some(
    (p: any) => p.type === "text",
  );

  // Pre-compute form detection at message level
  const allTextParts = (message.parts ?? []).filter(
    (p: any) => p.type === "text",
  );
  const allText = allTextParts
    .map((p: any) => p.text ?? "")
    .join("\n");
  const anyStreaming = allTextParts.some(
    (p: any) => p.state === "streaming",
  );
  const formFieldRE = /^(\d+)\.\s+([^：:\n]+)[：:]/gm;
  const formFieldMatches = [...allText.matchAll(formFieldRE)];
  const formFields =
    formFieldMatches.length >= 2 && !anyStreaming
      ? {
          fields: formFieldMatches.map((m) => ({
            index: Number(m[1]),
            label: m[2].trim(),
            optional: /可选/i.test(m[2]),
          })),
          leadingText: (() => {
            const idx = allText.indexOf(formFieldMatches[0][0]);
            return allText.slice(0, idx).trim();
          })(),
        }
      : null;

  // Pre-compute option detection at message level (Step 2+)
  const optionRE = /^[ \t]*(?:[-*]\s+)?\*{0,2}([A-E])[.)、:：\-\u2014]\s*\*{0,2}\s+(.+)$/gm;
  const optionMatches = [...allText.matchAll(optionRE)];
  const hasOptions = optionMatches.length >= 2 && !anyStreaming;
  const optionData = hasOptions
    ? {
        matches: optionMatches,
        leadingText: (() => {
          const idx = allText.indexOf(optionMatches[0][0]);
          return allText.slice(0, idx).trim();
        })(),
        options: optionMatches.map((m) => ({ letter: m[1], label: m[2] })),
      }
    : null;

  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          message.role === "user"
            ? "bg-slate-900 text-white dark:bg-white/12 dark:text-white"
            : "border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
        }`}
      >
        {formFields ? (
          (() => {
            const firstMatch = formFieldMatches[0][0];
            const formLeadingText = allText
              .slice(0, allText.indexOf(firstMatch))
              .trim();
            const isFormExpanded =
              context.activeForm?.messageId === message.id;

            return (
              <>
                {/* Form UI */}
                <div className="relative">
                  {formLeadingText ? (
                    <p className="mb-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {formLeadingText}
                    </p>
                  ) : null}

                  {isFormExpanded ? (
                    <div className="space-y-3">
                      {formFields.fields.map((f) => (
                        <div key={f.index}>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                            {f.index}. {f.label}
                            {f.optional && (
                              <span className="ml-1 text-[10px] font-normal text-slate-400">
                                （可选）
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={context.formValues[f.index] ?? ""}
                            onChange={(e) =>
                              context.setFormValues((prev: any) => ({ ...prev, [f.index]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                context.handleProductFormSubmit();
                              }
                            }}
                            placeholder={f.optional ? "选填" : "请输入..."}
                            autoFocus={f.index === formFields.fields[0].index}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:placeholder:text-slate-500"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={context.handleProductFormCancel} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-slate-400 dark:hover:bg-white/10">
                          跳过
                        </button>
                        <button type="button" onClick={context.handleProductFormSubmit} className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                          提交
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {formFields.fields.map((f) => (
                        <div key={f.index} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-200 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                            {f.index}
                          </span>
                          <span>{f.label}</span>
                          {f.optional && <span className="text-[10px] text-slate-400">可选</span>}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => context.setActiveForm({ messageId: message.id, fields: formFields.fields })}
                        disabled={context.isStreaming}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:opacity-50 dark:border-white/20 dark:bg-white/8 dark:text-slate-200 dark:hover:border-white dark:hover:bg-white/12"
                      >
                        填写产品信息
                      </button>
                    </div>
                  )}
                </div>

                {/* Render non-text parts (tools, files, reasoning) */}
                {message.parts!.map((part: any, i: number) => {
                  if (part.type === "text") return null;

                  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                    return (
                      <img key={`${message.id}-file-${i}`} src={part.url} alt="用户上传的图片" className="mt-2 max-h-64 rounded-lg object-contain" />
                    );
                  }

                  if (part.type === "reasoning") {
                    const isStreaming = part.state === "streaming";
                    return (
                      <div key={`${message.id}-reasoning-${i}`} className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                          <Brain className="h-3 w-3" /><span>{isStreaming ? "思考中" : "思考过程"}</span>
                          {isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                        </div>
                        <p className="max-h-60 overflow-y-auto text-xs leading-relaxed text-indigo-400/80 dark:text-indigo-300/60">{part.text}</p>
                      </div>
                    );
                  }

                  const isDynamicTool = part.type === "dynamic-tool";
                  const isStaticTool = typeof part.type === "string" && part.type.startsWith("tool-") && part.type !== "tool-invocation";
                  if (isDynamicTool || isStaticTool) {
                    const tp = part as any;
                    const toolName: string = isDynamicTool ? tp.toolName ?? "unknown" : part.type.replace(/^tool-/, "");
                    const toolLabel = TOOL_LABELS[toolName] ?? toolName;
                    const stateLabel = TOOL_STATE_LABELS[tp.state] ?? tp.state;
                    const running = isToolRunning(tp.state);
                    const outputObj: Record<string, unknown> | null = tp.state === "output-available" ? tp.output : null;
                    const isSuccess = outputObj?.success === true;
                    const resultSummary = getToolResultSummary(tp.output);

                    return (
                      <div key={`${message.id}-tool-${i}`} className={`my-2 rounded-xl border p-3 transition-colors ${
                        running ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
                        : isSuccess ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        : tp.state === "output-error" || tp.state === "output-denied" ? "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"
                        : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/4"
                      }`}>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                          : isSuccess ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : tp.state === "output-error" || tp.state === "output-denied" ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                          : <Wrench className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />}
                          <span className={running ? "text-amber-600 dark:text-amber-400" : isSuccess ? "text-emerald-600 dark:text-emerald-400" : tp.state === "output-error" || tp.state === "output-denied" ? "text-red-500" : "text-slate-500 dark:text-slate-400"}>{toolLabel}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{stateLabel}</span>
                        </div>
                        {!!isSuccess && !!resultSummary && <p className="mt-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{resultSummary}</p>}
                        {!!isSuccess && typeof outputObj?.generatedText === "string" && outputObj.generatedText.length > 0 && (
                          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/4">
                            <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">{String(outputObj.generatedText)}</p>
                          </div>
                        )}
                        {!!isSuccess && !!outputObj?.imageUrl && (
                          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                            <img src={String(outputObj.imageUrl)} alt={typeof outputObj.imageAssetId === "string" ? `生成图片 ${outputObj.imageAssetId.slice(0, 8)}` : "生成图片"} className="w-full object-cover" loading="lazy" />
                          </div>
                        )}
                        {!!outputObj && !isSuccess && !!outputObj.error && <p className="mt-1.5 text-[11px] text-red-500">{String(outputObj.error)}</p>}
                        {tp.state === "output-error" && !!tp.errorText && <p className="mt-1.5 text-[11px] text-red-500">{tp.errorText}</p>}
                      </div>
                    );
                  }

                  return null;
                })}
              </>
            );
          })()
        ) : (
          <>
            {message.parts?.map((part: any, i: number) => {
              /* ---- Text ---- */
              if (part.type === "text") {
                // Use pre-computed optionData from message level
                if (optionData) {
                  const firstTextIdx = message.parts!.findIndex(
                    (p: any) => p.type === "text",
                  );
                  if (i !== firstTextIdx) return null;

                  const optionMatches = optionData.matches;
                  const options = optionData.options;
                  const leadingText = optionData.leadingText;

                  const isExpanded =
                    context.activeOption?.messageId === message.id &&
                    context.activeOption?.leafLetter ===
                      optionMatches[0]?.[1];

                  const handleOptionClick = (letter: string) => {
                    context.setActiveOption({
                      messageId: message.id,
                      leafLetter: optionMatches[0]?.[1] ?? letter,
                      selectedLetter: letter,
                      selectedLabel:
                        options.find((o) => o.letter === letter)
                          ?.label ?? "",
                    });
                    setOptionInputText("");
                    context.setOptionInputText("");
                  };

                  return (
                    <div
                      key={`${message.id}-text-${i}`}
                      className="relative"
                    >
                      {leadingText && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {leadingText}
                        </p>
                      )}

                      {isExpanded ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-50 px-3 py-2 dark:border-white dark:bg-white/8">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                              {context.activeOption?.selectedLetter}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {context.activeOption?.selectedLabel}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={optionInputText}
                            onChange={(e) => {
                              setOptionInputText(e.target.value);
                              context.setOptionInputText(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey
                              ) {
                                e.preventDefault();
                                context.handleOptionConfirm();
                              }
                            }}
                            placeholder="输入补充说明（可选）…"
                            autoFocus
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:placeholder:text-slate-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={context.handleOptionCancel}
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-slate-400 dark:hover:bg-white/10"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={context.handleOptionConfirm}
                              className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                            >
                              确定
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {options.map((opt) => (
                            <button
                              key={opt.letter}
                              type="button"
                              onClick={() =>
                                handleOptionClick(opt.letter)
                              }
                              disabled={context.isStreaming}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:opacity-50 dark:border-white/20 dark:bg-white/8 dark:text-slate-200 dark:hover:border-white dark:hover:bg-white/12"
                            >
                              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                                {opt.letter}
                              </span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={`${message.id}-text-${i}`}
                    className="relative"
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {part.text}
                      {isLastAssistant &&
                        part.state === "streaming" && (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-slate-400 align-text-bottom dark:bg-slate-500" />
                        )}
                    </p>
                  </div>
                );
              }

              /* ---- Image file (user upload) ---- */
              if (
                part.type === "file" &&
                part.mediaType?.startsWith("image/")
              ) {
                return (
                  <img
                    key={`${message.id}-file-${i}`}
                    src={part.url}
                    alt="用户上传的图片"
                    className="mt-2 max-h-64 rounded-lg object-contain"
                  />
                );
              }

              /* ---- Reasoning / thinking ---- */
              if (part.type === "reasoning") {
                const isStreaming = part.state === "streaming";
                return (
                  <div
                    key={`${message.id}-reasoning-${i}`}
                    className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 dark:border-indigo-500/20 dark:bg-indigo-500/5"
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                      <Brain className="h-3 w-3" />
                      <span>{isStreaming ? "思考中" : "思考过程"}</span>
                      {isStreaming && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      )}
                    </div>
                    <p className="max-h-60 overflow-y-auto text-xs leading-relaxed text-indigo-400/80 dark:text-indigo-300/60">
                      {part.text}
                    </p>
                  </div>
                );
              }

              /* ---- Tool call (dynamic-tool or tool-*) ---- */
              const isDynamicTool = part.type === "dynamic-tool";
              const isStaticTool =
                typeof part.type === "string" &&
                part.type.startsWith("tool-") &&
                part.type !== "tool-invocation";
              if (isDynamicTool || isStaticTool) {
                const tp = part as any;
                const toolName: string = isDynamicTool
                  ? tp.toolName ?? "unknown"
                  : part.type.replace(/^tool-/, "");
                const label =
                  TOOL_LABELS[toolName] ?? toolName;
                const stateLabel =
                  TOOL_STATE_LABELS[tp.state] ?? tp.state;
                const running = isToolRunning(tp.state);
                const outputObj: Record<string, unknown> | null =
                  tp.state === "output-available"
                    ? tp.output
                    : null;
                const isSuccess =
                  outputObj?.success === true;
                const resultSummary =
                  getToolResultSummary(tp.output);

                return (
                  <div
                    key={`${message.id}-tool-${i}`}
                    className={`my-2 rounded-xl border p-3 transition-colors ${
                      running
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
                        : isSuccess
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                          : tp.state === "output-error" ||
                              tp.state === "output-denied"
                            ? "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"
                            : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/4"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium">
                      {running ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : tp.state === "output-error" ||
                        tp.state === "output-denied" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      )}
                      <span
                        className={
                          running
                            ? "text-amber-600 dark:text-amber-400"
                            : isSuccess
                              ? "text-emerald-600 dark:text-emerald-400"
                              : tp.state === "output-error" ||
                                  tp.state === "output-denied"
                                ? "text-red-500"
                                : "text-slate-500 dark:text-slate-400"
                        }
                      >
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {stateLabel}
                      </span>
                    </div>

                    {!!isSuccess && !!resultSummary && (
                      <p className="mt-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {resultSummary}
                      </p>
                    )}
                    {!!isSuccess &&
                      typeof outputObj?.generatedText === "string" &&
                      outputObj.generatedText.length > 0 && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/4">
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                            {String(outputObj.generatedText)}
                          </p>
                        </div>
                      )}
                    {!!isSuccess && !!outputObj?.imageUrl && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                        <img
                          src={String(outputObj.imageUrl)}
                          alt={
                            typeof outputObj.imageAssetId === "string"
                              ? `生成图片 ${outputObj.imageAssetId.slice(0, 8)}`
                              : "生成图片"
                          }
                          className="w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {!!outputObj && !isSuccess && !!outputObj.error && (
                      <p className="mt-1.5 text-[11px] text-red-500">
                        {String(outputObj.error)}
                      </p>
                    )}
                    {tp.state === "output-error" &&
                      !!tp.errorText && (
                        <p className="mt-1.5 text-[11px] text-red-500">
                          {tp.errorText}
                        </p>
                      )}
                  </div>
                );
              }

              return null;
            })}
          </>
        )}

        {/* Assistant thinking — no parts yet */}
        {message.role === "assistant" &&
          (!message.parts || message.parts.length === 0) &&
          context.isStreaming && (
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms] dark:bg-slate-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms] dark:bg-slate-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms] dark:bg-slate-500" />
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                思考中...
              </span>
            </div>
          )}

        {/* Waiting for more after existing text — subtle cursor */}
        {message.role === "assistant" &&
          context.isStreaming &&
          !!hasTextParts &&
          message.parts?.every(
            (p: any) =>
              p.type !== "text" ||
              p.state === "done",
          ) === false &&
          null}
      </div>
    </div>
  );
});
