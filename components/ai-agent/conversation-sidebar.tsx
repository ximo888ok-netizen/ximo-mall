"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThreadItem {
  id: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface ConversationSidebarProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewConversation: (threadId?: string | null) => void;
  onDeleteThread?: (threadId: string) => void;
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN");
}

export function ConversationSidebar({
  currentThreadId,
  onSelectThread,
  onNewConversation,
  onDeleteThread,
}: ConversationSidebarProps) {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-agent/threads");
      const data = await res.json();
      if (data.success) {
        setThreads(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    const handleRefresh = () => fetchThreads();
    window.addEventListener("thread-created", handleRefresh);
    return () => window.removeEventListener("thread-created", handleRefresh);
  }, [fetchThreads]);

  const handleCreateThread = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/ai-agent/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `新对话 ${new Date().toLocaleString("zh-CN")}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchThreads();
        onNewConversation(data.data.id);
      }
    } catch (error) {
      console.error("Failed to create thread:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteThread = async (
    e: React.MouseEvent,
    threadId: string
  ) => {
    e.stopPropagation();
    if (!confirm("确定删除这个对话吗？删除后无法恢复。")) return;

    try {
      await fetch("/api/ai-agent/threads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      await fetchThreads();

      // Clean up cached messages for deleted thread
      onDeleteThread?.(threadId);

      // If deleting current thread, clear selection
      if (threadId === currentThreadId) {
        onNewConversation(null);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <div className="flex w-64 flex-col rounded-2xl border border-slate-200 bg-white/74 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f10]/82">
      {/* Header with new conversation button */}
      <div className="border-b border-slate-100 p-4 dark:border-white/5">
        <Button
          onClick={handleCreateThread}
          disabled={creating}
          variant="default"
          className="w-full gap-2"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          新建对话
        </Button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : threads.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              暂无对话
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "group relative cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-200",
                  thread.id === currentThreadId
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "hover:bg-slate-100 dark:hover:bg-white/8"
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {thread.title || "未命名对话"}
                    </p>
                    {!!thread.metadata?.createdAt && (
                      <p
                        className={cn(
                          "mt-0.5 text-[10px]",
                          thread.id === currentThreadId
                            ? "text-white/60 dark:text-slate-500"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      >
                        {formatTimeAgo(thread.metadata.createdAt as string)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteThread(e, thread.id)}
                    className={cn(
                      "rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100",
                      thread.id === currentThreadId
                        ? "hover:bg-white/10"
                        : "hover:bg-slate-200 dark:hover:bg-white/10"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}