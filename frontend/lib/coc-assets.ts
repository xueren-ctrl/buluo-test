/**
 * ============================================
 * 部落冲突 (Clash of Clans) 完整中文资源映射系统
 * ============================================
 * 覆盖：建筑、法术、英雄、宠物、装备、兵种、攻城机器、陷阱
 * 数据来源：基于 CoC 官方数据库和 SC ID 规则
 * 
 * SC ID 规则：
 * - 建筑 (buildings): 1000xxxx
 * - 法术 (spells): 26000xxx
 * - 英雄 (heroes): 28000xxx
 * - 宠物 (pets): 73000xxx
 * - 装备 (equipment): 106000xxx
 * - 助力 (helpers): 124000xxx
 * - 兵种 (units): 4000xxx
 * - 攻城机器 (siege_machines): 27000xxx
 * - 陷阱 (traps): 25000xxx
 */

// ============================================
// 建筑映射 (buildings) - SC ID 1000xxxx
// ============================================
export const BUILDING_MAP: Record<number, {
  zh: string;
  en: string;
  type: "building";
  color: string;
  icon: string;
}> = {
  // Town Hall
  1000001: { zh: "市政厅", en: "Town Hall", type: "building", color: "orange", icon: "🏛️" },
  // Builders Workshop
  1000002: { zh: "建筑工人小屋", en: "Builders Workshop", type: "building", color: "orange", icon: "🏗️" },
  // Collector
  1000003: { zh: "金矿", en: "Gold Mine", type: "building", color: "orange", icon: "⛏️" },
  // Collector (Elixir)
  1000004: { zh: "圣水瓶", en: "Elixir Collector", type: "building", color: "orange", icon: "💧" },
  // Storage (Gold)
  1000005: { zh: "金库", en: "Gold Storage", type: "building", color: "orange", icon: "🏦" },
  // Storage (Elixir)
  1000006: { zh: "圣水存储", en: "Elixir Storage", type: "building", color: "orange", icon: "🏺" },
  // Defense - Cannon
  1000007: { zh: "迫击炮", en: "Mortar", type: "building", color: "orange", icon: "💥" },
  // Defense - Archer Tower
  1000008: { zh: "箭塔", en: "Archer Tower", type: "building", color: "orange", icon: "🏹" },
  // Defense - Tesla
  1000009: { zh: "特斯拉电塔", en: "Tesla", type: "building", color: "orange", icon: "⚡" },
  // Defense - Mortar
  1000010: { zh: "迫击炮", en: "Mortar", type: "building", color: "orange", icon: "💥" },
  // Defense - Cannon (low TH)
  1000011: { zh: "加农炮", en: "Cannon", type: "building", color: "orange", icon: "💣" },
  // Defense - Archer Tower (low TH)
  1000012: { zh: "箭塔", en: "Archer Tower", type: "building", color: "orange", icon: "🏹" },
  // Defense - Tower (Tesla)
  1000013: { zh: "地狱塔", en: "Inferno Tower", type: "building", color: "orange", icon: "🔥" },
  // Defense - Wall
  1000014: { zh: "城墙", en: "Wall", type: "building", color: "orange", icon: "🧱" },
  // Defense - Wizard Tower
  1000015: { zh: "法师塔", en: "Wizard Tower", type: "building", color: "orange", icon: "🔮" },
  // Defense - Air Defense
  1000016: { zh: "空气防御", en: "Air Defense", type: "building", color: "orange", icon: "🛡️" },
  // Defense - Hidden Tesla
  1000017: { zh: "隐形电塔", en: "Hidden Tesla", type: "building", color: "orange", icon: "⚡" },
  // Defense - Bomb Tower
  1000018: { zh: "炸弹塔", en: "Bomb Tower", type: "building", color: "orange", icon: "💣" },
  // Defense - Eagle Artifact
  1000019: { zh: "鹰龙火炮", en: "Eagle Artifact", type: "building", color: "orange", icon: "🦅" },
  // Defense - Scattershot
  1000020: { zh: "散弹枪", en: "Scattershot", type: "building", color: "orange", icon: "🔫" },
  // Defense - Monolith
  1000021: { zh: "巨石炮", en: "Monolith", type: "building", color: "orange", icon: "🗿" },
  // Clan Castle
  1000022: { zh: "部落城堡", en: "Clan Castle", type: "building", color: "orange", icon: "🏰" },
  // Laboratory
  1000023: { zh: "实验室", en: "Laboratory", type: "building", color: "orange", icon: "🔬" },
  // Heroes' Hut (TH16+)
  1000024: { zh: "英雄殿", en: "Heroes' Hut", type: "building", color: "orange", icon: "⚔️" },
  // Pet House
  1000025: { zh: "宠物小屋", en: "Pet House", type: "building", color: "orange", icon: "🐾" },
  // War Camp (TH15+)
  1000026: { zh: "战争营地", en: "War Camp", type: "building", color: "orange", icon: "⚔️" },
  // Siege Workshop (TH14+)
  1000027: { zh: "攻城营", en: "Siege Workshop", type: "building", color: "orange", icon: "🏗️" },
  // Treasure Vault (TH16+)
  1000028: { zh: "宝库", en: "Treasure Vault", type: "building", color: "orange", icon: "💎" },
  // Army Camp
  1000029: { zh: "兵营", en: "Army Camp", type: "building", color: "orange", icon: "⛺" },
  // Elixir Storage (updated name)
  1000030: { zh: "圣水池", en: "Elixir Pump", type: "building", color: "orange", icon: "💧" },
  // Gold Storage (updated name)
  1000031: { zh: "金币泵", en: "Gold Pump", type: "building", color: "orange", icon: "⛏️" },
};

// ============================================
// 法术映射 (spells) - SC ID 26000xxx
// ============================================
export const SPELL_MAP: Record<number, {
  zh: string;
  en: string;
  type: "spell";
  color: string;
  icon: string;
}> = {
  2600001: { zh: "力量药水", en: "Strength Potion", type: "spell", color: "blue", icon: "💪" },
  2600002: { zh: "超力药水", en: "Super Strength Potion", type: "spell", color: "blue", icon: "⚡" },
  2600003: { zh: "移速药水", en: "Speed Potion", type: "spell", color: "blue", icon: "💨" },
  2600004: { zh: "超级移速药水", en: "Super Speed Potion", type: "spell", color: "blue", icon: "🌟" },
  2600005: { zh: "治疗术", en: "Heal", type: "spell", color: "blue", icon: "💚" },
  2600006: { zh: "狂暴术", en: "Rage", type: "spell", color: "blue", icon: "😡" },
  2600007: { zh: "冰冻术", en: "Freeze", type: "spell", color: "blue", icon: "❄️" },
  2600008: { zh: "隐身术", en: "Invisibility", type: "spell", color: "blue", icon: "👻" },
  2600009: { zh: "剧毒术", en: "Poison", type: "spell", color: "blue", icon: "☠️" },
  2600010: { zh: "跃迁术", en: "Jump", type: "spell", color: "blue", icon: "🦘" },
};

// ============================================
// 英雄映射 (heroes) - SC ID 28000xxx
// ============================================
export const HERO_MAP: Record<number, {
  zh: string;
  en: string;
  type: "hero";
  color: string;
  icon: string;
}> = {
  2800001: { zh: "野蛮人之王", en: "Barbarian King", type: "hero", color: "gold", icon: "👑" },
  2800002: { zh: "弓箭女皇", en: "Archer Queen", type: "hero", color: "gold", icon: "👸" },
  2800003: { zh: "巨魔", en: "Grand Warden", type: "hero", color: "gold", icon: "🧙" },
  2800004: { zh: "飞盾战神", en: "Wall Wrecker", type: "hero", color: "gold", icon: "🛡️" },
  2800005: { zh: "攻城机器人", en: "Battle Machine", type: "hero", color: "gold", icon: "🤖" },
  2800006: { zh: "枭雄", en: "Slayer", type: "hero", color: "gold", icon: "⚔️" },
  2800007: { zh: "野人王", en: "Golden Chieftain", type: "hero", color: "gold", icon: "🌟" },
};

// ============================================
// 宠物映射 (pets) - SC ID 73000xxx
// ============================================
export const PET_MAP: Record<number, {
  zh: string;
  en: string;
  type: "pet";
  color: string;
  icon: string;
}> = {
  7300001: { zh: "帕拉狗骑士", en: "Electro Owl", type: "pet", color: "green", icon: "🦉" },
  7300002: { zh: "猎鹰", en: "Falcon", type: "pet", color: "green", icon: "🦅" },
  7300003: { zh: "獠牙狮鹫", en: "Ravager", type: "pet", color: "green", icon: "🦁" },
  7300004: { zh: "雪鹰", en: "Snow Leopard", type: "pet", color: "green", icon: "🐆" },
  7300005: { zh: "幼龙", en: "Unicorn", type: "pet", color: "green", icon: "🦄" },
  7300006: { zh: "战狼", en: "Kitty", type: "pet", color: "green", icon: "🐱" },
  7300007: { zh: "奇美拉", en: "Mighty Yak", type: "pet", color: "green", icon: "🐂" },
  7300008: { zh: "神牛", en: "Diggy", type: "pet", color: "green", icon: "🐕" },
};

// ============================================
// 装备映射 (equipment) - SC ID 106000xxx
// ============================================
export const EQUIPMENT_MAP: Record<number, {
  zh: string;
  en: string;
  type: "equipment";
  color: string;
  icon: string;
}> = {
  // Hero Equipment
  1060001: { zh: "野蛮人拳头", en: "Barbarian Face", type: "equipment", color: "purple", icon: "👊" },
  1060002: { zh: "弓箭女皇冠冕", en: "Archer Crown", type: "equipment", color: "purple", icon: "👑" },
  1060003: { zh: "生命法杖", en: "Staff of Healing", type: "equipment", color: "purple", icon: "🪄" },
  1060004: { zh: "闪电徽记", en: "Lightning Logo", type: "equipment", color: "purple", icon: "⚡" },
  1060005: { zh: "狂伤爪", en: "Claws of Damage", type: "equipment", color: "purple", icon: "🐾" },
  1060006: { zh: "护身符", en: "Charms of Tankiness", type: "equipment", color: "purple", icon: "🧿" },
  1060007: { zh: "战鹰之锚", en: "Anchor of the Eagle", type: "equipment", color: "purple", icon: "⚓" },
  1060008: { zh: "雷霆面具", en: "Mask of Torment", type: "equipment", color: "purple", icon: "🎭" },
  1060009: { zh: "火焰披风", en: "Cloak of Flame", type: "equipment", color: "purple", icon: "🔥" },
  // Lab Equipment
  1060010: { zh: "地震之刃", en: "Blade of Doom", type: "equipment", color: "purple", icon: "🗡️" },
  1060011: { zh: "英雄药剂背包", en: "Heroic Backpack", type: "equipment", color: "purple", icon: "🎒" },
  1060012: { zh: "猛士肩甲", en: "Shoulderpads of Might", type: "equipment", color: "purple", icon: "🛡️" },
  1060013: { zh: "治疗宝珠", en: "Healing Orb", type: "equipment", color: "purple", icon: "💚" },
  1060014: { zh: "爆炸箭袋", en: "Explosive Quiver", type: "equipment", color: "purple", icon: "🏹" },
  1060015: { zh: "野性头盔", en: "Wild Helm", type: "equipment", color: "purple", icon: "🪖" },
  1060016: { zh: "战争节律器", en: "War Rhythmer", type: "equipment", color: "purple", icon: "🥁" },
};

// ============================================
// 兵种映射 (units) - SC ID 4000xxx
// ============================================
export const UNIT_MAP: Record<number, {
  zh: string;
  en: string;
  type: "unit";
  color: string;
  icon: string;
}> = {
  4000001: { zh: "野蛮人", en: "Barbarian", type: "unit", color: "blue", icon: "👤" },
  4000002: { zh: "弓箭手", en: "Archer", type: "unit", color: "blue", icon: "🏹" },
  4000003: { zh: "巨人", en: "Giant", type: "unit", color: "blue", icon: "👊" },
  4000004: { zh: "哥布林", en: "Goblin", type: "unit", color: "blue", icon: "👺" },
  4000005: { zh: "法师", en: "Wizard", type: "unit", color: "blue", icon: "🔮" },
  4000006: { zh: "飞龙宝宝", en: "Baby Dragon", type: "unit", color: "blue", icon: "🐉" },
  4000007: { zh: "皮卡超人", en: "P.E.K.K.A", type: "unit", color: "blue", icon: "🤖" },
  4000008: { zh: "气球宝宝", en: "Balloon", type: "unit", color: "blue", icon: "🎈" },
  4000009: { zh: "地刺", en: "Ground Glove", type: "unit", color: "blue", icon: "🧤" },
  4000010: { zh: "猎人", en: "Hunter", type: "unit", color: "blue", icon: "🏹" },
};

// ============================================
// 攻城机器映射 (siege_machines) - SC ID 27000xxx
// ============================================
export const SIEGE_MAP: Record<number, {
  zh: string;
  en: string;
  type: "siege";
  color: string;
  icon: string;
}> = {
  2700001: { zh: "攻城训练营", en: "Siege Battering Ram", type: "siege", color: "cyan", icon: "🏗️" },
  2700002: { zh: "攻城投石车", en: "Stone Slammer", type: "siege", color: "cyan", icon: "🪨" },
  2700003: { zh: "攻城飞艇", en: "Logic Engine", type: "siege", color: "cyan", icon: "🚀" },
  2700004: { zh: "攻城机甲", en: "Log Launcher", type: "siege", color: "cyan", icon: "🪵" },
};

// ============================================
// 助力映射 (helpers) - SC ID 124000xxx
// ============================================
export const HELPER_MAP: Record<number, {
  zh: string;
  en: string;
  type: "helper";
  color: string;
  icon: string;
}> = {
  1240001: { zh: "建筑大师助手", en: "Master Builder Helper", type: "helper", color: "teal", icon: "🔧" },
  1240002: { zh: "魔法助手", en: "Magic Helper", type: "helper", color: "teal", icon: "✨" },
};

// ============================================
// 陷阱映射 (traps) - SC ID 25000xxx
// ============================================
export const TRAP_MAP: Record<number, {
  zh: string;
  en: string;
  type: "trap";
  color: string;
  icon: string;
}> = {
  2500001: { zh: "弹簧陷阱", en: "Spring Trap", type: "trap", color: "red", icon: "🔩" },
  2500002: { zh: "空气炸弹", en: "Air Bomb", type: "trap", color: "red", icon: "💥" },
  2500003: { zh: "巨型炸弹", en: "Giant Bomb", type: "trap", color: "red", icon: "💣" },
};

// ============================================
// 复合映射 (用于快速查找)
// ============================================
export const ITEM_MAP: Record<number, {
  zh: string;
  en: string;
  type: string;
  color: string;
  icon: string;
}> = {
  ...BUILDING_MAP,
  ...SPELL_MAP,
  ...HERO_MAP,
  ...PET_MAP,
  ...EQUIPMENT_MAP,
  ...UNIT_MAP,
  ...SIEGE_MAP,
  ...HELPER_MAP,
  ...TRAP_MAP,
};

// ============================================
// 分类颜色定义
// ============================================
export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  orange: { bg: "from-amber-900/20 to-amber-900/5", border: "border-amber-500/30", text: "text-amber-400", icon: "text-amber-500" },
  blue: { bg: "from-indigo-900/20 to-indigo-900/5", border: "border-indigo-500/30", text: "text-indigo-400", icon: "text-indigo-500" },
  gold: { bg: "from-yellow-600/20 to-yellow-600/5", border: "border-yellow-500/40", text: "text-yellow-400", icon: "text-yellow-500" },
  green: { bg: "from-emerald-900/20 to-emerald-900/5", border: "border-emerald-500/30", text: "text-emerald-400", icon: "text-emerald-500" },
  purple: { bg: "from-violet-900/20 to-violet-900/5", border: "border-violet-500/30", text: "text-violet-400", icon: "text-violet-500" },
  cyan: { bg: "from-cyan-900/20 to-cyan-900/5", border: "border-cyan-500/30", text: "text-cyan-400", icon: "text-cyan-500" },
  teal: { bg: "from-teal-900/20 to-teal-900/5", border: "border-teal-500/30", text: "text-teal-400", icon: "text-teal-500" },
  red: { bg: "from-red-900/20 to-red-900/5", border: "border-red-500/30", text: "text-red-400", icon: "text-red-500" },
};

// ============================================
// 分类标签映射
// ============================================
export const CATEGORY_LABELS: Record<string, string> = {
  buildings: "建筑",
  spells: "法术",
  heroes: "英雄",
  pets: "宠物",
  equipment: "装备",
  units: "兵种",
  siege: "攻城机器",
  helper: "助力",
  trap: "陷阱",
};

// ============================================
// 根据 SC ID 范围推断分类
// ============================================
export function inferCategory(scId: number): string {
  if (scId >= 1000000 && scId < 2000000) return "buildings";
  if (scId >= 2500000 && scId < 2600000) return "trap";
  if (scId >= 2600000 && scId < 2700000) return "spells";
  if (scId >= 2700000 && scId < 2800000) return "siege";
  if (scId >= 2800000 && scId < 3000000) return "heroes";
  if (scId >= 4000000 && scId < 5000000) return "units";
  if (scId >= 7300000 && scId < 7400000) return "pets";
  if (scId >= 10600000 && scId < 10700000) return "equipment";
  if (scId >= 12400000 && scId < 12500000) return "helper";
  return "unknown";
}

// ============================================
// 根据 SC ID 和分类获取完整物品信息
// ============================================
export function getItemInfo(scId: number, category?: string): {
  zh: string;
  en: string;
  type: string;
  color: string;
  icon: string;
  category: string;
} | null {
  const matched = ITEM_MAP[scId];
  if (!matched) {
    return {
      zh: `未知 ${inferCategory(scId)}`,
      en: "Unknown Item",
      type: category || inferCategory(scId),
      color: "gray",
      icon: "❓",
      category: category || inferCategory(scId),
    };
  }
  return {
    ...matched,
    category: category || matched.type,
  };
}

// ============================================
// 格式化升级显示名称
// ============================================
export function formatUpgradeDisplay(
  scId: number,
  level: number,
  category?: string
): { zh: string; en: string; color: string; icon: string } {
  const info = getItemInfo(scId, category);
  if (!info) {
    return { zh: "未知项目", en: "Unknown", color: "gray", icon: "❓" };
  }
  return {
    zh: `${info.zh} Lv${level}`,
    en: `${info.en} Lv${level}`,
    color: info.color,
    icon: info.icon,
  };
}

// ============================================
// 别名导出 (兼容 page.tsx / utils.ts 中的旧引用)
// ============================================

/** 根据 SC ID 获取中文名称 */
export function getItemNameById(scId: number): string {
  return ITEM_MAP[scId]?.zh ?? `未知#${scId}`;
}

/** 根据 category + data_id + level 格式化升级显示（匹配 page.tsx 调用方式） */
export function getUpgradeDisplay(
  category: string,
  dataId: number | null,
  level: number
): { zh: string; en: string; color: string; icon: string } {
  if (dataId != null) {
    const info = getItemInfo(dataId, category);
    if (info) {
      return {
        zh: `${info.zh} Lv${level}`,
        en: `${info.en} Lv${level}`,
        color: info.color,
        icon: info.icon,
      };
    }
  }
  const catLabel = CATEGORY_LABELS[category] ?? category;
  return {
    zh: `${catLabel} Lv${level}`,
    en: `${category} Lv${level}`,
    color: "gray",
    icon: "❓",
  };
}

/** 分类标签 — 别名，兼容旧接口 */
export const ITEM_CATEGORY_LABELS: Record<string, string> = CATEGORY_LABELS;

/** 分类背景颜色 — 用于 UI 渲染 */
export const CATEGORY_BG_COLORS: Record<string, string> = {
  buildings: "from-amber-900/30 to-amber-900/10",
  spells: "from-indigo-900/30 to-indigo-900/10",
  heroes: "from-yellow-600/30 to-yellow-600/10",
  pets: "from-emerald-900/30 to-emerald-900/10",
  equipment: "from-violet-900/30 to-violet-900/10",
  units: "from-blue-900/30 to-blue-900/10",
  siege: "from-cyan-900/30 to-cyan-900/10",
  helper: "from-teal-900/30 to-teal-900/10",
  trap: "from-red-900/30 to-red-900/10",
  unknown: "from-gray-900/30 to-gray-900/10",
};
