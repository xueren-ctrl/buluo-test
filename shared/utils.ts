/**
 * 工具函数 — 倒计时 / 时间格式化 / 数据过期检测 / 中文映射
 */

import { getItemNameById, ITEM_CATEGORY_LABELS, ITEM_MAP } from "./coc-assets";
import { getUpgradeDisplay } from "./coc-assets";

// ── 格式化剩余秒数为可读字符串 ──────────────
/**
 * 289397 -> "3天 7小时 23分"
 */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "已完成";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (secs > 0 && days === 0 && hours === 0) parts.push(`${secs}秒`);

  return parts.length > 0 ? parts.join(" ") : "即将完成";
}

/**
 * 格式化剩余秒数为紧凑时间字符串（精确到秒，确保动态可见）
 * 3661   -> "1时1分1秒"
 * 86461  -> "1天0时1分1秒"
 * 75     -> "1分15秒"
 */
export function formatCompactRemaining(seconds: number): string {
  if (seconds <= 0) return "已完成";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // 所有情况都显示秒，确保精确到秒动态更新
  if (days > 0) return `${days}天${hours}时${minutes}分${secs}秒`;
  if (hours > 0) return `${hours}时${minutes}分${secs}秒`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}

/**
 * 格式化 ISO 时间为本地可读格式
 */
export function formatFinishTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * 计算距离完成时间的剩余秒数
 */
export function getRemainingSeconds(finishTime: string): number {
  const finish = new Date(finishTime).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((finish - now) / 1000));
}

/**
 * 判断是否已过期
 */
export function isExpired(finishTime: string): boolean {
  return new Date(finishTime).getTime() <= Date.now();
}

/**
 * 判断数据是否过期 (超过 24 小时)
 */
export function isDataStale(lastUploadAt: string | null | undefined): boolean {
  if (!lastUploadAt) return false;
  const last = new Date(lastUploadAt).getTime();
  const now = Date.now();
  return (now - last) > 24 * 60 * 60 * 1000;
}

/**
 * 获取数据过期提醒文案
 */
export function getStaleMessage(lastUploadAt: string | null | undefined): string {
  if (!lastUploadAt) return "";
  const last = new Date(lastUploadAt).getTime();
  const now = Date.now();
  const diffHours = (now - last) / (60 * 60 * 1000);

  if (diffHours < 1) return `数据更新于 ${Math.floor(diffHours * 60)} 分钟前，请确认是否与当前游戏状态一致`;
  if (diffHours < 24) return `数据更新于 ${Math.floor(diffHours)} 小时前，请确认是否与当前游戏状态一致`;
  return `数据已过期 ${Math.floor(diffHours / 24)} 天，建议重新上传最新 JSON`;
}

/**
 * 根据剩余时间获取进度条百分比
 */
export function getProgressBarPercent(finishTime: string, timerSeconds: number | null): number {
  const remaining = getRemainingSeconds(finishTime);
  if (!timerSeconds || timerSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, ((timerSeconds - remaining) / timerSeconds) * 100));
}

// ── 中文名称映射 ────────────────────────────

/**
 * 根据 category + data_id 获取完整的中文显示名
 * 例: "宠物小屋 Lv2"
 */
export function getZhName(category: string, dataId: number | null, level: number): string {
  if (dataId != null) {
    const info = getItemNameById(category, dataId);
    if (info) return `${info.zh} Lv${level}`;
  }

  const catLabel = ITEM_CATEGORY_LABELS[category] || category;
  return `${catLabel} Lv${level}`;
}

/**
 * 根据 category + data_id 获取分类图标 emoji
 */
export function getCategoryIcon(category: string, dataId: number | null): string {
  if (dataId != null) {
    const info = ITEM_MAP[dataId];
    if (info) return info.icon;
  }

  const fallback: Record<string, string> = {
    buildings: "🏰", spells: "⚗️", heroes: "⚔️", pets: "🐾",
    equipment: "🛡️", units: "👾", helpers: "🤝", buildings2: "🌙",
    heroes2: "🦸", units2: "👹", siege_machines: "🏗️", traps: "💣",
  };

  return fallback[category] || "📦";
}

/**
 * 根据 category 获取背景渐变色
 */
export function getCategoryBg(category: string): string {
  const fallbacks: Record<string, string> = {
    buildings: "from-amber-900/20 to-amber-900/5",
    spells: "from-indigo-900/20 to-indigo-900/5",
    heroes: "from-yellow-600/20 to-yellow-600/5",
    pets: "from-emerald-900/20 to-emerald-900/5",
    equipment: "from-violet-900/20 to-violet-900/5",
  };
  return fallbacks[category] || "from-gray-800/20 to-gray-800/5";
}

/**
 * 根据 category 获取边框色
 */
export function getCategoryBorder(category: string): string {
  const fallbacks: Record<string, string> = {
    buildings: "border-amber-500/30",
    spells: "border-indigo-500/30",
    heroes: "border-yellow-500/40",
    pets: "border-emerald-500/30",
    equipment: "border-violet-500/30",
  };
  return fallbacks[category] || "border-gray-500/30";
}

/**
 * 根据 category 获取文字色
 */
export function getCategoryText(color: string): string {
  const fallbacks: Record<string, string> = {
    buildings: "text-amber-400",
    spells: "text-indigo-400",
    heroes: "text-yellow-400",
    pets: "text-emerald-400",
    equipment: "text-violet-400",
  };
  return fallbacks[color] || "text-gray-400";
}

/**
 * 根据 category 获取角标色
 */
export function getCategoryBadge(color: string): string {
  const fallbacks: Record<string, string> = {
    buildings: "bg-amber-500/20 text-amber-300",
    spells: "bg-indigo-500/20 text-indigo-300",
    heroes: "bg-yellow-500/20 text-yellow-300",
    pets: "bg-emerald-500/20 text-emerald-300",
    equipment: "bg-violet-500/20 text-violet-300",
  };
  return fallbacks[color] || "bg-gray-500/20 text-gray-300";
}
