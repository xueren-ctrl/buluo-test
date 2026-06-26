/**
 * 部落冲突升级助手 PWA - 首页
 * 功能: JSON上传 → 智能分析 → 升级规划 → 通知提醒
 */

"use client";

import { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { uploadJson, getUpgrades } from "@/services/api";
import { formatRemaining, formatCompactRemaining, formatFinishTime, getRemainingSeconds, isDataStale } from "@/lib/utils";
import type { UpgradeItem, IdleTimes, PlayerInfo } from "@/types";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { requestNotificationPermission, registerSW, scheduleCompletionNotifications } from "@/lib/notification-system";
import { saveUpgrades, loadUpgrades, loadUserData, saveUserData, resetAll } from "@/lib/indexeddb";
import { getUpgradeDisplay } from "@/lib/coc-assets";
import {
  generateDailyReport,
  predictWorkerAvailability,
  generateUpgradeRoute,
  calculateBaseScores,
} from "@/lib/upgrade-planner";

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
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([]);
  const [idleTimes, setIdleTimes] = useState<IdleTimes | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // ── 智能分析数据 ──────────────────────
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [workerPredictions, setWorkerPredictions] = useState<any[]>([]);
  const [upgradeRoute, setUpgradeRoute] = useState<any[]>([]);
  const [baseScores, setBaseScores] = useState<any>(null);

  const [staleWarning, setStaleWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<"upgrades" | "planner" | "scores">("upgrades");

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
    async function init() {
      const userData = await loadUserData();
      const storedUpgrades = await loadUpgrades();
      const nextClientId = userData?.client_id || createLocalClientId();
      setClientId(nextClientId);

      if (userData?.last_json_raw) setJsonInput(userData.last_json_raw);
      if (userData?.last_upload_at) setLastUploadAt(userData.last_upload_at);
      if (storedUpgrades.length > 0) setUpgrades(storedUpgrades as UpgradeItem[]);

      try {
        const res = await getUpgrades(nextClientId);
        if (res.success && res.upgrades.length > 0) applyData(res);
      } catch { /* ignore */ }

      registerSW();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 数据过期检测 ──────────────────────
  useEffect(() => {
    if (lastUploadAt && isDataStale(lastUploadAt)) setStaleWarning(true);
  }, [lastUploadAt]);

  // ── 智能分析更新 ──────────────────────
  useEffect(() => {
    if (upgrades.length > 0) {
      setDailyReport(generateDailyReport(upgrades, idleTimes, playerInfo));
      setWorkerPredictions(predictWorkerAvailability(upgrades, idleTimes));
      setUpgradeRoute(generateUpgradeRoute(upgrades, idleTimes?.builder_total || 5));
      setBaseScores(calculateBaseScores(upgrades, idleTimes, playerInfo));
    }
  }, [upgrades, idleTimes, playerInfo]);

  // ── 数据持久化 ────────────────────────
  useEffect(() => {
    if (upgrades.length === 0) return;
    const raw = upgrades.map((u) => ({
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

  function applyData(res: any) {
    setUpgrades(res.upgrades);
    setIdleTimes(res.idle_times);
    setPlayerInfo(res.player_info || null);
    setLastUploadAt(res.last_upload_at || null);
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
        saveUserData({
          client_id: activeClientId,
          player_tag: (res as any).player_info?.player_tag ?? null,
          player_name: (res as any).player_info?.player_name ?? null,
          last_json_raw: jsonInput,
          last_upload_at: res.last_upload_at ?? null,
        });
        toast.success(`解析成功! 发现 ${res.upgrades.length} 个升级项`, { className: "toast-success" });
        applyData(res);
        setCollapsed(true);
        setStaleWarning(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "上传失败", { className: "toast-error" });
    } finally {
      setLoading(false);
    }
  };

  // ── 操作 ──────────────────────────────
  const handleRefresh = async () => {
    if (!clientId) return;
    try {
      const res = await getUpgrades(clientId);
      if (res.success) { applyData(res); toast.success("数据已刷新"); }
    } catch { toast.error("刷新失败"); }
  };

  const handleNotify = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { toast.error("请先允许浏览器通知权限"); return; }
    scheduleCompletionNotifications(upgrades.map((u) => ({
      item_name: u.item_name, item_level: u.item_level,
      finish_time: u.finish_time, category: u.category,
    })));
    toast.success("已为 24 小时内完成的升级安排本地提醒");
  };

  const handleClearAll = async () => {
    if (!confirm("确定要清除所有本地数据吗? 此操作不可撤销。")) return;
    await resetAll();
    setUpgrades([]); setIdleTimes(null); setPlayerInfo(null);
    setLastUploadAt(null); setJsonInput("");
    toast.success("所有数据已清除");
  };

  const activeUpgrades = [...upgrades].sort(
    (a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime()
  ).filter((u) => getRemainingSeconds(u.finish_time) > 0);

  const completedUpgrades = [...upgrades].sort(
    (a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime()
  ).filter((u) => getRemainingSeconds(u.finish_time) <= 0);

  const nextUpgrade = activeUpgrades[0] || null;

  /* ════════ RENDER ════════ */
  return (
    <>
      <Toaster position="top-center" toastOptions={{
        duration: 3500,
        style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155", borderRadius: "12px" },
      }} />

      <main className="min-h-screen flex flex-col px-3 py-5 md:px-6 md:py-8 max-w-2xl mx-auto">
        {/* PWA 安装条 */}
        {pwa.status === "deferred" && (
          <div className="w-full mb-4 glass-card p-3 flex items-center justify-between border-brand-500/40">
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <span className="text-sm text-dark-200">安装到主屏幕获得最佳体验</span>
            </div>
            <button onClick={pwa.showPrompt} className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors active:scale-95">
              安装
            </button>
          </div>
        )}

        {/* Hero */}
        <header className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-black gradient-title mb-1.5 tracking-tight">
            ⚔️ 部落冲突升级规划助手
          </h1>
          <p className="text-dark-400 text-sm max-w-md mx-auto leading-relaxed">
            上传游戏 JSON → 智能分析 → 升级规划 → 通知提醒
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

        {/* 数据过期警告 */}
        {staleWarning && (
          <div className="w-full mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
            <span>{isDataStale(lastUploadAt || undefined) ? "数据可能已过时，建议重新上传" : ""}</span>
          </div>
        )}

        {/* 上传区域 */}
        <section className={`w-full glass-card p-4 mb-4 border-brand-500/20 transition-all duration-300 ${collapsed ? "mb-1.5" : ""}`}>
          <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-between text-sm font-semibold text-brand-300 mb-2 hover:text-brand-200 transition-colors">
            <span>📋 上传数据</span>
            <span className={`text-xs text-dark-500 transition-transform duration-200 ${collapsed ? "rotate-[-90deg]" : ""}`}>▼</span>
          </button>
          <div className={`collapsible-content ${collapsed ? "collapsed" : "expanded"}`}>
            <div className="mb-3">
              <label className="block text-xs text-dark-400 mb-1">CoC JSON 数据 <span className="text-red-400">*</span></label>
              <textarea
                ref={jsonRef}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={"粘贴游戏导出的 JSON …\n\n获取方法: 游戏内 设置 → 更多设置 → 数据导出 → 复制"}
                rows={8}
                className="w-full bg-dark-900/60 border border-dark-600 rounded-xl px-3.5 py-2.5 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-mono resize-y"
              />
            </div>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {loading ? (<>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                解析中...
              </>) : "🚀 开始解析"}
            </button>
          </div>
        </section>

        {/* 升级数据面板 */}
        {upgrades.length > 0 && (
          <>
            {/* Tab 导航 */}
            <div className="w-full flex gap-2 mb-4">
              <button onClick={() => setActiveTab("upgrades")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "upgrades" ? "bg-brand-600 text-white" : "glass-card text-dark-400"}`}>
                📊 升级进度
              </button>
              <button onClick={() => setActiveTab("planner")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "planner" ? "bg-brand-600 text-white" : "glass-card text-dark-400"}`}>
                🗺️ 升级规划
              </button>
              <button onClick={() => setActiveTab("scores")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "scores" ? "bg-brand-600 text-white" : "glass-card text-dark-400"}`}>
                📈 基地评分
              </button>
            </div>

            {/* Tab 内容 */}
            {activeTab === "upgrades" && (
              <div>
                {/* 统计卡片 */}
                <section className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  <div className="stat-card">
                    <div className="flex items-center justify-center gap-1.5 mb-1"><span className="text-lg">👤</span></div>
                    <p className="text-sm font-bold text-dark-100 truncate px-1">{playerInfo?.player_tag || "—"}</p>
                    <p className="text-xs text-dark-500">玩家标签</p>
                  </div>
                  <div className="stat-card">
                    <div className="flex items-center justify-center gap-1.5 mb-1"><span className="text-lg">🏠</span></div>
                    <p className="text-sm font-bold text-amber-400">{playerInfo?.town_hall_level ? `Lv${playerInfo.town_hall_level}` : "—"}</p>
                    <p className="text-xs text-dark-500">大本等级</p>
                  </div>
                  <div className="stat-card">
                    <div className="flex items-center justify-center gap-1.5 mb-1"><span className="text-lg">⏳</span></div>
                    <p className="text-sm font-bold text-brand-400">{activeUpgrades.length}</p>
                    <p className="text-xs text-dark-500">进行中</p>
                  </div>
                  <div className="stat-card">
                    <div className="flex items-center justify-center gap-1.5 mb-1"><span className="text-lg">✅</span></div>
                    <p className="text-sm font-bold text-green-400">{completedUpgrades.length}</p>
                    <p className="text-xs text-dark-500">已完成</p>
                  </div>
                </section>

                {/* 每日报告 */}
                {dailyReport && (
                  <section className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-brand-400 tracking-wider uppercase">📋 今日报告</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-brand-500/30 to-transparent" />
                    </div>
                    <div className="glass-card p-3 border-brand-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-dark-200">{dailyReport.title}</h4>
                        <span className={`text-lg font-black ${dailyReport.score >= 70 ? "text-green-400" : dailyReport.score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {dailyReport.score}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {dailyReport.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span>{item.icon}</span>
                            <span className="text-dark-300">{item.text}</span>
                          </div>
                        ))}
                      </div>
                      {dailyReport.recommendations && dailyReport.recommendations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dark-700/50">
                          <p className="text-xs text-dark-400 font-medium mb-1">💡 建议:</p>
                          {dailyReport.recommendations.map((rec: string, idx: number) => (
                            <p key={idx} className="text-xs text-dark-300 pl-2 border-l-2 border-brand-500/30 mb-1">{rec}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 工人预测 */}
                {workerPredictions.length > 0 && (
                  <section className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">🔮 预测系统</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
                    </div>
                    <div className="space-y-2">
                      {workerPredictions.map((pred: any, idx: number) => (
                        <div key={idx} className={`glass-card p-3 border-l-4 ${pred.urgency === "high" ? "border-l-red-500" : pred.urgency === "medium" ? "border-l-amber-500" : "border-l-blue-500"}`}>
                          <p className="text-xs text-dark-300">{pred.message}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 升级路线 */}
                {upgradeRoute.length > 0 && (
                  <section className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">🗺️ 升级路线</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
                    </div>
                    <div className="space-y-2">
                      {upgradeRoute.slice(0, 3).map((route: any, idx: number) => (
                        <div key={idx} className="glass-card p-3 border-purple-500/20">
                          <h5 className="text-xs font-bold text-purple-300 mb-2">Day {route.day} ({route.date})</h5>
                          <div className="space-y-1">
                            {route.items.map((item: any, itemIdx: number) => (
                              <div key={itemIdx} className="flex items-center gap-2 text-xs">
                                <span className="text-dark-500 w-4">{itemIdx + 1}.</span>
                                <span className="text-dark-300">{item.itemName} Lv{item.level}</span>
                                <span className="text-dark-500 ml-auto">~{item.estimatedDuration}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 升级列表 */}
                {nextUpgrade && (
                  <section className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-red-400 tracking-wider uppercase">🔥 最近完成</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-red-500/30 to-transparent" />
                    </div>
                    <NextCompletingCard item={nextUpgrade} />
                  </section>
                )}

                {/* 操作栏 */}
                <div className="w-full flex gap-2 mb-4">
                  <button onClick={handleRefresh} className="btn-secondary flex-1 py-2 text-sm">🔄 刷新</button>
                  <button onClick={handleNotify} disabled={upgrades.length === 0} className="btn-secondary flex-1 py-2 text-sm">📢 安排本地提醒</button>
                </div>

                <SectionTitle title="📊 升级进行中" count={activeUpgrades.length} />
                {activeUpgrades.length === 0 ? (
                  <EmptyState emoji="🎉" title="当前没有升级项目" desc="所有工人和实验室都在空闲" />
                ) : (
                  <div className="space-y-2">
                    {activeUpgrades.map((upg) => (<UpgradeCardV2 key={upg.id} item={upg} />))}
                  </div>
                )}

                {completedUpgrades.length > 0 && (
                  <section className="w-full mt-5 mb-4">
                    <SectionTitle title="✅ 最近完成" count={Math.min(completedUpgrades.length, 10)} />
                    <div className="space-y-1.5">
                      {completedUpgrades.slice(0, 10).map((upg) => (<CompletedCardV2 key={upg.id} item={upg} />))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === "planner" && (
              <PlannerTab workerPredictions={workerPredictions} upgradeRoute={upgradeRoute} dailyReport={dailyReport} />
            )}

            {activeTab === "scores" && (
              <ScoresTab scores={baseScores} playerInfo={playerInfo} />
            )}
          </>
        )}

        {/* 通知设置 */}
        <NotifySettingsPanel upgrades={upgrades} />

        {/* 工具栏 */}
        {upgrades.length > 0 && (
          <div className="w-full flex gap-2 mb-4">
            <button onClick={handleClearAll} className="btn-secondary text-xs py-2 flex-1 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40">🗑️ 清除所有数据</button>
          </div>
        )}

        <CollapsibleGuide />

        {upgrades.length === 0 && !loading && (
          <EmptyState emoji="📭" title="暂无升级数据" desc="请在上方粘贴 CoC JSON 数据开始规划" />
        )}

        {loading && upgrades.length === 0 && (
          <div className="w-full max-w-sm py-16 flex flex-col items-center gap-3">
            <div className="skeleton w-12 h-12 rounded-full" />
            <div className="skeleton w-40 h-3 rounded-full" />
          </div>
        )}

        <footer className="mt-4 text-center text-dark-600 text-xs space-y-1 pb-6">
          <p>升级提醒使用浏览器本地通知，不依赖服务器</p>
          <p>仅使用用户手动导出的 JSON，不涉及模拟/抓包</p>
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
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-semibold text-brand-300">
        <span>📖 使用说明</span>
        <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      <div className={`collapsible-content mt-3 ${open ? "expanded" : "collapsed"}`}>
        <div className="text-xs text-dark-400 space-y-2">
          <p><strong className="text-dark-200">① 导出数据</strong> → 游戏内 设置 → 更多设置 → 数据导出 → 复制</p>
          <p><strong className="text-dark-200">② 粘贴 JSON</strong> → 点击上方输入框 → 点「开始解析」</p>
          <p><strong className="text-dark-200">③ 智能规划</strong> → 切换到「升级规划」标签查看推荐</p>
          <p><strong className="text-dark-200">④ 开启通知</strong> → 在「通知设置」里允许浏览器通知</p>
          <p><strong className="text-dark-200">⑤ 安装应用</strong> → 浏览器出现安装按钮时添加到主屏幕</p>
        </div>
      </div>
    </section>
  );
}

function NextCompletingCard({ item }: { item: UpgradeItem }) {
  const remaining = getRemainingSeconds(item.finish_time);
  const done = remaining <= 0;
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);
  return (
    <div className={`glass-card overflow-hidden p-3 border-red-500/40 bg-gradient-to-r ${done ? "from-green-500/10 to-transparent" : "from-red-500/15 to-transparent"} animate-urgent`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-dark-900/60 border border-red-500/30">{display.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{display.zh}</p>
          <p className="text-xs text-dark-400">{done ? "✅ 已完成!" : `剩余 ${formatCompactRemaining(remaining)}`}</p>
        </div>
        {!done && <div className={`text-base font-bold ${remaining <= 1800 ? "text-red-400" : "text-amber-400"}`}>{formatCompactRemaining(remaining)}</div>}
      </div>
    </div>
  );
}

function UpgradeCardV2({ item }: { item: UpgradeItem }) {
  const remaining = getRemainingSeconds(item.finish_time);
  const done = remaining <= 0;
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);
  const barPercent = item.timer_seconds && item.timer_seconds > 0
    ? Math.min(100, Math.max(2, ((item.timer_seconds - remaining) / item.timer_seconds) * 100)) : 0;
  return (
    <div className="glass-card overflow-hidden transition-all duration-300 hover:translate-y-[-1px]">
      <div className="flex items-center gap-2.5 p-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-dark-900/50 border">{display.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{display.zh}</span>
            {item.notified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">已通知</span>}
          </div>
          <p className="text-[11px] text-dark-500">{done ? "✅ 已完成" : `预计 ${formatFinishTime(item.finish_time)}`}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-base font-bold tabular-nums ${done ? "text-green-400" : remaining <= 3600 ? "text-red-400" : "text-dark-200"}`}>
            {done ? "✅" : formatCompactRemaining(remaining)}
          </div>
        </div>
      </div>
      {!done && (
        <div className="progress-bar mx-3 mb-2">
          <div className="progress-bar-fill h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${barPercent}%` }} />
        </div>
      )}
    </div>
  );
}

function CompletedCardV2({ item }: { item: UpgradeItem }) {
  const display = getUpgradeDisplay(item.category, item.data_id ?? null, item.item_level);
  return (
    <div className="glass-card p-2.5 border-green-500/20 bg-gradient-to-r from-green-500/6 to-transparent flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base text-green-500/50">{display.icon}</span>
        <span className="font-medium text-sm truncate">{display.zh}</span>
      </div>
      <span className="text-[10px] text-dark-500 flex-shrink-0 ml-2">{formatFinishTime(item.finish_time)}</span>
    </div>
  );
}

function NotifySettingsPanel({ upgrades }: { upgrades: UpgradeItem[] }) {
  const handleNotify = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { toast.error("请先允许浏览器通知权限"); return; }
    scheduleCompletionNotifications(upgrades.map((u) => ({
      item_name: u.item_name, item_level: u.item_level, finish_time: u.finish_time, category: u.category,
    })));
    toast.success("已安排本地提醒");
  };
  return (
    <section className="w-full glass-card p-4 mb-4 border-dark-700/50">
      <h3 className="text-sm font-semibold text-dark-200 mb-3">🔔 通知设置</h3>
      <button onClick={handleNotify} disabled={upgrades.length === 0} className="btn-secondary w-full py-2 text-sm">
        📢 安排本地提醒
      </button>
    </section>
  );
}

function PlannerTab({ workerPredictions, upgradeRoute, dailyReport }: any) {
  return (
    <div className="space-y-4">
      {/* 每日报告 */}
      {dailyReport && (
        <div className="glass-card p-4 border-brand-500/20">
          <h4 className="text-sm font-bold text-dark-200 mb-3">{dailyReport.title}</h4>
          <div className="space-y-2">
            {dailyReport.items.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs"><span>{item.icon}</span><span className="text-dark-300">{item.text}</span></div>
            ))}
          </div>
          {dailyReport.recommendations && dailyReport.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dark-700/50">
              <p className="text-xs text-dark-400 font-medium mb-2">💡 建议:</p>
              {dailyReport.recommendations.map((rec: string, idx: number) => (
                <p key={idx} className="text-xs text-dark-300 pl-2 border-l-2 border-brand-500/30 mb-1">{rec}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 工人预测 */}
      {workerPredictions.length > 0 && (
        <div className="glass-card p-4 border-cyan-500/20">
          <h4 className="text-sm font-bold text-cyan-300 mb-3">🔮 工人预测</h4>
          <div className="space-y-2">
            {workerPredictions.map((pred: any, idx: number) => (
              <div key={idx} className={`text-xs p-2 rounded ${pred.urgency === "high" ? "bg-red-500/10 border border-red-500/20" : "bg-dark-800/50"}`}>
                {pred.message}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 升级路线 */}
      {upgradeRoute.length > 0 && (
        <div className="glass-card p-4 border-purple-500/20">
          <h4 className="text-sm font-bold text-purple-300 mb-3">🗺️ 升级路线 (未来7天)</h4>
          <div className="space-y-3">
            {upgradeRoute.slice(0, 5).map((route: any, idx: number) => (
              <div key={idx}>
                <h5 className="text-xs font-bold text-dark-300 mb-1">Day {route.day} ({route.date})</h5>
                <div className="space-y-1">
                  {route.items.map((item: any, itemIdx: number) => (
                    <div key={itemIdx} className="flex items-center gap-2 text-xs text-dark-400">
                      <span className="text-dark-600 w-4">{itemIdx + 1}.</span>
                      <span className="text-dark-300">{item.itemName} Lv{item.level}</span>
                      <span className="ml-auto text-dark-500">~{item.estimatedDuration}h</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoresTab({ scores, playerInfo }: any) {
  if (!scores) return <EmptyState emoji="📊" title="暂无评分数据" desc="上传数据后自动生成评分" />;
  return (
    <div className="space-y-4">
      <div className="glass-card p-4 border-yellow-500/20 text-center">
        <p className="text-xs text-dark-500 mb-2">基地综合评分</p>
        <p className={`text-4xl font-black ${scores.overall >= 70 ? "text-green-400" : scores.overall >= 50 ? "text-amber-400" : "text-red-400"}`}>
          {scores.overall}
        </p>
        <p className="text-xs text-dark-500 mt-1">
          大本 Lv{playerInfo?.town_hall_level || "?"}
        </p>
      </div>
      {(Object.entries(scores) as [string, any][]).filter(([k]) => k !== "overall").map(([key, val]: [string, any]) => (
        <div key={key} className="glass-card p-3 border-dark-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-dark-300">{val.category}</span>
            <span className={`text-sm font-bold ${val.score >= 70 ? "text-green-400" : val.score >= 50 ? "text-amber-400" : "text-red-400"}`}>{val.score}</span>
          </div>
          <div className="progress-bar mb-2">
            <div className="progress-bar-fill h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${val.score}%` }} />
          </div>
          <p className="text-xs text-dark-500">{val.feedback}</p>
        </div>
      ))}
    </div>
  );
}
