/**
 * 电池优化检测 + 厂商后台运行指南
 * ============================================
 * 国产安卓（小米/华为/OPPO/vivo/魅族）会"杀后台"，
 * 即使 Android AlarmManager 也可能被冻结，导致升级完成通知不弹出。
 *
 * 本模块提供：
 *  1. detectBatteryOptimization(): 检测当前 APP 是否被电池优化限制
 *  2. openBatteryOptimizationSettings(): 跳转到系统电池优化设置页
 *  3. openAutostartSettings(): 跳转厂商自启动管理页（小米/华为/OPPO/vivo）
 *  4. detectManufacturer(): 识别厂商（用于推荐对应教程）
 *  5. VENDOR_GUIDES: 各厂商后台运行教程文案
 *
 * 由于 Capacitor 未提供原生 API，这里通过 <a href="intent://...">
 * 让 Android WebView 启动系统 Intent。
 */

import { Capacitor } from "@capacitor/core";

// ── 厂商识别 ──────────────────────────────
export type Manufacturer =
  | "xiaomi"
  | "huawei"
  | "honor"
  | "oppo"
  | "vivo"
  | "meizu"
  | "samsung"
  | "oneplus"
  | "realme"
  | "pixel"
  | "unknown";

export function detectManufacturer(): Manufacturer {
  if (typeof navigator === "undefined") return "unknown";
  const ua = (navigator.userAgent || "").toLowerCase();
  const brand = (navigator as unknown as { device?: { manufacturer?: string } }).device?.manufacturer?.toLowerCase() || "";

  if (brand.includes("xiaomi") || brand.includes("redmi") || ua.includes("miui") || ua.includes("xiaomi")) return "xiaomi";
  if (brand.includes("huawei") || brand.includes("honor") || ua.includes("harmony") || ua.includes("huawei")) {
    return brand.includes("honor") || ua.includes("honor") ? "honor" : "huawei";
  }
  if (brand.includes("oppo") || ua.includes("oppo") || ua.includes("coloros")) return "oppo";
  if (brand.includes("vivo") || ua.includes("vivo") || ua.includes("funtouch")) return "vivo";
  if (brand.includes("meizu") || ua.includes("meizu") || ua.includes("flyme")) return "meizu";
  if (brand.includes("samsung") || ua.includes("samsung")) return "samsung";
  if (brand.includes("oneplus")) return "oneplus";
  if (brand.includes("realme")) return "realme";
  if (brand.includes("pixel") || ua.includes("pixel")) return "pixel";
  return "unknown";
}

// ── 电池优化状态 ──────────────────────────
export interface BatteryOptimizationStatus {
  isNative: boolean;
  manufacturer: Manufacturer;
  /** 当前 APP 是否被电池优化限制（true=受限，需要请求忽略）*/
  isOptimized: boolean;
  /** 是否支持跳转到电池优化设置页 */
  canOpenSettings: boolean;
  /** 是否需要厂商自启动权限（小米/华为/OPPO/vivo/魅族）*/
  needsAutostart: boolean;
  /** 是否需要厂商"省电策略"白名单 */
  needsPowerSaveWhitelist: boolean;
}

/**
 * 检测电池优化状态
 *
 * Capacitor LocalNotifications 已通过 AlarmManager.setExactAndAllowWhileIdle
 * 调度通知，但国产厂商额外的"省电策略"层会杀掉 AlarmManager。
 *
 * 这里无法直接获取系统级 "isIgnoringBatteryOptimizations" 标志
 * （需要原生插件），所以采用启发式判断：
 *  - 在国产厂商设备上默认认为"需要引导用户检查"
 *  - 在 Pixel/Samsung 等接近原生 ROM 上认为"无需特别处理"
 */
export async function detectBatteryOptimization(): Promise<BatteryOptimizationStatus> {
  const isNative = Capacitor.isNativePlatform();
  const manufacturer = detectManufacturer();

  // 这些厂商都有额外的"自启动管理 / 后台限制"层
  const restrictedVendors: Manufacturer[] = ["xiaomi", "huawei", "honor", "oppo", "vivo", "meizu", "oneplus", "realme"];

  const needsAutostart = restrictedVendors.includes(manufacturer);
  const needsPowerSaveWhitelist = ["xiaomi", "huawei", "honor", "oppo", "vivo"].includes(manufacturer);

  // 启发式：在没有原生插件能精确查询 isIgnoringBatteryOptimizations 时，
  // 受限厂商一律引导用户检查（宁可多弹一次，也不要错过通知）
  const isOptimized = isNative && needsAutostart;

  return {
    isNative,
    manufacturer,
    isOptimized,
    canOpenSettings: isNative,
    needsAutostart,
    needsPowerSaveWhitelist,
  };
}

// ── 跳转系统设置页 ────────────────────────
// 通过 <a href="intent://..."> 让 Android WebView 启动 Intent
// Capacitor 默认会把 intent:// 链接交给系统处理
function openIntent(intentUri: string): void {
  if (typeof window === "undefined") return;
  // 创建一个隐藏的 <a> 标签触发 intent 跳转
  const a = document.createElement("a");
  a.href = intentUri;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

/**
 * 跳转到系统"电池优化"设置页
 * 用户可在此把"部落冲突升级助手"改为"不优化"
 */
export function openBatteryOptimizationSettings(): void {
  // Android 标准 ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
  openIntent("intent://settings#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end");
}

/**
 * 跳转到当前 APP 的电池优化详情页（直接到本应用）
 */
export function openAppBatteryOptimizationSettings(): void {
  // ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 需要包名
  openIntent("intent://settings#Intent;action=android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS;package=com.xueren.buluo;end");
}

/**
 * 跳转到厂商自启动管理页（小米/华为/OPPO/vivo/魅族）
 * 不同厂商 Intent 不同，按 manufacturer 分发
 */
export function openAutostartSettings(manufacturer: Manufacturer): void {
  const intentMap: Partial<Record<Manufacturer, string>> = {
    xiaomi: "intent://settings#Intent;action=miui.intent.action.APP_AUTO_START;extra.miui:package_name:com.xueren.buluo;end",
    huawei: "intent://settings#Intent;action=huawei.intent.action.MANAGE_PROTECTED_APPS;end",
    honor: "intent://settings#Intent;action=huawei.intent.action.MANAGE_PROTECTED_APPS;end",
    oppo: "intent://settings#Intent;action=com.coloros.safecenter.appauto.start;end",
    vivo: "intent://settings#Intent;action=vivo.intent.action.bautostart;end",
    meizu: "intent://settings#Intent;action=com.meizu.safe.security.SHOW_APPSEC;end",
  };
  const intent = intentMap[manufacturer];
  if (intent) {
    openIntent(intent);
  } else {
    // 未知厂商：跳到通用设置
    openIntent("intent://settings#Intent;action=android.settings.SETTINGS;end");
  }
}

/**
 * 跳转到厂商"省电策略"白名单页
 * 小米/华为/OPPO 等需要把 APP 加入"高耗电允许" / "省电策略白名单"
 */
export function openPowerSaveWhitelistSettings(manufacturer: Manufacturer): void {
  const intentMap: Partial<Record<Manufacturer, string>> = {
    xiaomi: "intent://settings#Intent;action=miui.intent.action.POWER_MODE;end",
    huawei: "intent://settings#Intent;action=huawei.intent.action.POWER_SAVING_MODE;end",
    honor: "intent://settings#Intent;action=huawei.intent.action.POWER_SAVING_MODE;end",
    oppo: "intent://settings#Intent;action=com.coloros.oppoguardelf.PowerUsageModelActivity;end",
    vivo: "intent://settings#Intent;action=vivo.intent.action.highpower.detail;package=com.xueren.buluo;end",
  };
  const intent = intentMap[manufacturer];
  if (intent) {
    openIntent(intent);
  } else {
    openIntent("intent://settings#Intent;action=android.settings.SETTINGS;end");
  }
}

/**
 * 跳转到 APP 通知设置页（用于"通知没出现"时引导）
 */
export function openAppNotificationSettings(): void {
  // Android 8.0+ APP_NOTIFICATION_SETTINGS
  openIntent("intent://settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;extra.android:app_package:com.xueren.buluo;extra.android:app_uid:0;end");
}

// ── 厂商后台运行指南文案 ──────────────────
export interface VendorGuideStep {
  title: string;
  desc: string;
}

export interface VendorGuide {
  vendor: Manufacturer;
  label: string;
  emoji: string;
  steps: VendorGuideStep[];
}

export const VENDOR_GUIDES: VendorGuide[] = [
  {
    vendor: "xiaomi",
    label: "小米 / Redmi（MIUI）",
    emoji: "📱",
    steps: [
      { title: "1. 关闭省电策略", desc: "系统设置 → 应用设置 → 应用管理 → 部落冲突升级助手 → 省电策略 → 选择「无限制」" },
      { title: "2. 允许自启动", desc: "系统设置 → 应用设置 → 应用管理 → 部落冲突升级助手 → 自启动 → 开启" },
      { title: "3. 关闭后台弹出界面限制", desc: "系统设置 → 应用设置 → 应用管理 → 部落冲突升级助手 → 后台弹出界面 → 允许" },
      { title: "4. 锁屏不清理", desc: "任务管理器（长按主页键）→ 锁定部落冲突升级助手，避免被一键清理" },
    ],
  },
  {
    vendor: "huawei",
    label: "华为（EMUI / 鸿蒙）",
    emoji: "📲",
    steps: [
      { title: "1. 允许自启动", desc: "设置 → 应用 → 应用启动管理 → 找到「部落冲突升级助手」→ 关闭「自动管理」→ 手动允许「自启动/关联启动/后台活动」" },
      { title: "2. 关闭电池优化", desc: "设置 → 电池 → 更多电池设置 → 关闭「休眠时始终保持网络连接」开启；设置 → 应用 → 部落冲突升级助手 → 启动管理 → 允许后台活动" },
      { title: "3. 锁屏清理白名单", desc: "任务管理器（方块键）→ 下拉部落冲突升级助手卡片 → 出现「锁」图标" },
      { title: "4. 通知权限", desc: "设置 → 通知 → 部落冲突升级助手 → 允许通知、允许横幅、允许锁屏显示" },
    ],
  },
  {
    vendor: "honor",
    label: "荣耀（Magic UI）",
    emoji: "📲",
    steps: [
      { title: "1. 允许自启动", desc: "设置 → 应用 → 应用启动管理 → 部落冲突升级助手 → 关闭「自动管理」→ 全部允许" },
      { title: "2. 后台保护", desc: "设置 → 电池 → 更多电池设置 → 关闭「智能充电模式」对部落冲突升级助手的影响" },
      { title: "3. 锁屏清理白名单", desc: "任务管理器 → 下拉卡片锁定" },
    ],
  },
  {
    vendor: "oppo",
    label: "OPPO / OnePlus（ColorOS）",
    emoji: "📱",
    steps: [
      { title: "1. 允许自启动", desc: "设置 → 应用管理 → 部落冲突升级助手 → 启动管理 → 允许自启动、允许关联启动、允许后台启动" },
      { title: "2. 关闭电池优化", desc: "设置 → 电池 → 部落冲突升级助手 → 选择「不优化」或「允许后台运行」" },
      { title: "3. 锁定后台", desc: "任务管理器 → 下拉部落冲突升级助手卡片锁定" },
      { title: "4. 通知权限", desc: "设置 → 通知与状态栏 → 部落冲突升级助手 → 允许通知、横幅、锁屏" },
    ],
  },
  {
    vendor: "vivo",
    label: "vivo（OriginOS / FuntouchOS）",
    emoji: "📱",
    steps: [
      { title: "1. 允许自启动", desc: "i 管家 → 应用管理 → 权限管理 → 自启动 → 部落冲突升级助手 → 允许" },
      { title: "2. 允许后台高耗电", desc: "i 管家 → 应用管理 → 高耗电允许 → 部落冲突升级助手 → 允许" },
      { title: "3. 锁定后台", desc: "任务管理器 → 下拉部落冲突升级助手卡片 → 出现锁图标" },
      { title: "4. 通知权限", desc: "设置 → 通知与状态栏 → 部落冲突升级助手 → 允许通知、横幅、锁屏" },
    ],
  },
  {
    vendor: "meizu",
    label: "魅族（Flyme）",
    emoji: "📱",
    steps: [
      { title: "1. 允许自启动", desc: "设置 → 应用管理 → 部落冲突升级助手 → 权限管理 → 后台管理 → 允许后台运行" },
      { title: "2. 关闭电池优化", desc: "设置 → 电池 → 部落冲突升级助手 → 选择「无限制」" },
      { title: "3. 通知权限", desc: "设置 → 通知管理 → 部落冲突升级助手 → 允许通知、横幅、锁屏" },
    ],
  },
  {
    vendor: "samsung",
    label: "三星（One UI）",
    emoji: "📱",
    steps: [
      { title: "1. 关闭电池优化", desc: "设置 → 应用程序 → 部落冲突升级助手 → 电池 → 选择「不受限」" },
      { title: "2. 允许后台", desc: "设置 → 应用程序 → 部落冲突升级助手 → 电池 → 允许后台活动" },
      { title: "3. 通知权限", desc: "设置 → 应用程序 → 部落冲突升级助手 → 通知 → 允许通知" },
    ],
  },
  {
    vendor: "pixel",
    label: "Pixel / 原生 Android",
    emoji: "📱",
    steps: [
      { title: "1. 关闭电池优化", desc: "设置 → 应用 → 部落冲突升级助手 → 电池 → 不受限" },
      { title: "2. 通知权限", desc: "设置 → 应用 → 部落冲突升级助手 → 通知 → 允许通知" },
      { title: "3. 闹钟权限（Android 14+）", desc: "设置 → 应用 → 部落冲突升级助手 → 闹钟和提醒 → 允许" },
    ],
  },
];

export function getVendorGuide(manufacturer: Manufacturer): VendorGuide | null {
  return VENDOR_GUIDES.find((g) => g.vendor === manufacturer) || null;
}

/**
 * 获取厂商后台运行指南 HTML（用于设置页展示）
 */
export function getAllVendorGuides(): VendorGuide[] {
  return VENDOR_GUIDES;
}
