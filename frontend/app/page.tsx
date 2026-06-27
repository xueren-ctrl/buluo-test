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
import {
  registerSW,
  registerPeriodicSync,
  triggerSWNotifyCheck,
} from "@/lib/notification-system";
import {
  saveUpgrades,
  loadAll,
  saveUserData,
  resetAll,
  loadSettings,
  saveSettings,
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
import { CollapsibleGuide } from "@/components/CollapsibleGuide";
import { EmptyState } from "@/components/EmptyState";
import { BaseAnalysisPanel } from "@/components/BaseAnalysisPanel";
import { BaseScoreCard } from "@/components/BaseScoreCard";
import { ThemeToggle } from "@/components/ThemeToggle";

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

      // 3. 注册 Service Worker + Periodic Sync
      // 新 SW 激活后自动刷新页面一次（无需用户操作），用 sessionStorage 防止死循环
      try {
        const reg = await registerSW();
        if (cancelled) return;
        if (reg) {
          registerPeriodicSync().catch(() => {});
          // App 打开时立即让 SW 跑一次通知检查，补发所有已到期但未发送的通知
          triggerSWNotifyCheck();
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
  // 同时向 SW 发送 RUN_PERIODIC_CHECK，让 SW 也补发通知。
  useEffect(() => {
    let lastVisibleAt = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const gap = Date.now() - lastVisibleAt;
        // 离开超过 30 秒再回来才补发（避免快速切换抖动）
        if (gap > 30_000 && schedulerRef.current && upgrades.length > 0) {
          schedulerRef.current.catchUp(upgrades);
          triggerSWNotifyCheck();
        }
        lastVisibleAt = Date.now();
      } else {
        lastVisibleAt = Date.now();
      }
    };
    const onFocus = () => {
      if (schedulerRef.current && upgrades.length > 0) {
        schedulerRef.current.catchUp(upgrades);
        triggerSWNotifyCheck();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [upgrades]);

  // ── 30 分钟内即将到期的升级项：用 setTimeout 精确触发 ──
  // 调度器的 setInterval 是 30s tick，最迟 30s 后才发通知。
  // 对于即将到期的项，用 setTimeout 精确到秒，到期后立即触发 SW 通知检查。
  useEffect(() => {
    if (upgrades.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    const WINDOW_MS = 30 * 60 * 1000; // 30 分钟窗口

    for (const u of upgrades) {
      const finishMs = new Date(u.finish_time).getTime();
      const diff = finishMs - now;
      // 只对 0~30 分钟内到期的项设置精确 timer
      if (diff > 0 && diff <= WINDOW_MS) {
        const t = setTimeout(() => {
          // 到期后立即让页面调度器和 SW 都跑一次检查
          if (schedulerRef.current) {
            schedulerRef.current.catchUp(upgrades);
          }
          triggerSWNotifyCheck();
        }, diff + 500); // +500ms 确保过了 finish_time
        timers.push(t);
      }
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [upgrades]);

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

        {/* ======== 右上角主题切换按钮 ======== */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        {/* ======== 顶部 PWA 安装条（已合并到下方通知引导）======== */}

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
          <p>纯前端 PWA · 数据本地存储 · 无需服务器</p>
        </footer>
      </main>
    </>
  );
}
