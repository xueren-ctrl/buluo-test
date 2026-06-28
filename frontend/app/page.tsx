"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { uploadJson } from "@/services/api";
import { analyzeBase } from "@/lib/base-analyzer";
import { scoreBase } from "@/lib/base-scorer";
import {
  getRemainingSeconds,
  getStaleMessage,
  isDataStale,
} from "@/lib/utils";
import type { UpgradeItem, IdleTimes, PlayerInfo, VillageSnapshot } from "@/types";
import {
  createNotificationChannels,
  setupLocalNotificationListener,
  detectNotifyStatusAsync,
  requestNotificationPermission,
  type NotifyStatus,
} from "@/lib/notification-system";
import {
  saveUpgrades,
  loadAll,
  saveUserData,
  resetAll,
  loadSettings,
  saveSettings,
  saveVillage,
  markTierNotified,
  clearNotifyState,
  addJsonHistory,
  upsertAccount,
  setActiveAccount,
  type RawUpgradeRecord,
  type SchedulerSettings,
  type RestoredState,
  type AccountRecord,
} from "@/lib/indexeddb";
import { createScheduler, type Scheduler } from "@/lib/upgrade-scheduler";
import {
  checkForUpdate,
  CURRENT_VERSION,
  openApkDownload,
  openReleasesPage,
  formatApkSize,
  formatPublishedAt,
  renderMarkdown,
  type UpdateCheckResult,
} from "@/lib/update-checker";
import {
  detectBatteryOptimization,
  openBatteryOptimizationSettings,
  type BatteryOptimizationStatus,
} from "@/lib/battery-optimizer";

import { UploadSection } from "@/components/UploadSection";
import { StatsCards } from "@/components/StatsCards";
import { NextCompletingCard } from "@/components/NextCompletingCard";
import { BuilderLabStatus } from "@/components/BuilderLabStatus";
import { CategoryFilter } from "@/components/CategoryFilter";
import { UpgradeList } from "@/components/UpgradeList";
import { CompletedList } from "@/components/CompletedList";
import { CollapsibleGuide } from "@/components/CollapsibleGuide";
import { EmptyState } from "@/components/EmptyState";
import { BaseAnalysisPanel } from "@/components/BaseAnalysisPanel";
import { BaseScoreCard } from "@/components/BaseScoreCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotifySettingsPanel } from "@/components/NotifySettingsPanel";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { Modal } from "@/components/Modal";

/* ================================================================
   首页 — "部落冲突升级规划助手" PWA 应用级体验
   ================================================================ */

const LOCAL_CLIENT_PREFIX = "local-device";

function createLocalClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${LOCAL_CLIENT_PREFIX}-${crypto.randomUUID()}`;
  }
  return `${LOCAL_CLIENT_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function HomePage() {
  // ── 基本状态 ──────────────────────────
  const [jsonInput, setJsonInput] = useState("");
  const [exportTimeLabel, setExportTimeLabel] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([]);
  const [idleTimes, setIdleTimes] = useState<IdleTimes | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState(false);
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [village, setVillage] = useState<VillageSnapshot | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus | null>(null);

  // ── v1.1 新增状态 ─────────────────────
  const [activeAccount, setActiveAccount] = useState<AccountRecord | null>(null);
  const [batteryStatus, setBatteryStatus] = useState<BatteryOptimizationStatus | null>(null);
  const [showBatteryDialog, setShowBatteryDialog] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const schedulerRef = useRef<Scheduler | null>(null);

  // ── 实时倒计时 ────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── 派生：基地分析与评分 ──────────────
  const analysis = useMemo(() => (village ? analyzeBase(village) : null), [village]);
  const baseScore = useMemo(
    () => (village ? scoreBase(village) : null),
    [village]
  );

  // ── 初始化: IndexedDB 恢复 + SW + 调度器 ──
  useEffect(() => {
    let cancelled = false;
    async function init() {
      let restored: RestoredState;
      try {
        restored = await loadAll();
      } catch {
        restored = { upgrades: [], userData: undefined, settings: (await loadSettings()) as SchedulerSettings, notifyConfig: { browserNotifEnabled: false } };
      }

      if (cancelled) return;

      const nextClientId = restored.userData?.client_id || createLocalClientId();
      setClientId(nextClientId);
      setSettings(restored.settings);

      if (restored.userData?.last_json_raw) {
        setJsonInput(restored.userData.last_json_raw);
      }
      if (restored.userData?.last_upload_at) {
        setLastUploadAt(restored.userData.last_upload_at);
      }
      if (restored.upgrades.length > 0) {
        setUpgrades(restored.upgrades as UpgradeItem[]);
      }
      if (restored.village?.snapshot) {
        setVillage(restored.village.snapshot);
      }
      if (!restored.userData?.client_id) {
        await saveUserData({
          client_id: nextClientId,
          player_tag: restored.userData?.player_tag ?? null,
          player_name: restored.userData?.player_name ?? null,
          last_json_raw: restored.userData?.last_json_raw ?? null,
          last_upload_at: restored.userData?.last_upload_at ?? null,
          last_sync_at: restored.userData?.last_sync_at ?? null,
        });
      }

      // 2. 创建调度器并启动（含 catch-up 补发漏掉的完成通知）
      try {
        const sched = await createScheduler();
        if (cancelled) return;
        schedulerRef.current = sched;
        if (restored.upgrades.length > 0) {
          await sched.catchUp(restored.upgrades as UpgradeItem[]);
        }
        sched.start();
      } catch {
        // 调度器失败不阻塞 UI
      }

      // 3. 初始化 Capacitor 本地通知系统
      //    - 创建 Android 通知通道（幂等，每次启动都调用）
      //    - 检测权限状态更新 UI
      //    - 注册 LocalNotifications 触发监听：通知被系统触发时自动 markTierNotified，
      //      避免下次打开 APP 时 catch-up tick 重复发送
      try {
        await createNotificationChannels();
        if (cancelled) return;
        const status = await detectNotifyStatusAsync();
        if (cancelled) return;
        setNotifyStatus(status);
        if (status.browserNotifGranted) {
          setupLocalNotificationListener(async (notif) => {
            const extra = notif.extra || {};
            const notifyKey = extra.notifyKey as string | undefined;
            if (notifyKey) {
              try { await markTierNotified(notifyKey); } catch { /* ignore */ }
            }
          }).catch(() => {});
        }
      } catch {
        // ignore
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── v1.1 启动后：电池优化检测 + 检查更新（异步，不阻塞 UI）──
  useEffect(() => {
    let cancelled = false;

    async function postInit() {
      // 1. 电池优化检测（首次启动只弹一次提示）
      try {
        const status = await detectBatteryOptimization();
        if (cancelled) return;
        setBatteryStatus(status);
        if (status.isOptimized) {
          // 国产厂商设备：检查是否已展示过引导
          const shownKey = "coc_battery_guide_shown";
          const shown = localStorage.getItem(shownKey);
          if (!shown) {
            setShowBatteryDialog(true);
            localStorage.setItem(shownKey, "1");
          }
        }
      } catch (e) {
        console.warn("电池优化检测失败", e);
      }

      // 2. GitHub 自动检查更新（6 小时缓存，启动时静默调用）
      try {
        const result = await checkForUpdate(false);
        if (cancelled) return;
        setUpdateResult(result);
        if (result.hasUpdate && result.release) {
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.warn("检查更新失败", e);
      }
    }

    // 延迟 1.5s 启动，避免与首屏渲染竞争
    const timer = setTimeout(postInit, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // ── v1.1 监听账号切换事件 ──
  // AccountSwitcher 切换账号后触发，重新加载首页所有数据
  useEffect(() => {
    const handler = async () => {
      try {
        const restored = await loadAll();
        setClientId(restored.userData?.client_id || createLocalClientId());
        setSettings(restored.settings);
        if (restored.userData?.last_json_raw) {
          setJsonInput(restored.userData.last_json_raw);
        } else {
          setJsonInput("");
        }
        if (restored.userData?.last_upload_at) {
          setLastUploadAt(restored.userData.last_upload_at);
        } else {
          setLastUploadAt(null);
        }
        setUpgrades(restored.upgrades as UpgradeItem[]);
        if (restored.village?.snapshot) {
          setVillage(restored.village.snapshot);
        } else {
          setVillage(null);
        }
        setPlayerInfo(null);
        setIdleTimes(null);
        setExportTimeLabel(null);
        // 通知调度器重新加载升级
        if (restored.upgrades.length > 0) {
          await schedulerRef.current?.catchUp(restored.upgrades as UpgradeItem[]);
        } else {
          schedulerRef.current?.reschedule([]);
        }
      } catch (e) {
        console.error("账号切换后重载失败", e);
      }
    };
    window.addEventListener("coc-account-switched", handler);
    return () => window.removeEventListener("coc-account-switched", handler);
  }, []);

  // ── v1.1 历史记录页面恢复入口 ──
  // 用户在 /history 页点"恢复"时，把 JSON 写入 sessionStorage，
  // 跳回首页时此 effect 读取并自动解析
  useEffect(() => {
    const restoreJson = sessionStorage.getItem("coc_restore_json");
    if (!restoreJson) return;
    // 一次性消费
    sessionStorage.removeItem("coc_restore_json");
    sessionStorage.removeItem("coc_restore_player_tag");
    // 注入到输入框并自动解析
    setJsonInput(restoreJson);
    setTimeout(() => {
      handleSubmitRef.current?.(restoreJson);
    }, 300);
  }, []);

  // ── v1.1 账号标签（用于通知标题前缀，如【主号】）──
  const accountLabel = useMemo(() => {
    if (!activeAccount) return "";
    const name = activeAccount.player_name?.trim();
    if (!name) return "";
    return `【${name}】`;
  }, [activeAccount]);

  // handleSubmit 引用（供上面历史恢复 effect 调用）
  const handleSubmitRef = useRef<((json?: string) => void) | null>(null);

  // ── v1.1 账号标签变化 → 同步到调度器（通知标题前缀）──
  useEffect(() => {
    if (!schedulerRef.current) return;
    schedulerRef.current.setAccountLabel(accountLabel).catch(() => {});
  }, [accountLabel]);

  // ── SW 更新自动刷新 ──（已移除：Capacitor 模式下不依赖 Service Worker，
  //     APP 升级直接通过 APK 重装覆盖；新版 web 资源在 cap sync 时已更新）

  // ── 页面回到前台时立即跑一次 catchUp（补发漏掉的通知）──
  // 浏览器/WebView 在页面隐藏时会节流 setInterval（最低 1Hz 甚至暂停），
  // 用户切回前台时立即跑一次 catchUp 确保不漏。
  // catchUp 内部还会重新调度未来通知到 LocalNotifications，确保 APP 关闭时仍能提醒。
  useEffect(() => {
    let lastVisibleAt = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const gap = Date.now() - lastVisibleAt;
        // 离开超过 30 秒再回来才补发（避免快速切换抖动）
        if (gap > 30_000 && schedulerRef.current && upgrades.length > 0) {
          schedulerRef.current.catchUp(upgrades);
        }
        lastVisibleAt = Date.now();
      } else {
        lastVisibleAt = Date.now();
      }
    };
    const onFocus = () => {
      if (schedulerRef.current && upgrades.length > 0) {
        schedulerRef.current.catchUp(upgrades);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [upgrades]);

  // ── 即将到期的升级项：精确提醒 ──
  // 不再使用 setTimeout 精确触发（用户要求），
  // 而是依赖 scheduler 在 upgrades 变化时把所有未来通知点
  // 调度到 Capacitor LocalNotifications（AlarmManager 驱动，系统级精度）。

  // ── 页面内 toast 兜底（系统通知不可用时）──
  useEffect(() => {
    const onInPageNotif = (e: Event) => {
      const { title, body } = (e as CustomEvent).detail;
      toast(`${title}\n${body}`, {
        duration: 8000,
        className: "toast-success",
      });
    };
    window.addEventListener("coc-inpage-notification", onInPageNotif);
    return () => window.removeEventListener("coc-inpage-notification", onInPageNotif);
  }, []);

  // ── 升级变化 → 持久化 + 通知调度器 ──
  useEffect(() => {
    if (upgrades.length === 0) return;
    const raw: RawUpgradeRecord[] = upgrades.map((u) => ({
      category: u.category,
      item_name: u.item_name,
      item_level: u.item_level,
      finish_time: u.finish_time,
      timer_seconds: u.timer_seconds,
      notified: u.notified,
      data_id: u.data_id ?? null,
    }));
    saveUpgrades(raw);
    // 用 catchUp 代替 reschedule：除了更新升级列表，还立即跑一次 tick
    // 确保新解析出的"已完成"项能立即触发通知（不用等 30s interval）
    schedulerRef.current?.catchUp(upgrades);
  }, [upgrades]);

  // ── 数据过期检测 ──────────────────────
  useEffect(() => {
    setStaleWarning(!!lastUploadAt && isDataStale(lastUploadAt));
  }, [lastUploadAt]);

  // ── 设置变化 → 持久化 + 更新调度器 ──
  const updateSettings = useCallback(async (patch: Partial<SchedulerSettings>) => {
    setSettings((prev) => {
      const next = { ...(prev as SchedulerSettings), ...patch };
      saveSettings(next);
      schedulerRef.current?.updateSettings(patch);
      return next;
    });
  }, []);

  // ── 开启通知权限（Capacitor LocalNotifications）──
  const handleEnableNotify = useCallback(async () => {
    try {
      const granted = await requestNotificationPermission();
      const status = await detectNotifyStatusAsync();
      setNotifyStatus(status);
      if (granted) {
        toast.success("通知权限已开启", { className: "toast-success" });
        // 重新调度未来通知
        if (upgrades.length > 0) {
          await schedulerRef.current?.rescheduleFuture(upgrades);
        }
      } else {
        toast.error("通知权限未开启，请在系统设置中开启", { className: "toast-error", duration: 6000 });
      }
    } catch (e) {
      toast.error("请求通知权限失败", { className: "toast-error" });
    }
  }, [upgrades]);

  // ── 重置通知去重状态，便于重新触发通知 ──
  const handleClearNotifyState = useCallback(async () => {
    await clearNotifyState();
    // 重新调度未来通知
    if (upgrades.length > 0) {
      await schedulerRef.current?.rescheduleFuture(upgrades);
    }
    toast.success("通知去重已重置", { className: "toast-success" });
  }, [upgrades]);

  // ── 解析 JSON 并更新全量状态 ─────────
  const processJson = useCallback(async (json: string, activeClientId: string) => {
    const res = await uploadJson(json, activeClientId);
    if (!res.success) throw new Error("解析失败");

    // 全量村庄快照（来自 api.ts 的 parseVillage，用于基地分析/评分）
    if (res.village) {
      setVillage(res.village);
      await saveVillage(res.village);
    }

    setUpgrades(res.upgrades);
    setIdleTimes(res.idle_times);
    setPlayerInfo(res.player_info || null);
    setLastUploadAt(res.last_upload_at ?? null);
    setStaleWarning(false);
    // 显示从 JSON timestamp 自动检测的导出时间
    setExportTimeLabel(
      res.export_time
        ? new Date(res.export_time).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        : null
    );

    return res;
  }, []);

  // ── 上传（本地解析）──────────────────
  // 支持传入 json 参数（用于历史记录恢复）
  const handleSubmit = async (overrideJson?: string) => {
    const raw = (overrideJson ?? jsonInput).trim();
    if (!raw) {
      toast.error("请粘贴 CoC JSON 数据", { className: "toast-error" });
      return;
    }
    try { JSON.parse(raw); }
    catch { toast.error("JSON 格式不正确", { className: "toast-error" }); return; }

    setLoading(true);
    try {
      const activeClientId = clientId || createLocalClientId();
      if (!clientId) setClientId(activeClientId);
      const res = await processJson(raw, activeClientId);

      await saveUserData({
        client_id: activeClientId,
        player_tag: res.player_info?.player_tag ?? null,
        player_name: res.player_info?.player_name ?? null,
        last_json_raw: raw,
        last_upload_at: res.last_upload_at ?? null,
        last_sync_at: new Date().toISOString(),
      });

      // v1.1：写入 JSON 历史记录（最多 5 条，自动淘汰）
      try {
        // 算一下基地评分
        let baseScore: number | null = null;
        let baseGrade: string | null = null;
        if (res.village) {
          const score = scoreBase(res.village);
          baseScore = score.total;
          baseGrade = score.grade;
        }
        await addJsonHistory({
          imported_at: new Date().toISOString(),
          player_tag: res.player_info?.player_tag ?? "anon",
          player_name: res.player_info?.player_name ?? "(无名)",
          town_hall_level: res.player_info?.town_hall_level ?? 0,
          json_raw: raw,
          active_upgrades: res.upgrades.length,
          base_score: baseScore,
          base_grade: baseGrade,
        });
      } catch (e) {
        console.warn("写入 JSON 历史失败", e);
      }

      // v1.1：写入多账号 store
      try {
        const playerTag = res.player_info?.player_tag || "anon";
        const playerName = res.player_info?.player_name || "(无名玩家)";
        const townHall = res.player_info?.town_hall_level ?? 0;
        let baseScoreVal: number | null = null;
        let baseGradeVal: string | null = null;
        if (res.village) {
          const sc = scoreBase(res.village);
          baseScoreVal = sc.total;
          baseGradeVal = sc.grade;
        }
        await upsertAccount({
          player_tag: playerTag,
          player_name: playerName,
          town_hall_level: townHall,
          last_import_time: new Date().toISOString(),
          village_data: res.village ?? null,
          upgrades: res.upgrades,
          base_score: baseScoreVal,
          base_grade: baseGradeVal,
          active: true,
          json_raw: raw,
        });
        // 更新本地状态（让 AccountSwitcher 立即看到新账号）
        const { getActiveAccount } = await import("@/lib/indexeddb");
        const active = await getActiveAccount();
        setActiveAccount(active || null);
      } catch (e) {
        console.warn("写入账号 store 失败", e);
      }

      const diff = res.diff;
      if (diff?.new_upgrades?.length || diff?.completed_upgrades?.length) {
        const msgs: string[] = [];
        if (diff.new_upgrades?.length) msgs.push(`新增 ${diff.new_upgrades.length} 项`);
        if (diff.completed_upgrades?.length) msgs.push(`已完成 ${diff.completed_upgrades.length} 项`);
        toast.success(`解析成功! ${msgs.join("，")}`, { className: "toast-success" });
      } else {
        toast.success(`解析成功! 发现 ${res.upgrades.length} 个升级项`, { className: "toast-success" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CoC] 解析失败:", err);
      toast.error(`解析失败: ${msg}`, { className: "toast-error", duration: 6000 });
    } finally {
      setLoading(false);
    }
  };
  // 同步 handleSubmit 到 ref，供历史记录恢复 effect 调用
  handleSubmitRef.current = handleSubmit;

  // ── 重新解析当前 JSON（刷新）──────────
  const handleRefresh = async () => {
    if (!jsonInput.trim()) {
      toast.error("没有可刷新的 JSON 数据", { className: "toast-error" });
      return;
    }
    setLoading(true);
    try {
      await processJson(jsonInput, clientId);
      toast.success("数据已重新解析", { className: "toast-success" });
    } catch {
      toast.error("刷新失败", { className: "toast-error" });
    } finally {
      setLoading(false);
    }
  };

  // ── 清除所有本地数据 ──────────────────
  const handleClearAll = async () => {
    if (!confirm("确定要清除所有本地数据吗? 此操作不可撤销。")) return;
    await resetAll();
    setUpgrades([]);
    setIdleTimes(null);
    setPlayerInfo(null);
    setLastUploadAt(null);
    setVillage(null);
    setJsonInput("");
    setActiveCategory("all");
    schedulerRef.current?.reschedule([]);
    setExportTimeLabel(null);
    toast.success("所有数据已清除", { className: "toast-success" });
  };

  // ── 排序与分类 ───────────────────────
  const sortedUpgrades = useMemo(() =>
    [...upgrades].sort((a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime()),
    [upgrades]
  );

  const activeUpgrades = sortedUpgrades.filter((u) => getRemainingSeconds(u.finish_time) > 0);
  const completedUpgrades = sortedUpgrades.filter((u) => getRemainingSeconds(u.finish_time) <= 0);
  const nextUpgrade = activeUpgrades[0] || null;

  const categories = useMemo(() => {
    const set = new Set(activeUpgrades.map((u) => u.category));
    return Array.from(set);
  }, [activeUpgrades]);

  const filteredActive = activeCategory === "all"
    ? activeUpgrades
    : activeUpgrades.filter((u) => u.category === activeCategory);

  /* ════════ RENDER ════════ */
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
        }}
      />

      <main className="min-h-screen flex flex-col px-3 py-5 md:px-6 md:py-8 max-w-2xl mx-auto app-shell">

        {/* ======== 顶部工具栏：账号切换 + 历史入口 + 设置入口 + 主题切换 ======== */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <AccountSwitcher onAccountChange={(acc) => setActiveAccount(acc)} />
          <div className="flex items-center gap-1.5">
            <Link
              href="/history"
              className="coc-btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
              aria-label="历史记录"
            >
              <span>📜</span>
              <span className="hidden sm:inline">历史</span>
            </Link>
            <Link
              href="/settings"
              className="coc-btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
              aria-label="设置"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">设置</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* ======== Hero 区域 ======== */}
        <header className="text-center mb-5">
          <h1 className="coc-hero-title text-xl md:text-2xl mb-1">
            部落冲突升级规划助手
          </h1>
          <p className="text-sub text-xs md:text-sm">
            上传 JSON · 自动分析基地 · 本地通知提醒
          </p>
          {playerInfo && (
            <p className="mt-2 text-xs text-muted">
              {playerInfo.player_name || playerInfo.player_tag}
              <span className="mx-1.5">·</span>
              <span className="text-gold">大本 Lv{playerInfo.town_hall_level}</span>
            </p>
          )}
        </header>

        {/* ======== 数据过期警告 ======== */}
        {staleWarning && (
          <div
            className="w-full mb-3 p-3 rounded text-xs flex items-start gap-2"
            style={{
              background: "var(--color-warning-bg)",
              border: "1.5px solid var(--color-warning)",
              color: "var(--color-warning)",
            }}
          >
            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
            <span>{getStaleMessage(lastUploadAt || undefined)}</span>
          </div>
        )}

        {/* ======== 上传区域 ======== */}
        <div className="animate-fade-up">
          <UploadSection
            jsonInput={jsonInput}
            onJsonChange={setJsonInput}
            onSubmit={handleSubmit}
            loading={loading}
            exportTimeLabel={exportTimeLabel}
          />
        </div>

        {/* ======== 升级数据面板 ======== */}
        {upgrades.length > 0 && (
          <div className="animate-fade-up space-y-4">
            <StatsCards
              playerInfo={playerInfo}
              activeCount={activeUpgrades.length}
              completedCount={completedUpgrades.length}
              settings={settings}
            />

            {/* 基地简述（评分等级 + 风格一行）*/}
            {baseScore && analysis && (
              <div className="coc-card p-3 flex items-center justify-between text-sm">
                <span className="text-sub">
                  基地评分
                  <span className="coc-countdown font-bold ml-1.5">{baseScore.total}</span>
                  <span className="text-muted text-xs ml-1">/100</span>
                </span>
                <span className="text-gold font-semibold">{baseScore.grade} 级</span>
                <span className="text-muted text-xs">{analysis.styleDescription}</span>
              </div>
            )}

            {/* 即将完成 (高亮) */}
            {nextUpgrade && (
              <section className="w-full mb-4">
                <div className="coc-divider">
                  <span className="text-danger">即将完成</span>
                </div>
                <NextCompletingCard item={nextUpgrade} />
              </section>
            )}

            {/* 工人 / 实验室 */}
            {idleTimes && <BuilderLabStatus idleTimes={idleTimes} />}

            {/* 通知设置（Capacitor 本地通知：APP 关闭也能提醒）*/}
            {notifyStatus && settings && (
              <NotifySettingsPanel
                status={notifyStatus}
                settings={settings}
                onUpdateSettings={updateSettings}
                onEnableNotify={handleEnableNotify}
                onClearNotifyState={handleClearNotifyState}
              />
            )}

            {/* 操作栏 */}
            <div className="w-full flex gap-2 mb-4">
              <button onClick={handleRefresh} disabled={loading} className="coc-btn-secondary flex-1 py-2 text-sm">
                {loading ? "解析中..." : "重新解析"}
              </button>
            </div>

            {/* 分类筛选 */}
            <CategoryFilter
              categories={categories}
              activeCategory={activeCategory}
              activeUpgrades={activeUpgrades}
              onSelect={setActiveCategory}
            />

            {/* 升级进行中 */}
            <UpgradeList items={filteredActive} />

            {/* 最近完成 */}
            <CompletedList items={completedUpgrades} />

            {/* 基地详细评分 + 分析（升级列表后）*/}
            <BaseScoreCard score={baseScore} />
            <BaseAnalysisPanel analysis={analysis} />
          </div>
        )}

        {/* ======== 工具栏 ======== */}
        {upgrades.length > 0 && (
          <div className="w-full flex gap-2 mb-4 animate-fade-up">
            <button onClick={handleClearAll} className="coc-btn-secondary text-xs py-2 flex-1 text-danger">
              清除所有数据
            </button>
          </div>
        )}

        {/* ======== 教程区 ======== */}
        <CollapsibleGuide />

        {/* ======== 空状态 ======== */}
        {upgrades.length === 0 && !loading && (
          <EmptyState title="暂无升级数据" desc="请在上方粘贴 CoC JSON 数据开始追踪" />
        )}

        {/* ======== Loading ======== */}
        {loading && upgrades.length === 0 && (
          <div className="w-full max-w-sm py-16 flex flex-col items-center gap-3">
            <div className="skeleton w-12 h-12 rounded-full" />
            <div className="skeleton w-40 h-3 rounded-full" />
          </div>
        )}

        <footer className="mt-4 text-center text-muted text-xs pb-6 safe-area-bottom">
          <p>纯本地安卓 APP · 数据本地存储 · 离线运行 · 无需服务器</p>
          <p className="mt-1 text-[10px]">v{CURRENT_VERSION}</p>
        </footer>
      </main>

      {/* ======== 电池优化引导弹窗（国产厂商首次启动时显示）======== */}
      <Modal
        open={showBatteryDialog}
        onClose={() => setShowBatteryDialog(false)}
        title="后台运行提醒"
        footer={
          <>
            <button
              onClick={() => setShowBatteryDialog(false)}
              className="coc-btn-secondary text-xs !py-2 !px-4"
            >
              稍后
            </button>
            <button
              onClick={() => {
                setShowBatteryDialog(false);
                openBatteryOptimizationSettings();
              }}
              className="coc-btn text-xs !py-2 !px-4"
            >
              去设置
            </button>
            <Link
              href="/settings"
              onClick={() => setShowBatteryDialog(false)}
              className="coc-btn-secondary text-xs !py-2 !px-4"
            >
              查看教程
            </Link>
          </>
        }
      >
        <div className="space-y-3 text-sm text-sub">
          <p>
            为了保证升级提醒正常工作，请允许后台运行并关闭电池优化。
          </p>
          {batteryStatus && (
            <div className="coc-card p-3 text-xs space-y-1">
              <p>设备厂商：<span className="text-gold font-bold">{batteryStatus.manufacturer.toUpperCase()}</span></p>
              <p>需要自启动权限：{batteryStatus.needsAutostart ? "是" : "否"}</p>
              <p>需要省电白名单：{batteryStatus.needsPowerSaveWhitelist ? "是" : "否"}</p>
            </div>
          )}
          <p className="text-warning text-xs">
            ⚠️ 国产安卓系统会主动杀后台进程，不设置可能导致 APP 关闭时通知不弹出。
          </p>
          <p className="text-muted text-xs">
            在设置页面可以查看详细的厂商教程（小米 / 华为 / OPPO / vivo 等）。
          </p>
        </div>
      </Modal>

      {/* ======== 更新提示弹窗（GitHub 发现新版本时显示）======== */}
      <Modal
        open={showUpdateModal && !!updateResult?.release}
        onClose={() => setShowUpdateModal(false)}
        title={`发现新版本 ${updateResult?.latestTag ?? ""}`}
        maxWidth="max-w-lg"
        footer={
          <>
            <button
              onClick={() => setShowUpdateModal(false)}
              className="coc-btn-secondary text-xs !py-2 !px-4"
            >
              稍后提醒
            </button>
            <button
              onClick={() => {
                if (updateResult?.apkUrl) {
                  openApkDownload(updateResult.apkUrl);
                  toast.success("正在打开浏览器下载...", { className: "toast-success" });
                } else {
                  openReleasesPage();
                }
                setShowUpdateModal(false);
              }}
              className="coc-btn text-xs !py-2 !px-4"
            >
              立即更新
            </button>
          </>
        }
      >
        {updateResult?.release && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="coc-card p-2">
                <p className="text-muted text-[10px]">当前版本</p>
                <p className="text-main font-bold">v{updateResult.currentVersion}</p>
              </div>
              <div className="coc-card p-2">
                <p className="text-muted text-[10px]">最新版本</p>
                <p className="text-gold font-bold">{updateResult.latestTag}</p>
              </div>
              <div className="coc-card p-2">
                <p className="text-muted text-[10px]">发布时间</p>
                <p className="text-main">{formatPublishedAt(updateResult.release.published_at)}</p>
              </div>
              <div className="coc-card p-2">
                <p className="text-muted text-[10px]">APK 大小</p>
                <p className="text-main">{updateResult.apkSize ? formatApkSize(updateResult.apkSize) : "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-1 font-semibold">更新日志</p>
              <div
                className="coc-card p-3 text-xs prose-update-log max-h-60 overflow-y-auto"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(updateResult.release.body || "（无更新日志）"),
                }}
              />
            </div>
            {!updateResult.apkUrl && (
              <p className="text-[11px] text-warning">
                ⚠️ 此 Release 未附带 APK 资源，将跳转到 GitHub Releases 页面。
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
