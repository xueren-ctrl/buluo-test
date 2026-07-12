/**
 * 月卡剩余天数面板 — CoC 羊皮纸风格
 * ============================================================
 * - 月卡一次 30 天
 * - 用户可选「开通日期」或「剩余天数」两种录入方式
 * - 实时显示剩余天数 / 小时
 * - 已过期、临期（≤3 天）会高亮提示
 * - 数据持久化在 localStorage（独立 key，不影响其他功能）
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MONTHLY_CARD_DURATION_DAYS,
  fromActivationDate,
  fromRemainingDays,
  getStatus,
  loadMonthlyCard,
  saveMonthlyCard,
  clearMonthlyCard,
  formatDateLocal,
  todayDateStr,
  type MonthlyCardRecord,
} from "@/lib/monthly-card";

type InputMode = "activationDate" | "remainingDays";

export function MonthlyCardPanel() {
  const [record, setRecord] = useState<MonthlyCardRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // 录入表单状态
  const [inputMode, setInputMode] = useState<InputMode>("activationDate");
  const [activationDate, setActivationDate] = useState<string>("");
  const [remainingDaysInput, setRemainingDaysInput] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // 实时 tick（每 60s 刷新一次剩余时间）
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // 初始化：从 localStorage 恢复
  useEffect(() => {
    const r = loadMonthlyCard();
    setRecord(r);
    if (r) {
      // 默认填充表单
      setActivationDate(formatDateLocal(r.activatedAt));
      const st = getStatus(r);
      setRemainingDaysInput(st ? String(Math.max(0, st.remainingDays)) : "");
    } else {
      setActivationDate(todayDateStr());
      setRemainingDaysInput(String(MONTHLY_CARD_DURATION_DAYS));
    }
    setHydrated(true);
  }, []);

  const status = useMemo(() => getStatus(record), [record]);

  const handleSave = useCallback(() => {
    let next: MonthlyCardRecord | null = null;
    if (inputMode === "activationDate") {
      if (!activationDate) return;
      next = fromActivationDate(activationDate);
    } else {
      const n = parseInt(remainingDaysInput, 10);
      if (isNaN(n)) return;
      next = fromRemainingDays(n);
    }
    if (!next) return;
    saveMonthlyCard(next);
    setRecord(next);
    setShowForm(false);
  }, [inputMode, activationDate, remainingDaysInput]);

  const handleClear = useCallback(() => {
    if (!confirm("确定要清除月卡记录吗？")) return;
    clearMonthlyCard();
    setRecord(null);
    setActivationDate(todayDateStr());
    setRemainingDaysInput(String(MONTHLY_CARD_DURATION_DAYS));
    setShowForm(false);
  }, []);

  // 避免 SSR/CSR 不一致：未 hydrate 时不渲染真实数据
  if (!hydrated) {
    return (
      <section className="coc-panel mb-4">
        <div className="coc-panel-header">
          <span>月卡剩余天数</span>
        </div>
      </section>
    );
  }

  // ── 渲染 ────────────────────────────
  return (
    <section className="coc-panel mb-4">
      <button
        onClick={() => setShowForm(!showForm)}
        className="coc-panel-header w-full flex items-center justify-between"
        type="button"
      >
        <span>月卡剩余天数</span>
        <span className={`text-xs transition-transform duration-200 ${showForm ? "rotate-180" : ""}`}>▼</span>
      </button>

      <div className="coc-panel-body space-y-3">
        {/* ===== 主显示区 ===== */}
        {record && status ? (
          <MonthlyCardDisplay record={record} status={status} />
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-muted">尚未设置月卡</p>
            <p className="text-[11px] text-muted mt-1">
              点击下方按钮，选择开通日期或输入剩余天数开始追踪
            </p>
          </div>
        )}

        {/* ===== 录入表单（折叠） ===== */}
        <div className={`collapsible-content ${showForm ? "expanded" : "collapsed"}`}>
          <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--divider)" }}>
            {/* 录入方式切换 */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setInputMode("activationDate")}
                className={inputMode === "activationDate" ? "coc-btn text-xs py-1 px-3" : "coc-btn-secondary text-xs py-1 px-3"}
              >
                按开通日期
              </button>
              <button
                type="button"
                onClick={() => setInputMode("remainingDays")}
                className={inputMode === "remainingDays" ? "coc-btn text-xs py-1 px-3" : "coc-btn-secondary text-xs py-1 px-3"}
              >
                按剩余天数
              </button>
            </div>

            {inputMode === "activationDate" ? (
              <label className="block space-y-1">
                <span className="text-xs text-sub">开通日期</span>
                <input
                  type="date"
                  value={activationDate}
                  max={todayDateStr()}
                  onChange={(e) => setActivationDate(e.target.value)}
                  className="coc-input w-full text-xs py-1.5 px-2"
                />
                <span className="text-[11px] text-muted block">
                  月卡自开通日 00:00 起算，{MONTHLY_CARD_DURATION_DAYS} 天后到期
                </span>
              </label>
            ) : (
              <label className="block space-y-1">
                <span className="text-xs text-sub">剩余天数（0 - {MONTHLY_CARD_DURATION_DAYS}）</span>
                <input
                  type="number"
                  min={0}
                  max={MONTHLY_CARD_DURATION_DAYS}
                  value={remainingDaysInput}
                  onChange={(e) => setRemainingDaysInput(e.target.value)}
                  className="coc-input w-full text-xs py-1.5 px-2"
                />
                <span className="text-[11px] text-muted block">
                  按当前剩余天数反推开通日（已用 {MONTHLY_CARD_DURATION_DAYS} − 剩余 天）
                </span>
              </label>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="coc-btn text-xs py-1.5 px-3 flex-1"
              >
                保存
              </button>
              {record && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="coc-btn-secondary text-xs py-1.5 px-3 text-danger"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 未设置时显示「立即设置」按钮 */}
        {!record && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="coc-btn text-xs py-1.5 px-3 w-full"
          >
            立即设置
          </button>
        )}
      </div>
    </section>
  );
}

// ── 主显示子组件 ──────────────────────
function MonthlyCardDisplay({
  record,
  status,
}: {
  record: MonthlyCardRecord;
  status: NonNullable<ReturnType<typeof getStatus>>;
}) {
  const expired = status.expired;
  const isExpiringSoon = !expired && status.remainingDays <= 3;

  // 颜色：已过期 → 红，临期 → 黄，正常 → 金
  let accentColor = "var(--color-gold)";
  let accentBg = "rgba(184, 152, 90, 0.12)";
  if (expired) {
    accentColor = "var(--color-danger)";
    accentBg = "var(--color-danger-bg)";
  } else if (isExpiringSoon) {
    accentColor = "var(--color-warning)";
    accentBg = "var(--color-warning-bg)";
  }

  // 进度（已用天数 / 总天数）
  const usedDays = Math.max(0, MONTHLY_CARD_DURATION_DAYS - Math.max(0, status.remainingDays));
  const progressPercent = Math.min(100, Math.max(0, (usedDays / MONTHLY_CARD_DURATION_DAYS) * 100));

  return (
    <div className="space-y-2">
      {/* 大字剩余天数 */}
      <div
        className="rounded p-3 text-center"
        style={{ background: accentBg, border: `1px solid ${accentColor}` }}
      >
        {expired ? (
          <>
            <p className="text-sm font-bold" style={{ color: accentColor }}>
              月卡已过期
            </p>
            <p className="text-[11px] text-muted mt-1">
              到期于 {formatDateLocal(record.expiredAt)}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">剩余天数</p>
            <p className="coc-countdown font-bold text-2xl mt-0.5" style={{ color: accentColor }}>
              {status.remainingDays}
              <span className="text-xs ml-1 text-muted">天</span>
              {status.remainingDays === 0 && status.remainingHours > 0 && (
                <span className="text-xs ml-2 text-muted">
                  {status.remainingHours} 小时
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1">
              到期日 {formatDateLocal(record.expiredAt)}
              {status.remainingDays <= 3 && (
                <span className="ml-1" style={{ color: accentColor }}>· 临期</span>
              )}
            </p>
          </>
        )}
      </div>

      {/* 进度条 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>已用 {usedDays} / {MONTHLY_CARD_DURATION_DAYS} 天</span>
          <span>开通 {formatDateLocal(record.activatedAt)}</span>
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--bg-panel-alt)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: accentColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MonthlyCardPanel;
