"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import { uploadJson, getUpgrades } from "@/services/api";
import {
  CATEGORY_MAP,
  CATEGORY_ICON,
  getCategoryStyles,
  getUrgencyLevel,
  getUrgencyColor,
  DEFAULT_CATEGORY_COLOR,
} from "@/types";
import {
  formatRemaining,
  formatCompactRemaining,
  formatFinishTime,
  getRemainingSeconds,
  getStaleMessage,
  isDataStale,
  getZhName,
  getCategoryIcon as getZhIcon,
  getCategoryBg,
  getCategoryBorder,
  getCategoryText,
  getCategoryBadge,
} from "@/lib/utils";
import type { UpgradeItem, IdleTimes, PlayerInfo } from "@/types";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  requestNotificationPermission,
  registerSW,
  scheduleCompletionNotifications,
  detectNotifyStatus,
  subscribePwaPush,
  unsubscribePwaPush,
  type NotifyStatus,
} from "@/lib/notification-system";
import {
  saveUpgrades,
  loadUpgrades,
  loadUserData,
  saveUserData,
  resetAll,
  type RawUpgradeRecord,
} from "@/lib/indexeddb";
import { getUpgradeDisplay, ITEM_CATEGORY_LABELS, CATEGORY_BG_COLORS } from "@/lib/coc-assets";

/* ================================================================
   首页 — "部落冲突升级助手" PWA 应用级体验
   ================================================================ */

const MAX_JSON_LINES = 10;
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
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([]);
  const [idleTimes, setIdleTimes] = useState<IdleTimes | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [prevUpgradeKeys, setPrevUpgradeKeys] = useState<Set<string>>(new Set());

  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // ── PWA 安装 ──────────────────────────
  const pwa = usePwaInstall();

  // ── 实时倒计时 ────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── 初始化: 从 IndexedDB 恢复 + SW 注册 ──
  useEffect(() => {
    // 从 IndexedDB 恢复
    async function init() {
      const userData = await loadUserData();
      const storedUpgrades = await loadUpgrades();
      const nextClientId = userData?.client_id || createLocalClientId();
      setClientId(nextClientId);

      if (userData?.last_json_raw) {
        setJsonInput(userData.last_json_raw);
      }
      if (userData?.last_upload_at) {
        setLastUploadAt(userData.last_upload_at);
      }
      if (storedUpgrades.length > 0) {
        setUpgrades(storedUpgrades as UpgradeItem[]);
      }
      if (!userData?.client_id) {
        await saveUserData({
          client_id: nextClientId,
          player_tag: userData?.player_tag ?? null,
          player_name: userData?.player_name ?? null,
          last_json_raw: userData?.last_json_raw ?? null,
          last_upload_at: userData?.last_upload_at ?? null,
        });
      }

      // 尝试从 API 加载
      try {
        const res = await getUpgrades(nextClientId);
        if (res.success && res.upgrades.length > 0) {
          applyData(res);
        }
      } catch { /* ignore */ }

      // 注册 Service Worker
      registerSW().then((sw) => {
        if (sw) console.log("[PWA] Service Worker 已注册");
      });
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 数据过期检测 ──────────────────────
  useEffect(() => {
    if (lastUploadAt && isDataStale(lastUploadAt)) setStaleWarning(true);
  }, [lastUploadAt]);

  // ── 数据持久化 ────────────────────────
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
  }, [upgrades]);

  function applyData(
    res: {
      upgrades: UpgradeItem[];
      idle_times: IdleTimes;
      player_info?: PlayerInfo | null;
      last_upload_at?: string | null;
    }
  ) {
    setUpgrades(res.upgrades);
    setIdleTimes(res.idle_times);
    setPlayerInfo(res.player_info || null);
    setLastUploadAt(res.last_upload_at || null);
    const keys = new Set(res.upgrades.map((u) => `${u.category}:${u.item_name}`));
    setPrevUpgradeKeys(keys);
  }

  // ── 上传 ──────────────────────────────
  const handleSubmit = async () => {
    if (!jsonInput.trim()) {
      toast.error("请粘贴 CoC JSON 数据", { className: "toast-error" });
      return;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(jsonInput); }
    catch { toast.error("JSON 格式不正确", { className: "toast-error" }); return; }

    setLoading(true);
    try {
      const activeClientId = clientId || createLocalClientId();
      if (!clientId) setClientId(activeClientId);
      const res = await uploadJson(jsonInput, activeClientId);
      if (res.success) {
        // 持久化用户数据
        saveUserData({
          client_id: activeClientId,
          player_tag: (res as any).player_info?.player_tag ?? null,
          player_name: (res as any).player_info?.player_name ?? null,
          last_json_raw: jsonInput,
          last_upload_at: res.last_upload_at ?? null,
        });

        // Diff 提示
        const diff = (res as any)?.diff as { new_upgrades?: string[]; completed_upgrades?: string[] } | undefined;
        if (diff?.new_upgrades?.length || diff?.completed_upgrades?.length) {
          const msgs: string[] = [];
          if (diff.new_upgrades?.length) msgs.push(`新增: ${diff.new_upgrades.slice(0, 3).join(", ")}`);
          if (diff.completed_upgrades?.length) msgs.push(`已完成: ${diff.completed_upgrades.slice(0, 3).join(", ")}`);
          toast.success(`解析成功! ${msgs.join(" | ")}`, { className: "toast-success" });
        } else {
          toast.success(`解析成功! 发现 ${res.upgrades.length} 个升级项`, { className: "toast-success" });
        }

        applyData(res);
        setCollapsed(true);
        setStaleWarning(false);
        if (jsonRef.current) jsonRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "上传失败", { className: "toast-error" });
    } finally {
      setLoading(false);
    }
  };

  // ── 刷新 / 通知 ───────────────────────
  const handleRefresh = async () => {
    if (!clientId) return;
    setRefreshing(true);
    try {
      const res = await getUpgrades(clientId);
      if (res.success) { applyData(res); toast.success("数据已刷新", { className: "toast-success" }); }
    } catch { toast.error("刷新失败", { className: "toast-error" }); }
    finally { setRefreshing(false); }
  };

  const handleNotify = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      toast.error("请先允许浏览器通知权限", { className: "toast-error" });
      return;
    }
    scheduleCompletionNotifications(upgrades.map((u) => ({
      item_name: u.item_name,
      item_level: u.item_level,
      finish_time: u.finish_time,
      category: u.category,
    })));
    toast.success("已为 24 小时内完成的升级安排本地提醒", { className: "toast-success" });
  };

  // ── 浏览器通知权限 ───────────────────
  const handleBrowserNotif = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast.success("浏览器通知权限已授予", { className: "toast-success" });
      // 安排当前升级的通知
      scheduleCompletionNotifications(upgrades.map((u) => ({
        item_name: u.item_name,
        item_level: u.item_level,
        finish_time: u.finish_time,
        category: u.category,
      })));
    }
  };

  // ── PWA 推送订阅 ──────────────────────
  const handlePwaSubscribe = async () => {
    try {
      const sub = await subscribePwaPush();
      if (sub) {
        toast.success("PWA 推送订阅成功!", { className: "toast-success" });
      } else {
        toast.error("推送订阅失败，请检查浏览器兼容性", { className: "toast-error" });
      }
    } catch {
      toast.error("推送订阅失败", { className: "toast-error" });
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
    setJsonInput("");
    toast.success("所有数据已清除", { className: "toast-success" });
  };

  // ── 排序: 按剩余时间升序 ──────────────
  const sortedUpgrades = [...upgrades].sort(
    (a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime()
  );

  const activeUpgrades = sortedUpgrades.filter((u) => getRemainingSeconds(u.finish_time) > 0);
  const completedUpgrades = sortedUpgrades.filter((u) => getRemainingSeconds(u.finish_time) <= 0);
  const nextUpgrade = activeUpgrades[0] || null;

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

      <main className="min-h-screen flex flex-col px-3 py-5 md:px-6 md:py-8 max-w-2xl mx-auto">

        {/* ======== 顶部 PWA 安装条 ======== */}
        {pwa.status === "deferred" && (
          <div className="w-full mb-4 glass-card p-3 flex items-center justify-between border-brand-500/40">
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <span className="text-sm text-dark-200">安装到主屏幕获得最佳体验</span>
            </div>
            <button
              onClick={pwa.showPrompt}
              className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors active:scale-95"
            >
              安装
            </button>
          </div>
        )}

        {/* ======== Hero 区域 ======== */}
        <header className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-black gradient-title mb-1.5 tracking-tight">
            ⚔️ 部落冲突升级助手
          </h1>
          <p className="text-dark-400 text-sm max-w-md mx-auto leading-relaxed">
            上传游戏 JSON → 自动追踪进度 → 本地通知提醒
          </p>
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

        {/* ======== 上传区域 ======== */}
        <section className={`w-full glass-card p-4 mb-4 border-brand-500/20 transition-all duration-300 ${collapsed ? "mb-1.5" : ""}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-between text-sm font-semibold text-brand-300 mb-2 hover:text-brand-200 transition-colors"
          >
            <span>📋 上传数据</span>
            <span className={`text-xs text-dark-500 transition-transform duration-200 ${collapsed ? "rotate-[-90deg]" : ""}`}>▼</span>
          </button>

          <div className={`collapsible-content ${collapsed ? "collapsed" : "expanded"}`}>
            {/* JSON 输入 */}
            <div className="mb-3">
              <label className="block text-xs text-dark-400 mb-1">
                CoC JSON 数据 <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={jsonRef}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={"粘贴游戏导出的 JSON …\n\n获取方法: 游戏内 设置 → 更多设置 → 数据导出 → 复制"}
                rows={8}
                className="w-full bg-dark-900/60 border border-dark-600 rounded-xl px-3.5 py-2.5 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-mono resize-y"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  解析中...
                </>
              ) : "🚀 开始解析"}
            </button>
          </div>
        </section>

        {/* ======== 升级数据面板 ======== */}
        {upgrades.length > 0 && (
          <>
            {/* ---- 统计卡片 ---- */}
            <section className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
              <div className="stat-card">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-lg">👤</span>
                </div>
                <p className="text-sm font-bold text-dark-100 truncate px-1">
                  {playerInfo?.player_tag || "—"}
                </p>
                <p className="text-xs text-dark-500">玩家标签</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-lg">🏠</span>
                </div>
                <p className="text-sm font-bold text-amber-400">
                  {playerInfo?.town_hall_level ? `Lv${playerInfo.town_hall_level}` : "—"}
                </p>
                <p className="text-xs text-dark-500">大本等级</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-lg">⏳</span>
                </div>
                <p className="text-sm font-bold text-brand-400">{activeUpgrades.length}</p>
                <p className="text-xs text-dark-500">进行中</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-lg">✅</span>
                </div>
                <p className="text-sm font-bold text-green-400">{completedUpgrades.length}</p>
                <p className="text-xs text-dark-500">已完成</p>
              </div>
            </section>

            {/* ---- 即将完成 (高亮) ---- */}
            {nextUpgrade && (
              <section className="w-full mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-red-400 tracking-wider uppercase">🔥 最近完成</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-red-500/30 to-transparent" />
                </div>
                <NextCompletingCard item={nextUpgrade} />
              </section>
            )}

            {/* ---- 工人 / 实验室 ---- */}
            {idleTimes && (
              <section className="w-full grid grid-cols-2 gap-2.5 mb-4">
                <div className="glass-card p-3 border-dark-700/50 flex items-center gap-2.5">
                  <span className="text-lg">🔨</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-dark-500">工人空闲</p>
                    <p className="text-xs font-semibold text-dark-200 truncate">
                      {idleTimes.builder_idle_at ? formatFinishTime(idleTimes.builder_idle_at) : "空闲 ✅"}
                    </p>
                  </div>
                </div>
                <div className="glass-card p-3 border-dark-700/50 flex items-center gap-2.5">
                  <span className="text-lg">🧪</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-dark-500">实验室空闲</p>
                    <p className="text-xs font-semibold text-dark-200 truncate">
                      {idleTimes.lab_idle_at ? formatFinishTime(idleTimes.lab_idle_at) : "空闲 ✅"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ---- 操作栏 ---- */}
            <div className="w-full flex gap-2 mb-4">
              <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary flex-1 py-2 text-sm">
                {refreshing ? "⏳ 刷新中..." : "🔄 刷新"}
              </button>
              <button onClick={handleNotify} disabled={refreshing || upgrades.length === 0} className="btn-secondary flex-1 py-2 text-sm">
                📢 安排本地提醒
              </button>
            </div>

            {/* ---- 中文升级卡片 ---- */}
            <SectionTitle title="📊 升级进行中" count={activeUpgrades.length} />

            {activeUpgrades.length === 0 ? (
              <EmptyState emoji="🎉" title="当前没有升级项目" desc="所有工人和实验室都在空闲" />
            ) : (
              <div className="space-y-2">
                {activeUpgrades.map((upg) => (
                  <UpgradeCardV2 key={upg.id} item={upg} />
                ))}
              </div>
            )}

            {/* ---- 最近完成 ---- */}
            {completedUpgrades.length > 0 && (
              <section className="w-full mt-5 mb-4">
                <SectionTitle title="✅ 最近完成" count={Math.min(completedUpgrades.length, 10)} />
                <div className="space-y-1.5">
                  {completedUpgrades.slice(0, 10).map((upg) => (
                    <CompletedCardV2 key={upg.id} item={upg} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ======== 通知设置面板 ======== */}
        <NotifySettingsPanel
          onBrowserNotif={handleBrowserNotif}
          onPwaSubscribe={handlePwaSubscribe}
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

        <footer className="mt-4 text-center text-dark-600 text-xs space-y-1 pb-6">
          <p>升级提醒使用浏览器本地通知，不依赖 WxPusher 或自建服务器</p>
          <p>仅使用用户手动导出的 JSON，不涉及模拟 / 抓包</p>
        </footer>
      </main>
    </>
  );
}

/* ═══════════════════════════════════════════════
   子组件
   ═══════════════════════════════════════════════ */

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="relative flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-gradient-to-r from-dark-600/50 to-transparent" />
      <span className="text-dark-400 text-xs uppercase tracking-widest">{title} ({count})</span>
      <div className="flex-1 h-px bg-gradient-to-l from-dark-600/50 to-transparent" />
    </div>
  );
}

function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="w-full glass-card p-8 text-center">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-dark-300 text-sm font-medium">{title}</p>
      <p className="text-dark-500 text-xs mt-1">{desc}</p>
    </div>
  );
}

function CollapsibleGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="w-full glass-card p-4 mb-4 border-brand-500/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-brand-300"
      >
        <span>📖 使用说明</span>
        <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      <div className={`collapsible-content mt-3 ${open ? "expanded" : "collapsed"}`}>
        <div className="text-xs text-dark-400 space-y-2">
          <p><strong className="text-dark-200">① 导出数据</strong> → 游戏内 设置 → 更多设置 → 数据导出 → 复制</p>
          <p><strong className="text-dark-200">② 粘贴 JSON</strong> → 点击上方输入框 → 点「开始解析」</p>
          <p><strong className="text-dark-200">③ 开启通知</strong> → 在「通知设置」里允许浏览器通知</p>
          <p><strong className="text-dark-200">④ 安排提醒</strong> → 点击「安排本地提醒」</p>
          <p><strong className="text-dark-200">⑤ 安装应用</strong> → 浏览器出现安装按钮时添加到主屏幕</p>
        </div>
      </div>
    </section>
  );
}

/* ── 即将完成卡片 ───────────────────── */
function NextCompletingCard({ item }: { item: UpgradeItem }) {
  const remaining = getRemainingSeconds(item.finish_time);
  const done = remaining <= 0;
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);

  return (
    <div className={`glass-card overflow-hidden p-3 border-red-500/40 bg-gradient-to-r ${done ? "from-green-500/10 to-transparent" : "from-red-500/15 to-transparent"} animate-urgent`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-dark-900/60 border border-red-500/30`}>
          {display.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{display.zh}</p>
          <p className="text-xs text-dark-400">
            {done ? "✅ 已完成!" : `剩余 ${formatCompactRemaining(remaining)}`}
          </p>
        </div>
        {!done && <div className={`text-base font-bold ${remaining <= 1800 ? "text-red-400" : "text-amber-400"}`}>
          {formatCompactRemaining(remaining)}
        </div>}
      </div>
    </div>
  );
}

/* ── 升级项卡片 V2 ─────────────────── */
function UpgradeCardV2({ item }: { item: UpgradeItem }) {
  const remaining = getRemainingSeconds(item.finish_time);
  const done = remaining <= 0;
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);
  const barPercent = item.timer_seconds && item.timer_seconds > 0
    ? Math.min(100, Math.max(2, ((item.timer_seconds - remaining) / item.timer_seconds) * 100))
    : 0;

  const cardBg = CATEGORY_BG_COLORS[item.category] || "from-gray-800/20 to-gray-800/5";
  const cardBorder = getCategoryBorder(item.category);
  const cardColor = getCategoryText(item.category);

  const urgency = getUrgencyLevel(remaining);
  const urgentAnim = urgency === "urgent" && !done ? "animate-urgent" : "";

  return (
    <div className={`glass-card overflow-hidden ${cardBorder} ${urgentAnim} transition-all duration-300 hover:translate-y-[-1px]`}>
      <div className="flex items-center gap-2.5 p-3">
        {/* 图标 */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-dark-900/50 border ${cardBorder}`}>
          {display.icon}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-semibold text-sm ${cardColor}`}>{display.zh}</span>
            {item.notified && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">已通知</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-dark-500">
            <span>{done ? "✅ 已完成" : `预计 ${formatFinishTime(item.finish_time)}`}</span>
          </div>
        </div>

        {/* 倒计时 */}
        <div className="text-right flex-shrink-0">
          <div className={`text-base font-bold tabular-nums ${done ? "text-green-400" : remaining <= 3600 ? "text-red-400" : remaining <= 7200 ? "text-amber-400" : "text-dark-200"}`}>
            {done ? "✅" : formatCompactRemaining(remaining)}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      {!done && (
        <div className="progress-bar mx-3 mb-2">
          <div
            className={`progress-bar-fill h-full rounded-full bg-gradient-to-r ${
              urgency === "urgent" ? "from-red-600 to-red-400"
                : urgency === "soon" ? "from-amber-600 to-amber-400"
                : "from-brand-600 to-brand-400"
            }`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ── 已完成卡片 V2 ─────────────────── */
function CompletedCardV2({ item }: { item: UpgradeItem }) {
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);
  const cardBorder = getCategoryBorder(item.category);

  return (
    <div className={`glass-card p-2.5 border-green-500/20 bg-gradient-to-r from-green-500/6 to-transparent flex items-center justify-between`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base text-green-500/50">{display.icon}</span>
        <span className={`font-medium text-sm truncate ${getCategoryText(item.category)}`}>
          {display.zh}
        </span>
      </div>
      <span className="text-[10px] text-dark-500 flex-shrink-0 ml-2">
        {formatFinishTime(item.finish_time)}
      </span>
    </div>
  );
}

/* ── 通知设置面板 ──────────────────── */
const DEFAULT_NOTIFY_STATUS: NotifyStatus = {
  browserNotifAvailable: false,
  browserNotifGranted: false,
  pwaPushAvailable: false,
  isInstalled: false,
};

function NotifySettingsPanel({
  onBrowserNotif,
  onPwaSubscribe,
}: {
  onBrowserNotif: () => void;
  onPwaSubscribe: () => void;
}) {
  const [status, setStatus] = useState<NotifyStatus>(DEFAULT_NOTIFY_STATUS);

  useEffect(() => {
    setStatus(detectNotifyStatus());
    const interval = setInterval(() => setStatus(detectNotifyStatus()), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="w-full glass-card p-4 mb-4 border-dark-700/50">
      <h3 className="text-sm font-semibold text-dark-200 mb-3">🔔 通知设置</h3>
      <div className="space-y-2">
        {/* 浏览器通知 */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-dark-400">
            浏览器通知
            {!status.browserNotifAvailable && <span className="text-red-400 ml-1">(不支持)</span>}
            {status.browserNotifAvailable && !status.browserNotifGranted && <span className="text-amber-400 ml-1">(未授权)</span>}
          </span>
          <button
            onClick={onBrowserNotif}
            disabled={!status.browserNotifAvailable}
            className={`px-3 py-1 rounded-lg transition-colors ${
              status.browserNotifGranted
                ? "bg-green-500/20 text-green-400"
                : status.browserNotifAvailable
                  ? "bg-brand-600 hover:bg-brand-500 text-white"
                  : "bg-dark-700 text-dark-600 cursor-not-allowed"
            }`}
          >
            {status.browserNotifGranted ? "已开启" : "申请权限"}
          </button>
        </div>

        {/* PWA 推送 */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-dark-400">
            PWA 推送
            {!status.pwaPushAvailable && <span className="text-red-400 ml-1">(不支持)</span>}
          </span>
          <button
            onClick={onPwaSubscribe}
            disabled={!status.pwaPushAvailable}
            className={`px-3 py-1 rounded-lg transition-colors ${
              status.isInstalled
                ? "bg-green-500/20 text-green-400"
                : status.pwaPushAvailable
                  ? "bg-brand-600 hover:bg-brand-500 text-white"
                  : "bg-dark-700 text-dark-600 cursor-not-allowed"
            }`}
          >
            {status.isInstalled ? "已安装" : "订阅推送"}
          </button>
        </div>

        {/* 安装状态 */}
        {status.isInstalled && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span>✅</span>
            <span>已从主屏幕打开 — PWA 安装成功</span>
          </div>
        )}
      </div>
    </section>
  );
}
