"use client";

import Image from "next/image";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const viewLabels: Record<string, string> = {
  front: "正面",
  back: "背面",
  side: "侧面",
  top: "顶面",
  bottom: "底面",
  perspective: "立体透视",
};

interface ResultViewerProps {
  results: Record<string, { base64Data: string; usedModel: string }>;
  activeView: string;
  onViewChange: (view: string) => void;
  onDownload: (view: string) => void;
}

export function ResultViewer({ results, activeView, onViewChange, onDownload }: ResultViewerProps) {
  const viewKeys = Object.keys(results);
  const currentResult = results[activeView];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {viewKeys.map((key) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
              activeView === key
                ? "bg-violet-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/12",
            )}
          >
            {viewLabels[key] ?? key}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        {currentResult ? (
          <div className="space-y-4 p-4">
            <div className="relative flex items-center justify-center rounded-xl bg-slate-50 p-4 dark:bg-white/[0.02]">
              <Image
                src={`data:image/png;base64,${currentResult.base64Data}`}
                alt={viewLabels[activeView] ?? activeView}
                width={600}
                height={600}
                className="max-h-[480px] w-auto rounded-lg object-contain"
                unoptimized
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                生成模型：{currentResult.usedModel}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl text-xs"
                onClick={() => onDownload(activeView)}
              >
                <Download className="h-3.5 w-3.5" />
                下载此视图
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">该视图暂无结果</p>
          </div>
        )}
      </div>
    </div>
  );
}
