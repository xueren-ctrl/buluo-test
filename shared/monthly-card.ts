/**
 * 月卡剩余天数 — 存储与计算
 * ============================================================
 * 设计目标：
 *  - 月卡一次周期固定 30 天
 *  - 用户可以选择「开通日期」或「剩余天数」两种录入方式
 *  - 仅本地持久化，不依赖任何后端 / 服务器
 *  - 与现有 IndexedDB 完全隔离，使用 localStorage 独立 key，
 *    避免改动 DB_VERSION 触发 upgrade 风险（不影响任何现有功能）
 *
 * 数据结构：
 *  - activatedAt: 开通时间（ISO 字符串），月卡从这一刻起 30 天有效
 *  - expiredAt:   到期时间（ISO 字符串）= activatedAt + 30 天
 *  用户两种录入方式都会换算为 activatedAt 存储：
 *    1) 直接选开通日期 → activatedAt = 那一天 00:00:00
 *    2) 输入剩余天数   → activatedAt = 今天 00:00 - (30 - 剩余天数) 天
 */

export const MONTHLY_CARD_DURATION_DAYS = 30;
export const MONTHLY_CARD_STORAGE_KEY = "coc_monthly_card_v1";

export interface MonthlyCardRecord {
  activatedAt: string; // ISO 字符串
  expiredAt: string;   // ISO 字符串
  note?: string;       // 可选备注（保留扩展位，目前 UI 不强求）
}

// ── 工具：日期换算 ──────────────────────
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 给定开通日期 → 算出 activatedAt（取当天 00:00）和 expiredAt（+30 天）*/
export function fromActivationDate(dateStr: string): MonthlyCardRecord | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const activated = startOfDay(d);
  const expired = addDays(activated, MONTHLY_CARD_DURATION_DAYS);
  return {
    activatedAt: activated.toISOString(),
    expiredAt: expired.toISOString(),
  };
}

/** 给定剩余天数 → 反推 activatedAt（今天 00:00 减去已用天数）*/
export function fromRemainingDays(remainingDays: number): MonthlyCardRecord | null {
  if (remainingDays == null || isNaN(remainingDays)) return null;
  const r = Math.floor(remainingDays);
  // 限制在 [0, 30]
  if (r < 0 || r > MONTHLY_CARD_DURATION_DAYS) return null;
  const today = startOfDay(new Date());
  // 已用天数 = 30 - 剩余
  const used = MONTHLY_CARD_DURATION_DAYS - r;
  const activated = addDays(today, -used);
  const expired = addDays(activated, MONTHLY_CARD_DURATION_DAYS);
  return {
    activatedAt: activated.toISOString(),
    expiredAt: expired.toISOString(),
  };
}

// ── 实时剩余计算 ────────────────────────
export interface MonthlyCardStatus {
  totalDays: number;       // 总周期 = 30
  remainingDays: number;   // 剩整天数（向下取整，已过期为负数）
  remainingHours: number;  // 不足 1 天的小时部分
  expired: boolean;        // 是否已过期
  expiryTimestamp: number; // 到期 ms 时间戳
  activatedTimestamp: number;
}

export function getStatus(record: MonthlyCardRecord | null, now: number = Date.now()): MonthlyCardStatus | null {
  if (!record) return null;
  const expiry = new Date(record.expiredAt).getTime();
  const activated = new Date(record.activatedAt).getTime();
  const diffMs = expiry - now;
  const diffDays = diffMs / 86400000;
  const remainingDays = Math.floor(diffDays);
  const remainingHours = Math.floor((diffMs - remainingDays * 86400000) / 3600000);
  return {
    totalDays: MONTHLY_CARD_DURATION_DAYS,
    remainingDays,
    remainingHours: remainingDays < 0 ? 0 : remainingHours,
    expired: diffMs <= 0,
    expiryTimestamp: expiry,
    activatedTimestamp: activated,
  };
}

// ── 存储 CRUD ─────────────────────────
function safeLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* ignore */ }
  return null;
}

export function loadMonthlyCard(): MonthlyCardRecord | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(MONTHLY_CARD_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as MonthlyCardRecord;
    if (!obj || !obj.activatedAt || !obj.expiredAt) return null;
    // 校验时间合法性
    const a = new Date(obj.activatedAt).getTime();
    const e = new Date(obj.expiredAt).getTime();
    if (isNaN(a) || isNaN(e)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function saveMonthlyCard(record: MonthlyCardRecord | null): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    if (!record) {
      ls.removeItem(MONTHLY_CARD_STORAGE_KEY);
    } else {
      ls.setItem(MONTHLY_CARD_STORAGE_KEY, JSON.stringify(record));
    }
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function clearMonthlyCard(): void {
  saveMonthlyCard(null);
}

/** 格式化日期为 YYYY-MM-DD（本地时区） */
export function formatDateLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/** 取今天日期字符串 YYYY-MM-DD（用于 <input type="date"> 的默认值/最大值） */
export function todayDateStr(): string {
  return formatDateLocal(new Date().toISOString());
}
