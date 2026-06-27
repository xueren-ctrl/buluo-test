/**
 * 通知管理系统（纯前端）
 * ============================================
 * 仅保留浏览器本地通知 + Service Worker 注册 + 周期性后台同步。
 *
 * 设计取舍：
 *  - 无推送服务器，所以删除 VAPID / Push API 订阅（留着会误导用户）。
 *  - 通知触发由 upgrade-scheduler.ts 在页面打开时驱动；
 *    页面关闭时通过 Periodic Background Sync API（best-effort）唤醒 SW，
 *    SW 再读 IndexedDB 里的 upgrades/notifyState 决定是否补发。
 *  - Periodic Sync 仅 Chrome/Edge 支持，且需要安装 PWA。Safari/iOS 不支持，
 *    这种场景下用户重开页面时由 catchUp 兜底。
 *
 * 浏览器兼容性：
 *  - Chrome / Edge：完整支持（前台 + 后台 Periodic Sync + SW showNotification）
 *  - Firefox：支持前台通知，不支持 Periodic Sync（页面关闭时无法补发）
 *  - Safari (macOS)：支持前台通知，不支持 Periodic Sync
 *  - iOS Safari（非 PWA 模式）：完全不支持 Notification API，按钮禁用
 *  - iOS Safari（PWA 模式，已添加到主屏幕）：支持前台通知，不支持 Periodic Sync
 *  - 微信/QQ/UC/夸克等内置浏览器：可能屏蔽 Notification API，需引导用户用系统浏览器打开
 *  - iframe 内（如被嵌入到第三方页面）：requestPermission 会被拦截
 */

import { log, warn, error } from "@/lib/logger";

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// ── 浏览器环境检测 ──────────────────────────
export interface NotifyEnvironment {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;          // 已安装 PWA（standalone 模式）
  isWechat: boolean;              // 微信内置浏览器
  isQQ: boolean;                  // QQ 内置浏览器
  isUc: boolean;                  // UC 浏览器
  isQuark: boolean;               // 夸克浏览器
  isIframe: boolean;              // 在 iframe 内
  isSecureContext: boolean;       // HTTPS 或 localhost
  browserName: string;            // chrome / edge / safari / firefox / wechat / qq / uc / quark / other
  notificationSupported: boolean; // Notification 对象是否存在
  permissionAvailable: boolean;   // 是否能请求权限（不在 iframe、不在微信内、不在 iOS 非 PWA 等）
  periodicSyncSupported: boolean;
  unsupportedReason?: string;     // 不支持的具体原因（中文）
  hint?: string;                  // 给用户的引导文案
}

export function detectNotifyEnvironment(): NotifyEnvironment {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  const maxTouchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
  const isIOS = /iphone|ipad|ipod/.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios|edg|uc|quark).)*safari/i.test(navigator.userAgent || "");
  const isStandalone = checkStandalone();
  const isWechat = /micromessenger/.test(ua);
  const isQQ = /qqbrowser\//.test(ua) && !/qq\/\d/.test(ua); // QQ Browser 不是 QQ 客户端
  const isQQClient = /qq\/\d/.test(ua); // QQ 内置浏览器
  const isUc = /ucbrowser|ucweb/.test(ua);
  const isQuark = /quark/.test(ua);
  const isIframe = typeof window !== "undefined" && window.self !== window.top;
  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : false;

  let browserName = "other";
  if (isWechat) browserName = "wechat";
  else if (isQQClient) browserName = "qq";
  else if (isUc) browserName = "uc";
  else if (isQuark) browserName = "quark";
  else if (/edg\//.test(ua)) browserName = "edge";
  else if (/chrome|crios/.test(ua)) browserName = "chrome";
  else if (isSafari) browserName = "safari";
  else if (/firefox|fxios/.test(ua)) browserName = "firefox";

  const notificationSupported = typeof window !== "undefined" && "Notification" in window;

  // 判断能否请求权限
  let permissionAvailable = notificationSupported;
  let unsupportedReason: string | undefined;
  let hint: string | undefined;

  if (isWechat || isQQClient) {
    permissionAvailable = false;
    unsupportedReason = `${isWechat ? "微信" : "QQ"}内置浏览器不支持网页通知`;
    hint = `请点击右上角菜单 → 选择"在浏览器打开"，使用系统浏览器（Chrome/Safari）访问本应用`;
  } else if (isIframe) {
    permissionAvailable = false;
    unsupportedReason = "应用被嵌入到 iframe 中，浏览器拒绝授予通知权限";
    hint = "请在新标签页中独立打开本应用";
  } else if (isIOS && !isStandalone) {
    // iOS Safari 非 PWA 模式下 Notification 对象不存在
    permissionAvailable = false;
    unsupportedReason = "iOS Safari 不支持网页通知";
    hint = "请点击 Safari 底部的「分享」按钮 →「添加到主屏幕」，从主屏幕图标启动后即可开启通知";
  } else if (!notificationSupported) {
    permissionAvailable = false;
    unsupportedReason = "当前浏览器不支持网页通知 API";
    hint = "建议使用 Chrome、Edge 或 Firefox 最新版浏览器";
  } else if (!isSecureContext) {
    permissionAvailable = false;
    unsupportedReason = "通知 API 需要 HTTPS 安全上下文";
    hint = "请通过 HTTPS 域名访问本应用";
  }

  // Periodic Sync：仅 Chromium 系 + 已安装 PWA 支持
  const periodicSyncSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "periodicSync" in (ServiceWorkerRegistration.prototype as unknown as Record<string, unknown>);

  return {
    isIOS,
    isSafari,
    isStandalone,
    isWechat,
    isQQ: isQQClient,
    isUc,
    isQuark,
    isIframe,
    isSecureContext,
    browserName,
    notificationSupported,
    permissionAvailable,
    periodicSyncSupported,
    unsupportedReason,
    hint,
  };
}

function checkStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari standalone
  if ("standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone) {
    return true;
  }
  // Android / Chrome PWA
  return window.matchMedia("(display-mode: standalone)").matches;
}

// ── 请求浏览器通知权限 ──────────────────────
export type PermissionResult = {
  granted: boolean;
  reason: "granted" | "denied" | "unsupported" | "default" | "iframe_blocked" | "ios_non_pwa" | "wechat" | "not_secure";
  message?: string;
};

/**
 * 请求通知权限（兼容旧调用方，返回 boolean）
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const result = await requestNotificationPermissionDetailed();
  return result.granted;
}

/**
 * 请求通知权限（详细版本，返回原因）
 */
export async function requestNotificationPermissionDetailed(): Promise<PermissionResult> {
  const env = detectNotifyEnvironment();

  if (!env.notificationSupported) {
    if (env.isIOS && !env.isStandalone) {
      return {
        granted: false,
        reason: "ios_non_pwa",
        message: "iOS Safari 不支持网页通知，请将应用添加到主屏幕后从主屏幕图标启动",
      };
    }
    if (env.isWechat) {
      return {
        granted: false,
        reason: "wechat",
        message: "微信内置浏览器屏蔽了通知 API，请点击右上角菜单 → 在浏览器中打开",
      };
    }
    return {
      granted: false,
      reason: "unsupported",
      message: env.unsupportedReason || "当前浏览器不支持网页通知",
    };
  }

  if (env.isIframe) {
    return {
      granted: false,
      reason: "iframe_blocked",
      message: "应用被嵌入到 iframe 中，无法请求通知权限，请在新标签页中打开",
    };
  }

  if (!env.isSecureContext) {
    return {
      granted: false,
      reason: "not_secure",
      message: "通知 API 需要 HTTPS 环境，当前页面非安全上下文",
    };
  }

  if (Notification.permission === "granted") {
    log("通知权限：已授予");
    return { granted: true, reason: "granted" };
  }
  if (Notification.permission === "denied") {
    warn("通知权限：已被用户拒绝（无法再次请求，需用户在浏览器设置中手动开启）");
    return {
      granted: false,
      reason: "denied",
      message: "通知权限已被拒绝，请在浏览器设置 → 网站权限中手动开启",
    };
  }

  try {
    log("通知权限：开始请求用户授权…");
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      log("通知权限：用户已授予");
      return { granted: true, reason: "granted" };
    }
    if (perm === "denied") {
      warn("通知权限：用户已拒绝");
      return {
        granted: false,
        reason: "denied",
        message: "您已拒绝通知权限，请在浏览器设置中手动开启",
      };
    }
    return {
      granted: false,
      reason: "default",
      message: "通知权限请求被关闭，未作出选择",
    };
  } catch (e) {
    error("通知权限请求异常:", e);
    return {
      granted: false,
      reason: "unsupported",
      message: "通知权限请求失败：" + (e instanceof Error ? e.message : String(e)),
    };
  }
}

// ── 发送浏览器本地通知 ──────────────────────
// 移动端 Chrome/Edge 必须 SW showNotification 才能弹出通知栏
// new Notification() 在移动端不弹出通知栏（仅桌面端有效）
export function sendBrowserNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    warn("通知未发送：浏览器不支持 Notification API");
    showInPageToast(title, body);
    return;
  }
  if (Notification.permission !== "granted") {
    warn(`通知未发送：权限未授予（当前=${Notification.permission}），title="${title}"`);
    showInPageToast(title, body);
    return;
  }

  // 移动端必须用 SW showNotification 才能弹出通知栏
  // 不检查 navigator.serviceWorker.controller，因为首次加载时 controller 是 null
  // 但 SW 可能已注册并激活，ready 会在 SW 激活后 resolve
  const showViaSW = async () => {
    try {
      if ("serviceWorker" in navigator) {
        // 等待 SW ready（3s 超时），ready 在 SW 注册并激活后 resolve
        // 即使当前页面还没被 SW 接管（controller 是 null），ready 也能 resolve
        const readyWithTimeout = Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("SW ready timeout")), 3000)
          ),
        ]);
        const reg = await readyWithTimeout;
        await reg.showNotification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: data?.tag ? String(data.tag) : title,
          requireInteraction: false,
          data: { ...data, createdAt: Date.now() },
        });
        log("通知已通过 SW showNotification 发送:", title);
        return;
      }
    } catch (e) {
      warn("SW showNotification 失败，回退到 Notification API:", e);
    }
    // fallback: new Notification（桌面端有效，移动端可能不弹出通知栏）
    fallbackNotification(title, body, data);
  };

  showViaSW();
}

// ── 页面内 toast 兜底（系统通知不可用时）──
function showInPageToast(title: string, body: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("coc-inpage-notification", { detail: { title, body } })
  );
}

function fallbackNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    showInPageToast(title, body);
    return;
  }
  try {
    const notif = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data?.tag ? String(data.tag) : title,
      requireInteraction: false,
      data: { ...data, createdAt: Date.now() },
    });
    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notif.close();
    };
    setTimeout(() => notif.close(), 30_000);
    log("通知已通过 Notification API 发送:", title);
    // 移动端 new Notification 可能不弹出通知栏，同时显示页面内 toast 兜底
    showInPageToast(title, body);
  } catch (e) {
    warn("Notification API 失败:", e);
    showInPageToast(title, body);
  }
}

// ── 注册 PWA Service Worker ──────────────────
// 新 SW 安装后自动 skipWaiting + clientsClaim（见 next.config.js）
// 页面通过 controllerchange 事件自动刷新，用户无需任何操作
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // 定期检查 SW 更新（每小时一次，后台静默）
    setInterval(() => {
      reg.update().catch(() => {});
    }, 60 * 60 * 1000);

    log("Service Worker 已注册");
    return reg;
  } catch (e) {
    warn("Service Worker 注册失败:", e);
    return null;
  }
}

// ── 周期性后台同步（best-effort）──────────────
//  仅 Chromium 系 + 已安装 PWA 支持；其他平台静默跳过。
//  注册后浏览器会按自身策略（最少 12 小时一次）触发 periodicsync 事件，
//  SW 在事件中读 IndexedDB 的升级队列并发通知。
export async function registerPeriodicSync(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, opts?: { minInterval: number }): Promise<void> };
    };
    if (!anyReg.periodicSync) {
      log("Periodic Sync 不支持（仅 Chromium 系 + PWA 安装支持，页面关闭时无法补发通知）");
      return false;
    }
    await anyReg.periodicSync.register("periodic-sync", {
      // 12 小时最小间隔（实际由浏览器决定）
      minInterval: 12 * 60 * 60 * 1000,
    });
    log("Periodic Sync 已注册");
    return true;
  } catch (e) {
    warn("Periodic Sync 注册失败:", e);
    return false;
  }
}

// ── 检测 Periodic Sync 状态 ──────────────────
export async function isPeriodicSyncRegistered(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as ServiceWorkerRegistration & {
      periodicSync?: { getTags(): Promise<string[]> };
    };
    if (!anyReg.periodicSync) return false;
    const tags = await anyReg.periodicSync.getTags();
    return tags.includes("periodic-sync");
  } catch {
    return false;
  }
}

// ── 检测通知状态 ──────────────────────────
export interface NotifyStatus {
  browserNotifAvailable: boolean;
  browserNotifGranted: boolean;
  swRegistered: boolean;
  periodicSyncSupported: boolean;
  isInstalled: boolean;
  // 新增：环境信息和提示
  env?: NotifyEnvironment;
  unsupportedReason?: string;
  hint?: string;
}

export function detectNotifyStatus(reg?: ServiceWorkerRegistration | null): NotifyStatus {
  const env = detectNotifyEnvironment();
  const periodicSyncSupported =
    "serviceWorker" in navigator &&
    "periodicSync" in (reg ?? ({} as ServiceWorkerRegistration));
  return {
    browserNotifAvailable: env.notificationSupported,
    browserNotifGranted: env.notificationSupported ? Notification.permission === "granted" : false,
    swRegistered: !!reg,
    periodicSyncSupported,
    isInstalled: env.isStandalone,
    env,
    unsupportedReason: env.unsupportedReason,
    hint: env.hint,
  };
}

// ── 是否以独立 App 模式运行（已安装到桌面）──
export function isStandalone(): boolean {
  return checkStandalone();
}

// ── 立即让 SW 跑一次后台通知检查（兜底）──
//  适用场景：页面打开时调用，确保 SW 至少跑一次 runPeriodicCheck
export async function triggerSWNotifyCheck(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const active = reg.active;
    if (active) {
      active.postMessage({ type: "RUN_PERIODIC_CHECK" });
      log("已请求 SW 立即跑通知检查");
    }
  } catch (e) {
    warn("请求 SW 通知检查失败:", e);
  }
}
