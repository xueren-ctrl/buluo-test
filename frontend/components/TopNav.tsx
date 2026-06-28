/**
 * 顶部导航栏 — 多页面切换
 * 主要在 /history 和 /settings 页面顶部展示返回按钮
 * 同时保留主题切换
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav({
  title,
  backHref = "/",
  showHome = true,
}: {
  title: string;
  backHref?: string;
  showHome?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-page)]/85 border-b border-[var(--divider)]">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push(backHref)}
            className="coc-btn-secondary !px-3 !py-1.5 text-sm flex items-center gap-1"
            aria-label="返回"
          >
            <span>←</span>
            <span className="hidden sm:inline">返回</span>
          </button>
          <h1 className="text-base font-bold text-main truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {showHome && (
            <Link
              href="/"
              className="coc-btn-secondary !px-3 !py-1.5 text-xs"
              aria-label="首页"
            >
              🏠 <span className="hidden sm:inline">首页</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export default TopNav;
