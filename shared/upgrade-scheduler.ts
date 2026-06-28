/**
 * 升级调度系统（Capacitor 本地通知版）
 * ============================================
 * 双重保险：
 *  1. 未来通知：每次 upgrades 变化时调用 LocalNotifications.schedule
 *     把所有未到期的通知点（pre_30m / pre_10m / complete / post_complete）
 *     注册到 Android AlarmManager —— 即使 APP 关闭、锁屏、返回桌面，
 *     通知仍由系统按时触发。
 *  2. Catch-up tick：APP 打开时立即跑一次 tick，补发漏掉的 complete /
 *     post_complete（防止 LocalNotifications 因权限/电池优化未触发）。
 *
 * 支持的提醒层级：
 *  - pre_30m       提前 30 分钟
 *  - pre_10m       提前 10 分钟
 *  - complete      完成时
 *  - post_complete 完成后 10 分钟再次（默认关）
 *
 * 通知去重：
 *  - 调度未来通知时通过 extra 携带 notifyStateKey
 *  - 监听 LocalNotifications 触发事件，触发后自动 markTierNotified
 *  - tick 内同样检查 isTierNotified，避免重复
 */

import type { UpgradeItem } from "./types";
import {
  notifyStateKey,
  isTierNotified,
  markTierNotified,
  loadSettings,
  saveSettings,
  type SchedulerSettings,
  type NotifyTier,
} from "./indexeddb";
import {
  sendBrowserNotification,
  scheduleLocalNotifications,
  cancelAllScheduledNotifications,
  notifIdFromKey,
  CHANNELS,
  type ChannelId,
  type ScheduleInput,
} from "./notification-system";
import { getItemNameById, ITEM_CATEGORY_LABELS } from "./coc-assets";

const TICK_MS = 30_000;
// 仅调度未来 30 天内的通知（避免一次性调度过多，AlarmManager 容量有限）
const SCHEDULE_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

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
  if (s > e) return h >= s || h < e;
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

// 根据分类推断通道（实验室升级走 LAB_COMPLETE，工人相关走 BUILDER_IDLE）
function channelForCategory(category: string): ChannelId {
  const labCategories = ["troop", "spell", "siege"];
  if (labCategories.includes(category)) return CHANNELS.LAB_COMPLETE;
  return CHANNELS.UPGRADE_COMPLETE;
}

export interface Scheduler {
  start: () => void;
  stop: () => void;
  reschedule: (upgrades: UpgradeItem[]) => void;
  catchUp: (upgrades: UpgradeItem[]) => Promise<void>;
  getSettings: () => SchedulerSettings;
  updateSettings: (patch: Partial<SchedulerSettings>) => Promise<void>;
  rescheduleFuture: (upgrades: UpgradeItem[]) => Promise<void>;
  /** v1.1：设置账号标签前缀（用于通知标题）*/
  setAccountLabel: (label: string) => Promise<void>;
}

export async function createScheduler(): Promise<Scheduler> {
  let settings = await loadSettings();
  let currentUpgrades: UpgradeItem[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  // v1.1：账号标签，用于在通知标题前加【主号】/【小号】前缀
  let accountLabel = "";

  async function fireOne(u: UpgradeItem, tier: NotifyTier, label: string): Promise<void> {
    const name = displayName(u);
    const catLabel = ITEM_CATEGORY_LABELS[u.category] || u.category;
    const prefix = accountLabel ? `${accountLabel} ` : "";
    const title =
      tier === "complete" ? `${prefix}🏰 升级完成！` :
      tier === "post_complete" ? `${prefix}🏰 升级已完成` :
      `${prefix}⏰ ${label}：${name}`;
    const body =
      tier === "complete" || tier === "post_complete"
        ? `${catLabel} · ${name} 已升级完成，快上线验收！`
        : `${catLabel} · ${name} 将在${tier === "pre_30m" ? " 30 分钟" : " 10 分钟"}后完成`;
    sendBrowserNotification(title, body, {
      upgrade: upgradeKey(u),
      tier,
      channelId: channelForCategory(u.category),
      tag: `${upgradeKey(u)}:${tier}`,
    });
    const key = notifyStateKey(u.category, u.data_id ?? null, u.item_level, tier);
    await markTierNotified(key);
  }

  async function fireBatch(items: Array<{ u: UpgradeItem; tier: NotifyTier }>): Promise<void> {
    if (items.length === 1) {
      await fireOne(items[0].u, items[0].tier, "已完成");
      return;
    }
    const names = items.map((i) => displayName(i.u));
    const prefix = accountLabel ? `${accountLabel} ` : "";
    const title = `${prefix}🏰 ${items.length} 项升级完成！`;
    const body = names.slice(0, 5).join("、") + (names.length > 5 ? ` 等 ${names.length} 项` : "") + " 已完成，快上线验收！";
    sendBrowserNotification(title, body, {
      batch: items.length,
      channelId: CHANNELS.UPGRADE_COMPLETE,
      tag: `batch:${items.map((i) => upgradeKey(i.u)).join(",")}`,
    });
    for (const i of items) {
      const key = notifyStateKey(i.u.category, i.u.data_id ?? null, i.u.item_level, "complete");
      await markTierNotified(key);
    }
  }

  // catch-up tick：立即发已过期但未通知的项（保险）
  async function tick(): Promise<void> {
    if (currentUpgrades.length === 0) return;
    const now = new Date();
    const nowMs = now.getTime();
    const inDND = isInDND(settings, now);

    const completeDue: Array<{ u: UpgradeItem; tier: NotifyTier }> = [];
    let firedAny = false;

    for (const u of currentUpgrades) {
      const finishMs = new Date(u.finish_time).getTime();
      const alreadyComplete = nowMs >= finishMs;

      for (const def of TIER_DEFS) {
        if (!settings[TIER_ENABLED_FIELD[def.tier]]) continue;

        if (alreadyComplete && (def.tier === "pre_30m" || def.tier === "pre_10m")) {
          const key = notifyStateKey(u.category, u.data_id ?? null, u.item_level, def.tier);
          if (!await isTierNotified(key)) {
            await markTierNotified(key);
          }
          continue;
        }

        const fireMs = finishMs + def.offsetSec * 1000;
        if (nowMs < fireMs) continue;

        const key = notifyStateKey(u.category, u.data_id ?? null, u.item_level, def.tier);
        if (await isTierNotified(key)) continue;

        if (inDND) {
          if (def.tier === "pre_30m" || def.tier === "pre_10m") {
            await markTierNotified(key);
            continue;
          }
          continue;
        }

        if (def.tier === "complete" && settings.enableBatch) {
          completeDue.push({ u, tier: def.tier });
        } else {
          await fireOne(u, def.tier, def.label);
          firedAny = true;
        }
      }
    }

    if (completeDue.length > 0) {
      await fireBatch(completeDue);
      firedAny = true;
    }

    if (firedAny) {
      settings.last_notify_at = new Date().toISOString();
      await saveSettings(settings);
    }
  }

  // 调度所有未来通知点（核心：APP 关闭时仍能触发）
  async function rescheduleFuture(upgrades: UpgradeItem[]): Promise<void> {
    if (currentUpgrades.length === 0 && upgrades.length === 0) return;
    currentUpgrades = upgrades;

    // 先取消所有待发通知，避免重复
    await cancelAllScheduledNotifications();

    const nowMs = Date.now();
    const scheduleList: ScheduleInput[] = [];

    for (const u of upgrades) {
      const finishMs = new Date(u.finish_time).getTime();
      if (Number.isNaN(finishMs)) continue;

      for (const def of TIER_DEFS) {
        if (!settings[TIER_ENABLED_FIELD[def.tier]]) continue;

        const fireMs = finishMs + def.offsetSec * 1000;

        // 已过期的：交给 catch-up tick，不调度到 LocalNotifications
        if (fireMs <= nowMs) continue;

        // 超出调度窗口的：跳过（避免 AlarmManager 队列爆炸）
        if (fireMs - nowMs > SCHEDULE_HORIZON_MS) continue;

        const name = displayName(u);
        const catLabel = ITEM_CATEGORY_LABELS[u.category] || u.category;
        const prefix = accountLabel ? `${accountLabel} ` : "";
        const title =
          def.tier === "complete" ? `${prefix}🏰 升级完成！` :
          def.tier === "post_complete" ? `${prefix}🏰 升级已完成` :
          `${prefix}⏰ ${def.label}：${name}`;
        const body =
          def.tier === "complete" || def.tier === "post_complete"
            ? `${catLabel} · ${name} 已升级完成，快上线验收！`
            : `${catLabel} · ${name} 将在${def.tier === "pre_30m" ? " 30 分钟" : " 10 分钟"}后完成`;

        const notifyKey = notifyStateKey(u.category, u.data_id ?? null, u.item_level, def.tier);
        const tag = `${upgradeKey(u)}:${def.tier}`;
        const id = notifIdFromKey(tag);

        scheduleList.push({
          id,
          at: new Date(fireMs),
          title,
          body,
          channelId: channelForCategory(u.category),
          data: {
            upgrade: upgradeKey(u),
            tier: def.tier,
            notifyKey,
            tag,
            channelId: channelForCategory(u.category),
          },
        });
      }
    }

    if (scheduleList.length > 0) {
      await scheduleLocalNotifications(scheduleList);
    }
  }

  return {
    start() {
      if (timer) return;
      tick();
      timer = setInterval(() => { tick(); }, TICK_MS);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
    reschedule(upgrades: UpgradeItem[]) {
      currentUpgrades = upgrades;
      // 异步调度未来通知（不阻塞 UI）
      rescheduleFuture(upgrades).catch(() => {});
    },
    async catchUp(upgrades: UpgradeItem[]) {
      currentUpgrades = upgrades;
      await tick();
      // 重新调度未来通知（同步 LocalNotifications 队列）
      await rescheduleFuture(upgrades);
    },
    getSettings() {
      return settings;
    },
    async updateSettings(patch: Partial<SchedulerSettings>) {
      settings = { ...settings, ...patch };
      await saveSettings(settings);
      // 设置变化时重新调度（比如开关 pre_30m）
      if (currentUpgrades.length > 0) {
        await rescheduleFuture(currentUpgrades);
      }
    },
    async rescheduleFuture(upgrades: UpgradeItem[]) {
      await rescheduleFuture(upgrades);
    },
    async setAccountLabel(label: string) {
      accountLabel = label;
      // 切换账号后重新调度未来通知（标题前缀已变）
      if (currentUpgrades.length > 0) {
        await rescheduleFuture(currentUpgrades);
      }
    },
  };
}
