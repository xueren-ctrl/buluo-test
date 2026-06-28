/**
 * JSON 历史时间轴页面
 * ============================================
 * 展示最近 5 次导入记录：
 *  - 时间轴布局
 *  - 恢复历史记录（一键回滚到该 JSON）
 *  - 查看详情（玩家信息 + 升级列表）
 *  - 删除
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import {
  loadJsonHistory,
  deleteJsonHistory,
  clearJsonHistory,
  type JsonHistoryRecord,
} from "@/lib/indexeddb";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
  const [history, setHistory] = useState<JsonHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<JsonHistoryRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<JsonHistoryRecord | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadJsonHistory();
      setHistory(list);
    } catch (e) {
      toast.error("加载历史记录失败", { className: "toast-error" });
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteJsonHistory(id);
      toast.success("已删除", { className: "toast-success" });
      refresh();
    } catch (e) {
      toast.error("删除失败", { className: "toast-error" });
      console.error(e);
    }
  }, [refresh]);

  const handleClearAll = useCallback(async () => {
    if (!confirm("确定要清空所有历史记录吗？此操作不可撤销。")) return;
    try {
      await clearJsonHistory();
      toast.success("所有历史记录已清空", { className: "toast-success" });
      refresh();
    } catch (e) {
      toast.error("清空失败", { className: "toast-error" });
      console.error(e);
    }
  }, [refresh]);

  const handleRestore = useCallback((item: JsonHistoryRecord) => {
    setRestoreTarget(item);
  }, []);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget) return;
    try {
      // 把 JSON 原文存到 sessionStorage，首页 useEffect 读取后自动解析
      sessionStorage.setItem("coc_restore_json", restoreTarget.json_raw);
      sessionStorage.setItem("coc_restore_player_tag", restoreTarget.player_tag);
      toast.success(`已恢复 ${restoreTarget.player_name || "玩家"} 的数据，正在跳转首页...`, {
        className: "toast-success",
      });
      setTimeout(() => router.push("/"), 400);
    } catch (e) {
      toast.error("恢复失败", { className: "toast-error" });
      console.error(e);
    }
  }, [restoreTarget, router]);

  return (
    <>
      <TopNav title="历史记录" />

      <main className="max-w-2xl mx-auto px-3 py-5 min-h-screen">
        {/* 头部信息 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted">
            最近 {history.length}/5 次导入记录
          </p>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="coc-btn-secondary text-xs !py-1 !px-3 text-danger"
            >
              清空全部
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="coc-panel">
                <div className="coc-panel-body">
                  <div className="skeleton w-32 h-4 rounded mb-2" />
                  <div className="skeleton w-48 h-3 rounded mb-1" />
                  <div className="skeleton w-40 h-3 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && history.length === 0 && (
          <EmptyState
            emoji="📜"
            title="暂无导入历史"
            desc="首次上传 CoC JSON 后会自动记录到这里"
          />
        )}

        {/* 时间轴 */}
        {!loading && history.length > 0 && (
          <div className="relative pl-6">
            {/* 时间轴垂直线 */}
            <div
              className="absolute left-[10px] top-2 bottom-2 w-0.5"
              style={{ background: "var(--divider)" }}
              aria-hidden
            />
            <div className="space-y-3">
              {history.map((item, idx) => (
                <TimelineItem
                  key={item.id ?? idx}
                  item={item}
                  isLatest={idx === 0}
                  onView={() => setDetailItem(item)}
                  onRestore={() => handleRestore(item)}
                  onDelete={() => item.id != null && handleDelete(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 底部返回首页 */}
        <div className="mt-6 flex justify-center">
          <Link href="/" className="coc-btn-secondary text-xs !py-2 !px-4">
            ← 返回首页
          </Link>
        </div>
      </main>

      {/* 详情弹窗 */}
      <Modal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="历史记录详情"
        footer={
          <>
            <button
              onClick={() => setDetailItem(null)}
              className="coc-btn-secondary text-xs !py-2 !px-4"
            >
              关闭
            </button>
            {detailItem && (
              <button
                onClick={() => {
                  setRestoreTarget(detailItem);
                  setDetailItem(null);
                }}
                className="coc-btn text-xs !py-2 !px-4"
              >
                恢复此版本
              </button>
            )}
          </>
        }
      >
        {detailItem && <HistoryDetail item={detailItem} />}
      </Modal>

      {/* 恢复确认弹窗 */}
      <Modal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title="确认恢复历史记录"
        footer={
          <>
            <button
              onClick={() => setRestoreTarget(null)}
              className="coc-btn-secondary text-xs !py-2 !px-4"
            >
              取消
            </button>
            <button
              onClick={confirmRestore}
              className="coc-btn text-xs !py-2 !px-4"
            >
              确认恢复
            </button>
          </>
        }
      >
        {restoreTarget && (
          <div className="space-y-2 text-sm text-sub">
            <p>即将恢复：</p>
            <div className="coc-card p-3 text-xs">
              <p className="text-main font-semibold">
                {restoreTarget.player_name || "(无名玩家)"}
                {restoreTarget.player_tag && (
                  <span className="text-muted ml-2">{restoreTarget.player_tag}</span>
                )}
              </p>
              <p className="mt-1">
                大本 Lv{restoreTarget.town_hall_level} · {restoreTarget.active_upgrades} 个活跃升级
              </p>
              <p className="text-muted mt-1">
                导入时间：{new Date(restoreTarget.imported_at).toLocaleString("zh-CN")}
              </p>
            </div>
            <p className="text-warning text-xs">
              ⚠️ 恢复后会覆盖当前页面正在显示的数据，但历史记录本身不会被删除。
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

// ── 时间轴单项 ──────────────────────────
function TimelineItem({
  item,
  isLatest,
  onView,
  onRestore,
  onDelete,
}: {
  item: JsonHistoryRecord;
  isLatest: boolean;
  onView: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="timeline-item relative">
      {/* 圆点 */}
      <div
        className="absolute -left-[18px] top-3 w-3 h-3 rounded-full"
        style={{
          background: isLatest ? "var(--color-gold)" : "var(--border-gold)",
          boxShadow: isLatest ? "0 0 0 4px var(--color-warning-bg)" : "none",
        }}
        aria-hidden
      />
      <div className="coc-panel">
        <div className="coc-panel-body">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-main font-semibold text-sm truncate">
                  {item.player_name || "(无名玩家)"}
                </span>
                {isLatest && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
                    最新
                  </span>
                )}
              </div>
              <div className="text-xs text-muted space-y-0.5">
                <p>
                  {item.player_tag && <span>{item.player_tag} · </span>}
                  <span className="text-gold">大本 Lv{item.town_hall_level}</span>
                  {" · "}
                  <span>{item.active_upgrades} 个升级</span>
                </p>
                {item.base_score != null && (
                  <p>
                    基地评分：
                    <span className="coc-countdown font-bold ml-1">{item.base_score}</span>
                    <span className="text-muted ml-0.5">/100</span>
                    {item.base_grade && (
                      <span className="text-gold ml-1.5 font-bold">{item.base_grade} 级</span>
                    )}
                  </p>
                )}
                <p>{new Date(item.imported_at).toLocaleString("zh-CN")}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 mt-3">
            <button
              onClick={onView}
              className="coc-btn-secondary text-xs !py-1.5 !px-3 flex-1"
            >
              查看详情
            </button>
            <button
              onClick={onRestore}
              className="coc-btn text-xs !py-1.5 !px-3 flex-1"
            >
              恢复
            </button>
            <button
              onClick={onDelete}
              className="coc-btn-secondary text-xs !py-1.5 !px-3 text-danger"
              aria-label="删除"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 详情弹窗内容 ────────────────────────
function HistoryDetail({ item }: { item: JsonHistoryRecord }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(item.json_raw);
  } catch {
    parsed = null;
  }

  // 从 JSON 中尝试解析活跃升级列表
  let upgradeList: Array<{ category: string; name: string; level: number; finish: string }> = [];
  if (parsed) {
    const TIMER_CATEGORIES = ["buildings", "spells", "heroes", "pets", "equipment", "units", "helpers", "siege_machines", "buildings2", "heroes2", "units2"];
    for (const cat of TIMER_CATEGORIES) {
      const arr = (parsed as Record<string, unknown[]>)[cat];
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        if (typeof it !== "object" || !it) continue;
        const obj = it as Record<string, unknown>;
        const timer = typeof obj.timer === "number" ? obj.timer : (typeof obj.helper_cooldown === "number" ? obj.helper_cooldown : 0);
        if (timer <= 0) continue;
        const level = typeof obj.lvl === "number" ? obj.lvl : (typeof obj.level === "number" ? obj.level : 0);
        const dataId = typeof obj.data === "number" ? obj.data : 0;
        const finishMs = Date.now() + timer * 1000;
        upgradeList.push({
          category: cat,
          name: `#${dataId}`,
          level,
          finish: new Date(finishMs).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoCell label="玩家名" value={item.player_name || "(无名)"} />
        <InfoCell label="玩家标签" value={item.player_tag || "—"} />
        <InfoCell label="大本等级" value={`Lv${item.town_hall_level}`} />
        <InfoCell label="活跃升级" value={`${item.active_upgrades} 项`} />
        <InfoCell label="基地评分" value={item.base_score != null ? `${item.base_score}/100` : "—"} />
        <InfoCell label="评级" value={item.base_grade || "—"} />
        <InfoCell label="导入时间" value={new Date(item.imported_at).toLocaleString("zh-CN")} />
        <InfoCell label="JSON 大小" value={`${(item.json_raw.length / 1024).toFixed(1)} KB`} />
      </div>

      {upgradeList.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-1">活跃升级（{upgradeList.length} 项）</p>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {upgradeList.slice(0, 30).map((u, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs p-2 rounded"
                style={{ background: "var(--bg-content)" }}
              >
                <span className="text-sub truncate">
                  <span className="text-muted mr-1">[{u.category}]</span>
                  {u.name} Lv{u.level}
                </span>
                <span className="text-muted text-[11px] whitespace-nowrap ml-2">
                  {u.finish}
                </span>
              </div>
            ))}
            {upgradeList.length > 30 && (
              <p className="text-center text-[11px] text-muted py-1">
                还有 {upgradeList.length - 30} 项...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="coc-card p-2">
      <p className="text-muted text-[10px]">{label}</p>
      <p className="text-main text-xs mt-0.5 break-all">{value}</p>
    </div>
  );
}
