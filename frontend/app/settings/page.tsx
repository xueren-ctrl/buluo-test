/**
 * 设置页面
 * ============================================
 * 5 大模块：
 *  1. 应用信息（版本 / GitHub 仓库 / 构建时间）
 *  2. 更新管理（检查更新 / 当前版本 / 更新日志）
 *  3. 通知设置（升级完成 / 提前30分钟 / 提前10分钟 / 工人空闲 / 实验室完成）
 *  4. 后台运行（电池优化状态 / 后台权限状态 / 厂商教程）
 *  5. 数据管理（导出 / 导入 / 清空 / 清除通知记录）
 */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Modal } from "@/components/Modal";
import {
  GITHUB_REPO,
  GITHUB_RELEASES_PAGE,
  CURRENT_VERSION,
  checkForUpdate,
  clearUpdateCache,
  getLastCacheTime,
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
  openAppBatteryOptimizationSettings,
  openAutostartSettings,
  openPowerSaveWhitelistSettings,
  openAppNotificationSettings,
  getVendorGuide,
  getAllVendorGuides,
  type BatteryOptimizationStatus,
  type VendorGuide,
  type Manufacturer,
} from "@/lib/battery-optimizer";
import {
  loadSettings,
  saveSettings,
  clearNotifyState,
  resetAll,
  loadJsonHistory,
  loadAllAccounts,
  type SchedulerSettings,
} from "@/lib/indexeddb";
import { requestNotificationPermission, detectNotifyStatusAsync, type NotifyStatus } from "@/lib/notification-system";

export default function SettingsPage() {
  const router = useRouter();

  // 应用信息
  const buildTime = useMemo(() => {
    const t = process.env.NEXT_PUBLIC_BUILD_TIME as string | undefined;
    if (!t) return "未知";
    try {
      return new Date(t).toLocaleString("zh-CN");
    } catch {
      return t;
    }
  }, []);

  // 通知设置
  const [settings, setSettings] = useState<SchedulerSettings | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus | null>(null);

  // 更新管理
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<number | null>(null);

  // 后台运行
  const [batteryStatus, setBatteryStatus] = useState<BatteryOptimizationStatus | null>(null);
  const [vendorGuide, setVendorGuide] = useState<VendorGuide | null>(null);
  const [showAllGuides, setShowAllGuides] = useState(false);

  // 数据管理
  const [jsonHistoryCount, setJsonHistoryCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);

  // 初始化加载
  const init = useCallback(async () => {
    try {
      const [s, status, cacheTime, battery, history, accounts] = await Promise.all([
        loadSettings(),
        detectNotifyStatusAsync(),
        Promise.resolve(getLastCacheTime()),
        detectBatteryOptimization(),
        loadJsonHistory(),
        loadAllAccounts(),
      ]);
      setSettings(s);
      setNotifyStatus(status);
      setLastCacheTime(cacheTime);
      setBatteryStatus(battery);
      setVendorGuide(getVendorGuide(battery.manufacturer));
      setJsonHistoryCount(history.length);
      setAccountCount(accounts.length);
    } catch (e) {
      console.error("初始化设置页失败", e);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  // ── 通知设置变更 ──
  const handleSettingChange = useCallback(async (patch: Partial<SchedulerSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    toast.success("设置已保存", { className: "toast-success", duration: 1500 });
  }, [settings]);

  const handleEnableNotify = useCallback(async () => {
    try {
      const granted = await requestNotificationPermission();
      const status = await detectNotifyStatusAsync();
      setNotifyStatus(status);
      if (granted) {
        toast.success("通知权限已开启", { className: "toast-success" });
      } else {
        toast.error("通知权限未开启，请在系统设置中开启", { className: "toast-error", duration: 6000 });
      }
    } catch (e) {
      toast.error("请求通知权限失败", { className: "toast-error" });
      console.error(e);
    }
  }, []);

  const handleClearNotifyState = useCallback(async () => {
    if (!confirm("确定要重置通知去重状态吗？所有已发送的通知标记将被清除，可能导致通知重复发送。")) return;
    try {
      await clearNotifyState();
      toast.success("通知去重状态已重置", { className: "toast-success" });
    } catch (e) {
      toast.error("重置失败", { className: "toast-error" });
      console.error(e);
    }
  }, []);

  // ── 检查更新 ──
  const handleCheckUpdate = useCallback(async (force: boolean) => {
    setChecking(true);
    try {
      const result = await checkForUpdate(force);
      setUpdateResult(result);
      setLastCacheTime(getLastCacheTime());
      if (result.hasUpdate) {
        setShowUpdateModal(true);
      } else if (result.error) {
        toast.error(result.error, { className: "toast-error", duration: 5000 });
      } else {
        toast.success(`已是最新版本 v${result.currentVersion}`, { className: "toast-success" });
      }
    } catch (e) {
      toast.error("检查更新失败", { className: "toast-error" });
      console.error(e);
    } finally {
      setChecking(false);
    }
  }, []);

  // ── 数据管理 ──
  const handleExportData = useCallback(async () => {
    try {
      // 从 IndexedDB 导出全部数据为 JSON 文件
      const { loadAll, loadJsonHistory, loadAllAccounts } = await import("@/lib/indexeddb");
      const [all, history, accounts] = await Promise.all([
        loadAll(),
        loadJsonHistory(),
        loadAllAccounts(),
      ]);
      const exportData = {
        _meta: {
          app: "coc-upgrade-reminder",
          version: CURRENT_VERSION,
          exported_at: new Date().toISOString(),
        },
        state: all,
        json_history: history,
        accounts,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
      toast.success("数据已导出", { className: "toast-success" });
    } catch (e) {
      toast.error("导出失败", { className: "toast-error" });
      console.error(e);
    }
  }, []);

  const handleImportData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data._meta || !data.state) {
          toast.error("无效的备份文件", { className: "toast-error" });
          return;
        }
        if (!confirm("导入将覆盖当前所有数据，确定继续吗？")) return;
        // 简单实现：写入 sessionStorage 让首页重新初始化
        sessionStorage.setItem("coc_restore_backup", text);
        toast.success("备份已导入，正在刷新...", { className: "toast-success" });
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        toast.error("导入失败：" + (e instanceof Error ? e.message : String(e)), {
          className: "toast-error",
          duration: 5000,
        });
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => document.body.removeChild(input), 1000);
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!confirm("⚠️ 确定要清空所有本地数据吗？\n\n这将永久删除：\n• 所有升级记录\n• 玩家信息\n• 历史记录\n• 账号信息\n• 通知设置\n\n此操作不可撤销！")) return;
    if (!confirm("再次确认：这将永久删除所有数据，确定继续吗？")) return;
    try {
      await resetAll();
      toast.success("所有数据已清除", { className: "toast-success" });
      setTimeout(() => router.push("/"), 1000);
    } catch (e) {
      toast.error("清除失败", { className: "toast-error" });
      console.error(e);
    }
  }, [router]);

  return (
    <>
      <TopNav title="设置" />

      <main className="max-w-2xl mx-auto px-3 py-5 space-y-4 min-h-screen pb-12">
        {/* ======== 1. 应用信息 ======== */}
        <Section title="应用信息" emoji="📦">
          <InfoRow label="当前版本" value={`v${CURRENT_VERSION}`} />
          <InfoRow label="构建时间" value={buildTime} />
          <InfoRow
            label="GitHub 仓库"
            value={GITHUB_REPO}
            action={
              <button
                onClick={() => openReleasesPage()}
                className="coc-btn-secondary text-[10px] !py-0.5 !px-2"
              >
                打开
              </button>
            }
          />
        </Section>

        {/* ======== 2. 更新管理 ======== */}
        <Section title="更新管理" emoji="🔄">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs">
              <p className="text-sub">当前版本：<span className="text-gold font-bold">v{CURRENT_VERSION}</span></p>
              {updateResult?.hasUpdate && updateResult.release ? (
                <p className="text-success mt-0.5">
                  发现新版本：<span className="font-bold">{updateResult.latestTag}</span>
                </p>
              ) : updateResult ? (
                <p className="text-muted mt-0.5">已是最新版本</p>
              ) : (
                <p className="text-muted mt-0.5">尚未检查</p>
              )}
              {lastCacheTime && (
                <p className="text-muted text-[10px] mt-0.5">
                  上次检查：{new Date(lastCacheTime).toLocaleString("zh-CN")}
                </p>
              )}
            </div>
            <button
              onClick={() => handleCheckUpdate(true)}
              disabled={checking}
              className="coc-btn text-xs !py-2 !px-4"
            >
              {checking ? "检查中..." : "立即检查"}
            </button>
          </div>

          {updateResult?.release && (
            <button
              onClick={() => setShowUpdateModal(true)}
              className="coc-btn-secondary text-xs !py-1.5 !px-3 w-full mt-2 text-left"
            >
              📋 查看更新日志
            </button>
          )}
        </Section>

        {/* ======== 3. 通知设置 ======== */}
        <Section title="通知设置" emoji="🔔">
          {/* 权限状态 */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sub">
                本地通知权限
                {notifyStatus?.browserNotifGranted ? (
                  <span className="text-success ml-1">✓ 已开启</span>
                ) : (
                  <span className="text-warning ml-1">未授权</span>
                )}
              </span>
              <button
                onClick={handleEnableNotify}
                className={
                  notifyStatus?.browserNotifGranted
                    ? "coc-btn-secondary text-xs !py-1 !px-3 text-success"
                    : "coc-btn text-xs !py-1 !px-3"
                }
              >
                {notifyStatus?.browserNotifGranted ? "已开启" : "申请权限"}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-muted mb-2">
            ✓ 三个通道：升级完成 / 工人空闲 / 实验室完成
          </div>

          <ToggleRow
            label="升级完成"
            checked={!!settings?.enableComplete}
            onChange={(v) => handleSettingChange({ enableComplete: v })}
          />
          <ToggleRow
            label="提前 30 分钟"
            checked={!!settings?.enablePre30m}
            onChange={(v) => handleSettingChange({ enablePre30m: v })}
          />
          <ToggleRow
            label="提前 10 分钟"
            checked={!!settings?.enablePre10m}
            onChange={(v) => handleSettingChange({ enablePre10m: v })}
          />
          <ToggleRow
            label="完成后 10 分钟（再次提醒）"
            checked={!!settings?.enablePostComplete}
            onChange={(v) => handleSettingChange({ enablePostComplete: v })}
          />

          <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--divider)" }}>
            <p className="text-xs text-muted mb-2">工人空闲 / 实验室完成通知</p>
            <p className="text-[11px] text-muted leading-relaxed">
              工人空闲和实验室完成通知会通过同一套调度系统自动触发，
              无需单独开关 — 只要"升级完成"开启，相关通知会自动弹出。
            </p>
          </div>

          <button
            onClick={handleClearNotifyState}
            className="coc-btn-secondary text-xs !py-1.5 !px-3 mt-3 w-full"
          >
            重置通知去重
          </button>
        </Section>

        {/* ======== 4. 后台运行 ======== */}
        <Section title="后台运行" emoji="⚡">
          {batteryStatus ? (
            <>
              <InfoRow
                label="设备厂商"
                value={batteryStatus.manufacturer.toUpperCase()}
              />
              <InfoRow
                label="电池优化状态"
                value={
                  batteryStatus.isOptimized ? (
                    <span className="text-warning">⚠️ 可能受限</span>
                  ) : (
                    <span className="text-success">✓ 正常</span>
                  )
                }
              />
              <InfoRow
                label="需要自启动权限"
                value={batteryStatus.needsAutostart ? "是" : "否"}
              />
              <InfoRow
                label="需要省电白名单"
                value={batteryStatus.needsPowerSaveWhitelist ? "是" : "否"}
              />

              <div className="mt-3 space-y-2">
                <button
                  onClick={() => openBatteryOptimizationSettings()}
                  className="coc-btn text-xs !py-2 w-full"
                >
                  ⚡ 关闭电池优化
                </button>
                {batteryStatus.needsAutostart && (
                  <button
                    onClick={() => openAutostartSettings(batteryStatus.manufacturer)}
                    className="coc-btn-secondary text-xs !py-2 w-full"
                  >
                    🚀 允许自启动（{batteryStatus.manufacturer.toUpperCase()}）
                  </button>
                )}
                {batteryStatus.needsPowerSaveWhitelist && (
                  <button
                    onClick={() => openPowerSaveWhitelistSettings(batteryStatus.manufacturer)}
                    className="coc-btn-secondary text-xs !py-2 w-full"
                  >
                    🔋 加入省电白名单
                  </button>
                )}
                <button
                  onClick={() => openAppNotificationSettings()}
                  className="coc-btn-secondary text-xs !py-2 w-full"
                >
                  🔔 打开 APP 通知设置
                </button>
              </div>

              {/* 厂商教程 */}
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--divider)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted font-semibold">
                    后台运行指南{vendorGuide ? `（${vendorGuide.label}）` : ""}
                  </p>
                  <button
                    onClick={() => setShowAllGuides(true)}
                    className="text-[10px] text-gold underline"
                  >
                    查看全部厂商
                  </button>
                </div>

                {vendorGuide ? (
                  <ol className="space-y-2 text-xs text-sub">
                    {vendorGuide.steps.map((step, i) => (
                      <li key={i} className="coc-card p-2">
                        <p className="text-main font-semibold text-xs mb-0.5">{step.title}</p>
                        <p className="text-muted text-[11px] leading-relaxed">{step.desc}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[11px] text-muted">
                    您的设备不需要特殊设置。如有通知未弹出，请检查系统通知权限。
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">检测中...</p>
          )}
        </Section>

        {/* ======== 5. 数据管理 ======== */}
        <Section title="数据管理" emoji="💾">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="coc-card p-2">
              <p className="text-muted text-[10px]">JSON 历史</p>
              <p className="text-main font-bold">{jsonHistoryCount}/5 条</p>
            </div>
            <div className="coc-card p-2">
              <p className="text-muted text-[10px]">账号数量</p>
              <p className="text-main font-bold">{accountCount} 个</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleExportData}
              className="coc-btn text-xs !py-2 w-full"
            >
              📤 导出全部数据（JSON 备份）
            </button>
            <button
              onClick={handleImportData}
              className="coc-btn-secondary text-xs !py-2 w-full"
            >
              📥 导入备份
            </button>
            <Link
              href="/history"
              className="coc-btn-secondary text-xs !py-2 w-full text-center block"
            >
              📜 查看历史记录
            </Link>
            <button
              onClick={handleClearAll}
              className="coc-btn-secondary text-xs !py-2 w-full text-danger"
            >
              🗑 清空所有数据
            </button>
          </div>
        </Section>

        {/* ======== 底部 ======== */}
        <footer className="text-center text-muted text-[11px] pt-4 pb-8">
          <p>部落冲突升级规划助手 · v{CURRENT_VERSION}</p>
          <p className="mt-1">纯本地安卓 APP · 数据本地存储 · 离线运行</p>
        </footer>
      </main>

      {/* ======== 更新弹窗 ======== */}
      <Modal
        open={showUpdateModal}
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
                ⚠️ 此 Release 未附带 APK 资源，点击"立即更新"将跳转到 GitHub Releases 页面查看。
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ======== 全部厂商教程弹窗 ======== */}
      <Modal
        open={showAllGuides}
        onClose={() => setShowAllGuides(false)}
        title="厂商后台运行指南"
        maxWidth="max-w-lg"
        footer={
          <button
            onClick={() => setShowAllGuides(false)}
            className="coc-btn-secondary text-xs !py-2 !px-4"
          >
            关闭
          </button>
        }
      >
        <AllVendorGuides manufacturer={batteryStatus?.manufacturer} />
      </Modal>
    </>
  );
}

// ── 子组件 ──────────────────────────

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section className="coc-panel">
      <div className="coc-panel-header flex items-center gap-2">
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      <div className="coc-panel-body space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-main text-right truncate">{value}</span>
        {action}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-xs text-sub cursor-pointer py-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`coc-toggle ${checked ? "on" : ""}`}
      >
        <span className="coc-toggle-knob" />
      </button>
    </label>
  );
}

function AllVendorGuides({ manufacturer }: { manufacturer?: Manufacturer }) {
  const guides = getAllVendorGuides();
  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
      {guides.map((g) => (
        <div
          key={g.vendor}
          className={`coc-card p-3 ${manufacturer === g.vendor ? "border-[var(--color-gold)]" : ""}`}
        >
          <p className="text-sm font-bold text-main mb-1">
            {g.emoji} {g.label}
            {manufacturer === g.vendor && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
                您的设备
              </span>
            )}
          </p>
          <ol className="space-y-1.5">
            {g.steps.map((step, i) => (
              <li key={i} className="text-xs text-sub">
                <p className="text-main font-semibold text-[11px]">{step.title}</p>
                <p className="text-muted text-[11px] leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
