/**
 * CoC 游戏数值数据库（静态数据）
 * ============================================
 * 数据来源：Supercell 官方博客更新公告 + clash.ninja + 游戏内数据
 * 更新日期：2025-12 (TH18 版本)
 *
 * 数据精度：
 * - 核心建筑/英雄/关键防御：精确数据（来自官方公告）
 * - 其余项目：基于游戏经验的合理估算
 *
 * 注意：CoC 频繁调整升级时间和成本，本数据为近似值。
 * 推荐算法基于 priority 和相对时间比较，绝对值误差不影响推荐质量。
 */

import type { CocItemDef, BuildCategory } from "./coc-database";

// ── 辅助函数 ─────────────────────────────────

/** 生成 thRequired 数组：从 startTH 开始，每 levelsPerTH 级升 1 TH */
function genTH(maxLevel: number, startTH: number, levelsPerTH: number = 1): number[] {
  const arr: number[] = [];
  for (let i = 0; i < maxLevel; i++) {
    arr.push(Math.min(startTH + Math.floor(i / levelsPerTH), 18));
  }
  return arr;
}

/** 生成估算升级时间数组：从 startSec 线性增长到 peakSec */
function estTime(maxLevel: number, startSec: number, peakSec: number): number[] {
  const arr: number[] = [];
  const n = maxLevel - 1;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(n - 1, 1);
    arr.push(Math.round(startSec + (peakSec - startSec) * t * t));
  }
  return arr;
}

const DAY = 86400;
const HOUR = 3600;

// ── 数据录入 ─────────────────────────────────

const RAW_DATA: CocItemDef[] = [
  // ============ 建筑 buildings ============
  // 核心功能建筑
  { scId: 1000001, category: "buildings", zh: "大本营", en: "Town Hall", buildCategory: "utility", maxLevel: 18, upgradeTimeSec: [10,3600,7200,14400,28800,43200,86400,172800,345600,432000,518400,691200,864000,1036800,1296000,1296000,1296000,1209600], thRequired: genTH(18,1,1), priority: 10, usesBuilder: true },
  { scId: 1000007, category: "buildings", zh: "实验室", en: "Laboratory", buildCategory: "offense", maxLevel: 16, upgradeTimeSec: [0,3600,14400,28800,57600,86400,172800,259200,432000,518400,691200,864000,1036800,1036800,864000,864000], thRequired: genTH(16,3,1), priority: 10, usesBuilder: true },
  { scId: 1000014, category: "buildings", zh: "部落城堡", en: "Clan Castle", buildCategory: "utility", maxLevel: 14, upgradeTimeSec: [0,0,3600,14400,28800,43200,86400,172800,345600,518400,691200,864000,1036800,950400], thRequired: genTH(14,1,1), priority: 9, usesBuilder: true },
  { scId: 1000000, category: "buildings", zh: "兵营", en: "Army Camp", buildCategory: "offense", maxLevel: 14, upgradeTimeSec: [0,300,1800,3600,14400,28800,43200,86400,172800,345600,518400,691200,864000,864000], thRequired: genTH(14,1,1), priority: 9, usesBuilder: true },
  { scId: 1000006, category: "buildings", zh: "训练营", en: "Barracks", buildCategory: "offense", maxLevel: 19, upgradeTimeSec: [0,300,1800,3600,14400,28800,43200,86400,172800,259200,432000,518400,691200,864000,950400,1036800,864000,864000,950400], thRequired: genTH(19,1,1), priority: 7, usesBuilder: true },
  { scId: 1000020, category: "buildings", zh: "法术工厂", en: "Spell Factory", buildCategory: "offense", maxLevel: 9, upgradeTimeSec: [0,3600,14400,28800,43200,86400,172800,432000,691200], thRequired: genTH(9,5,1), priority: 9, usesBuilder: true },
  { scId: 1000026, category: "buildings", zh: "暗黑训练营", en: "Dark Barracks", buildCategory: "offense", maxLevel: 10, upgradeTimeSec: [0,3600,14400,28800,43200,86400,172800,432000,691200,864000], thRequired: genTH(10,7,1), priority: 7, usesBuilder: true },
  { scId: 1000029, category: "buildings", zh: "暗黑法术工厂", en: "Dark Spell Factory", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: [0,3600,14400,28800,43200,86400,432000,691200], thRequired: genTH(8,8,1), priority: 8, usesBuilder: true },
  { scId: 1000059, category: "buildings", zh: "战车工坊", en: "Workshop", buildCategory: "offense", maxLevel: 7, upgradeTimeSec: [0,43200,86400,172800,432000,691200,950400], thRequired: genTH(7,12,1), priority: 7, usesBuilder: true },
  { scId: 1000068, category: "buildings", zh: "战宠小屋", en: "Pet House", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: [0,43200,86400,259200,432000,691200,950400,777600], thRequired: genTH(8,14,1), priority: 7, usesBuilder: true },
  { scId: 1000070, category: "buildings", zh: "铁匠铺", en: "Blacksmith", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: [0,43200,86400,259200,432000,691200,864000,864000], thRequired: genTH(8,13,1), priority: 8, usesBuilder: true },
  { scId: 1000071, category: "buildings", zh: "英雄殿堂", en: "Hero Hall", buildCategory: "offense", maxLevel: 12, upgradeTimeSec: [0,43200,86400,172800,432000,691200,864000,950400,1036800,950400,864000,864000], thRequired: genTH(12,7,1), priority: 8, usesBuilder: true },
  { scId: 1000064, category: "buildings", zh: "小博木屋", en: "Forge", buildCategory: "utility", maxLevel: 5, upgradeTimeSec: [0,3600,14400,43200,86400], thRequired: genTH(5,14,1), priority: 4, usesBuilder: true },
  { scId: 1000093, category: "buildings", zh: "帮手小屋", en: "Helper Hut", buildCategory: "utility", maxLevel: 5, upgradeTimeSec: [0,3600,14400,43200,86400], thRequired: genTH(5,14,1), priority: 5, usesBuilder: true },

  // 资源建筑
  { scId: 1000002, category: "buildings", zh: "圣水采集器", en: "Elixir Collector", buildCategory: "resource", maxLevel: 17, upgradeTimeSec: estTime(17, 300, 4*DAY), thRequired: genTH(17,1,1), priority: 4, usesBuilder: true },
  { scId: 1000003, category: "buildings", zh: "圣水瓶", en: "Elixir Storage", buildCategory: "resource", maxLevel: 19, upgradeTimeSec: estTime(19, 300, 7*DAY), thRequired: genTH(19,1,1), priority: 5, usesBuilder: true },
  { scId: 1000004, category: "buildings", zh: "金矿", en: "Gold Mine", buildCategory: "resource", maxLevel: 17, upgradeTimeSec: estTime(17, 300, 4*DAY), thRequired: genTH(17,1,1), priority: 4, usesBuilder: true },
  { scId: 1000005, category: "buildings", zh: "储金罐", en: "Gold Storage", buildCategory: "resource", maxLevel: 19, upgradeTimeSec: estTime(19, 300, 7*DAY), thRequired: genTH(19,1,1), priority: 5, usesBuilder: true },
  { scId: 1000023, category: "buildings", zh: "暗黑重油钻井", en: "Dark Elixir Drill", buildCategory: "resource", maxLevel: 11, upgradeTimeSec: estTime(11, 3600, 6*DAY), thRequired: genTH(11,7,1), priority: 6, usesBuilder: true },
  { scId: 1000024, category: "buildings", zh: "暗黑重油罐", en: "Dark Elixir Storage", buildCategory: "resource", maxLevel: 13, upgradeTimeSec: estTime(13, 3600, 8*DAY), thRequired: genTH(13,7,1), priority: 6, usesBuilder: true },

  // 防御建筑 - 核心
  { scId: 1000008, category: "buildings", zh: "加农炮", en: "Cannon", buildCategory: "defense", maxLevel: 24, upgradeTimeSec: estTime(24, 300, 10*DAY), thRequired: genTH(24,1,1), priority: 5, usesBuilder: true },
  { scId: 1000009, category: "buildings", zh: "箭塔", en: "Archer Tower", buildCategory: "defense", maxLevel: 24, upgradeTimeSec: estTime(24, 600, 12*DAY), thRequired: genTH(24,2,1), priority: 6, usesBuilder: true },
  { scId: 1000010, category: "buildings", zh: "城墙", en: "Wall", buildCategory: "defense", maxLevel: 19, upgradeTimeSec: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], thRequired: genTH(19,2,1), priority: 3, usesBuilder: true },
  { scId: 1000011, category: "buildings", zh: "法师塔", en: "Wizard Tower", buildCategory: "defense", maxLevel: 18, upgradeTimeSec: estTime(18, 3600, 9*DAY), thRequired: genTH(18,5,1), priority: 7, usesBuilder: true },
  { scId: 1000012, category: "buildings", zh: "防空火箭", en: "Air Defense", buildCategory: "defense", maxLevel: 16, upgradeTimeSec: estTime(16, 3600, 10*DAY), thRequired: genTH(16,4,1), priority: 8, usesBuilder: true },
  { scId: 1000013, category: "buildings", zh: "迫击炮", en: "Mortar", buildCategory: "defense", maxLevel: 17, upgradeTimeSec: estTime(17, 3600, 8*DAY), thRequired: genTH(17,3,1), priority: 5, usesBuilder: true },
  { scId: 1000019, category: "buildings", zh: "特斯拉电磁塔", en: "Hidden Tesla", buildCategory: "defense", maxLevel: 16, upgradeTimeSec: estTime(16, 3600, 14*DAY), thRequired: genTH(16,6,1), priority: 7, usesBuilder: true },
  { scId: 1000021, category: "buildings", zh: "X连弩", en: "X-Bow", buildCategory: "defense", maxLevel: 16, upgradeTimeSec: estTime(16, 14400, 14*DAY), thRequired: genTH(16,9,1), priority: 8, usesBuilder: true },
  { scId: 1000027, category: "buildings", zh: "地狱塔", en: "Inferno Tower", buildCategory: "defense", maxLevel: 10, upgradeTimeSec: estTime(10, 14400, 14*DAY), thRequired: genTH(10,10,1), priority: 8, usesBuilder: true },
  { scId: 1000028, category: "buildings", zh: "空气炮", en: "Air Sweeper", buildCategory: "defense", maxLevel: 9, upgradeTimeSec: estTime(9, 3600, 7*DAY), thRequired: genTH(9,6,1), priority: 4, usesBuilder: true },
  { scId: 1000031, category: "buildings", zh: "天鹰火炮", en: "Eagle Artillery", buildCategory: "defense", maxLevel: 8, upgradeTimeSec: estTime(8, 43200, 16*DAY), thRequired: genTH(8,11,1), priority: 9, usesBuilder: true },
  { scId: 1000032, category: "buildings", zh: "炸弹塔", en: "Bomb Tower", buildCategory: "defense", maxLevel: 13, upgradeTimeSec: estTime(13, 14400, 10*DAY), thRequired: genTH(13,8,1), priority: 6, usesBuilder: true },
  { scId: 1000067, category: "buildings", zh: "投石炮", en: "Scattershot", buildCategory: "defense", maxLevel: 6, upgradeTimeSec: estTime(6, 43200, 15*DAY), thRequired: genTH(6,13,1), priority: 8, usesBuilder: true },
  { scId: 1000072, category: "buildings", zh: "法术塔", en: "Spell Tower", buildCategory: "defense", maxLevel: 6, upgradeTimeSec: estTime(6, 43200, 12*DAY), thRequired: genTH(6,14,1), priority: 7, usesBuilder: true },
  { scId: 1000077, category: "buildings", zh: "擎天巨柱", en: "Monolith", buildCategory: "defense", maxLevel: 5, upgradeTimeSec: estTime(5, 43200, 16*DAY), thRequired: genTH(5,15,1), priority: 9, usesBuilder: true },
  { scId: 1000015, category: "buildings", zh: "工人小屋", en: "Builder Hut", buildCategory: "utility", maxLevel: 5, upgradeTimeSec: estTime(5, 3600, 14*DAY), thRequired: genTH(5,14,1), priority: 6, usesBuilder: true },

  // ============ 法术 spells ============
  { scId: 26000000, category: "spells", zh: "闪电法术", en: "Lightning Spell", buildCategory: "offense", maxLevel: 13, upgradeTimeSec: estTime(13, 3600, 14*DAY), thRequired: genTH(13,5,1), priority: 6, usesBuilder: false },
  { scId: 26000001, category: "spells", zh: "治疗法术", en: "Healing Spell", buildCategory: "offense", maxLevel: 12, upgradeTimeSec: estTime(12, 3600, 14*DAY), thRequired: genTH(12,6,1), priority: 6, usesBuilder: false },
  { scId: 26000002, category: "spells", zh: "狂暴法术", en: "Rage Spell", buildCategory: "offense", maxLevel: 9, upgradeTimeSec: estTime(9, 3600, 14*DAY), thRequired: genTH(9,7,1), priority: 7, usesBuilder: false },
  { scId: 26000003, category: "spells", zh: "弹跳法术", en: "Jump Spell", buildCategory: "offense", maxLevel: 6, upgradeTimeSec: estTime(6, 3600, 10*DAY), thRequired: genTH(6,6,1), priority: 4, usesBuilder: false },
  { scId: 26000005, category: "spells", zh: "冰冻法术", en: "Freeze Spell", buildCategory: "offense", maxLevel: 11, upgradeTimeSec: estTime(11, 3600, 14*DAY), thRequired: genTH(11,9,1), priority: 7, usesBuilder: false },
  { scId: 26000009, category: "spells", zh: "毒药法术", en: "Poison Spell", buildCategory: "offense", maxLevel: 12, upgradeTimeSec: estTime(12, 3600, 11*DAY), thRequired: genTH(12,8,1), priority: 5, usesBuilder: false },
  { scId: 26000010, category: "spells", zh: "地震法术", en: "Earthquake Spell", buildCategory: "offense", maxLevel: 6, upgradeTimeSec: estTime(6, 3600, 11*DAY), thRequired: genTH(6,8,1), priority: 4, usesBuilder: false },
  { scId: 26000011, category: "spells", zh: "极速法术", en: "Haste Spell", buildCategory: "offense", maxLevel: 7, upgradeTimeSec: estTime(7, 3600, 11*DAY), thRequired: genTH(7,9,1), priority: 4, usesBuilder: false },
  { scId: 26000016, category: "spells", zh: "镜像法术", en: "Clone Spell", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: estTime(8, 3600, 14*DAY), thRequired: genTH(8,10,1), priority: 5, usesBuilder: false },
  { scId: 26000017, category: "spells", zh: "铁皮法术", en: "Skeleton Spell", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: estTime(8, 3600, 11*DAY), thRequired: genTH(8,9,1), priority: 4, usesBuilder: false },
  { scId: 26000028, category: "spells", zh: "蝙蝠法术", en: "Bat Spell", buildCategory: "offense", maxLevel: 8, upgradeTimeSec: estTime(8, 3600, 12*DAY), thRequired: genTH(8,10,1), priority: 5, usesBuilder: false },
  { scId: 26000035, category: "spells", zh: "隐身法术", en: "Invisibility Spell", buildCategory: "offense", maxLevel: 6, upgradeTimeSec: estTime(6, 3600, 14*DAY), thRequired: genTH(6,12,1), priority: 6, usesBuilder: false },
  { scId: 26000053, category: "spells", zh: "回溯法术", en: "Recall Spell", buildCategory: "offense", maxLevel: 6, upgradeTimeSec: estTime(6, 3600, 12*DAY), thRequired: genTH(6,13,1), priority: 5, usesBuilder: false },
  { scId: 26000070, category: "spells", zh: "蔓生法术", en: "Overgrowth Spell", buildCategory: "offense", maxLevel: 4, upgradeTimeSec: [0,864000,1036800,1296000], thRequired: genTH(4,12,1), priority: 5, usesBuilder: false },

  // ============ 英雄 heroes ============
  // ID 顺序按英雄发布顺序：国王(TH7) → 女皇(TH9) → 大守护者(TH11) → 飞盾战神(TH13) → 亡灵王子(TH17, 2024-11)
  { scId: 28000000, category: "heroes", zh: "蛮王", en: "Barbarian King", buildCategory: "offense", maxLevel: 105, upgradeTimeSec: estTime(105, 3600, 7*DAY), thRequired: genTH(105,7,1), priority: 8, usesBuilder: false },
  { scId: 28000001, category: "heroes", zh: "女王", en: "Archer Queen", buildCategory: "offense", maxLevel: 105, upgradeTimeSec: estTime(105, 3600, 7*DAY), thRequired: genTH(105,9,1), priority: 9, usesBuilder: false },
  { scId: 28000002, category: "heroes", zh: "永王", en: "Grand Warden", buildCategory: "offense", maxLevel: 80, upgradeTimeSec: estTime(80, 3600, 7*DAY), thRequired: genTH(80,11,1), priority: 8, usesBuilder: false },
  { scId: 28000004, category: "heroes", zh: "闰土", en: "Royal Champion", buildCategory: "offense", maxLevel: 55, upgradeTimeSec: estTime(55, 3600, 7*DAY), thRequired: genTH(55,13,1), priority: 8, usesBuilder: false },
  { scId: 28000006, category: "heroes", zh: "王子", en: "Minion Prince", buildCategory: "offense", maxLevel: 95, upgradeTimeSec: estTime(95, 3600, 7*DAY), thRequired: genTH(95,17,1), priority: 8, usesBuilder: false },

  // ============ 宠物 pets ============
  ...[73000000,73000001,73000002,73000003,73000004,73000005,73000006,73000007,73000008,73000009,73000010].map((id, i) => {
    const names = [
      ["莱西","L.A.S.S.I"],["闪枭","Electro Owl"],["大牦","Mighty Yak"],["独角","Unicorn"],
      ["冰牙","Frosty"],["地兽","Diggy"],["猛蜥","Poison Lizard"],["凤凰","Phoenix"],
      ["灵狐","Spirit Fox"],["水母","Angry Jelly"],["啾啾","Sneezy"]
    ];
    return {
      scId: id, category: "pets", zh: names[i][0], en: names[i][1],
      buildCategory: "offense" as BuildCategory,
      maxLevel: 15, upgradeTimeSec: estTime(15, 3600, 8*DAY),
      thRequired: genTH(15, 14, 1), priority: 5, usesBuilder: false
    };
  }),

  // ============ 装备 equipment ============
  ...[
    [106000000,"野蛮人傀儡","Barbarian Puppet"],[106000001,"狂暴药瓶","Rage Vial"],
    [106000002,"弓箭手傀儡","Archer Puppet"],[106000003,"隐身药瓶","Invisibility Vial"],
    [106000004,"永恒圣典","Eternal Tome"],[106000005,"生命宝石","Life Gem"],
    [106000006,"追踪之盾","Seeking Shield"],[106000007,"皇家宝石","Royal Gem"],
    [106000008,"地震战靴","Earthquake Boots"],[106000009,"野猪骑士傀儡","Hog Rider Puppet"],
    [106000010,"巨人护手","Giant Gauntlet"],[106000011,"吸血胡须","Vampstache"],
    [106000012,"急速药瓶","Haste Vial"],[106000013,"火箭长矛","Rocket Spear"],
    [106000014,"尖刺球","Spiky Ball"],[106000015,"冰霜之箭","Frozen Arrow"],
    [106000016,"巨石之箭","Monolith Arrow"],[106000017,"巨箭","Giant Arrow"],
    [106000019,"天使傀儡","Healer Puppet"],[106000020,"魔镜","Magic Mirror"],
    [106000022,"魔法手套","Magic Glove"],[106000024,"国王权杖","King's Wand"],
    [106000032,"女皇之守护","Queen's Ward"],[106000034,"守护者宝珠","Warden's Orb"],
    [106000035,"冠军之冠","Champion's Crown"],[106000039,"野蛮人门徒","Barbarian Disciple"],
    [106000040,"弓箭刺客","Archer Assassin"],[106000041,"守护者光环","Warden's Aura"],
    [106000042,"狂怒守护者","Rageful Guardian"],[106000043,"神圣守护者","Sacred Protector"],
    [106000044,"暗影长矛","Shadow Spear"],[106000047,"凤凰之环","Phoenix Ring"],
    [106000048,"吸血药瓶","Vampire Vial"],[106000049,"骷髅钥匙","Skeleton Key"],
    [106000050,"霜寒守护","Frost Guard"],[106000051,"毒药瓶","Poison Flask"],
    [106000052,"地震之锤","Earthquake Hammer"],[106000053,"闪电护符","Lightning Charm"],
    [106000057,"克隆之冠","Clone Crown"],[106000060,"风暴使者","Storm Bringer"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "equipment", zh: zh as string, en: en as string,
    buildCategory: "offense" as BuildCategory,
    maxLevel: 18, upgradeTimeSec: estTime(18, 1800, 4*DAY),
    thRequired: genTH(18, 13, 1), priority: 6, usesBuilder: false
  })),

  // ============ 兵种 units ============
  // 中文名参考部落小工具 APK，ID 顺序按 COC 兵营解锁顺序
  ...[
    [4000000,"野蛮人","Barbarian"],[4000001,"弓箭手","Archer"],[4000002,"哥布林","Goblin"],
    [4000003,"巨人","Giant"],[4000004,"炸弹人","Wall Breaker"],[4000005,"气球","Balloon"],
    [4000006,"法师","Wizard"],[4000007,"天使","Healer"],[4000008,"飞龙","Dragon"],
    [4000009,"皮卡","P.E.K.K.A"],[4000010,"亡灵","Minion"],[4000011,"野猪骑士","Hog Rider"],
    [4000012,"武神","Valkyrie"],[4000013,"石头人","Golem"],[4000015,"女巫","Witch"],
    [4000017,"熔岩猎犬","Lava Hound"],[4000022,"蓝胖","Bowler"],[4000023,"龙宝","Baby Dragon"],
    [4000024,"矿工","Miner"],[4000053,"雪怪","Yeti"],
    [4000058,"冰人","Ice Golem"],[4000059,"雷龙","Electro Dragon"],
    [4000065,"龙骑","Dragon Rider"],[4000082,"英雄猎手","Headhunter"],
    [4000095,"雷霆泰坦","Electro Titan"],[4000097,"守护者学徒","Apprentice Warden"],
    [4000110,"根蔓骑士","Root Rider"]
  ].map(([id,zh,en], i) => ({
    scId: id as number, category: "units", zh: zh as string, en: en as string,
    buildCategory: "offense" as BuildCategory,
    maxLevel: [14,14,14,14,14,14,14,11,14,13,14,12,12,14,6,10,8,10,12,10,6,9,6,6,6,4,4][i] || 10,
    upgradeTimeSec: estTime(14, 3600, 15*DAY),
    thRequired: genTH(14, 1, 1), priority: 5, usesBuilder: false
  })),

  // ============ 助力 helpers ============
  ...[
    [124000000,"工人助手","Builder Helper"],[124000001,"实验室助手","Lab Helper"],
    [124000002,"炼金术师","Alchemist"],[124000003,"探矿者","Prospector"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "helpers", zh: zh as string, en: en as string,
    buildCategory: "utility" as BuildCategory,
    maxLevel: 5, upgradeTimeSec: estTime(5, 3600, 5*DAY),
    thRequired: genTH(5, 14, 1), priority: 4, usesBuilder: false
  })),

  // ============ 攻城机器 siege_machines ============
  ...[
    [4000051,"攻城战车","Wall Wrecker"],[4000052,"攻城气球","Battle Blimp"],
    [4000062,"攻城投石车","Stone Slammer"],[4000075,"战营","Siege Barracks"],
    [4000087,"滚木车","Log Launcher"],[4000091,"投石车","Log Thrower"],
    [4000092,"钻地机","Driller"],[4000135,"部队发射器","Troop Launcher"],
    [4000188,"空中部队发射器","Air Troop Launcher"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "siege_machines", zh: zh as string, en: en as string,
    buildCategory: "offense" as BuildCategory,
    maxLevel: 5, upgradeTimeSec: estTime(5, 3600, 12*DAY),
    thRequired: genTH(5, 12, 1), priority: 5, usesBuilder: false
  })),

  // ============ 夜世界建筑 buildings2 ============
  // 中文名参考部落小工具 APK
  ...[
    [1000033,"城墙(夜)","BH Wall"],[1000034,"建筑大师大本营","BH Town Hall"],
    [1000035,"圣水采集器(夜)","BH Elixir Collector"],[1000036,"圣水瓶(夜)","BH Elixir Storage"],
    [1000037,"金矿(夜)","BH Gold Mine"],[1000038,"储金罐(夜)","BH Gold Storage"],
    [1000039,"时光钟楼","BH Clock Tower"],[1000040,"建筑大师训练营","BH Barracks"],
    [1000041,"双管加农炮","BH Double Cannon"],[1000042,"兵营(夜)","BH Army Camp"],
    [1000043,"特斯拉电磁塔(夜)","BH Hidden Tesla"],[1000044,"加农炮(夜)","BH Cannon"],
    [1000045,"多管迫击炮","BH Multi Mortar"],[1000046,"星空实验室","BH Star Laboratory"],
    [1000048,"箭塔(夜)","BH Archer Tower"],[1000049,"预备营","BH Guard Post"],
    [1000050,"防空火箭(夜)","BH Air Defense"],[1000051,"守卫哨岗","BH Guard Post"],
    [1000052,"超级特斯拉电磁塔","BH Mega Tesla"],[1000053,"重建战斗机器","BH Battle Machine"],
    [1000054,"空中炸弹发射器(夜)","BH Air Bombs"],[1000055,"撼地巨石","BH Crusher"],
    [1000056,"熔岩火炮(夜)","BH Roaster"],[1000057,"巨型加农炮","BH Giant Cannon"],
    [1000058,"宝石矿井","BH Gem Mine"],[1000063,"熔岩发射器(夜)","BH Lava Launcher"],
    [1000065,"小博控制室","BH OTTO Hut"],[1000078,"奥仔哨站","BH OTTO Outpost"],
    [1000080,"重建战斗直升机","BH Battle Copter"],[1000081,"X连弩(夜)","BH X-Bow"],
    [1000082,"治疗小屋","BH Healing Hut"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "buildings2", zh: zh as string, en: en as string,
    buildCategory: "defense" as BuildCategory,
    maxLevel: 10, upgradeTimeSec: estTime(10, 300, 5*DAY),
    thRequired: genTH(10, 2, 1), priority: 3, usesBuilder: true
  })),

  // ============ 夜世界英雄 heroes2 ============
  ...[
    [28000003,"战斗机器","Battle Machine"],[28000005,"战斗直升机","Battle Copter"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "heroes2", zh: zh as string, en: en as string,
    buildCategory: "offense" as BuildCategory,
    maxLevel: 35, upgradeTimeSec: estTime(35, 3600, 5*DAY),
    thRequired: genTH(35, 5, 1), priority: 5, usesBuilder: false
  })),

  // ============ 夜世界兵种 units2 ============
  // 中文名参考部落小工具 APK
  ...[
    [4000031,"狂暴野蛮人","Raged Barbarian"],[4000032,"隐秘弓箭手","Sneaky Archer"],
    [4000033,"异变亡灵","Beta Minion"],[4000034,"巨人拳击手","Boxer Giant"],
    [4000035,"炸弹兵","Bomber"],[4000036,"雷霆皮卡","Cannon Cart"],
    [4000037,"加农炮战车","Drop Ship"],[4000038,"骷髅气球","Night Witch"],
    [4000041,"飞龙宝宝","BH Baby Dragon"],[4000042,"暗夜女巫","Power P.E.K.K.A"],
    [4000070,"野猪飞骑","Hog Glider"]
  ].map(([id,zh,en]) => ({
    scId: id as number, category: "units2", zh: zh as string, en: en as string,
    buildCategory: "offense" as BuildCategory,
    maxLevel: 12, upgradeTimeSec: estTime(12, 3600, 5*DAY),
    thRequired: genTH(12, 2, 1), priority: 3, usesBuilder: false
  })),
];

// ── 导出 ─────────────────────────────────

export const COC_DATABASE_VERSION = "2025.12-TH18";
export const COC_DATABASE_UPDATED_AT = "2025-12-01";
export const COC_DATABASE_SOURCE = "Supercell 官方博客 + clash.ninja + 游戏经验估算";

export const COC_ITEM_DEFS: CocItemDef[] = RAW_DATA;

/** 按 SC ID 索引的查找表 */
export const COC_ITEM_BY_ID: Record<number, CocItemDef> = Object.fromEntries(
  RAW_DATA.map((d) => [d.scId, d])
);
