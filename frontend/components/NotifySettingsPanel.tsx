/**
 * 通知设置面板 — 浏览器权限 + 提醒时机 + DND + 去重重置
 */
import { useState } from "react";
import type { NotifyStatus } from "@/lib/notification-system";
import type { SchedulerSettings } from "@/lib/indexeddb";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  return `${Math.floor(hr / 24)}天前`;
}

export function NotifySettingsPanel({
  status,
  settings,
  onUpdateSettings,
  onEnableNotify,
  onClearNotifyState,
}: {
  status: NotifyStatus;
  settings: SchedulerSettings | null;
  onUpdateSettings: (patch: Partial<SchedulerSettings>) => Promise<void>;
  onEnableNotify: () => void;
  onClearNotifyState: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!settings) return null;

  return (
    <section className="w-full glass-card p-4 mb-4 border-dark-700/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-dark-200"
      >
        <span>🔔 通知设置</span>
        <span className={`text-xs text-dark-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      <div className={`collapsible-content mt-3 ${open ? "expanded" : "collapsed"}`}>
        <div className="space-y-3">
          {/* 浏览器通知权限 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">
                浏览器通知
                {!status.browserNotifAvailable && <span className="text-red-400 ml-1">(不支持)</span>}
                {status.browserNotifAvailable && !status.browserNotifGranted && <span className="text-amber-400 ml-1">(未授权)</span>}
                {status.browserNotifGranted && <span className="text-green-400 ml-1">✓</span>}
              </span>
              <button
                onClick={onEnableNotify}
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
            {/* 不支持原因 + 引导文案 */}
            {status.unsupportedReason && (
              <div className="text-[11px] text-amber-400/80 leading-relaxed pl-1">
                <p>⚠️ {status.unsupportedReason}</p>
                {status.hint && <p className="text-dark-400 mt-0.5">{status.hint}</p>}
              </div>
            )}
            {/* 已安装 PWA 提示 */}
            {status.isInstalled && (
              <div className="text-[11px] text-green-400/70 pl-1">
                ✓ 已以 PWA 模式启动，可获得最佳通知体验
              </div>
            )}
          </div>

          {/* 后台同步状态 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">
                后台同步（页面关闭时提醒）
                {!status.periodicSyncSupported && <span className="text-amber-400 ml-1">(不支持)</span>}
                {status.periodicSyncSupported && <span className="text-green-400 ml-1">✓</span>}
              </span>
            </div>
            {!status.periodicSyncSupported && (
              <div className="text-[11px] text-dark-500 leading-relaxed pl-1">
                仅 Chrome / Edge 浏览器 + 安装 PWA 后支持。其他浏览器请保持页面打开，或重开页面时自动补发漏掉的通知。
              </div>
            )}
          </div>

          {/* 提醒层级 */}
          <div className="space-y-2 pt-2 border-t border-dark-700/50">
            <p className="text-xs text-dark-500 font-semibold">提醒时机</p>
            <ToggleRow
              label="提前 30 分钟"
              checked={settings.enablePre30m}
              onChange={(v) => onUpdateSettings({ enablePre30m: v })}
            />
            <ToggleRow
              label="提前 10 分钟"
              checked={settings.enablePre10m}
              onChange={(v) => onUpdateSettings({ enablePre10m: v })}
            />
            <ToggleRow
              label="完成时"
              checked={settings.enableComplete}
              onChange={(v) => onUpdateSettings({ enableComplete: v })}
            />
            <ToggleRow
              label="完成后 10 分钟（再次）"
              checked={settings.enablePostComplete}
              onChange={(v) => onUpdateSettings({ enablePostComplete: v })}
            />
            <ToggleRow
              label="批量合并（同一时刻多项完成合并为一条）"
              checked={settings.enableBatch}
              onChange={(v) => onUpdateSettings({ enableBatch: v })}
            />
          </div>

          {/* 夜间免打扰 */}
          <div className="space-y-2 pt-2 border-t border-dark-700/50">
            <ToggleRow
              label="夜间免打扰（DND）"
              checked={settings.dndEnabled}
              onChange={(v) => onUpdateSettings({ dndEnabled: v })}
            />
            {settings.dndEnabled && (
              <div className="flex items-center gap-2 text-xs text-dark-400 pl-1">
                <span>免扰时段</span>
                <select
                  value={settings.dndStart}
                  onChange={(e) => onUpdateSettings({ dndStart: Number(e.target.value) })}
                  className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-dark-200"
                >
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
                <span>至</span>
                <select
                  value={settings.dndEnd}
                  onChange={(e) => onUpdateSettings({ dndEnd: Number(e.target.value) })}
                  className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-dark-200"
                >
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 上次提醒时间 + 重置去重 */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-dark-700/50">
            <span className="text-dark-500">
              上次提醒: {settings.last_notify_at ? formatRelativeTime(settings.last_notify_at) : "—"}
            </span>
            <button
              onClick={onClearNotifyState}
              className="text-dark-400 hover:text-amber-400 transition-colors"
            >
              重置去重
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-xs text-dark-300 cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-dark-700"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
    </label>
  );
}

export default NotifySettingsPanel;
