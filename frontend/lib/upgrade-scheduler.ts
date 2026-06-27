/**
 * 升级调度系统（核心）
 * ============================================
 * 替代原 notification-system.ts 里简陋的单次 setTimeout。
 *
 * 支持的提醒层级：
 *  - pre_30m       提前 30 分钟
 *  - pre_10m       提前 10 分钟
 *  - complete      完成时
 *  - post_complete 完成后再次（默认关）
 *
 * 特性：
 *  - 单 setInterval (30s) tick 驱动，页面打开时可靠
 *  - 夜间免打扰（DND）：pre_* 在 DND 内静默跳过；complete/post 在 DND 内延迟到 DND 结束
 *  - 通知去重：notifyState store 持久化已发层级，重开/重传不重复
 *  - 批量完成：同一 tick 内多个 complete 合并为一条通知
 *  - catchUp：app 启动时立即跑一次 tick，补发漏掉的 complete/post
 */

import type { UpgradeItem } from "@/types";
import {
  notifyStateKey,
  isTierNotified,
  markTierNotified,
  loadSettings,
  saveSettings,
  type SchedulerSettings,
  type NotifyTier,
} from "@/lib/indexeddb";
import { sendBrowserNotification } from "@/lib/notification-system";
import { getItemNameById, ITEM_CATEGORY_LABELS } from "@/lib/coc-assets";

const TICK_MS = 30_000;

interface TierDef {
  tier: NotifyTier;
  offsetSec: number; // 相对 finish_time 的偏移（负=提前）
  label: string;
}

const TIER_DEFS: TierDef[] = [
  { tier: "pre_30m", offsetSec: -30 * 60, label: "即将完成" },
  { tier: "pre_10m", offsetSec: -10 * 60, label: "马上完成" },
  { tier: "complete", offsetSec: 0, label: "已完成" },
  { tier: "post_complete", offsetSec: 10 * 60, label: "已完成" },
];

const TIER_ENABLED_FIELD: Record<NotifyTier, keyof SchedulerSettings> = {
  pre_30m: "enablePre30m",
  pre_10m: "enablePre10m",
  complete: "enableComplete",
  post_complete: "enablePostComplete",
};

function isInDND(settings: SchedulerSettings, now: Date): boolean {
  if (!settings.dndEnabled) return false;
  const h = now.getHours();
  const s = settings.dndStart;
  const e = settings.dndEnd;
  // 跨天，如 22-8
  if (s > e) return h >= s || h < e;
  // 同天，如 1-5
  return h >= s && h < e;
}

function upgradeKey(u: UpgradeItem): string {
  return `${u.category}:${u.data_id ?? u.item_name}:${u.item_level}`;
}

function displayName(u: UpgradeItem): string {
  const info = getItemNameById(u.category, u.data_id);
  const name = info ? info.zh : u.item_name;
  return `${name} Lv${u.item_level}`;
}

export interface Scheduler {
  start: () => void;
  stop: () => void;
  reschedule: (upgrades: UpgradeItem[]) => void;
  catchUp: (upgrades: UpgradeItem[]) => Promise<void>;
  getSettings: () => SchedulerSettings;
  updateSettings: (patch: Partial<SchedulerSettings>) => Promise<void>;
}

export async function createScheduler(): Promise<Scheduler> {
  let settings = await loadSettings();
  let currentUpgrades: UpgradeItem[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  async function fireOne(u: UpgradeItem, tier: NotifyTier, label: string): Promise<void> {
    const name = displayName(u);
    const catLabel = ITEM_CATEGORY_LABELS[u.category] || u.category;
    const title =
      tier === "complete" ? "🏰 升级完成！" :
      tier === "post_complete" ? "🏰 升级已完成" :
      `⏰ ${label}：${name}`;
    const body =
      tier === "complete" || tier === "post_complete"
        ? `${catLabel} · ${name} 已升级完成，快上线验收！`
        : `${catLabel} · ${name} 将在${tier === "pre_30m" ? " 30 分钟" : " 10 分钟"}后完成`;
    sendBrowserNotification(title, body, { upgrade: upgradeKey(u), tier });
    const key = notifyStateKey(u.category, u.data_id ?? null, u.item_level, tier);
    await markTierNotified(key);
  }

  async function fireBatch(items: Array<{ u: UpgradeItem; tier: NotifyTier }>): Promise<void> {
    if (items.length === 1) {
      await fireOne(items[0].u, items[0].tier, "已完成");
      return;
    }
    const names = items.map((i) => displayName(i.u));
    const title = `🏰 ${items.length} 项升级完成！`;
    const body = names.slice(0, 5).join("、") + (names.length > 5 ? ` 等 ${names.length} 项` : "") + " 已完成，快上线验收！";
    sendBrowserNotification(title, body, { batch: items.length });
    for (const i of items) {
      const key = notifyStateKey(i.u.category, i.u.data_id ?? null, i.u.item_level, "complete");
      await markTierNotified(key);
    }
  }

  async function tick(): Promise<void> {
    if (currentUpgrades.length === 0) return;

    // 通知权限未授予：跳过整个 tick（不标记 markTierNotified，待授权后才能补发）
    // 否则会出现"调度器跑了一次但通知没发，后续授权了也不补发"的 bug
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const inDND = isInDND(settings, now);

    // 收集本 tick 应发的 complete 项（用于批量）
    const completeDue: Array<{ u: UpgradeItem; tier: NotifyTier }> = [];
    let firedAny = false;

    for (const u of currentUpgrades) {
      const finishMs = new Date(u.finish_time).getTime();

      for (const def of TIER_DEFS) {
        // 设置开关
        if (!settings[TIER_ENABLED_FIELD[def.tier]]) continue;

        const fireMs = finishMs + def.offsetSec * 1000;
        if (nowMs < fireMs) continue; // 还没到时间

        const key = notifyStateKey(u.category, u.data_id ?? null, u.item_level, def.tier);
        if (await isTierNotified(key)) continue; // 已发，去重

        // DND 处理
        if (inDND) {
          if (def.tier === "pre_30m" || def.tier === "pre_10m") {
            // 提前提醒落在 DND：静默跳过并标记（避免 DND 后补发无意义的"即将完成"）
            await markTierNotified(key);
            continue;
          }
          // complete / post_complete：延迟到 DND 结束后补发
          continue;
        }

        // 非批量或非 complete：直接发
        if (def.tier === "complete" && settings.enableBatch) {
          completeDue.push({ u, tier: def.tier });
        } else {
          await fireOne(u, def.tier, def.label);
          firedAny = true;
        }
      }
    }

    // 批量发 complete
    if (completeDue.length > 0) {
      await fireBatch(completeDue);
      firedAny = true;
    }

    if (firedAny) {
      settings.last_notify_at = new Date().toISOString();
      await saveSettings(settings);
    }
  }

  return {
    start() {
      if (timer) return;
      tick(); // 立即跑一次（含 catch-up 语义）
      timer = setInterval(() => { tick(); }, TICK_MS);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
    reschedule(upgrades: UpgradeItem[]) {
      currentUpgrades = upgrades;
    },
    async catchUp(upgrades: UpgradeItem[]) {
      currentUpgrades = upgrades;
      await tick();
    },
    getSettings() {
      return settings;
    },
    async updateSettings(patch: Partial<SchedulerSettings>) {
      settings = { ...settings, ...patch };
      await saveSettings(settings);
    },
  };
}
