"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { getUpgrades, manualRefresh } from "@/services/api";
import { CATEGORY_MAP, CATEGORY_ICON } from "@/types";
import {
  formatRemaining,
  formatFinishTime,
  getRemainingSeconds,
} from "@/lib/utils";
import type { UpgradeItem, IdleTimes } from "@/types";

export default function PanelPage() {
  return (
    <Suspense fallback={<PanelLoading /> }>
      <PanelContent />
    </Suspense>
  );
}

function PanelLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-brand-400">
        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>加载中...</span>
      </div>
    </main>
  );
}

function PanelContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";

  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([]);
  const [idleTimes, setIdleTimes] = useState<IdleTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await getUpgrades(uid);
      if (res.success) {
        setUpgrades(res.upgrades);
        setIdleTimes(res.idle_times);
        setUserId(res.user_id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchData();
    // 每 30 秒自动刷新
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // 每秒更新倒计时显示
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    try {
      const res = await manualRefresh(uid);
      if (res.success) {
        toast.success(res.message);
        fetchData();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshing(false);
    }
  };

  if (!uid) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="text-dark-300 text-lg mb-4">
            🔒 请提供本地设备 ID
          </p>
          <p className="text-dark-500 text-sm">
            访问方式: /panel?uid=本地设备ID
          </p>
        </div>
      </main>
    );
  }

  if (loading && upgrades.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-brand-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>加载中...</span>
        </div>
      </main>
    );
  }

  const activeUpgrades = upgrades.filter((u) => getRemainingSeconds(u.finish_time) > 0);
  const completedUpgrades = upgrades.filter((u) => getRemainingSeconds(u.finish_time) <= 0);

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 max-w-3xl mx-auto">
      {/* 头部 */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-dark-100">
            📊 升级面板
          </h1>
          <p className="text-dark-500 text-sm mt-1">
            UID: {uid}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 rounded-xl text-brand-300 text-sm transition-all disabled:opacity-50"
        >
          {refreshing ? "刷新中..." : "🔄 手动检测"}
        </button>
      </header>

      {/* 统计概览 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">
            {upgrades.length}
          </p>
          <p className="text-xs text-dark-400 mt-1">总升级项</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {activeUpgrades.length}
          </p>
          <p className="text-xs text-dark-400 mt-1">进行中</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {completedUpgrades.length}
          </p>
          <p className="text-xs text-dark-400 mt-1">已完成</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-dark-300">
            {upgrades.filter((u) => u.notified).length}
          </p>
          <p className="text-xs text-dark-400 mt-1">已通知</p>
        </div>
      </section>

      {/* 空闲时间 */}
      {idleTimes && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-card glow-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔨</span>
              <span className="text-sm text-dark-400">工人空闲</span>
            </div>
            <p className="text-xl font-bold text-dark-100">
              {idleTimes.builder_idle_at
                ? formatFinishTime(idleTimes.builder_idle_at)
                : "空闲中 ✅"}
            </p>
          </div>
          <div className="glass-card glow-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🧪</span>
              <span className="text-sm text-dark-400">实验室空闲</span>
            </div>
            <p className="text-xl font-bold text-dark-100">
              {idleTimes.lab_idle_at
                ? formatFinishTime(idleTimes.lab_idle_at)
                : "空闲中 ✅"}
            </p>
          </div>
        </section>
      )}

      {/* 进行中 */}
      {activeUpgrades.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-300 mb-4 flex items-center gap-2">
            ⏳ 升级进行中
            <span className="text-sm font-normal text-dark-500">
              ({activeUpgrades.length})
            </span>
          </h2>
          <div className="space-y-3">
            {activeUpgrades
              .sort(
                (a, b) =>
                  new Date(a.finish_time).getTime() -
                  new Date(b.finish_time).getTime()
              )
              .map((upg) => {
                const remaining = getRemainingSeconds(upg.finish_time);
                const totalEstimate = remaining + 60; // 粗略估计总时间
                const elapsed = totalEstimate - remaining;
                const progress = Math.min(98, Math.max(2, (elapsed / totalEstimate) * 100));

                return (
                  <div
                    key={upg.id}
                    className="glass-card p-4 border-dark-700/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {CATEGORY_ICON[upg.category] || "📦"}
                        </span>
                        <span className="font-semibold text-dark-100">
                          {upg.item_name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                          Lv{upg.item_level}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        {CATEGORY_MAP[upg.category] || upg.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-amber-400 font-medium">
                        ⏳ {formatRemaining(remaining)}
                      </span>
                      <span className="text-dark-500">
                        {formatFinishTime(upg.finish_time)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* 已完成 */}
      {completedUpgrades.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            ✅ 升级已完成
            <span className="text-sm font-normal text-dark-500">
              ({completedUpgrades.length})
            </span>
          </h2>
          <div className="space-y-3">
            {completedUpgrades.map((upg) => (
              <div
                key={upg.id}
                className="glass-card p-4 bg-gradient-to-r from-green-500/10 to-green-600/5 border-green-500/20 border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {CATEGORY_ICON[upg.category] || "📦"}
                    </span>
                    <span className="font-semibold text-dark-100">
                      {upg.item_name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                      Lv{upg.item_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {upg.notified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        已通知
                      </span>
                    )}
                    <span className="text-xs text-dark-500">
                      {CATEGORY_MAP[upg.category] || upg.category}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-dark-400 mt-1">
                  完成时间: {formatFinishTime(upg.finish_time)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 无数据 */}
      {upgrades.length === 0 && !loading && (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-dark-300 text-lg">暂无升级数据</p>
          <p className="text-dark-500 text-sm mt-2">
            请先在首页上传 CoC JSON 数据
          </p>
        </div>
      )}

      {/* 底部 */}
      <footer className="mt-12 text-center text-dark-600 text-xs">
        <p>自动刷新: 每 30 秒 | 通知检测: 每 60 秒</p>
      </footer>
    </main>
  );
}
