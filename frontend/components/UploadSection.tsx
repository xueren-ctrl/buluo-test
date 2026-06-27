/**
 * 上传区域 — 简约风格，默认折叠，点击展开
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
  const [expanded, setExpanded] = useState(false);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // 从剪贴板快速导入
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        onJsonChange(text);
        setExpanded(true);
      } else {
        setExpanded(true);
      }
    } catch {
      // 剪贴板权限失败，直接展开手动输入
      setExpanded(true);
    }
  };

  return (
    <section className="coc-panel mb-4">
      <div className="coc-panel-body">
        {!expanded ? (
          /* 默认：两个按钮 */
          <div className="flex gap-2">
            <button
              onClick={handlePasteFromClipboard}
              disabled={loading}
              className="coc-btn flex-1 text-sm py-2.5"
            >
              {loading ? "解析中..." : "粘贴 JSON"}
            </button>
            <button
              onClick={() => setExpanded(true)}
              disabled={loading}
              className="coc-btn-secondary text-sm py-2.5"
            >
              手动输入
            </button>
          </div>
        ) : (
          /* 展开后：文本框 + 操作按钮 */
          <div className="space-y-2.5">
            <textarea
              ref={jsonRef}
              value={jsonInput}
              onChange={(e) => onJsonChange(e.target.value)}
              placeholder={"粘贴游戏导出的 JSON …\n\n获取方法: 游戏内 设置 → 更多设置 → 数据导出 → 复制"}
              rows={6}
              className="coc-input w-full text-xs resize-y"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={onSubmit}
                disabled={loading || !jsonInput.trim()}
                className="coc-btn flex-1 text-sm py-2.5"
              >
                {loading ? "解析中..." : "开始解析"}
              </button>
              <button
                onClick={() => { onJsonChange(""); setExpanded(false); }}
                disabled={loading}
                className="coc-btn-secondary text-sm py-2.5 px-4"
              >
                收起
              </button>
            </div>
          </div>
        )}

        {exportTimeLabel && (
          <p className="mt-2 text-[11px] text-muted">
            游戏导出时间: <span className="text-sub">{exportTimeLabel}</span>
          </p>
        )}
      </div>
    </section>
  );
}

export default UploadSection;
