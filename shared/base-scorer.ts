/**
 * 基地评分系统 — 四维评分 + 评级
 * ============================================
 * 输入：VillageSnapshot + 活跃升级数 + 工人数
 * 输出：BaseScore
 *  - offenseScore(35%):   进攻科技进度
 *  - defenseScore(30%):   防御建筑进度
 *  - resourceScore(15%):  资源建筑进度
 *  - utilityScore(20%):   功能建筑进度
 *  - builderEfficiency:   工人利用率 0-100
 *  - total:               加权总分 0-100
 *  - grade:               S/A/B/C/D
 *
 * 依赖：coc-database.ts 的 getItemDef
 */

import { getItemDef } from "./coc-database";
import type { BuildCategory } from "./coc-database";
import type { VillageSnapshot } from "./types";

export type BaseGrade = "S" | "A" | "B" | "C" | "D";

export interface BaseScore {
  total: number;            // 加权总分 0-100
  offenseScore: number;     // 进攻分 0-100
  defenseScore: number;     // 防御分 0-100
  resourceScore: number;    // 资源分 0-100
  utilityScore: number;     // 功能分 0-100
  builderEfficiency: number; // 工人利用率 0-100
  grade: BaseGrade;
}

const WEIGHTS = {
  offense: 0.35,
  defense: 0.30,
  resource: 0.15,
  utility: 0.20,
} as const;

/**
 * 计算某分类的平均进度 0-100
 */
function categoryAvg(snapshot: VillageSnapshot, cat: BuildCategory): number {
  let sum = 0;
  let count = 0;
  for (const item of snapshot.items) {
    const def = getItemDef(item.scId);
    if (!def || def.buildCategory !== cat) continue;
    const max = def.maxLevel;
    if (max <= 0) continue;
    const lvl = Math.max(0, Math.min(item.currentLevel, max));
    sum += (lvl / max) * 100;
    count += 1;
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

/**
 * 计算工人利用率
 * - builderCount <= 0 时返回 0
 * - activeUpgrades >= builderCount 时返回 100
 * - 否则 = activeUpgrades / builderCount * 100
 */
function calcBuilderEfficiency(activeUpgrades: number, builderCount: number): number {
  if (builderCount <= 0) return 0;
  if (activeUpgrades >= builderCount) return 100;
  return Math.round((activeUpgrades / builderCount) * 100);
}

/**
 * 评级映射
 */
function toGrade(total: number): BaseGrade {
  if (total >= 85) return "S";
  if (total >= 70) return "A";
  if (total >= 55) return "B";
  if (total >= 40) return "C";
  return "D";
}

/**
 * 主入口：评分基地
 * @param snapshot 村庄快照
 * @param activeUpgrades 当前活跃升级数（含建筑+英雄+法术）
 * @param builderCount 工人总数（来自 snapshot.builderCount 或外部传入）
 */
export function scoreBase(
  snapshot: VillageSnapshot,
  activeUpgrades?: number,
  builderCount?: number
): BaseScore {
  const offenseScore = categoryAvg(snapshot, "offense");
  const defenseScore = categoryAvg(snapshot, "defense");
  const resourceScore = categoryAvg(snapshot, "resource");
  const utilityScore = categoryAvg(snapshot, "utility");

  const bCount = builderCount ?? snapshot.builderCount ?? 5;
  const active = activeUpgrades ?? snapshot.items.filter((i) => i.isUpgrading).length;
  const builderEfficiency = calcBuilderEfficiency(active, bCount);

  const total = Math.round(
    offenseScore * WEIGHTS.offense +
    defenseScore * WEIGHTS.defense +
    resourceScore * WEIGHTS.resource +
    utilityScore * WEIGHTS.utility
  );

  return {
    total,
    offenseScore,
    defenseScore,
    resourceScore,
    utilityScore,
    builderEfficiency,
    grade: toGrade(total),
  };
}

export const GRADE_LABELS: Record<BaseGrade, string> = {
  S: "S 级 · 优秀",
  A: "A 级 · 良好",
  B: "B 级 · 合格",
  C: "C 级 · 待提升",
  D: "D 级 · 需努力",
};

export const GRADE_COLORS: Record<BaseGrade, string> = {
  S: "text-yellow-400",
  A: "text-emerald-400",
  B: "text-cyan-400",
  C: "text-amber-400",
  D: "text-red-400",
};
