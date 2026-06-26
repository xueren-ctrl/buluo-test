/**
 * API 服务层
 * 所有请求统一走 Next.js rewrites -> /api/*
 */
import type {
  UploadResponse,
  UpgradesListResponse,
  ManualRefreshResponse,
} from "@/types";

const API_BASE = "/api";

export async function uploadJson(
  jsonData: string,
  clientId: string,
  playerTag?: string,
  playerName?: string
): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/upload-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json_data: jsonData,
      wspusher_uid: clientId,
      player_tag: playerTag || null,
      player_name: playerName || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getUpgrades(
  clientId: string
): Promise<UpgradesListResponse> {
  const res = await fetch(
    `${API_BASE}/upgrades?wspusher_uid=${encodeURIComponent(clientId)}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function manualRefresh(
  clientId: string
): Promise<ManualRefreshResponse> {
  const res = await fetch(
    `${API_BASE}/manual-refresh?wspusher_uid=${encodeURIComponent(clientId)}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
