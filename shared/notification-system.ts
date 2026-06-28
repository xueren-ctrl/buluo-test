/**
 * 通知管理系统（Capacitor 本地通知版）
 * ============================================
 * 完全脱离 Web Notification API / Service Worker / Push API，
 * 改用 @capacitor/local-notifications 在 Android 系统层调度通知：
 *  - 即使 APP 关闭、锁屏、返回桌面，通知仍能由 AlarmManager 触发
 *  - 支持 Android 8.0+ 通知通道（Channel）
 *  - 支持 Android 13+ POST_NOTIFICATIONS 权限申请
 *  - 通知 ID 由字符串哈希生成，跨重启稳定，便于去重 / 取消
 *
 * 为保持调用方（page.tsx / upgrade-scheduler.ts）签名兼容，
 * 旧函数名一律保留，内部改用 LocalNotifications 实现。
 */

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { log, warn, error } from "./logger";

// ── 安卓通知通道 ──────────────────────────
export const CHANNELS = {
  UPGRADE_COMPLETE: "coc_upgrade_complete",
  BUILDER_IDLE: "coc_builder_idle",
  LAB_COMPLETE: "coc_lab_complete",
} as const;

export type ChannelId = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// ── 环境检测 ──────────────────────────────
export interface NotifyEnvironment {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  isWechat: boolean;
  isQQ: boolean;
  isUc: boolean;
  isQuark: boolean;
  isIframe: boolean;
  isSecureContext: boolean;
  browserName: string;
  notificationSupported: boolean;
  permissionAvailable: boolean;
  periodicSyncSupported: boolean;
  unsupportedReason?: string;
  hint?: string;
}

export function detectNotifyEnvironment(): NotifyEnvironment {
  const platform = Capacitor.getPlatform();
  const isNative = platform === "android" || platform === "ios";
  return {
    isIOS: platform === "ios",
    isSafari: false,
    isStandalone: true,
    isWechat: false,
    isQQ: false,
    isUc: false,
    isQuark: false,
    isIframe: false,
    isSecureContext: true,
    browserName: platform,
    notificationSupported: true,
    permissionAvailable: true,
    periodicSyncSupported: isNative,
    unsupportedReason: undefined,
    hint: undefined,
  };
}

// ── 创建 Android 通知通道 ──────────────────
// Android 8.0+ 必需；Android 13+ 还需要 POST_NOTIFICATIONS 权限。
// 通道一旦创建即持久化（即使 APP 卸载重装也会保留配置），重复创建是 no-op。
export async function createNotificationChannels(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNELS.UPGRADE_COMPLETE,
      name: "升级完成提醒",
      description: "建筑/英雄/兵种等升级完成时提醒",
      importance: 5, // HIGH：锁屏可见、横幅、振动
      visibility: 1, // PUBLIC：锁屏显示完整内容
      vibration: true,
      sound: "default",
      // 频道默认用系统默认铃声
    });
    await LocalNotifications.createChannel({
      id: CHANNELS.BUILDER_IDLE,
      name: "工人空闲提醒",
      description: "建筑工人空闲时提醒，便于及时安排新升级",
      importance: 4, // DEFAULT
      visibility: 1,
      vibration: true,
      sound: "default",
    });
    await LocalNotifications.createChannel({
      id: CHANNELS.LAB_COMPLETE,
      name: "实验室完成提醒",
      description: "实验室兵种/法术升级完成时提醒",
      importance: 5, // HIGH
      visibility: 1,
      vibration: true,
      sound: "default",
    });
    log("Android 通知通道已创建:", CHANNELS);
  } catch (e) {
    error("创建通知通道失败:", e);
  }
}

// ── 请求通知权限（Android 13+ POST_NOTIFICATIONS） ─
export type PermissionResult = {
  granted: boolean;
  reason:
    | "granted"
    | "denied"
    | "unsupported"
    | "default"
    | "iframe_blocked"
    | "ios_non_pwa"
    | "wechat"
    | "not_secure";
  message?: string;
};

export async function requestNotificationPermission(): Promise<boolean> {
  const r = await requestNotificationPermissionDetailed();
  return r.granted;
}

export async function requestNotificationPermissionDetailed(): Promise<PermissionResult> {
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") {
      // 通道在每次启动时尝试创建（幂等）
      await createNotificationChannels();
      return { granted: true, reason: "granted" };
    }
    if (status.display === "denied") {
      return {
        granted: false,
        reason: "denied",
        message: "通知权限已被拒绝，请前往系统设置 → 应用 → 部落冲突升级助手 → 通知 中开启",
      };
    }
    // prompt 状态：发起请求
    const req = await LocalNotifications.requestPermissions();
    if (req.display === "granted") {
      await createNotificationChannels();
      return { granted: true, reason: "granted" };
    }
    if (req.display === "denied") {
      return {
        granted: false,
        reason: "denied",
        message: "您已拒绝通知权限，请前往系统设置开启",
      };
    }
    return {
      granted: false,
      reason: "default",
      message: "权限请求未做出选择",
    };
  } catch (e) {
    error("请求通知权限失败:", e);
    return {
      granted: false,
      reason: "unsupported",
      message: "通知权限请求失败：" + (e instanceof Error ? e.message : String(e)),
    };
  }
}

// ── 通知 ID 生成（基于字符串哈希，跨重启稳定）──
export function notifIdFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  // 1 ~ 1,000,000；避免 0（Capacitor 视 0 为无效 ID）
  return (Math.abs(h) % 1_000_000) + 1;
}

// ── 立即发送通知（页面打开时补发 / 立即提醒场景）──
// 兼容旧 API 名 sendBrowserNotification；内部改用 LocalNotifications
export function sendBrowserNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  // 始终同时显示页面内 toast（确保用户一定能看到提醒）
  showInPageToast(title, body);

  const tag = (data?.tag as string) || `${title}:${body}`;
  const id = notifIdFromKey(tag);
  const channelId =
    (data?.channelId as ChannelId | undefined) || CHANNELS.UPGRADE_COMPLETE;

  LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        channelId,
        sound: "default",
        smallIcon: "ic_stat_icon",
        largeIcon: "ic_launcher",
        // 不带 schedule 字段 = 立即显示
        extra: { ...(data || {}), tag, createdAt: Date.now() },
      },
    ],
  })
    .then(() => log("通知已立即发送:", title))
    .catch((e) => warn("通知发送失败:", e));
}

// ── 调度未来通知（核心：APP 关闭时仍能由 AlarmManager 触发）──
export interface ScheduleInput {
  id: number;
  at: Date;
  title: string;
  body: string;
  channelId?: ChannelId;
  data?: Record<string, unknown>;
}

export async function scheduleLocalNotification(
  opts: ScheduleInput
): Promise<void> {
  const channelId = opts.channelId || CHANNELS.UPGRADE_COMPLETE;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id,
          title: opts.title,
          body: opts.body,
          channelId,
          sound: "default",
          smallIcon: "ic_stat_icon",
          largeIcon: "ic_launcher",
          schedule: {
            at: opts.at,
            allowWhileIdle: true, // DOZE 模式下也触发
          },
          extra: { ...(opts.data || {}), scheduledAt: Date.now() },
        },
      ],
    });
  } catch (e) {
    warn("调度未来通知失败:", e);
  }
}

// ── 批量调度未来通知 ──────────────────────
export async function scheduleLocalNotifications(
  list: ScheduleInput[]
): Promise<void> {
  if (list.length === 0) return;
  try {
    await LocalNotifications.schedule({
      notifications: list.map((opts) => ({
        id: opts.id,
        title: opts.title,
        body: opts.body,
        channelId: opts.channelId || CHANNELS.UPGRADE_COMPLETE,
        sound: "default",
        smallIcon: "ic_stat_icon",
        largeIcon: "ic_launcher",
        schedule: {
          at: opts.at,
          allowWhileIdle: true,
        },
        extra: { ...(opts.data || {}), scheduledAt: Date.now() },
      })),
    });
    log(`已调度 ${list.length} 个未来通知`);
  } catch (e) {
    warn("批量调度通知失败:", e);
  }
}

// ── 取消单个/全部待发通知 ─────────────────
export async function cancelScheduledNotification(id: number): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (e) {
    warn("取消通知失败:", e);
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
      log(`已取消 ${pending.notifications.length} 个待发通知`);
    }
  } catch (e) {
    warn("取消所有待发通知失败:", e);
  }
}

export async function getPendingNotifications() {
  try {
    const p = await LocalNotifications.getPending();
    return p.notifications;
  } catch {
    return [];
  }
}

// ── 监听通知被系统触发（用于同步去重状态）──
export async function setupLocalNotificationListener(
  onReceived: (notif: {
    id: number;
    title: string;
    body: string;
    extra?: Record<string, unknown>;
  }) => void
): Promise<() => void> {
  try {
    const handler = await LocalNotifications.addListener(
      "localNotificationReceived",
      (notif) => {
        onReceived({
          id: notif.id,
          title: notif.title || "",
          body: notif.body || "",
          extra: (notif.extra || {}) as Record<string, unknown>,
        });
      }
    );
    return () => {
      handler.remove();
    };
  } catch (e) {
    warn("注册通知监听失败:", e);
    return () => {};
  }
}

// ── 检测通知状态（兼容旧 API）──────────────
export interface NotifyStatus {
  browserNotifAvailable: boolean;
  browserNotifGranted: boolean;
  swRegistered: boolean;
  periodicSyncSupported: boolean;
  isInstalled: boolean;
  env?: NotifyEnvironment;
  unsupportedReason?: string;
  hint?: string;
}

// 异步获取真实权限状态（推荐）
export async function detectNotifyStatusAsync(): Promise<NotifyStatus> {
  const env = detectNotifyEnvironment();
  let granted = false;
  try {
    const s = await LocalNotifications.checkPermissions();
    granted = s.display === "granted";
  } catch {
    /* ignore */
  }
  return {
    browserNotifAvailable: true,
    browserNotifGranted: granted,
    swRegistered: true,
    periodicSyncSupported: true,
    isInstalled: true,
    env,
  };
}

// 兼容旧同步签名：返回未授权占位，UI 应改用 detectNotifyStatusAsync
export function detectNotifyStatus(): NotifyStatus {
  const env = detectNotifyEnvironment();
  return {
    browserNotifAvailable: true,
    browserNotifGranted: false,
    swRegistered: true,
    periodicSyncSupported: true,
    isInstalled: true,
    env,
  };
}

// ── 页面内 toast 兜底 ──────────────────────
function showInPageToast(title: string, body: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("coc-inpage-notification", { detail: { title, body } })
  );
}

// ── 平台判断 ──────────────────────────────
export function isStandalone(): boolean {
  return true; // Capacitor 内置 WebView 始终 standalone
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

// ── 兼容旧调用方的占位函数（在 Capacitor 模式下都是 no-op）──
// page.tsx 中仍会调用这些函数名，但实际无操作
export async function registerSW(): Promise<null> {
  return null;
}

export async function registerPeriodicSync(): Promise<boolean> {
  // 在 Capacitor 模式下，调度由 LocalNotifications.schedule 接管，
  // 这里返回 true 让 UI 显示"已支持后台同步"
  return true;
}

export async function triggerSWNotifyCheck(): Promise<void> {
  // 不再依赖 SW，但保留函数名兼容旧调用方
  // 实际触发通过 LocalNotifications 的 catch-up 逻辑
}

export async function isPeriodicSyncRegistered(): Promise<boolean> {
  return true;
}
