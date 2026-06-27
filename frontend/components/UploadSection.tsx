/**
 * 上传区域 — JSON 输入 + 解析按钮（可折叠）
 * 导出时间自动从 JSON 的 timestamp 字段读取，无需手动输入
 */
import { useState, useRef } from "react";

export function UploadSection({
  jsonInput,
  onJsonChange,
  onSubmit,
  loading,
  exportTimeLabel,
}: {
  jsonInput: string;
  onJsonChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  exportTimeLabel?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  return (
    <section className={`w-full glass-card p-4 mb-4 border-brand-500/20 transition-all duration-300 ${collapsed ? "mb-1.5" : ""}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between text-sm font-semibold text-brand-300 mb-2 hover:text-brand-200 transition-colors"
      >
        <span>📋 上传数据</span>
        <span className={`text-xs text-dark-500 transition-transform duration-200 ${collapsed ? "rotate-[-90deg]" : ""}`}>▼</span>
      </button>

      <div className={`collapsible-content ${collapsed ? "collapsed" : "expanded"}`}>
        <div className="mb-3">
          <label className="block text-xs text-dark-400 mb-1">
            CoC JSON 数据 <span className="text-red-400">*</span>
          </label>
          <textarea
            ref={jsonRef}
            value={jsonInput}
            onChange={(e) => onJsonChange(e.target.value)}
            placeholder={"粘贴游戏导出的 JSON …\n\n获取方法: 游戏内 设置 → 更多设置 → 数据导出 → 复制"}
            rows={8}
            className="w-full bg-dark-900/60 border border-dark-600 rounded-xl px-3.5 py-2.5 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-mono resize-y"
          />
        </div>

        {exportTimeLabel && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <span>📅</span>
            <span>游戏导出时间: <strong>{exportTimeLabel}</strong></span>
          </div>
        )}

        <button
          onClick={onSubmit}
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
  );
}

export default UploadSection;
