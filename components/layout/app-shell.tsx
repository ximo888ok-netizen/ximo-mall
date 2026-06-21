import Link from "next/link";
import { BookOpen, Box, FolderKanban, GalleryVerticalEnd, History, Home, Images, Settings2, WandSparkles, Zap } from "lucide-react";

import { ApiUsageIndicator } from "@/components/layout/api-usage-indicator";
import { FloatingThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/ai-agent", label: "首页", icon: Home },
  { href: "/", label: "快速开始", icon: FolderKanban },
  { href: "/box-generator", label: "包装盒生成", icon: Box },
  { href: "/product-library", label: "产品知识库", icon: BookOpen },
  { href: "/image-tune", label: "图片微调", icon: WandSparkles },
  { href: "/library", label: "图片知识库", icon: Images },
  { href: "/history", label: "历史记录", icon: History },
  { href: "/projects/new", label: "高级创建", icon: GalleryVerticalEnd },
  { href: "/mcp", label: "MCP 工具", icon: Zap },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <div className="fixed bottom-4 left-4 z-[60]">
        <FloatingThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-5 md:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[2rem] border border-white/70 bg-white/76 p-5 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b0b0c]/88 dark:shadow-[0_24px_60px_-38px_rgba(0,0,0,0.72)] md:flex md:flex-col">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,245,0.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-black text-base font-semibold tracking-[-0.06em] text-white dark:border-white/10 dark:bg-white dark:text-black">
              M
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">ximo-mall</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI 电商详情页生成与编辑工作台</p>
            </div>
          </Link>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200",
                    "text-slate-600 hover:bg-white/85 hover:text-slate-950 hover:shadow-sm",
                    "dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto" />
        </aside>

        <main className="flex-1 rounded-[2rem] border border-white/80 bg-white/74 p-5 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f10]/82 dark:shadow-[0_24px_60px_-38px_rgba(0,0,0,0.78)] md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/monitor/usage"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 gap-2 rounded-2xl border-slate-200 bg-white px-3 shadow-sm hover:bg-white dark:border-white/10 dark:bg-black/30 dark:hover:border-white/20 dark:hover:bg-white/8",
              )}
            >
              <span className="text-sm font-medium">API 监控</span>
              <ApiUsageIndicator />
            </Link>
            <Link href="/settings/providers" className={cn(buttonVariants({ variant: "default" }))}>
              <Settings2 className="mr-2 h-4 w-4" />
              AI 配置
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
