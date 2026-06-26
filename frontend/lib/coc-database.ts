/**
 * ============================================
 * 部落冲突数据库 - 完整升级规划数据
 * ============================================
 * 包含所有建筑、英雄、法术、兵种的升级信息
 * 用于智能推荐和升级路线规划
 */

export type ItemType = "building" | "hero" | "spell" | "unit" | "pet" | "equipment" | "resource" | "defense" | "wall";

export interface ItemUpgrade {
  level: number;
  cost?: number; // 资源费用 (金币或圣水)
  elixirCost?: number; // 圣水费用
  duration: number; // 升级时间 (秒)
  requiredBuildingLevel?: number; // 前置建筑等级
}

export interface CocItem {
  id: number; // SC ID
  dataId: number; // 游戏内 data ID
  name: string; // 中文名称
  category: ItemType;
  subCategory: string; // 细分类型 (如"defense", "resource")
  maxLevel: number;
  thRequired: number; // 需要的大本等级
  icon: string;
  priorityScore: number; // 推荐优先级分数 (0-100)
  upgradeTimes?: number[]; // 各级升级时间 (秒)
  upgradeCosts?: number[]; // 各级升级费用 (资源)
  description?: string; // 描述
}

// ============================================
// 建筑数据库
// ============================================
export const BUILDING_DATABASE: CocItem[] = [
  // 大本营
  {
    id: 1000001,
    dataId: 1000001,
    name: "大本营",
    category: "building",
    subCategory: "core",
    maxLevel: 16,
    thRequired: 1,
    icon: "🏛️",
    priorityScore: 100,
    description: "解锁所有建筑和兵种的核心",
  },
  // 建筑工人小屋
  {
    id: 1000002,
    dataId: 1000002,
    name: "建筑工人小屋",
    category: "building",
    subCategory: "builder",
    maxLevel: 6,
    thRequired: 4,
    icon: "🏗️",
    priorityScore: 90,
    description: "增加同时建设的工人数量",
  },
  // 金矿
  {
    id: 1000003,
    dataId: 1000003,
    name: "金矿",
    category: "building",
    subCategory: "resource",
    maxLevel: 12,
    thRequired: 1,
    icon: "⛏️",
    priorityScore: 70,
    description: "产出金币的基础建筑",
  },
  // 圣水瓶
  {
    id: 1000004,
    dataId: 1000004,
    name: "圣水瓶",
    category: "building",
    subCategory: "resource",
    maxLevel: 12,
    thRequired: 1,
    icon: "💧",
    priorityScore: 70,
    description: "产出圣水的基础建筑",
  },
  // 金库
  {
    id: 1000005,
    dataId: 1000005,
    name: "金库",
    category: "building",
    subCategory: "storage",
    maxLevel: 12,
    thRequired: 1,
    icon: "🏦",
    priorityScore: 75,
    description: "储存金币的建筑",
  },
  // 圣水存储
  {
    id: 1000006,
    dataId: 1000006,
    name: "圣水存储",
    category: "building",
    subCategory: "storage",
    maxLevel: 12,
    thRequired: 1,
    icon: "🏺",
    priorityScore: 75,
    description: "储存圣水的建筑",
  },
  // 法师塔
  {
    id: 1000015,
    dataId: 1000015,
    name: "法师塔",
    category: "building",
    subCategory: "defense",
    maxLevel: 12,
    thRequired: 4,
    icon: "🔮",
    priorityScore: 60,
    description: "远程范围伤害防御塔",
  },
  // 空气防御
  {
    id: 1000016,
    dataId: 1000016,
    name: "空气防御",
    category: "building",
    subCategory: "defense",
    maxLevel: 8,
    thRequired: 2,
    icon: "🛡️",
    priorityScore: 55,
    description: "对空单体高伤害防御",
  },
  // 隐形电塔
  {
    id: 1000017,
    dataId: 1000017,
    name: "隐形电塔",
    category: "building",
    subCategory: "defense",
    maxLevel: 5,
    thRequired: 7,
    icon: "⚡",
    priorityScore: 50,
    description: "敌人接近时才会显示的防御塔",
  },
  // 部落城堡
  {
    id: 1000022,
    dataId: 1000022,
    name: "部落城堡",
    category: "building",
    subCategory: "clan",
    maxLevel: 8,
    thRequired: 5,
    icon: "🏰",
    priorityScore: 85,
    description: "接收部落成员援军",
  },
  // 实验室
  {
    id: 1000023,
    dataId: 1000023,
    name: "实验室",
    category: "building",
    subCategory: "research",
    maxLevel: 15,
    thRequired: 4,
    icon: "🔬",
    priorityScore: 95,
    description: "研究新兵种和法术",
  },
  // 英雄殿
  {
    id: 1000024,
    dataId: 1000024,
    name: "英雄殿",
    category: "building",
    subCategory: "hero",
    maxLevel: 3,
    thRequired: 12,
    icon: "⚔️",
    priorityScore: 80,
    description: "英雄升级的场所",
  },
  // 宠物小屋
  {
    id: 1000025,
    dataId: 1000025,
    name: "宠物小屋",
    category: "building",
    subCategory: "pet",
    maxLevel: 5,
    thRequired: 14,
    icon: "🐾",
    priorityScore: 75,
    description: "研究和升级宠物",
  },
  // 战争营地
  {
    id: 1000026,
    dataId: 1000026,
    name: "战争营地",
    category: "building",
    subCategory: "war",
    maxLevel: 5,
    thRequired: 13,
    icon: "⚔️",
    priorityScore: 65,
    description: "部落战和联赛的备战场所",
  },
  // 攻城营
  {
    id: 1000027,
    dataId: 1000027,
    name: "攻城营",
    category: "building",
    subCategory: "siege",
    maxLevel: 5,
    thRequired: 11,
    icon: "🏗️",
    priorityScore: 60,
    description: "训练和使用攻城机器",
  },
  // 宝库
  {
    id: 1000028,
    dataId: 1000028,
    name: "宝库",
    category: "building",
    subCategory: "protection",
    maxLevel: 4,
    thRequired: 14,
    icon: "💎",
    priorityScore: 70,
    description: "保护资源不被掠夺",
  },
  // 兵营
  {
    id: 1000029,
    dataId: 1000029,
    name: "兵营",
    category: "building",
    subCategory: "army",
    maxLevel: 16,
    thRequired: 1,
    icon: "⛺",
    priorityScore: 65,
    description: "决定可以同时训练的 troop 数量",
  },
];

// ============================================
// 英雄数据库
// ============================================
export const HERO_DATABASE: CocItem[] = [
  {
    id: 2800001,
    dataId: 2800001,
    name: "野蛮人之王",
    category: "hero",
    subCategory: "melee",
    maxLevel: 81,
    thRequired: 5,
    icon: "👑",
    priorityScore: 98,
    description: "主要近战英雄，技能是战斧旋风",
  },
  {
    id: 2800002,
    dataId: 2800002,
    name: "弓箭女皇",
    category: "hero",
    subCategory: "ranged",
    maxLevel: 71,
    thRequired: 7,
    icon: "👸",
    priorityScore: 98,
    description: "主要远程英雄，技能是隐身术",
  },
  {
    id: 2800003,
    dataId: 2800003,
    name: "巨魔",
    category: "hero",
    subCategory: "support",
    maxLevel: 30,
    thRequired: 11,
    icon: "🧙",
    priorityScore: 90,
    description: "主要辅助英雄，技能是天空守护者",
  },
  {
    id: 2800007,
    dataId: 2800007,
    name: "野人王",
    category: "hero",
    subCategory: "melee",
    maxLevel: 30,
    thRequired: 16,
    icon: "🌟",
    priorityScore: 85,
    description: "最新版本英雄，野人主题",
  },
];

// ============================================
// 推荐算法核心
// ============================================

/**
 * 计算推荐优先级
 * 考虑因素:
 * - 是否卡科技
 * - 是否影响战斗力
 * - 资源效率
 * - 工人占用时间
 */
export function calculateRecommendationPriority(
  currentItem: CocItem,
  playerState: {
    thLevel: number;
    builderCount: number;
    activeBuilders: number;
    goldPerMinute: number;
    elixirPerMinute: number;
    goldStored: number;
    elixirStored: number;
    goldMax: number;
    elixirMax: number;
    labLevel: number;
    heroLevels: Record<string, number>;
  }
): number {
  let score = currentItem.priorityScore;

  // 如果当前 TH 等级，则大幅提升优先级
  if (currentItem.thRequired <= playerState.thLevel) {
    score += 20;
  }

  // 如果超过 TH 限制，降低优先级
  if (currentItem.thRequired > playerState.thLevel) {
    score -= 30;
  }

  // 实验室等级越高，研究优先级越高
  if (currentItem.subCategory === "research") {
    score += 10;
  }

  // 资源建筑在资源不足时优先级提升
  if (currentItem.subCategory === "resource") {
    if (playerState.goldPerMinute < 1000) score += 15;
    if (playerState.elixirPerMinute < 1000) score += 15;
  }

  // 存储建筑在接近满仓时优先级提升
  if (currentItem.subCategory === "storage") {
    const goldRatio = playerState.goldStored / playerState.goldMax;
    const elixirRatio = playerState.elixirStored / playerState.elixirMax;
    if (goldRatio > 0.8) score += 20;
    if (elixirRatio > 0.8) score += 20;
  }

  // 英雄等级低时，升级优先级高
  if (currentItem.category === "hero") {
    const heroKey = currentItem.name;
    const currentLevel = playerState.heroLevels[heroKey] || 1;
    if (currentLevel < 30) score += 15;
  }

  return score;
}

/**
 * 生成升级推荐列表
 */
export function generateRecommendations(
  items: CocItem[],
  playerState: any
): Recommendation[] {
  const scored = items.map((item) => ({
    ...item,
    recommendationScore: calculateRecommendationPriority(item, playerState),
  }));

  // 按优先级排序
  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scored.slice(0, 10).map((item, index) => ({
    rank: index + 1,
    item,
    reason: getRecommendationReason(item, playerState),
    recommendationScore: item.recommendationScore,
  }));
}

function getRecommendationReason(item: CocItem, playerState: any): string {
  if (item.subCategory === "core") return "大本营是核心建筑，优先升级";
  if (item.subCategory === "research") return "实验室直接影响兵种和法术强度";
  if (item.subCategory === "builder") return "增加工人数量可以并行更多升级";
  if (item.subCategory === "hero") return "英雄是战斗力的核心";
  if (item.subCategory === "resource") return "提升资源产出效率";
  if (item.subCategory === "storage") return "防止资源溢出浪费";
  return "提升整体基地实力";
}

export interface Recommendation {
  rank: number;
  item: CocItem;
  reason: string;
  recommendationScore: number;
}
