/**
 * 升级进行中列表 — 按分类分组显示（CoC 羊皮纸风格分隔行）
 */
import type { UpgradeItem } from "@/types";
import { UpgradeCard } from "./UpgradeCard";
import { SectionTitle } from "./SectionTitle";
import { EmptyState } from "./EmptyState";

const CATEGORY_ORDER: { key: string; label: string; icon: string }[] = [
  { key: "buildings", label: "建筑", icon: "🏰" },
  { key: "heroes", label: "英雄", icon: "⚔️" },
  { key: "spells", label: "法术", icon: "⚗️" },
  { key: "pets", label: "战宠", icon: "🐾" },
  { key: "equipment", label: "装备", icon: "🛡️" },
  { key: "units", label: "兵种", icon: "👾" },
  { key: "helpers", label: "助手", icon: "🔧" },
  { key: "siege_machines", label: "攻城机器", icon: "🏗️" },
  { key: "traps", label: "陷阱", icon: "💣" },
  { key: "buildings2", label: "夜世界建筑", icon: "🌙" },
  { key: "heroes2", label: "夜世界英雄", icon: "🦸" },
  { key: "units2", label: "夜世界兵种", icon: "👹" },
  { key: "traps2", label: "夜世界陷阱", icon: "🪤" },
];

export function UpgradeList({ items }: { items: UpgradeItem[] }) {
  if (items.length === 0) {
    return (
      <>
        <SectionTitle title="升级进行中" count={0} />
        <EmptyState emoji="" title="当前没有升级项目" desc="所有工人和实验室都在空闲" />
      </>
    );
  }

  const groups = new Map<string, UpgradeItem[]>();
  for (const item of items) {
    const arr = groups.get(item.category) ?? [];
    arr.push(item);
    groups.set(item.category, arr);
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    const idxA = CATEGORY_ORDER.findIndex((c) => c.key === a[0]);
    const idxB = CATEGORY_ORDER.findIndex((c) => c.key === b[0]);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  return (
    <>
      <SectionTitle title="升级进行中" count={items.length} />
      <div className="space-y-3">
        {sortedGroups.map(([category, groupItems]) => {
          const meta = CATEGORY_ORDER.find((c) => c.key === category);
          const label = meta ? `${meta.icon} ${meta.label}` : category;
          return (
            <div key={category}>
              <div className="coc-divider">
                {label} ({groupItems.length})
              </div>
              <div className="space-y-2">
                {groupItems.map((upg) => (
                  <UpgradeCard
                    key={`${upg.category}-${upg.data_id ?? upg.item_name}-${upg.item_level}`}
                    item={upg}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default UpgradeList;
