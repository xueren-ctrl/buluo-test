/**
 * 基地分析器 — 识别基地风格 + 生成优化建议
 * ============================================
 * 输入：VillageSnapshot（全量村庄快照）
 * 输出：BaseAnalysis
 *  - style: rusher / offense_heavy / defense_heavy / balanced / maxer
 *  - categoryProgress: 各 buildCategory 的平均进度 0-100
 *  - bottleneck: 进度最低的分类
 *  - suggestions: 中文建议列表
 *
 * 依赖：coc-database.ts 的 getItemDef / BuildCategory
 */

import { getItemDef } from "./coc-database";
import type { BuildCategory } from "./coc-database";
import type { VillageSnapshot } from "./types";

export type BaseStyle =
  | "rusher"
  | "offense_heavy"
  | "defense_heavy"
  | "balanced"
  | "maxer";

export interface CategoryProgress {
  category: BuildCategory;
  avgProgress: number;   // 0-100
  itemCount: number;
  maxedCount: number;
}

export interface BaseAnalysis {
  style: BaseStyle;
  styleDescription: string;
  categoryProgress: CategoryProgress[];
  bottleneck: BuildCategory | null;
  suggestions: string[];
}

const STYLE_LABELS: Record<BaseStyle, string> = {
  rusher: "速本流",
  offense_heavy: "偏科技进攻",
  defense_heavy: "偏防御",
  balanced: "均衡发展",
  maxer: "满防流",
};

const STYLE_DESCRIPTIONS: Record<BaseStyle, string> = {
  rusher: "大本营等级领先，但建筑和科技进度落后。升级快但战力易断层，建议暂停升本、补齐核心防御与实验室科技。",
  offense_heavy: "进攻科技优先于防御。适合主动出击打资源，但防守薄弱易被平推，建议补强防空与核心防御。",
  defense_heavy: "防御等级高于进攻科技。基地防守扎实，但打资源乏力，建议优先升级实验室和常用兵种法术。",
  balanced: "进攻与防御均衡发展。基地整体健康，按优先级继续推进即可。",
  maxer: "大部分建筑接近满级。基地发展成熟，可考虑升级大本营解锁新内容（18本即将到来）。",
};

const CATEGORY_LABELS: Record<BuildCategory, string> = {
  offense: "进攻",
  defense: "防御",
  resource: "资源",
  utility: "功能",
};

/**
 * 计算单个项目的进度百分比 0-100
 * - 无定义返回 null（不计入统计）
 * - currentLevel <= 0 返回 0
 * - currentLevel >= maxLevel 返回 100
 */
function itemProgress(scId: number, currentLevel: number): number | null {
  const def = getItemDef(scId);
  if (!def) return null;
  if (currentLevel <= 0) return 0;
  if (currentLevel >= def.maxLevel) return 100;
  return Math.round((currentLevel / def.maxLevel) * 100);
}

/**
 * 按分类聚合进度
 */
function aggregateProgress(
  snapshot: VillageSnapshot
): CategoryProgress[] {
  const buckets: Record<BuildCategory, { sum: number; count: number; maxed: number }> = {
    offense: { sum: 0, count: 0, maxed: 0 },
    defense: { sum: 0, count: 0, maxed: 0 },
    resource: { sum: 0, count: 0, maxed: 0 },
    utility: { sum: 0, count: 0, maxed: 0 },
  };

  for (const item of snapshot.items) {
    const def = getItemDef(item.scId);
    if (!def) continue;
    const p = itemProgress(item.scId, item.currentLevel);
    if (p == null) continue;
    const b = buckets[def.buildCategory];
    b.sum += p;
    b.count += 1;
    if (p >= 100) b.maxed += 1;
  }

  return (Object.keys(buckets) as BuildCategory[]).map((cat) => {
    const b = buckets[cat];
    return {
      category: cat,
      avgProgress: b.count > 0 ? Math.round(b.sum / b.count) : 0,
      itemCount: b.count,
      maxedCount: b.maxed,
    };
  });
}

/**
 * 判断基地风格
 */
function detectStyle(
  snapshot: VillageSnapshot,
  progress: CategoryProgress[]
): BaseStyle {
  const th = snapshot.townHallLevel;
  const offense = progress.find((p) => p.category === "offense")?.avgProgress ?? 0;
  const defense = progress.find((p) => p.category === "defense")?.avgProgress ?? 0;
  const totalAvg =
    progress.reduce((s, p) => s + p.avgProgress, 0) / Math.max(progress.length, 1);

  // 满防流：整体进度 ≥ 85
  if (totalAvg >= 85) return "maxer";

  // 速本流：TH ≥ 10 且整体进度 < 50
  if (th >= 10 && totalAvg < 50) return "rusher";

  // 偏科判断：进攻 vs 防御差距 ≥ 20
  const diff = offense - defense;
  if (diff >= 20) return "offense_heavy";
  if (diff <= -20) return "defense_heavy";

  return "balanced";
}

/**
 * 生成中文建议（结合最新版本攻略）
 */
function generateSuggestions(
  style: BaseStyle,
  progress: CategoryProgress[],
  snapshot: VillageSnapshot
): string[] {
  const suggestions: string[] = [];
  const offense = progress.find((p) => p.category === "offense");
  const defense = progress.find((p) => p.category === "defense");
  const resource = progress.find((p) => p.category === "resource");
  const utility = progress.find((p) => p.category === "utility");
  const th = snapshot.townHallLevel;

  // ── 按风格给总体建议（结合最新版本主流打法）──
  switch (style) {
    case "rusher":
      suggestions.push("大本等级偏高，建议暂停升本，优先补齐核心防御与实验室科技。");
      suggestions.push("推荐打法：飞龙 + 闪震（雷电+地震）劈防空，一字划强推，过渡丝滑。");
      if (defense && defense.avgProgress < 40) {
        suggestions.push(`防御仅 ${defense.avgProgress}%，优先升防空火箭、天鹰火炮、X连弩、地狱之塔。`);
      }
      break;
    case "offense_heavy":
      if (defense && defense.avgProgress < 50) {
        suggestions.push(`防御 ${defense.avgProgress}% 偏低，优先升防空火箭、法师塔、地狱之塔。`);
      }
      suggestions.push("进攻已成型，可考虑补齐装备：蛮王地震靴+尖刺铁球，女王穿云箭+天使玩偶。");
      break;
    case "defense_heavy":
      if (offense && offense.avgProgress < 50) {
        suggestions.push(`进攻科技 ${offense.avgProgress}% 偏低，优先升实验室、飞龙、雷电法术。`);
      }
      suggestions.push("建议转向飞龙+闪震流派打资源，无需依赖高等级英雄。");
      break;
    case "maxer":
      suggestions.push("基地接近满级，可考虑升级大本营（18本即将到来，含新建筑与等级上限提升）。");
      break;
    case "balanced":
      suggestions.push("进攻与防御均衡，按优先级继续推进。建议优先升满实验室、部落城堡、英雄殿堂、铁匠铺。");
      break;
  }

  // ── 装备建议（高本玩家关键战力来源）──
  if (th >= 12) {
    suggestions.push("装备是四王战力关键：永王永恒之书+狂暴药水，飞盾战神雷霆战靴+火箭矛（1500宝石）。");
  }

  // ── 功能建筑建议 ──
  if (utility && utility.avgProgress < 60) {
    suggestions.push("功能建筑偏低：部落城堡影响援军，英雄殿堂影响四王等级，铁匠铺影响装备，建议优先升满。");
  }

  // ── 资源建议 ──
  if (resource && resource.avgProgress < 40) {
    suggestions.push(`资源建筑 ${resource.avgProgress}%，升级储金罐/圣水瓶/暗黑重油罐保障升级资金。`);
  }

  // ── 工人利用率建议 ──
  const activeCount = snapshot.items.filter((i) => i.isUpgrading).length;
  if (snapshot.builderCount > 0 && activeCount < snapshot.builderCount) {
    suggestions.push(`当前 ${snapshot.builderCount - activeCount} 个工人空闲，建议立即安排升级避免浪费。`);
  }

  // ── 夜世界建议（关联主世界第六工人解锁）──
  if (th >= 9 && th <= 14) {
    suggestions.push("夜世界目标：升奥仔小屋解锁第六工人，需主世界改装3个建筑 + 夜世界防御/部队/英雄达标。");
  }

  return suggestions;
}

/**
 * 主入口：分析基地
 */
export function analyzeBase(snapshot: VillageSnapshot): BaseAnalysis {
  const progress = aggregateProgress(snapshot);
  const style = detectStyle(snapshot, progress);
  const suggestions = generateSuggestions(style, progress, snapshot);

  // 找瓶颈（进度最低且 < 60 的分类）
  let bottleneck: BuildCategory | null = null;
  let minProgress = 60;
  for (const p of progress) {
    if (p.itemCount > 0 && p.avgProgress < minProgress) {
      minProgress = p.avgProgress;
      bottleneck = p.category;
    }
  }

  return {
    style,
    styleDescription: `${STYLE_LABELS[style]}：${STYLE_DESCRIPTIONS[style]}`,
    categoryProgress: progress,
    bottleneck,
    suggestions,
  };
}

export { CATEGORY_LABELS as BUILD_CATEGORY_LABELS };
