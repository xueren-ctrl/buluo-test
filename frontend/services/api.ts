/**
 * API 服务层（纯本地实现，无后端依赖）
 * ============================================
 * 原 services/api.ts 通过 Next.js rewrites 调用 FastAPI 后端，
 * 但 Cloudflare Pages 是纯静态托管，部署后 /api/* 会 404。
 *
 * 现改为本地调用 lib/coc-parser.ts 解析 JSON，返回与原后端
 * 相同形状的 UploadResponse / UpgradesListResponse，保持
 * page.tsx 调用签名不变。
 */

import { parseFull, parseVillage } from "@/lib/coc-parser";
import { log, warn, error, group } from "@/lib/logger";
import type {
  UploadResponse,
  UpgradesListResponse,
  ManualRefreshResponse,
  PlayerInfo,
  IdleTimes,
  UpgradeItem,
  VillageSnapshot,
} from "@/types";

function diffUpgrades(
  prev: UpgradeItem[],
  next: UpgradeItem[]
): { new_upgrades: string[]; completed_upgrades: string[]; removed_upgrades: string[] } {
  log(`diffUpgrades: prev=${prev.length} 项，next=${next.length} 项`);
  const prevKeys = new Set(prev.map((u) => `${u.category}:${u.data_id ?? u.item_name}`));
  const nextKeys = new Set(next.map((u) => `${u.category}:${u.data_id ?? u.item_name}`));
  const now = Date.now();

  const newUpgrades = next
    .filter((u) => !prevKeys.has(`${u.category}:${u.data_id ?? u.item_name}`))
    .map((u) => u.item_name);
  const completedUpgrades = prev
    .filter((u) => !nextKeys.has(`${u.category}:${u.data_id ?? u.item_name}`))
    .filter((u) => new Date(u.finish_time).getTime() <= now)
    .map((u) => u.item_name);
  const removedUpgrades = prev
    .filter((u) => !nextKeys.has(`${u.category}:${u.data_id ?? u.item_name}`))
    .filter((u) => new Date(u.finish_time).getTime() > now)
    .map((u) => u.item_name);

  if (newUpgrades.length > 0) log(`  新增升级: ${newUpgrades.join(", ")}`);
  if (completedUpgrades.length > 0) log(`  已完成: ${completedUpgrades.join(", ")}`);
  if (removedUpgrades.length > 0) warn(`  已移除(未完成但消失): ${removedUpgrades.join(", ")}`);

  return {
    new_upgrades: newUpgrades,
    completed_upgrades: completedUpgrades,
    removed_upgrades: removedUpgrades,
  };
}

// 上一次解析结果缓存，用于 diff 计算
let _lastUpgrades: UpgradeItem[] = [];

export async function uploadJson(
  jsonData: string,
  clientId: string,
  exportTime?: number,
  _playerTag?: string,
  _playerName?: string
): Promise<UploadResponse> {
  log(`uploadJson: 收到请求，clientId=${clientId}，JSON 大小=${jsonData.length} 字符${exportTime ? `，导出时间=${new Date(exportTime).toLocaleString("zh-CN")}` : ""}`);

  // 1. 解析活跃升级
  let upgrades: UpgradeItem[];
  let player_info: PlayerInfo;
  let idle_times: IdleTimes;
  try {
    const result = parseFull(jsonData, exportTime);
    upgrades = result.upgrades;
    player_info = result.player_info;
    idle_times = result.idle_times;
  } catch (e) {
    error("uploadJson: parseFull 失败", e);
    throw e;
  }

  // 2. 计算差异
  const diff = diffUpgrades(_lastUpgrades, upgrades);
  _lastUpgrades = upgrades;

  // 3. 全量村庄解析（用于基地分析/评分/推荐）
  let village: VillageSnapshot | undefined;
  try {
    village = parseVillage(jsonData, exportTime);
  } catch (e) {
    warn("uploadJson: parseVillage 失败，基地分析/评分将不可用", e);
  }

  group("uploadJson 响应汇总", () => {
    log(`成功: true，活跃升级=${upgrades.length}，village条目=${village?.items.length ?? 0}`);
    log(`玩家: ${player_info.player_name || "(无名)"}，TH=${player_info.town_hall_level}，工人=${player_info.builder_count}`);
    if (diff.new_upgrades.length) log(`diff: 新增 ${diff.new_upgrades.length}，完成 ${diff.completed_upgrades.length}，移除 ${diff.removed_upgrades.length}`);
  });

  return {
    success: true,
    user_id: 0,
    village_id: 0,
    upgrades,
    idle_times,
    player_info,
    last_upload_at: new Date().toISOString(),
    diff,
    village,
  };
}

export async function getUpgrades(
  _clientId: string
): Promise<UpgradesListResponse> {
  // 纯前端模式下，升级数据由 IndexedDB 持久化，此处返回缓存
  // page.tsx 实际从 IndexedDB loadUpgrades() 读取，本函数仅作 fallback
  return {
    success: true,
    user_id: 0,
    upgrades: _lastUpgrades,
    idle_times: {
      builder_idle_at: null,
      lab_idle_at: null,
      builder_busy_count: 0,
      lab_busy_count: 0,
    },
    player_info: null,
    last_upload_at: null,
  };
}

export async function manualRefresh(
  _clientId: string
): Promise<ManualRefreshResponse> {
  return {
    success: true,
    message: "本地数据已刷新",
    notified_count: 0,
  };
}

export type { PlayerInfo, IdleTimes, UpgradeItem };
