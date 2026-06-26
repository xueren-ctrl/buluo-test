/**
 * ============================================
 * 升级规划系统 - 核心算法
 * ============================================
 * 功能:
 * - 自动推荐下一步升级什么
 * - 生成升级路线
 * - 工人空闲预测
 * - 资源溢出预警
 */

import type { UpgradeItem, IdleTimes, PlayerInfo } from "@/types";
import { BUILDING_DATABASE, HERO_DATABASE } from "./coc-database";

// ============================================
// 每日基地状态报告
// ============================================
export interface DailyReport {
  title: string;
  items: ReportItem[];
  recommendations: string[];
  score: number;
}

export interface ReportItem {
  type: "success" | "warning" | "info" | "alert";
  icon: string;
  text: string;
}

/**
 * 生成今日基地状态报告
 */
export function generateDailyReport(
  upgrades: UpgradeItem[],
  idleTimes: IdleTimes | null,
  playerInfo: PlayerInfo | null
): DailyReport {
  const items: ReportItem[] = [];
  const recommendations: string[] = [];
  let score = 50; // 基础分

  // 检查升级完成
  const now = new Date();
  const completedToday = upgrades.filter((u) => {
    const finish = new Date(u.finish_time);
    const diff = now.getTime() - finish.getTime();
    return diff > 0 && diff < 86400000; // 24小时内完成
  });

  if (completedToday.length > 0) {
    items.push({
      type: "success",
      icon: "✅",
      text: `${completedToday.length}个升级今日完成`,
    });
    score += completedToday.length * 5;
  }

  // 检查工人空闲
  if (idleTimes) {
    if (idleTimes.builder_busy_count === 0) {
      items.push({
        type: "info",
        icon: "🔨",
        text: "所有工人当前空闲",
      });
      score -= 10;
      recommendations.push("建议立即开始新升级");
    } else {
      items.push({
        type: "info",
        icon: "🔨",
        text: `${idleTimes.builder_busy_count}/${idleTimes.builder_total || 5}个工人在忙`,
      });
    }
  }

  // 检查实验室
  if (idleTimes?.lab_idle_at) {
    const labIdle = new Date(idleTimes.lab_idle_at);
    if (now.getTime() - labIdle.getTime() > 3600000) {
      items.push({
        type: "warning",
        icon: "🧪",
        text: "实验室已空闲超过1小时",
      });
      recommendations.push("请尽快开始新研究");
      score -= 5;
    }
  }

  // 检查资源建筑等级
  if (playerInfo) {
    const th = playerInfo.town_hall_level;
    if (th < 10) {
      recommendations.push("建议优先升级金矿和圣水瓶");
      score += 5;
    } else if (th >= 10 && th < 14) {
      recommendations.push("开始注重防御建筑升级");
      score += 5;
    } else {
      recommendations.push("英雄和实验室是优先升级项");
      score += 10;
    }
  }

  return {
    title: "📊 今日基地状态",
    items,
    recommendations,
    score: Math.min(100, Math.max(0, score)),
  };
}

// ============================================
// 工人空闲预测
// ============================================
export interface WorkerPrediction {
  type: "worker_free" | "lab_free" | "resource_overflow";
  time: string;
  message: string;
  urgency: "high" | "medium" | "low";
}

/**
 * 预测工人何时空闲
 */
export function predictWorkerAvailability(
  upgrades: UpgradeItem[],
  idleTimes: IdleTimes | null
): WorkerPrediction[] {
  const predictions: WorkerPrediction[] = [];
  const now = Date.now();

  // 预测下一个完成的升级
  const active = upgrades
    .filter((u) => {
      const finish = new Date(u.finish_time).getTime();
      return finish > now;
    })
    .sort((a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime());

  if (active.length > 0) {
    const next = active[0];
    const finishTime = new Date(next.finish_time).getTime();
    const hoursToWait = Math.ceil((finishTime - now) / 3600000);

    predictions.push({
      type: "worker_free",
      time: next.finish_time,
      message: `${hoursToWait}小时后 ${next.item_name} 升级完成，1个工人将空闲`,
      urgency: hoursToWait < 2 ? "high" : hoursToWait < 6 ? "medium" : "low",
    });
  }

  // 预测实验室空闲
  if (idleTimes?.lab_idle_at) {
    const labTime = new Date(idleTimes.lab_idle_at).getTime();
    if (labTime > now) {
      const hoursToWait = Math.ceil((labTime - now) / 3600000);
      predictions.push({
        type: "lab_free",
        time: idleTimes.lab_idle_at,
        message: `${hoursToWait}小时后实验室将空闲`,
        urgency: hoursToWait < 1 ? "high" : "medium",
      });
    }
  }

  return predictions;
}

// ============================================
// 资源溢出预警
// ============================================
export interface ResourceWarning {
  type: "gold" | "elixir";
  ratio: number; // 当前/最大
  message: string;
  recommendation: string;
}

/**
 * 检测资源是否即将溢出
 */
export function detectResourceOverflow(
  upgrades: UpgradeItem[]
): ResourceWarning[] {
  const warnings: ResourceWarning[] = [];

  // 这里简化处理，实际需要从 JSON 数据中获取资源数量
  // 假设从 upgrades 中推断 (实际应从 player state 获取)

  return warnings;
}

// ============================================
// 升级路线生成
// ============================================
export interface UpgradeRoute {
  day: number;
  date: string;
  items: RouteItem[];
}

export interface RouteItem {
  category: string;
  itemName: string;
  level: number;
  estimatedDuration: number; // 小时
  resourceCost: number;
}

/**
 * 生成未来升级路线 (基于当前升级队列推算)
 */
export function generateUpgradeRoute(
  upgrades: UpgradeItem[],
  builderCount: number = 5
): UpgradeRoute[] {
  const now = new Date();
  const routes: UpgradeRoute[] = [];

  // 按完成时间排序
  const sorted = [...upgrades]
    .filter((u) => new Date(u.finish_time).getTime() > now.getTime())
    .sort((a, b) => new Date(a.finish_time).getTime() - new Date(b.finish_time).getTime());

  let currentDay = 1;
  let currentIndex = 0;

  while (currentIndex < sorted.length) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() + currentDay);

    const dayItems: RouteItem[] = [];
    const maxPerDay = builderCount * 2; // 每天最多处理 maxPerDay 个升级

    for (let i = 0; i < maxPerDay && currentIndex < sorted.length; i++, currentIndex++) {
      const upg = sorted[currentIndex];
      const durationSec = upg.timer_seconds || 3600;
      const durationHours = Math.ceil(durationSec / 3600);

      dayItems.push({
        category: upg.category,
        itemName: upg.item_name,
        level: upg.item_level,
        estimatedDuration: durationHours,
        resourceCost: 0, // 需要从数据库获取
      });
    }

    routes.push({
      day: currentDay,
      date: dayStart.toISOString().split("T")[0],
      items: dayItems,
    });

    currentDay++;
  }

  return routes.slice(0, 7); // 只返回未来7天
}

// ============================================
// 基地发展评分
// ============================================
export interface BaseScore {
  category: string;
  score: number;
  feedback: string;
}

export interface OverallScore {
  resourceEfficiency: BaseScore;
  techEfficiency: BaseScore;
  workerUtilization: BaseScore;
  defenseScore: BaseScore;
  overall: number;
}

/**
 * 计算基地综合发展评分
 */
export function calculateBaseScores(
  upgrades: UpgradeItem[],
  idleTimes: IdleTimes | null,
  playerInfo: PlayerInfo | null
): OverallScore {
  // 资源效率 (基于资源建筑数量和升级状态)
  const resourceUpgrades = upgrades.filter((u) => u.category === "buildings").length;
  const resourceScore = Math.min(100, 50 + resourceUpgrades * 10);

  // 科技效率 (基于实验室状态)
  const labStatus = idleTimes?.lab_idle_at ? "idle" : "busy";
  const techScore = labStatus === "busy" ? 80 : 60;

  // 工人利用率
  const busyBuilders = idleTimes?.builder_busy_count || 0;
  const totalBuilders = idleTimes?.builder_total || 5;
  const workerScore = totalBuilders > 0 ? (busyBuilders / totalBuilders) * 100 : 50;

  // 防御分数
  const defenseUpgrades = upgrades.filter((u) => ["defenses", "walls"].includes(u.category)).length;
  const defenseScore = Math.min(100, 40 + defenseUpgrades * 15);

  return {
    resourceEfficiency: {
      category: "资源效率",
      score: resourceScore,
      feedback: resourceScore > 70 ? "资源建筑升级良好" : "建议优先升级资源建筑",
    },
    techEfficiency: {
      category: "科技效率",
      score: techScore,
      feedback: techScore > 70 ? "实验室运转良好" : "实验室空闲时间过长",
    },
    workerUtilization: {
      category: "工人利用率",
      score: Math.round(workerScore),
      feedback: workerScore > 80 ? "工人利用率高" : "有空闲工人未充分利用",
    },
    defenseScore: {
      category: "防御评分",
      score: defenseScore,
      feedback: defenseScore > 60 ? "防御建设不错" : "建议加强防御建筑",
    },
    overall: Math.round(
      (resourceScore + techScore + workerScore + defenseScore) / 4
    ),
  };
}
