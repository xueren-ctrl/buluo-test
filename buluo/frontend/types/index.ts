/**
 * 升级项类型
 */
export interface UpgradeItem {
  id: number;
  category: string;
  item_name: string;
  item_level: number;
  finish_time: string;
  timer_seconds: number | null;
  notified: boolean;
  data_id?: number | null;
}

/**
 * 上传 JSON 响应
 */
export interface UploadResponse {
  success: boolean;
  user_id: number;
  village_id: number;
  upgrades: UpgradeItem[];
  idle_times: IdleTimes;
  player_info?: PlayerInfo | null;
  last_upload_at?: string | null;
  diff?: DataDiff | null;
}

/**
 * 升级列表响应
 */
export interface UpgradesListResponse {
  success: boolean;
  user_id: number;
  upgrades: UpgradeItem[];
  idle_times: IdleTimes;
  player_info?: PlayerInfo | null;
  last_upload_at?: string | null;
  stats?: DashboardStats;
}

/**
 * 手动刷新响应
 */
export interface ManualRefreshResponse {
  success: boolean;
  message: string;
  notified_count: number;
}

/**
 * 空闲时间信息
 */
export interface IdleTimes {
  builder_idle_at: string | null;
  lab_idle_at: string | null;
  builder_busy_count: number;
  lab_busy_count: number;
  builder_total?: number;
}

/**
 * 玩家信息
 */
export interface PlayerInfo {
  player_tag: string;
  player_name: string;
  town_hall_level: number;
  builder_count: number;
  active_upgrades: number;
  completed_count: number;
  last_upload_at?: string | null;
}

/**
 * Dashboard 统计
 */
export interface DashboardStats {
  total_upgrades: number;
  active_upgrades: number;
  completed_upgrades: number;
  notified_count: number;
}

/**
 * 数据 Diff
 */
export interface DataDiff {
  new_upgrades: string[];
  completed_upgrades: string[];
  removed_upgrades: string[];
}

/**
 * 分类中文映射
 */
export const CATEGORY_MAP: Record<string, string> = {
  buildings: "建筑",
  spells: "法术",
  heroes: "英雄",
  pets: "宠物",
  equipment: "装备",
  units: "兵种",
  helpers: "助力",
  buildings2: "建设者基地",
  heroes2: "建设者英雄",
  units2: "建设者兵种",
  siege_machines: "攻城机器",
  traps: "陷阱",
  traps2: "夜世界陷阱",
  decos: "装饰",
  decos2: "夜世界装饰",
  obstacles: "障碍物",
  obstacles2: "夜世界障碍",
};

/**
 * 分类图标映射 (emoji)
 */
export const CATEGORY_ICON: Record<string, string> = {
  buildings: "🏰",
  spells: "⚗️",
  heroes: "⚔️",
  pets: "🐾",
  equipment: "🛡️",
  units: "👾",
  helpers: "🤝",
  buildings2: "🌙",
  heroes2: "🦸",
  units2: "👹",
  siege_machines: "🏗️",
  traps: "💣",
  traps2: "💥",
  decos: "🎄",
  decos2: "🍃",
  obstacles: "🪨",
  obstacles2: "🪨",
};

/**
 * 分类颜色映射 (Tailwind classes for borders/gradients)
 * 每种类型有独特的色系
 */
export const CATEGORY_COLOR: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  buildings: {
    bg: "from-amber-900/20 to-amber-900/5",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300",
    icon: "text-amber-500",
  },
  spells: {
    bg: "from-indigo-900/20 to-indigo-900/5",
    border: "border-indigo-500/30",
    text: "text-indigo-400",
    badge: "bg-indigo-500/20 text-indigo-300",
    icon: "text-indigo-500",
  },
  heroes: {
    bg: "from-yellow-600/20 to-yellow-600/5",
    border: "border-yellow-500/40",
    text: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300",
    icon: "text-yellow-500",
  },
  pets: {
    bg: "from-emerald-900/20 to-emerald-900/5",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300",
    icon: "text-emerald-500",
  },
  equipment: {
    bg: "from-violet-900/20 to-violet-900/5",
    border: "border-violet-500/30",
    text: "text-violet-400",
    badge: "bg-violet-500/20 text-violet-300",
    icon: "text-violet-500",
  },
  units: {
    bg: "from-cyan-900/20 to-cyan-900/5",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300",
    icon: "text-cyan-500",
  },
  helpers: {
    bg: "from-rose-900/20 to-rose-900/5",
    border: "border-rose-500/30",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-300",
    icon: "text-rose-500",
  },
  buildings2: {
    bg: "from-slate-800/20 to-slate-800/5",
    border: "border-slate-500/30",
    text: "text-slate-400",
    badge: "bg-slate-500/20 text-slate-300",
    icon: "text-slate-500",
  },
  heroes2: {
    bg: "from-orange-900/20 to-orange-900/5",
    border: "border-orange-500/30",
    text: "text-orange-400",
    badge: "bg-orange-500/20 text-orange-300",
    icon: "text-orange-500",
  },
  units2: {
    bg: "from-teal-900/20 to-teal-900/5",
    border: "border-teal-500/30",
    text: "text-teal-400",
    badge: "bg-teal-500/20 text-teal-300",
    icon: "text-teal-500",
  },
  siege_machines: {
    bg: "from-zinc-800/20 to-zinc-800/5",
    border: "border-zinc-500/30",
    text: "text-zinc-400",
    badge: "bg-zinc-500/20 text-zinc-300",
    icon: "text-zinc-500",
  },
  traps: {
    bg: "from-red-900/20 to-red-900/5",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300",
    icon: "text-red-500",
  },
  traps2: {
    bg: "from-red-900/20 to-red-900/5",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300",
    icon: "text-red-500",
  },
};

/**
 * 默认颜色 (未知分类)
 */
export const DEFAULT_CATEGORY_COLOR = {
  bg: "from-gray-800/20 to-gray-800/5",
  border: "border-gray-500/30",
  text: "text-gray-400",
  badge: "bg-gray-500/20 text-gray-300",
  icon: "text-gray-500",
};

export function getCategoryStyles(category: string) {
  return CATEGORY_COLOR[category] || DEFAULT_CATEGORY_COLOR;
}

/**
 * 倒计时优先级 — 剩余时间越少的越醒目
 */
export function getUrgencyLevel(remainingSeconds: number): "urgent" | "soon" | "normal" | "long" | "done" {
  if (remainingSeconds <= 0) return "done";
  if (remainingSeconds <= 3600) return "urgent";     // 1小时内
  if (remainingSeconds <= 7200) return "soon";        // 2小时内
  if (remainingSeconds <= 86400) return "normal";     // 24小时内
  return "long";                                      // 超过24小时
}

/**
 *  urgency 级别对应的颜色类
 */
export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "urgent":  return "from-red-500/30 via-red-600/10 to-dark-850/80 border-red-500/50 animate-pulse-slow";
    case "soon":    return "from-amber-500/30 to-dark-850/80 border-amber-500/40";
    case "normal":  return "from-brand-600/20 to-dark-850/80 border-brand-500/30";
    case "long":    return "from-dark-800/30 to-dark-850/80 border-dark-600/40";
    default:        return "from-green-500/20 to-green-600/5 border-green-500/40";
  }
}
