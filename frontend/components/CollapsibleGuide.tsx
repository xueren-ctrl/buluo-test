/**
 * 使用说明 — 简约风格
 */
import { useState } from "react";

export function CollapsibleGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="coc-panel mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="coc-panel-header w-full flex items-center justify-between"
      >
        <span>使用说明</span>
        <span className={`transition-transform duration-200 text-xs ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="coc-panel-body text-xs text-sub space-y-1.5">
          <p>游戏内 设置 → 更多设置 → 数据导出 → 复制 JSON</p>
          <p>粘贴到上方输入框，点击「粘贴 JSON」或「手动输入」</p>
          <p>解析后自动展示升级进度、基地评分与分析</p>
          <p>数据保存在本地，离线可用</p>
        </div>
      )}
    </section>
  );
}

export default CollapsibleGuide;
