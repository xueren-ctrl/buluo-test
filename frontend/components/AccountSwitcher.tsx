/**
 * 账号切换器 — 多账号支持
 * ============================================
 * 在首页顶部展示当前激活账号 + 切换/添加/删除按钮
 * - 点击账号名 → 弹出账号列表 Modal
 * - 添加账号 → 跳转到首页"粘贴 JSON"区域
 * - 切换账号 → 从 IndexedDB 加载该账号数据，覆盖当前状态
 * - 通知系统通过 onAccountLabelChange 把账号标签传给调度器，
 *   用于在通知标题前加【主号】/【小号】前缀
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Modal } from "./Modal";
import {
  loadAllAccounts,
  setActiveAccount,
  deleteAccount,
  getActiveAccount,
  type AccountRecord,
} from "@/lib/indexeddb";

export function AccountSwitcher({
  onAccountChange,
}: {
  onAccountChange?: (account: AccountRecord | null) => void;
}) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeAccount, setActive] = useState<AccountRecord | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await loadAllAccounts();
      setAccounts(list);
      const active = await getActiveAccount();
      setActive(active || null);
      if (active) {
        onAccountChange?.(active);
      }
    } catch (e) {
      console.error("加载账号列表失败", e);
    }
  }, [onAccountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSwitch = useCallback(async (account: AccountRecord) => {
    try {
      await setActiveAccount(account.player_tag);
      const active = await getActiveAccount();
      setActive(active ?? null);
      setOpen(false);
      // 通知父组件触发页面刷新（从 IndexedDB 重新加载 upgrades/village）
      onAccountChange?.(active ?? null);
      toast.success(`已切换到 ${account.player_name || "默认账号"}`, {
        className: "toast-success",
      });
      // 触发页面整体刷新，让 page.tsx 重新读取数据
      window.dispatchEvent(new CustomEvent("coc-account-switched"));
    } catch (e) {
      toast.error("切换账号失败", { className: "toast-error" });
      console.error(e);
    }
  }, [onAccountChange]);

  const handleDelete = useCallback(async (account: AccountRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除账号「${account.player_name || account.player_tag}」吗？\n该账号的所有升级记录、村庄快照、设置都会被清除。`)) {
      return;
    }
    try {
      await deleteAccount(account.player_tag);
      toast.success("账号已删除", { className: "toast-success" });
      refresh();
      // 如果删除的是当前账号，触发切换事件
      if (account.active) {
        window.dispatchEvent(new CustomEvent("coc-account-switched"));
      }
    } catch (err) {
      toast.error("删除失败", { className: "toast-error" });
      console.error(err);
    }
  }, [refresh]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="coc-btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 max-w-[180px]"
        aria-label="切换账号"
      >
        <span className="text-[var(--color-gold)]">👤</span>
        <span className="truncate">
          {activeAccount?.player_name || "默认账号"}
        </span>
        {accounts.length > 1 && (
          <span className="text-[10px] bg-[var(--color-gold)] text-[var(--bg-panel)] rounded-full px-1.5 py-0.5 font-bold">
            {accounts.length}
          </span>
        )}
        <span className="text-muted text-[10px]">▼</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="切换账号"
        footer={
          <button
            onClick={() => setOpen(false)}
            className="coc-btn-secondary text-xs !py-2 !px-4"
          >
            关闭
          </button>
        }
      >
        <div className="space-y-2">
          {accounts.length === 0 && (
            <p className="text-center text-muted text-sm py-6">
              还没有账号记录<br />
              <span className="text-xs">上传第一个 JSON 后会自动创建</span>
            </p>
          )}
          {accounts.map((a) => (
            <div
              key={a.player_tag}
              onClick={() => handleSwitch(a)}
              className={`coc-card p-3 cursor-pointer transition-all ${
                a.active ? "border-[var(--color-gold)]" : ""
              } hover:border-[var(--border-gold)]`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-main truncate">
                      {a.player_name || "(无名玩家)"}
                    </span>
                    {a.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
                        当前
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {a.player_tag && <span>{a.player_tag} · </span>}
                    <span className="text-gold">大本 Lv{a.town_hall_level}</span>
                    {" · "}
                    <span>{a.upgrades?.length || 0} 升级</span>
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    最近导入：{new Date(a.last_import_time).toLocaleString("zh-CN")}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(a, e)}
                  className="text-danger text-xs px-2 py-1 hover:bg-[var(--color-danger-bg)] rounded transition-colors"
                  aria-label="删除账号"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default AccountSwitcher;
