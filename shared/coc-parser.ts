/**
 * CoC JSON 本地解析器（移植自 backend/app/parser/coc_parser.py）
 * ============================================================
 * 解析逻辑：
 *  - JSON 中每个对象若有 "timer" 字段且 > 0，则正在升级
 *  - helpers 类别使用 "helper_cooldown" 字段
 *  - finish_time = 当前时间 + timer (秒)
 *  - 名称通过 coc-assets.ts 的 getItemNameById 解析为中文
 *
 * 纯前端，无后端依赖。Cloudflare Pages 静态部署可用。
 */

import { getItemNameById, inferCategory } from "./coc-assets";
import type { UpgradeItem, IdleTimes, PlayerInfo, VillageItem, VillageSnapshot } from "./types";
import { log, warn, error, group, fmtDuration } from "./logger";

const TIMER_CATEGORIES = [
  "buildings", "spells", "heroes", "pets", "equipment", "units",
  "helpers",
  "buildings2", "heroes2", "units2", "siege_machines",
] as const;

type RawItem = Record<string, unknown>;

function getTimer(item: RawItem): number | null {
  const timer = item.timer;
  if (typeof timer === "number" && timer > 0) return Math.floor(timer);

  const cooldown = item.helper_cooldown;
  if (typeof cooldown === "number" && cooldown > 0) return Math.floor(cooldown);

  return null;
}

function getLevel(item: RawItem): number {
  for (const field of ["lvl", "level"] as const) {
    const val = item[field];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  // 未找到等级字段，默认 1
  log("  getLevel: 未找到 lvl/level 字段，默认返回 1，item.data=", item.data);
  return 1;
}

function resolveName(category: string, dataId: number | null): string {
  if (dataId == null) return category;
  const info = getItemNameById(category, dataId);
  if (info) return info.zh;
  // 未知 SC ID — 资产表中找不到
  warn(`resolveName: 未知 SC ID ${dataId} (category=${category})，使用 ID 作为名称`);
  return String(dataId);
}

export interface ParseResult {
  upgrades: UpgradeItem[];
  player_info: PlayerInfo;
  idle_times: IdleTimes;
}

export function parseCocJson(raw: string | object, exportTime?: number): UpgradeItem[] {
  const inputType = typeof raw === "string" ? "string" : "object";
  const inputSize = typeof raw === "string" ? raw.length : JSON.stringify(raw).length;
  log(`parseCocJson: 开始解析，输入类型=${inputType}，大小=${inputSize} 字符`);

  let data: object;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    error("parseCocJson: JSON 解析失败", e);
    throw e;
  }

  const topKeys = Object.keys(data as Record<string, unknown>);
  log(`parseCocJson: 顶层字段 [${topKeys.join(", ")}]`);

  // 优先从 JSON 顶层 timestamp 字段读取导出时间（Unix 秒）
  // 其次用传入的 exportTime 参数，最后回退到当前时间
  const jsonObj = data as Record<string, unknown>;
  const jsonTs = typeof jsonObj.timestamp === "number" && jsonObj.timestamp > 0
    ? jsonObj.timestamp * 1000
    : null;
  const baseTime = jsonTs
    ?? (Number.isFinite(exportTime as number) ? (exportTime as number) : null)
    ?? Date.now();
  const diffMin = Math.round((Date.now() - baseTime) / 60000);
  log(`parseCocJson: 基准时间 ${new Date(baseTime).toLocaleString("zh-CN")} (距今 ${diffMin} 分钟)${jsonTs ? " [来自JSON timestamp]" : ""}`);

  const upgrades: UpgradeItem[] = [];
  let idCounter = 1;
  let totalSkipped = 0;

  for (const cat of TIMER_CATEGORIES) {
    const sub = (data as Record<string, unknown>)[cat];
    if (!Array.isArray(sub)) {
      log(`  [${cat}] 不存在或非数组，跳过`);
      continue;
    }

    let catActive = 0;
    let catSkipped = 0;

    for (const entry of sub) {
      if (typeof entry !== "object" || entry === null) {
        catSkipped++;
        continue;
      }
      const item = entry as RawItem;

      const timer = getTimer(item);
      if (timer == null) {
        catSkipped++;
        continue;
      }

      const dataId =
        typeof item.data === "number" ? item.data
          : typeof item.data === "string" ? parseInt(item.data, 10)
          : null;
      const lvl = getLevel(item);
      const name = resolveName(cat, dataId);
      const finishMs = baseTime + timer * 1000;

      log(`    → [${cat}] ${name} (scId=${dataId}, lvl=${lvl}, timer=${fmtDuration(timer)})`);

      upgrades.push({
        id: idCounter++,
        category: cat,
        item_name: name,
        item_level: lvl,
        timer_seconds: timer,
        finish_time: new Date(finishMs).toISOString(),
        notified: false,
        data_id: Number.isFinite(dataId as number) ? (dataId as number) : null,
      });
      catActive++;
    }

    log(`  [${cat}] 共 ${sub.length} 条，活跃升级 ${catActive}，跳过 ${catSkipped}`);
    totalSkipped += catSkipped;
  }

  log(`parseCocJson: 完成，共提取 ${upgrades.length} 个活跃升级，跳过 ${totalSkipped} 条无 timer 记录`);
  return upgrades;
}

export function extractPlayerInfo(raw: string | object): PlayerInfo {
  let data: Record<string, unknown>;
  try {
    data = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch (e) {
    error("extractPlayerInfo: JSON 解析失败，返回默认值", e);
    return {
      player_tag: "",
      player_name: "",
      town_hall_level: 0,
      builder_count: 5,
      active_upgrades: 0,
      completed_count: 0,
    };
  }

  const playerTag = (data.playerTag as string) || (data.tag as string) || "";
  const playerName = (data.playerName as string) || (data.name as string) || "";

  let townHallLevel = 0;
  let builderCount = 0;
  const buildings = data.buildings;
  if (Array.isArray(buildings)) {
    let foundTH = false;
    let foundBH = false;
    for (const b of buildings) {
      if (typeof b !== "object" || b === null) continue;
      const obj = b as RawItem;
      if (obj.data === 1000001) {
        townHallLevel = typeof obj.lvl === "number" ? obj.lvl : 0;
        foundTH = true;
        log(`  extractPlayerInfo: 检测到市政厅 Lv${townHallLevel}`);
      }
      if (obj.data === 1000015) {
        const cnt = typeof obj.cnt === "number" ? obj.cnt : 0;
        builderCount += cnt;
        foundBH = true;
        log(`  extractPlayerInfo: 检测到建筑工人小屋 cnt=${cnt}，累计=${builderCount}`);
      }
    }
    if (!foundTH) warn("extractPlayerInfo: 未找到市政厅 (data=1000001)，townHallLevel=0");
    if (!foundBH) warn("extractPlayerInfo: 未找到建筑工人小屋 (data=1000015)，使用默认值 5");
  } else {
    warn("extractPlayerInfo: buildings 字段不存在或非数组");
  }

  const result = {
    player_tag: playerTag,
    player_name: playerName,
    town_hall_level: townHallLevel,
    builder_count: builderCount > 0 ? builderCount : 5,
    active_upgrades: 0,
    completed_count: 0,
  };
  log(`extractPlayerInfo: 完成，玩家=${playerName || "(无名)"}，TH=${townHallLevel}，工人=${result.builder_count}`);
  return result;
}

export function calculateIdleTimes(upgrades: UpgradeItem[]): IdleTimes {
  const result: IdleTimes = {
    builder_idle_at: null,
    lab_idle_at: null,
    builder_busy_count: 0,
    lab_busy_count: 0,
    builder_total: null,
  };

  const buildingItems = upgrades.filter((u) => u.category === "buildings");
  const spellItems = upgrades.filter((u) => u.category === "spells");

  if (buildingItems.length > 0) {
    const latest = buildingItems.reduce((a, b) =>
      new Date(b.finish_time).getTime() > new Date(a.finish_time).getTime() ? b : a
    );
    result.builder_idle_at = latest.finish_time;
    result.builder_busy_count = buildingItems.length;
    log(`  calculateIdleTimes: 工人忙 ${buildingItems.length} 项，最晚完成=${latest.item_name} @ ${latest.finish_time}`);
  } else {
    log("  calculateIdleTimes: 无建筑升级，工人全部空闲");
  }

  if (spellItems.length > 0) {
    const latest = spellItems.reduce((a, b) =>
      new Date(b.finish_time).getTime() > new Date(a.finish_time).getTime() ? b : a
    );
    result.lab_idle_at = latest.finish_time;
    result.lab_busy_count = spellItems.length;
    log(`  calculateIdleTimes: 实验室忙 ${spellItems.length} 项，最晚完成=${latest.item_name} @ ${latest.finish_time}`);
  } else {
    log("  calculateIdleTimes: 无法术研究，实验室空闲");
  }

  return result;
}

export function parseFull(raw: string | object, exportTime?: number): ParseResult {
  group("parseFull 开始", () => {
    log(`输入类型=${typeof raw === "string" ? "string" : "object"}，大小=${typeof raw === "string" ? raw.length : JSON.stringify(raw).length} 字符`);
  });

  const upgrades = parseCocJson(raw, exportTime);
  const playerInfo = extractPlayerInfo(raw);
  playerInfo.active_upgrades = upgrades.filter(
    (u) => new Date(u.finish_time).getTime() > Date.now()
  ).length;
  playerInfo.completed_count = upgrades.length - playerInfo.active_upgrades;
  const idleTimes = calculateIdleTimes(upgrades);

  group("parseFull 汇总", () => {
    log(`活跃升级: ${playerInfo.active_upgrades}，已完成: ${playerInfo.completed_count}，总计: ${upgrades.length}`);
    log(`工人: 忙=${idleTimes.builder_busy_count}，空闲时间=${idleTimes.builder_idle_at || "(空闲)"}`);
    log(`实验室: 忙=${idleTimes.lab_busy_count}，空闲时间=${idleTimes.lab_idle_at || "(空闲)"}`);
  });

  return { upgrades, player_info: playerInfo, idle_times: idleTimes };
}

// ── 全量村庄解析（含 timer=0 的项）─────────────

/**
 * 解析整个村庄的所有条目（含 timer=0 的），生成 VillageSnapshot
 * - 与 parseFull() 互补：parseFull 只提取 timer>0 的活跃升级
 * - parseVillage 提取所有条目（含已完成/未升级的），用于基地分析/评分/推荐
 * - 不修改现有 parseCocJson/parseFull，向后兼容
 */
export function parseVillage(raw: string | object, exportTime?: number): VillageSnapshot {
  const inputSize = typeof raw === "string" ? raw.length : JSON.stringify(raw).length;
  log(`parseVillage: 开始全量解析，输入大小=${inputSize} 字符`);

  let data: Record<string, unknown>;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch (e) {
    error("parseVillage: JSON 解析失败", e);
    throw e;
  }

  // 优先从 JSON 顶层 timestamp 字段读取导出时间（Unix 秒）
  const jsonTs = typeof data.timestamp === "number" && data.timestamp > 0
    ? data.timestamp * 1000
    : null;
  const baseTime = jsonTs
    ?? (Number.isFinite(exportTime as number) ? (exportTime as number) : null)
    ?? Date.now();
  log(`parseVillage: 基准时间 ${new Date(baseTime).toLocaleString("zh-CN")}${jsonTs ? " [来自JSON timestamp]" : ""}`);
  const items: VillageItem[] = [];

  let townHallLevel = 0;
  let builderCount = 0;
  const playerTag = (data.playerTag as string) || (data.tag as string) || "";
  const playerName = (data.playerName as string) || (data.name as string) || "";
  let unknownIdCount = 0;

  for (const cat of TIMER_CATEGORIES) {
    const sub = data[cat];
    if (!Array.isArray(sub)) continue;

    let catCount = 0;
    let catUpgrading = 0;

    for (const entry of sub) {
      if (typeof entry !== "object" || entry === null) continue;
      const item = entry as RawItem;

      const dataId =
        typeof item.data === "number" ? item.data
          : typeof item.data === "string" ? parseInt(item.data, 10)
          : null;
      if (!Number.isFinite(dataId as number)) {
        unknownIdCount++;
        continue;
      }
      const scId = dataId as number;

      // 市政厅等级
      if (scId === 1000001 && typeof item.lvl === "number") {
        townHallLevel = item.lvl;
        log(`  parseVillage: 检测到市政厅 Lv${townHallLevel}`);
      }
      // 建筑工人小屋数量
      if (scId === 1000015 && typeof item.cnt === "number") {
        builderCount += item.cnt;
        log(`  parseVillage: 检测到工人小屋 cnt=${item.cnt}，累计=${builderCount}`);
      }

      const currentLevel = getLevel(item);
      const timer = getTimer(item);

      const villageItem: VillageItem = {
        scId,
        category: cat,
        currentLevel,
        isUpgrading: timer != null,
      };

      if (timer != null) {
        villageItem.targetLevel = currentLevel + 1;
        villageItem.timerSeconds = timer;
        villageItem.finishTime = new Date(baseTime + timer * 1000).toISOString();
        catUpgrading++;
        log(`    → [${cat}] scId=${scId} lvl=${currentLevel}→${currentLevel + 1} timer=${fmtDuration(timer)}`);
      }

      items.push(villageItem);
      catCount++;
    }

    if (catCount > 0) {
      log(`  [${cat}] 共 ${catCount} 条，其中 ${catUpgrading} 条正在升级`);
    }
  }

  if (unknownIdCount > 0) {
    warn(`parseVillage: ${unknownIdCount} 条记录缺少有效 data 字段，已跳过`);
  }
  if (townHallLevel === 0) {
    warn("parseVillage: 未检测到市政厅等级 (data=1000001)，townHallLevel=0");
  }
  if (builderCount === 0) {
    warn("parseVillage: 未检测到建筑工人小屋 (data=1000015)，使用默认值 5");
  }

  const upgradingCount = items.filter((i) => i.isUpgrading).length;
  const snapshot: VillageSnapshot = {
    capturedAt: new Date(baseTime).toISOString(),
    townHallLevel,
    builderCount: builderCount > 0 ? builderCount : 5,
    playerTag,
    playerName,
    items,
  };

  group("parseVillage 完成", () => {
    log(`总条目: ${items.length}，正在升级: ${upgradingCount}，已满级/空闲: ${items.length - upgradingCount}`);
    log(`大本营: Lv${townHallLevel}，工人: ${snapshot.builderCount}`);
    log(`玩家: ${playerName || "(无名)"} (${playerTag || "(无tag)"})`);
  });

  return snapshot;
}

export { inferCategory };
