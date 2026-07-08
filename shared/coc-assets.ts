/**
 * ============================================
 * 部落冲突 (Clash of Clans) 中文资产映射库
 * ============================================
 * ID 真相来源：backend/app/assets/building_map.json（已用真实游戏 JSON 验证）
 *
 * SC ID 位数规则（验证后）：
 * - buildings:      1000000+   (7 位, 1000000~1000093)
 * - spells:         26000000+  (8 位)
 * - heroes:         28000000+  (8 位)
 * - pets:           73000000+  (8 位)
 * - equipment:      106000000+ (9 位)
 * - helpers:        124000000+ (9 位)
 * - units:          4000000+   (7 位)
 * - siege_machines: 4000051+   (与 units 共享 4000xxx 空间)
 * - buildings2:     1000033+   (夜世界, 与 buildings 共享 1000xxx)
 * - heroes2:        28000003+  (夜世界英雄)
 * - units2:         4000031+   (夜世界兵种)
 */

export type ItemColor =
  | "amber" | "indigo" | "yellow" | "emerald" | "violet"
  | "cyan" | "rose" | "slate" | "orange" | "teal" | "zinc" | "red" | "gray";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface AssetInfo {
  zh: string;
  en: string;
  type: string;
  color: ItemColor;
  icon: string;
  rarity?: Rarity;
}

// ── 单分类映射表 ─────────────────────────────
type AssetMap = Record<number, AssetInfo>;

// 建筑 buildings (1000xxx)
const BUILDING_MAP: AssetMap = {
  1000000: { zh: "兵营", en: "Army Camp", type: "buildings", color: "amber", icon: "⛺" },
  1000001: { zh: "大本营", en: "Town Hall", type: "buildings", color: "amber", icon: "🏛️" },
  1000002: { zh: "圣水采集器", en: "Elixir Collector", type: "buildings", color: "amber", icon: "💧" },
  1000003: { zh: "圣水瓶", en: "Elixir Storage", type: "buildings", color: "amber", icon: "🏺" },
  1000004: { zh: "金矿", en: "Gold Mine", type: "buildings", color: "amber", icon: "⛏️" },
  1000005: { zh: "储金罐", en: "Gold Storage", type: "buildings", color: "amber", icon: "🏦" },
  1000006: { zh: "训练营", en: "Barracks", type: "buildings", color: "amber", icon: "⚔️" },
  1000007: { zh: "实验室", en: "Laboratory", type: "buildings", color: "amber", icon: "🔬" },
  1000008: { zh: "加农炮", en: "Cannon", type: "buildings", color: "amber", icon: "💣" },
  1000009: { zh: "箭塔", en: "Archer Tower", type: "buildings", color: "amber", icon: "🏹" },
  1000010: { zh: "城墙", en: "Wall", type: "buildings", color: "amber", icon: "🧱" },
  1000011: { zh: "法师塔", en: "Wizard Tower", type: "buildings", color: "amber", icon: "🔮" },
  1000012: { zh: "防空火箭", en: "Air Defense", type: "buildings", color: "amber", icon: "🚀" },
  1000013: { zh: "迫击炮", en: "Mortar", type: "buildings", color: "amber", icon: "💥" },
  1000014: { zh: "部落城堡", en: "Clan Castle", type: "buildings", color: "amber", icon: "🏰" },
  1000015: { zh: "工人小屋", en: "Builder Hut", type: "buildings", color: "amber", icon: "🏚️" },
  1000019: { zh: "特斯拉电磁塔", en: "Hidden Tesla", type: "buildings", color: "amber", icon: "⚡" },
  1000020: { zh: "法术工厂", en: "Spell Factory", type: "buildings", color: "indigo", icon: "⚗️" },
  1000021: { zh: "X连弩", en: "X-Bow", type: "buildings", color: "amber", icon: "🎯" },
  1000023: { zh: "暗黑重油钻井", en: "Dark Elixir Drill", type: "buildings", color: "violet", icon: "🛢️" },
  1000024: { zh: "暗黑重油罐", en: "Dark Elixir Storage", type: "buildings", color: "violet", icon: "🏚️" },
  1000026: { zh: "暗黑训练营", en: "Dark Barracks", type: "buildings", color: "violet", icon: "💀" },
  1000027: { zh: "地狱塔", en: "Inferno Tower", type: "buildings", color: "red", icon: "🔥" },
  1000028: { zh: "空气炮", en: "Air Sweeper", type: "buildings", color: "cyan", icon: "💨" },
  1000029: { zh: "暗黑法术工厂", en: "Dark Spell Factory", type: "buildings", color: "violet", icon: "⚗️" },
  1000031: { zh: "天鹰火炮", en: "Eagle Artillery", type: "buildings", color: "red", icon: "🦅" },
  1000032: { zh: "炸弹塔", en: "Bomb Tower", type: "buildings", color: "red", icon: "💣" },
  1000059: { zh: "战车工坊", en: "Workshop", type: "buildings", color: "zinc", icon: "🏗️" },
  1000064: { zh: "小博木屋", en: "Forge", type: "buildings", color: "amber", icon: "🔨" },
  1000067: { zh: "投石炮", en: "Scattershot", type: "buildings", color: "red", icon: "🪨" },
  1000068: { zh: "战宠小屋", en: "Pet House", type: "buildings", color: "emerald", icon: "🐾" },
  1000070: { zh: "铁匠铺", en: "Blacksmith", type: "buildings", color: "violet", icon: "⚒️" },
  1000071: { zh: "英雄殿堂", en: "Hero Hall", type: "buildings", color: "yellow", icon: "🛡️" },
  1000072: { zh: "法术塔", en: "Spell Tower", type: "buildings", color: "indigo", icon: "🔮" },
  1000077: { zh: "擎天巨柱", en: "Monolith", type: "buildings", color: "red", icon: "🗿" },
  1000093: { zh: "帮手小屋", en: "Helper Hut", type: "buildings", color: "rose", icon: "🔧" },
};

// 法术 spells (26000xxx)
const SPELL_MAP: AssetMap = {
  26000000: { zh: "闪电法术", en: "Lightning Spell", type: "spells", color: "indigo", icon: "⚡" },
  26000001: { zh: "治疗法术", en: "Healing Spell", type: "spells", color: "emerald", icon: "💚" },
  26000002: { zh: "狂暴法术", en: "Rage Spell", type: "spells", color: "red", icon: "😡" },
  26000003: { zh: "弹跳法术", en: "Jump Spell", type: "spells", color: "cyan", icon: "🦘" },
  26000005: { zh: "冰冻法术", en: "Freeze Spell", type: "spells", color: "cyan", icon: "❄️" },
  26000009: { zh: "毒药法术", en: "Poison Spell", type: "spells", color: "violet", icon: "☠️" },
  26000010: { zh: "地震法术", en: "Earthquake Spell", type: "spells", color: "amber", icon: "🌍" },
  26000011: { zh: "极速法术", en: "Haste Spell", type: "spells", color: "cyan", icon: "💨" },
  26000016: { zh: "镜像法术", en: "Clone Spell", type: "spells", color: "teal", icon: "🧬" },
  26000017: { zh: "铁皮法术", en: "Skeleton Spell", type: "spells", color: "slate", icon: "💀" },
  26000028: { zh: "蝙蝠法术", en: "Bat Spell", type: "spells", color: "slate", icon: "🦇" },
  26000035: { zh: "隐身法术", en: "Invisibility Spell", type: "spells", color: "violet", icon: "👻" },
  26000053: { zh: "回溯法术", en: "Recall Spell", type: "spells", color: "indigo", icon: "🔁" },
  26000070: { zh: "蔓生法术", en: "Overgrowth Spell", type: "spells", color: "emerald", icon: "🌱" },
};

// 英雄 heroes (28000xxx)
// ID 顺序按英雄发布顺序：国王(TH7) → 女皇(TH9) → 大守护者(TH11) → 战斗机器(夜世界) →
// 飞盾战神(TH13) → 战斗直升机(夜世界) → 亡灵王子(TH17, 2024-11)
const HERO_MAP: AssetMap = {
  28000000: { zh: "蛮王", en: "Barbarian King", type: "heroes", color: "yellow", icon: "👑" },
  28000001: { zh: "女王", en: "Archer Queen", type: "heroes", color: "yellow", icon: "👸" },
  28000002: { zh: "永王", en: "Grand Warden", type: "heroes", color: "yellow", icon: "🧙" },
  28000004: { zh: "闰土", en: "Royal Champion", type: "heroes", color: "yellow", icon: "🛡️" },
  28000006: { zh: "王子", en: "Minion Prince", type: "heroes", color: "yellow", icon: "🦇" },
};

// 宠物 pets (73000xxx)
const PET_MAP: AssetMap = {
  73000000: { zh: "莱西", en: "L.A.S.S.I", type: "pets", color: "emerald", icon: "🐕" },
  73000001: { zh: "闪枭", en: "Electro Owl", type: "pets", color: "emerald", icon: "🦉" },
  73000002: { zh: "大牦", en: "Mighty Yak", type: "pets", color: "emerald", icon: "🐂" },
  73000003: { zh: "独角", en: "Unicorn", type: "pets", color: "emerald", icon: "🦄" },
  73000004: { zh: "冰牙", en: "Frosty", type: "pets", color: "emerald", icon: "❄️" },
  73000005: { zh: "地兽", en: "Diggy", type: "pets", color: "emerald", icon: "🐀" },
  73000006: { zh: "猛蜥", en: "Poison Lizard", type: "pets", color: "emerald", icon: "🦎" },
  73000007: { zh: "凤凰", en: "Phoenix", type: "pets", color: "emerald", icon: "🔥" },
  73000008: { zh: "灵狐", en: "Spirit Fox", type: "pets", color: "emerald", icon: "🦊" },
  73000009: { zh: "水母", en: "Angry Jelly", type: "pets", color: "emerald", icon: "🪼" },
  73000010: { zh: "啾啾", en: "Sneezy", type: "pets", color: "emerald", icon: "🤧" },
};

// 装备 equipment (106000xxx) — 含稀有度，名称核对自官方简中
const EQUIPMENT_MAP: AssetMap = {
  106000000: { zh: "野蛮人玩偶", en: "Barbarian Puppet", type: "equipment", color: "violet", icon: "👊", rarity: "common" },
  106000001: { zh: "狂暴药瓶", en: "Rage Vial", type: "equipment", color: "violet", icon: "😡", rarity: "common" },
  106000002: { zh: "弓箭手玩偶", en: "Archer Puppet", type: "equipment", color: "violet", icon: "🏹", rarity: "common" },
  106000003: { zh: "隐身药瓶", en: "Invisibility Vial", type: "equipment", color: "violet", icon: "👻", rarity: "common" },
  106000004: { zh: "永恒之书", en: "Eternal Tome", type: "equipment", color: "violet", icon: "📖", rarity: "epic" },
  106000005: { zh: "生命宝石", en: "Life Gem", type: "equipment", color: "violet", icon: "💎", rarity: "common" },
  106000006: { zh: "追踪之盾", en: "Seeking Shield", type: "equipment", color: "violet", icon: "🛡️", rarity: "epic" },
  106000007: { zh: "皇家宝石", en: "Royal Gem", type: "equipment", color: "violet", icon: "💎", rarity: "epic" },
  106000008: { zh: "地震靴", en: "Earthquake Boots", type: "equipment", color: "violet", icon: "🥾", rarity: "epic" },
  106000009: { zh: "野猪骑士玩偶", en: "Hog Rider Puppet", type: "equipment", color: "violet", icon: "🐗", rarity: "common" },
  106000010: { zh: "巨人之拳", en: "Giant Gauntlet", type: "equipment", color: "violet", icon: "🧤", rarity: "epic" },
  106000011: { zh: "嗜血胡须", en: "Vampstache", type: "equipment", color: "violet", icon: "🧔", rarity: "common" },
  106000012: { zh: "急速药瓶", en: "Haste Vial", type: "equipment", color: "violet", icon: "💨", rarity: "common" },
  106000013: { zh: "火箭矛", en: "Rocket Spear", type: "equipment", color: "violet", icon: "🚀", rarity: "epic" },
  106000014: { zh: "尖刺铁球", en: "Spiky Ball", type: "equipment", color: "violet", icon: "🔮", rarity: "epic" },
  106000015: { zh: "冰霜之箭", en: "Frozen Arrow", type: "equipment", color: "violet", icon: "🏹", rarity: "epic" },
  106000016: { zh: "巨石之箭", en: "Monolith Arrow", type: "equipment", color: "violet", icon: "🏹", rarity: "epic" },
  106000017: { zh: "巨箭", en: "Giant Arrow", type: "equipment", color: "violet", icon: "🏹", rarity: "common" },
  106000019: { zh: "天使玩偶", en: "Healer Puppet", type: "equipment", color: "violet", icon: "😇", rarity: "common" },
  106000020: { zh: "魔镜", en: "Magic Mirror", type: "equipment", color: "violet", icon: "🪞", rarity: "common" },
  106000022: { zh: "魔法手套", en: "Magic Glove", type: "equipment", color: "violet", icon: "🧤", rarity: "common" },
  106000024: { zh: "国王权杖", en: "King's Wand", type: "equipment", color: "violet", icon: "🪄", rarity: "epic" },
  106000032: { zh: "女王之守护", en: "Queen's Ward", type: "equipment", color: "violet", icon: "👑", rarity: "epic" },
  106000034: { zh: "守护者宝珠", en: "Warden's Orb", type: "equipment", color: "violet", icon: "🔮", rarity: "epic" },
  106000035: { zh: "冠军之冠", en: "Champion's Crown", type: "equipment", color: "violet", icon: "👑", rarity: "epic" },
  106000039: { zh: "野蛮人门徒", en: "Barbarian Disciple", type: "equipment", color: "violet", icon: "⚔️", rarity: "legendary" },
  106000040: { zh: "弓箭刺客", en: "Archer Assassin", type: "equipment", color: "violet", icon: "🏹", rarity: "legendary" },
  106000041: { zh: "守护者光环", en: "Warden's Aura", type: "equipment", color: "violet", icon: "✨", rarity: "legendary" },
  106000042: { zh: "狂怒守护者", en: "Rageful Guardian", type: "equipment", color: "violet", icon: "🛡️", rarity: "legendary" },
  106000043: { zh: "神圣守护者", en: "Sacred Protector", type: "equipment", color: "violet", icon: "🛡️", rarity: "legendary" },
  106000044: { zh: "暗影长矛", en: "Shadow Spear", type: "equipment", color: "violet", icon: "🗡️", rarity: "legendary" },
  106000047: { zh: "凤凰之环", en: "Phoenix Ring", type: "equipment", color: "violet", icon: "🔥", rarity: "legendary" },
  106000048: { zh: "吸血药瓶", en: "Vampire Vial", type: "equipment", color: "violet", icon: "🧛", rarity: "legendary" },
  106000049: { zh: "骷髅钥匙", en: "Skeleton Key", type: "equipment", color: "violet", icon: "🗝️", rarity: "legendary" },
  106000050: { zh: "霜寒守护", en: "Frost Guard", type: "equipment", color: "violet", icon: "❄️", rarity: "legendary" },
  106000051: { zh: "毒药瓶", en: "Poison Flask", type: "equipment", color: "violet", icon: "☠️", rarity: "legendary" },
  106000052: { zh: "地震之锤", en: "Earthquake Hammer", type: "equipment", color: "violet", icon: "🔨", rarity: "legendary" },
  106000053: { zh: "闪电护符", en: "Lightning Charm", type: "equipment", color: "violet", icon: "⚡", rarity: "legendary" },
  106000057: { zh: "克隆之冠", en: "Clone Crown", type: "equipment", color: "violet", icon: "👑", rarity: "legendary" },
  106000060: { zh: "风暴使者", en: "Storm Bringer", type: "equipment", color: "violet", icon: "🌩️", rarity: "legendary" },
};

// 兵种 units (4000xxx) — 中文名参考部落小工具 APK，ID 顺序按 COC 兵营解锁顺序
const UNIT_MAP: AssetMap = {
  4000000: { zh: "野蛮人", en: "Barbarian", type: "units", color: "cyan", icon: "👤" },
  4000001: { zh: "弓箭手", en: "Archer", type: "units", color: "cyan", icon: "🏹" },
  4000002: { zh: "哥布林", en: "Goblin", type: "units", color: "cyan", icon: "👺" },
  4000003: { zh: "巨人", en: "Giant", type: "units", color: "cyan", icon: "🗿" },
  4000004: { zh: "炸弹人", en: "Wall Breaker", type: "units", color: "cyan", icon: "💣" },
  4000005: { zh: "气球", en: "Balloon", type: "units", color: "cyan", icon: "🎈" },
  4000006: { zh: "法师", en: "Wizard", type: "units", color: "cyan", icon: "🔮" },
  4000007: { zh: "天使", en: "Healer", type: "units", color: "cyan", icon: "😇" },
  4000008: { zh: "飞龙", en: "Dragon", type: "units", color: "cyan", icon: "🐉" },
  4000009: { zh: "皮卡", en: "P.E.K.K.A", type: "units", color: "cyan", icon: "🤖" },
  4000010: { zh: "亡灵", en: "Minion", type: "units", color: "cyan", icon: "🦇" },
  4000011: { zh: "野猪骑士", en: "Hog Rider", type: "units", color: "cyan", icon: "🐗" },
  4000012: { zh: "武神", en: "Valkyrie", type: "units", color: "cyan", icon: "🪓" },
  4000013: { zh: "石头人", en: "Golem", type: "units", color: "cyan", icon: "🗿" },
  4000015: { zh: "女巫", en: "Witch", type: "units", color: "cyan", icon: "🧙" },
  4000017: { zh: "熔岩猎犬", en: "Lava Hound", type: "units", color: "cyan", icon: "🌋" },
  4000022: { zh: "蓝胖", en: "Bowler", type: "units", color: "cyan", icon: "🎳" },
  4000023: { zh: "龙宝", en: "Baby Dragon", type: "units", color: "cyan", icon: "🐲" },
  4000024: { zh: "矿工", en: "Miner", type: "units", color: "cyan", icon: "⛏️" },
  4000053: { zh: "雪怪", en: "Yeti", type: "units", color: "cyan", icon: "🐻‍❄️" },
  4000058: { zh: "冰人", en: "Ice Golem", type: "units", color: "cyan", icon: "❄️" },
  4000059: { zh: "雷龙", en: "Electro Dragon", type: "units", color: "cyan", icon: "⚡" },
  4000065: { zh: "龙骑", en: "Dragon Rider", type: "units", color: "cyan", icon: "🐉" },
  4000082: { zh: "英雄猎手", en: "Headhunter", type: "units", color: "cyan", icon: "🎯" },
  4000095: { zh: "雷霆泰坦", en: "Electro Titan", type: "units", color: "cyan", icon: "👩" },
  4000097: { zh: "守护者学徒", en: "Apprentice Warden", type: "units", color: "cyan", icon: "🧙" },
  4000110: { zh: "根蔓骑士", en: "Root Rider", type: "units", color: "cyan", icon: "🌿" },
};

// 助力 helpers (124000xxx)
const HELPER_MAP: AssetMap = {
  124000000: { zh: "工人助手", en: "Builder's Apprentice", type: "helpers", color: "rose", icon: "🔧" },
  124000001: { zh: "实验室助手", en: "Lab Assistant", type: "helpers", color: "rose", icon: "🛠️" },
  124000002: { zh: "炼金术师", en: "Forge Assistant", type: "helpers", color: "rose", icon: "⚙️" },
  124000003: { zh: "探矿者", en: "Prospector", type: "helpers", color: "rose", icon: "⛏️" },
};

// 陷阱 traps (12000xxx) — SC ID 来自用户实际 COC JSON 导出数据
// 12000000=Bomb(TH2) / 12000001=SpringTrap(TH4) / 12000002=GiantBomb(TH6) /
// 12000005=AirBomb(TH6) / 12000006=SeekingAirMine(TH7) / 12000008=SkeletonTrap(TH8) /
// 12000016=TornadoTrap(TH11)
const TRAP_MAP: AssetMap = {
  12000000: { zh: "隐形炸弹", en: "Bomb", type: "traps", color: "red", icon: "💣" },
  12000001: { zh: "弹簧", en: "Spring Trap", type: "traps", color: "amber", icon: "🌀" },
  12000002: { zh: "巨型炸弹", en: "Giant Bomb", type: "traps", color: "red", icon: "💥" },
  12000005: { zh: "红雷", en: "Air Bomb", type: "traps", color: "cyan", icon: "🎈" },
  12000006: { zh: "黑雷", en: "Seeking Air Mine", type: "traps", color: "cyan", icon: "🎯" },
  12000008: { zh: "骷髅陷阱", en: "Skeleton Trap", type: "traps", color: "slate", icon: "💀" },
  12000016: { zh: "飓风陷阱", en: "Tornado Trap", type: "traps", color: "cyan", icon: "🌪️" },
};

// 夜世界建筑 buildings2 (1000xxx, 1000033+) — 中文名参考部落小工具 APK
const BUILDING2_MAP: AssetMap = {
  1000033: { zh: "城墙(夜)", en: "Builder Hall Wall", type: "buildings2", color: "slate", icon: "🧱" },
  1000034: { zh: "建筑大师大本营", en: "Builder Hall", type: "buildings2", color: "slate", icon: "🏛️" },
  1000035: { zh: "圣水采集器(夜)", en: "Builder Hall Elixir Collector", type: "buildings2", color: "slate", icon: "💧" },
  1000036: { zh: "圣水瓶(夜)", en: "Builder Hall Elixir Storage", type: "buildings2", color: "slate", icon: "🏺" },
  1000037: { zh: "金矿(夜)", en: "Builder Hall Gold Mine", type: "buildings2", color: "slate", icon: "⛏️" },
  1000038: { zh: "储金罐(夜)", en: "Builder Hall Gold Storage", type: "buildings2", color: "slate", icon: "🏦" },
  1000039: { zh: "时光钟楼", en: "Builder Hall Clock Tower", type: "buildings2", color: "slate", icon: "⏰" },
  1000040: { zh: "建筑大师训练营", en: "Builder Hall Barracks", type: "buildings2", color: "slate", icon: "⚔️" },
  1000041: { zh: "双管加农炮", en: "Builder Hall Double Cannon", type: "buildings2", color: "slate", icon: "💣" },
  1000042: { zh: "兵营(夜)", en: "Builder Hall Barracks", type: "buildings2", color: "slate", icon: "⚔️" },
  1000043: { zh: "特斯拉电磁塔(夜)", en: "Builder Hall Hidden Tesla", type: "buildings2", color: "slate", icon: "⚡" },
  1000044: { zh: "加农炮(夜)", en: "Builder Hall Cannon", type: "buildings2", color: "slate", icon: "💣" },
  1000045: { zh: "多管迫击炮", en: "Builder Hall Multi Mortar", type: "buildings2", color: "slate", icon: "💥" },
  1000046: { zh: "星空实验室", en: "Builder Hall Star Laboratory", type: "buildings2", color: "slate", icon: "🔬" },
  1000048: { zh: "箭塔(夜)", en: "Builder Hall Archer Tower", type: "buildings2", color: "slate", icon: "🏹" },
  1000049: { zh: "预备营", en: "Builder Hall Guard Post", type: "buildings2", color: "slate", icon: "🛡️" },
  1000050: { zh: "防空火箭(夜)", en: "Builder Hall Air Defense", type: "buildings2", color: "slate", icon: "🚀" },
  1000051: { zh: "守卫哨岗", en: "Builder Hall Guard Post", type: "buildings2", color: "slate", icon: "🏰" },
  1000052: { zh: "超级特斯拉电磁塔", en: "Builder Hall Mega Tesla", type: "buildings2", color: "slate", icon: "⚡" },
  1000053: { zh: "重建战斗机器", en: "Builder Hall Battle Machine Altar", type: "buildings2", color: "slate", icon: "🤖" },
  1000054: { zh: "空中炸弹发射器(夜)", en: "Builder Hall Air Bombs", type: "buildings2", color: "slate", icon: "💥" },
  1000055: { zh: "撼地巨石", en: "Builder Hall Crusher", type: "buildings2", color: "slate", icon: "🔨" },
  1000056: { zh: "熔岩火炮(夜)", en: "Builder Hall Roaster", type: "buildings2", color: "slate", icon: "🔥" },
  1000057: { zh: "巨型加农炮", en: "Builder Hall Giant Cannon", type: "buildings2", color: "slate", icon: "💣" },
  1000058: { zh: "宝石矿井", en: "Builder Hall Gem Mine", type: "buildings2", color: "slate", icon: "💎" },
  1000063: { zh: "熔岩发射器(夜)", en: "Builder Hall Lava Launcher", type: "buildings2", color: "slate", icon: "🌋" },
  1000065: { zh: "小博控制室", en: "Builder Hall OTTO Hut", type: "buildings2", color: "slate", icon: "🏚️" },
  1000078: { zh: "奥仔哨站", en: "Builder Hall Night Witch Altar", type: "buildings2", color: "slate", icon: "🧙" },
  1000080: { zh: "重建战斗直升机", en: "Builder Hall Battle Copter Altar", type: "buildings2", color: "slate", icon: "🚁" },
  1000081: { zh: "X连弩(夜)", en: "Builder Hall X-Bow", type: "buildings2", color: "slate", icon: "🎯" },
  1000082: { zh: "治疗小屋", en: "Builder Hall Hog Glider Altar", type: "buildings2", color: "slate", icon: "🏥" },
};

// 夜世界英雄 heroes2 (28000xxx)
const HERO2_MAP: AssetMap = {
  28000003: { zh: "战斗机器", en: "Battle Machine", type: "heroes2", color: "orange", icon: "🤖" },
  28000005: { zh: "战斗直升机", en: "Battle Copter", type: "heroes2", color: "orange", icon: "🚁" },
};

// 夜世界兵种 units2 (4000xxx) — 中文名参考部落小工具 APK
const UNIT2_MAP: AssetMap = {
  4000031: { zh: "狂暴野蛮人", en: "Raged Barbarian", type: "units2", color: "teal", icon: "👤" },
  4000032: { zh: "隐秘弓箭手", en: "Sneaky Archer", type: "units2", color: "teal", icon: "🏹" },
  4000033: { zh: "异变亡灵", en: "Beta Minion", type: "units2", color: "teal", icon: "🦇" },
  4000034: { zh: "巨人拳击手", en: "Boxer Giant", type: "units2", color: "teal", icon: "🗿" },
  4000035: { zh: "炸弹兵", en: "Bomber", type: "units2", color: "teal", icon: "💣" },
  4000036: { zh: "雷霆皮卡", en: "Cannon Cart", type: "units2", color: "teal", icon: "🤖" },
  4000037: { zh: "加农炮战车", en: "Drop Ship", type: "units2", color: "teal", icon: "🛸" },
  4000038: { zh: "骷髅气球", en: "Night Witch", type: "units2", color: "teal", icon: "🎈" },
  4000041: { zh: "飞龙宝宝", en: "Baby Dragon", type: "units2", color: "teal", icon: "🐲" },
  4000042: { zh: "暗夜女巫", en: "Power P.E.K.K.A", type: "units2", color: "teal", icon: "🧙" },
  4000070: { zh: "野猪飞骑", en: "Hog Glider", type: "units2", color: "teal", icon: "🐗" },
};

// 攻城机器 siege_machines (4000xxx, 与 units 共享空间) — 中文名参考部落小工具 APK
const SIEGE_MAP: AssetMap = {
  4000051: { zh: "攻城战车", en: "Wall Wrecker", type: "siege_machines", color: "zinc", icon: "🛻" },
  4000052: { zh: "攻城飞艇", en: "Battle Blimp", type: "siege_machines", color: "zinc", icon: "🛸" },
  4000062: { zh: "攻城气球", en: "Stone Slammer", type: "siege_machines", color: "zinc", icon: "🪨" },
  4000075: { zh: "战营", en: "Siege Barracks", type: "siege_machines", color: "zinc", icon: "⛺" },
  4000087: { zh: "滚木车", en: "Log Launcher", type: "siege_machines", color: "zinc", icon: "🪵" },
  4000091: { zh: "投石车", en: "Log Launcher", type: "siege_machines", color: "zinc", icon: "🪨" },
  4000092: { zh: "钻地机", en: "Drill", type: "siege_machines", color: "zinc", icon: "🚇" },
  4000135: { zh: "部队发射器", en: "Troop Launcher", type: "siege_machines", color: "zinc", icon: "🚀" },
  4000188: { zh: "空中部队发射器", en: "Air Troop Launcher", type: "siege_machines", color: "zinc", icon: "🛩️" },
};

// ── 复合查找表 ───────────────────────────────
export const ITEM_MAP: AssetMap = {
  ...BUILDING_MAP, ...SPELL_MAP, ...HERO_MAP, ...PET_MAP, ...EQUIPMENT_MAP,
  ...UNIT_MAP, ...HELPER_MAP, ...BUILDING2_MAP, ...HERO2_MAP, ...UNIT2_MAP,
  ...SIEGE_MAP, ...TRAP_MAP,
};

// 注意：siege_machines 与 units 共享 4000xxx，按 category 优先精确匹配
const BY_CATEGORY: Record<string, AssetMap> = {
  buildings: BUILDING_MAP,
  spells: SPELL_MAP,
  heroes: HERO_MAP,
  pets: PET_MAP,
  equipment: EQUIPMENT_MAP,
  units: UNIT_MAP,
  helpers: HELPER_MAP,
  buildings2: BUILDING2_MAP,
  heroes2: HERO2_MAP,
  units2: UNIT2_MAP,
  siege_machines: SIEGE_MAP,
  traps: TRAP_MAP,
};

// ── 分类中文标签 ─────────────────────────────
export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  buildings: "建筑",
  spells: "法术",
  heroes: "英雄",
  pets: "宠物",
  equipment: "装备",
  units: "兵种",
  helpers: "助力",
  buildings2: "夜世界建筑",
  heroes2: "夜世界英雄",
  units2: "夜世界兵种",
  siege_machines: "攻城机器",
  traps: "陷阱",
  traps2: "夜世界陷阱",
};

// ── 分类背景渐变色（Tailwind 类） ───────────
export const CATEGORY_BG_COLORS: Record<string, string> = {
  buildings: "from-amber-900/20 to-amber-900/5",
  spells: "from-indigo-900/20 to-indigo-900/5",
  heroes: "from-yellow-600/20 to-yellow-600/5",
  pets: "from-emerald-900/20 to-emerald-900/5",
  equipment: "from-violet-900/20 to-violet-900/5",
  units: "from-cyan-900/20 to-cyan-900/5",
  helpers: "from-rose-900/20 to-rose-900/5",
  buildings2: "from-slate-800/20 to-slate-800/5",
  heroes2: "from-orange-900/20 to-orange-900/5",
  units2: "from-teal-900/20 to-teal-900/5",
  siege_machines: "from-zinc-800/20 to-zinc-800/5",
  traps: "from-red-900/20 to-red-900/5",
};

// ── 稀有度颜色 ───────────────────────────────
export const RARITY_COLORS: Record<Rarity, { border: string; text: string; glow: string }> = {
  common: { border: "border-slate-500/30", text: "text-slate-300", glow: "" },
  rare: { border: "border-blue-500/40", text: "text-blue-300", glow: "glow-indigo" },
  epic: { border: "border-violet-500/40", text: "text-violet-300", glow: "glow-violet" },
  legendary: { border: "border-amber-500/50", text: "text-amber-300", glow: "glow-amber" },
};

// ── 根据 SC ID 范围推断分类 ──────────────────
export function inferCategory(scId: number): string {
  if (scId >= 1000000 && scId < 2000000) return "buildings";
  if (scId >= 26000000 && scId < 27000000) return "spells";
  if (scId >= 28000000 && scId < 29000000) return "heroes";
  if (scId >= 73000000 && scId < 74000000) return "pets";
  if (scId >= 106000000 && scId < 107000000) return "equipment";
  if (scId >= 124000000 && scId < 125000000) return "helpers";
  if (scId >= 4000000 && scId < 5000000) return "units";
  return "unknown";
}

// ── 严格按 category 查找（防止 buildings/buildings2 ID 冲突）──
export function getItemNameById(
  category: string,
  dataId: number | null | undefined
): AssetInfo | null {
  if (dataId == null) return null;

  // 1. 精确 category 查找（必须匹配，不做跨类别 fallback）
  const catMap = BY_CATEGORY[category];
  if (catMap && catMap[dataId]) return catMap[dataId];

  // 2. fallback：返回未知（不全局查找，避免 buildings2 的 ID 被误匹配到 buildings）
  return null;
}

// ── 升级项显示信息 ───────────────────────────
export function getUpgradeDisplay(
  category: string,
  dataId: number | null | undefined,
  level: number
): { zh: string; en: string; icon: string; color: ItemColor } {
  const info = getItemNameById(category, dataId);
  const catLabel = ITEM_CATEGORY_LABELS[category] || category;
  if (!info) {
    return {
      zh: `${catLabel} Lv${level}`,
      en: `${category} Lv${level}`,
      icon: "📦",
      color: "gray",
    };
  }
  return {
    zh: `${info.zh} Lv${level}`,
    en: `${info.en} Lv${level}`,
    icon: info.icon,
    color: info.color,
  };
}

// ── 根据颜色名取 Tailwind 类 ─────────────────
export function getColorClasses(color: ItemColor): { border: string; text: string; bg: string } {
  const map: Record<ItemColor, { border: string; text: string; bg: string }> = {
    amber: { border: "border-amber-500/30", text: "text-amber-400", bg: "from-amber-900/20 to-amber-900/5" },
    indigo: { border: "border-indigo-500/30", text: "text-indigo-400", bg: "from-indigo-900/20 to-indigo-900/5" },
    yellow: { border: "border-yellow-500/40", text: "text-yellow-400", bg: "from-yellow-600/20 to-yellow-600/5" },
    emerald: { border: "border-emerald-500/30", text: "text-emerald-400", bg: "from-emerald-900/20 to-emerald-900/5" },
    violet: { border: "border-violet-500/30", text: "text-violet-400", bg: "from-violet-900/20 to-violet-900/5" },
    cyan: { border: "border-cyan-500/30", text: "text-cyan-400", bg: "from-cyan-900/20 to-cyan-900/5" },
    rose: { border: "border-rose-500/30", text: "text-rose-400", bg: "from-rose-900/20 to-rose-900/5" },
    slate: { border: "border-slate-500/30", text: "text-slate-400", bg: "from-slate-800/20 to-slate-800/5" },
    orange: { border: "border-orange-500/30", text: "text-orange-400", bg: "from-orange-900/20 to-orange-900/5" },
    teal: { border: "border-teal-500/30", text: "text-teal-400", bg: "from-teal-900/20 to-teal-900/5" },
    zinc: { border: "border-zinc-500/30", text: "text-zinc-400", bg: "from-zinc-800/20 to-zinc-800/5" },
    red: { border: "border-red-500/30", text: "text-red-400", bg: "from-red-900/20 to-red-900/5" },
    gray: { border: "border-gray-500/30", text: "text-gray-400", bg: "from-gray-800/20 to-gray-800/5" },
  };
  return map[color] || map.gray;
}
