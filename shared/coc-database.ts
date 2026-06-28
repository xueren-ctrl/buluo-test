/**
 * CoC 游戏数值数据库 — 接口定义与查询函数
 * ============================================
 * 类型来源：本文件定义 CocItemDef / BuildCategory
 * 数据来源：./coc-database-data.ts（182 项静态数据）
 *
 * 查询函数：
 *  - getItemDef(scId)            按 SC ID 查单项定义
 *  - getItemsByCategory(cat)     按分类列出所有项
 *  - getAvailableItems(thLevel)  列出当前 TH 可建造/升级的项
 *  - getUpgradeTime(scId, lvl)   返回从 lvl → lvl+1 的升级耗时(秒)
 *  - isMaxed(scId, lvl)          当前等级是否已满级
 *  - getProgressPercent(scId, lvl) 返回升级进度百分比 0-100
 */

// ── 类型定义 ─────────────────────────────────

export type BuildCategory = "offense" | "defense" | "resource" | "utility";

export interface CocItemDef {
  scId: number;
  category: string;
  zh: string;
  en: string;
  buildCategory: BuildCategory;
  maxLevel: number;
  upgradeTimeSec: number[];
  thRequired: number[];
  priority: number;
  usesBuilder: boolean;
}

// ── 重新导出数据常量（统一入口） ───────────────
export {
  COC_DATABASE_VERSION,
  COC_DATABASE_UPDATED_AT,
  COC_DATABASE_SOURCE,
  COC_ITEM_DEFS,
  COC_ITEM_BY_ID,
} from "./coc-database-data";

import { COC_ITEM_BY_ID, COC_ITEM_DEFS } from "./coc-database-data";

// ── 查询函数 ─────────────────────────────────

/** 按 SC ID 查找单项定义，找不到返回 undefined */
export function getItemDef(scId: number): CocItemDef | undefined {
  return COC_ITEM_BY_ID[scId];
}

/** 按分类列出所有项（如 "buildings" / "spells" / "heroes"） */
export function getItemsByCategory(category: string): CocItemDef[] {
  return COC_ITEM_DEFS.filter((d) => d.category === category);
}

/** 列出当前大本营等级可建造/可升级到至少 1 级的所有项 */
export function getAvailableItems(thLevel: number): CocItemDef[] {
  return COC_ITEM_DEFS.filter((d) => d.thRequired[0] <= thLevel);
}

/**
 * 返回从 currentLevel → currentLevel+1 的升级耗时(秒)
 * - 已满级或越界返回 0
 * - currentLevel 从 1 开始（1 表示从 1 级升到 2 级）
 */
export function getUpgradeTime(scId: number, currentLevel: number): number {
  const def = getItemDef(scId);
  if (!def) return 0;
  if (currentLevel < 1 || currentLevel >= def.maxLevel) return 0;
  const idx = currentLevel - 1;
  return def.upgradeTimeSec[idx] ?? 0;
}

/** 当前等级是否已达到满级 */
export function isMaxed(scId: number, currentLevel: number): boolean {
  const def = getItemDef(scId);
  if (!def) return false;
  return currentLevel >= def.maxLevel;
}

/**
 * 返回升级进度百分比 0-100
 * - 0 表示未开始（currentLevel = 0）
 * - 100 表示已满级
 * - 中间值 = currentLevel / maxLevel * 100
 */
export function getProgressPercent(scId: number, currentLevel: number): number {
  const def = getItemDef(scId);
  if (!def) return 0;
  if (currentLevel <= 0) return 0;
  if (currentLevel >= def.maxLevel) return 100;
  return Math.round((currentLevel / def.maxLevel) * 100);
}

/**
 * 返回某项在当前 TH 下还能升多少级
 * - 若已满级返回 0
 * - 若当前 TH 不允许升级返回 0
 */
export function getRemainingUpgrades(scId: number, currentLevel: number, thLevel: number): number {
  const def = getItemDef(scId);
  if (!def) return 0;
  if (currentLevel >= def.maxLevel) return 0;
  let count = 0;
  for (let lvl = currentLevel; lvl < def.maxLevel; lvl++) {
    const thNeeded = def.thRequired[lvl] ?? 99;
    if (thNeeded <= thLevel) count++;
    else break;
  }
  return count;
}
