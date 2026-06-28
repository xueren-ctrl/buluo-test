/**
 * 通用 Modal 弹窗 — CoC 羊皮纸风格
 * 用于：更新提示弹窗、确认弹窗、详情查看
 */
"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  // 阻止背景滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 安卓硬件返回键关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      {/* 弹窗主体 */}
      <div
        className={`relative ${maxWidth} w-full coc-panel animate-pop-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="coc-panel-header flex items-center justify-between">
            <span>{title}</span>
            <button
              onClick={onClose}
              className="text-muted hover:text-main transition-colors text-lg leading-none"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        )}
        <div className="coc-panel-body">{children}</div>
        {footer && (
          <div className="coc-panel-body pt-0 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
