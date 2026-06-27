"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  requestNotificationPermission,
  requestNotificationPermissionDetailed,
  registerSW,
  registerPeriodicSync,
  detectNotifyStatus,
  triggerSWNotifyCheck,
  type NotifyStatus,
} from "@/lib/notification-system";
import {
  saveUpgrades,
  loadAll,
  saveUserData,
  resetAll,
  loadSettings,
  saveSettings,
  clearNotifyState,
  saveVillage,
  type RawUpgradeRecord,
  type SchedulerSettings,
  type RestoredState,
} from "@/lib/indexeddb";
import { createScheduler, type Scheduler } from "@/lib/upgrade-scheduler";

import { UploadSection } from "@/components/UploadSection";
import { StatsCards } from "@/components/StatsCards";
import { NextCompletingCard } from "@/components/NextCompletingCard";
import { BuilderLabStatus } from "@/components/BuilderLabStatus";
import { CategoryFilter } from "@/components/CategoryFilter";
import { UpgradeList } from "@/components/UpgradeList";
import { CompletedList } from "@/components/CompletedList";
import { NotifySettingsPanel } from "@/components/NotifySettingsPanel";
import { CollapsibleGuide } from "@/components/CollapsibleGuide";
import { EmptyState } from "@/components/EmptyState";
import { BaseAnalysisPanel } from "@/components/BaseAnalysisPanel";
import { BaseScoreCard } from "@/components/BaseScoreCard";

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
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus>({
    browserNotifAvailable: false,
    browserNotifGranted: false,
    swRegistered: false,
    periodicSyncSupported: false,
    isInstalled: false,
  });

  const schedulerRef = useRef<Scheduler | null>(null);
  const pwa = usePwaInstall();

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

      // 3. 注册 Service Worker + Periodic Sync
      // 新 SW 激活后自动刷新页面一次（无需用户操作），用 sessionStorage 防止死循环
      try {
        const reg = await registerSW();
        if (cancelled) return;
        setNotifyStatus(detectNotifyStatus(reg));
        if (reg) {
          registerPeriodicSync().then((ok) => {
            if (!ok && reg) {
              setNotifyStatus(detectNotifyStatus(reg));
            }
          });
        }
      } catch {
        // ignore
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SW 更新自动刷新（无需用户操作）──────
  // 新 SW 激活后，自动刷新页面一次加载最新资源；用 sessionStorage 防止死循环
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshed = false;
    const onControllerChange = () => {
      if (refreshed) return;
      if (sessionStorage.getItem("sw-refreshed") === "1") {
        sessionStorage.removeItem("sw-refreshed");
        return;
      }
      refreshed = true;
      sessionStorage.setItem("sw-refreshed", "1");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  // ── 页面回到前台时立即跑一次 tick（补发漏掉的通知）──
  // 浏览器在页面隐藏时会节流 setInterval（最低 1Hz 甚至暂停），
  // 用户切回前台时立即跑一次 catchUp 确保不漏。
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

  // ── 页面内 toast 兜底（系统通知不可用时）──
  useEffect(() => {
    const onInPageNotif = (e: Event) => {
      const { title, body } = (e as CustomEvent).detail;
      toast(`${title}\n${body}`, {
        icon: "🔔",
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
  const handleSubmit = async () => {
    if (!jsonInput.trim()) {
      toast.error("请粘贴 CoC JSON 数据", { className: "toast-error" });
      return;
    }
    try { JSON.parse(jsonInput); }
    catch { toast.error("JSON 格式不正确", { className: "toast-error" }); return; }

    setLoading(true);
    try {
      const activeClientId = clientId || createLocalClientId();
      if (!clientId) setClientId(activeClientId);
      const res = await processJson(jsonInput, activeClientId);

      await saveUserData({
        client_id: activeClientId,
        player_tag: res.player_info?.player_tag ?? null,
        player_name: res.player_info?.player_name ?? null,
        last_json_raw: jsonInput,
        last_upload_at: res.last_upload_at ?? null,
        last_sync_at: new Date().toISOString(),
      });

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

  // ── 开启通知权限 ─────────────────────
  const handleEnableNotify = async () => {
    const result = await requestNotificationPermissionDetailed();
    if (result.granted) {
      setNotifyStatus((s) => ({ ...s, browserNotifGranted: true }));
      toast.success("通知权限已开启，升级完成会自动提醒", { className: "toast-success", duration: 4000 });
      // 立即跑一次补发（可能已经有完成的）
      schedulerRef.current?.catchUp(upgrades);
      // 兜底：让 SW 也立即跑一次（页面关闭时也能补发）
      triggerSWNotifyCheck();
    } else {
      // 显示具体失败原因
      const msg = result.message || "通知权限未授予";
      toast.error(msg, { className: "toast-error", duration: 6000 });
      setNotifyStatus((s) => ({ ...s, ...detectNotifyStatus() }));
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
          duration: 3500,
          style: {
            background: "#1e293b",
            color: "#f1f5f9",
            border: "1px solid #334155",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />

      <main className="min-h-screen flex flex-col px-3 py-5 md:px-6 md:py-8 max-w-2xl mx-auto app-shell">

        {/* ======== 顶部 PWA 安装条（已合并到下方通知引导）======== */}

        {/* ======== Hero 区域 ======== */}
        <header className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-black gradient-title mb-1.5 tracking-tight">
            ⚔️ 部落冲突升级规划助手
          </h1>
          <p className="text-dark-400 text-sm max-w-md mx-auto leading-relaxed">
            上传 JSON → 自动分析基地 → 智能规划升级 → 本地通知提醒
          </p>
          {/* 实时时钟 — 证明页面每秒在刷新 */}
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800/50 border border-dark-700/50 text-xs text-dark-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-dark-300 tabular-nums">{new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span>
          </div>
          {playerInfo && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800/50 border border-dark-700/50 text-xs text-dark-400">
              <span>👤</span>
              <span className="text-dark-300">{playerInfo.player_name || playerInfo.player_tag}</span>
              <span>·</span>
              <span className="text-amber-400 font-medium">大本 Lv{playerInfo.town_hall_level}</span>
            </div>
          )}
        </header>

        {/* ======== 数据过期警告 ======== */}
        {staleWarning && (
          <div className="w-full mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
            <span>{getStaleMessage(lastUploadAt || undefined)}</span>
          </div>
        )}

        {/* ======== 通知引导（PWA 安装 + 通知权限）======== */}
        {upgrades.length > 0 && (
          <>
            {/* 非 PWA 模式：引导安装 PWA（系统通知中心必须安装 PWA）*/}
            {!pwa.installed && !notifyStatus.unsupportedReason && (
              <div className="w-full mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">📱</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-300 font-semibold mb-1">
                      安装到主屏幕后，通知才能在手机通知中心弹出
                    </p>
                    <p className="text-dark-400 text-[11px] leading-relaxed mb-2">
                      普通浏览器网页通知只在页面内显示，无法推送到系统通知中心。安装 PWA 后即使关闭页面也能收到通知。
                    </p>
                    {pwa.canInstall ? (
                      <button
                        onClick={pwa.showPrompt}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                      >
                        安装到主屏幕
                      </button>
                    ) : (
                      <p className="text-amber-300 text-[11px] font-semibold">
                        📲 Chrome 菜单 ⋮ → 添加到主屏幕
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PWA 模式但未授权通知 */}
            {pwa.installed && !notifyStatus.browserNotifGranted && !notifyStatus.unsupportedReason && (
              <div className="w-full mb-3 p-3 rounded-xl bg-brand-600/10 border border-brand-600/30 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-300 font-semibold mb-1">
                      升级完成后将自动通知，请先开启权限
                    </p>
                    <button
                      onClick={handleEnableNotify}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                    >
                      开启通知权限
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 不支持通知的环境 */}
            {notifyStatus.unsupportedReason && (
              <div className="w-full mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-red-300 font-semibold mb-1">
                      当前环境无法接收通知：{notifyStatus.unsupportedReason}
                    </p>
                    {notifyStatus.hint && (
                      <p className="text-dark-400 text-[11px] leading-relaxed">{notifyStatus.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ======== 上传区域 ======== */}
        <UploadSection
          jsonInput={jsonInput}
          onJsonChange={setJsonInput}
          onSubmit={handleSubmit}
          loading={loading}
          exportTimeLabel={exportTimeLabel}
        />

        {/* ======== 升级数据面板 ======== */}
        {upgrades.length > 0 && (
          <>
            <StatsCards
              playerInfo={playerInfo}
              activeCount={activeUpgrades.length}
              completedCount={completedUpgrades.length}
              settings={settings}
            />

            {/* 基地分析 + 评分（新增） */}
            <BaseScoreCard score={baseScore} />
            <BaseAnalysisPanel analysis={analysis} />

            {/* 即将完成 (高亮) */}
            {nextUpgrade && (
              <section className="w-full mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-red-400 tracking-wider uppercase">🔥 即将完成</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-red-500/30 to-transparent" />
                </div>
                <NextCompletingCard item={nextUpgrade} />
              </section>
            )}

            {/* 工人 / 实验室 */}
            {idleTimes && <BuilderLabStatus idleTimes={idleTimes} />}

            {/* 操作栏 */}
            <div className="w-full flex gap-2 mb-4">
              <button onClick={handleRefresh} disabled={loading} className="btn-secondary flex-1 py-2 text-sm">
                {loading ? "⏳ 解析中..." : "🔄 重新解析"}
              </button>
              {!notifyStatus.browserNotifGranted && (
                <button onClick={handleEnableNotify} className="btn-secondary flex-1 py-2 text-sm">
                  🔔 开启通知
                </button>
              )}
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
          </>
        )}

        {/* ======== 通知设置面板 ======== */}
        <NotifySettingsPanel
          status={notifyStatus}
          settings={settings}
          onUpdateSettings={updateSettings}
          onEnableNotify={handleEnableNotify}
          onClearNotifyState={async () => {
            await clearNotifyState();
            toast.success("已清除通知去重记录，将重新提醒", { className: "toast-success" });
          }}
        />

        {/* ======== 工具栏 ======== */}
        {upgrades.length > 0 && (
          <div className="w-full flex gap-2 mb-4">
            <button onClick={handleClearAll} className="btn-secondary text-xs py-2 flex-1 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40">
              🗑️ 清除所有数据
            </button>
          </div>
        )}

        {/* ======== 教程区 ======== */}
        <CollapsibleGuide />

        {/* ======== 空状态 ======== */}
        {upgrades.length === 0 && !loading && (
          <EmptyState emoji="📭" title="暂无升级数据" desc="请在上方粘贴 CoC JSON 数据开始追踪" />
        )}

        {/* ======== Loading ======== */}
        {loading && upgrades.length === 0 && (
          <div className="w-full max-w-sm py-16 flex flex-col items-center gap-3">
            <div className="skeleton w-12 h-12 rounded-full" />
            <div className="skeleton w-40 h-3 rounded-full" />
          </div>
        )}

        <footer className="mt-4 text-center text-dark-600 text-xs space-y-1 pb-6 safe-area-bottom">
          <p>纯前端 PWA · 数据本地存储 · 无需服务器</p>
          <p>仅使用用户手动导出的 JSON，不涉及模拟 / 抓包</p>
        </footer>
      </main>
    </>
  );
}
