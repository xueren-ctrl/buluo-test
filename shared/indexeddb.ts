/**
 * IndexedDB 本地存储层
 * ============================================
 * 替代 localStorage，离线持久化全部本地状态：
 *  - upgrades:    升级队列 + 已通知状态
 *  - userData:    用户 JSON、设备 ID（替代 WsPusher UID）、上次同步时间
 *  - history:     已完成历史
 *  - notifyConfig:通知开关
 *  - notifyState: 通知去重（已发层级），跨重传/重开不重复
 *  - settings:    调度器设置 + 最近提醒时间
 *  - village:     村庄快照
 *
 * v4 新增：
 *  - json_history: 最近 5 次 JSON 导入历史（时间轴展示）
 *  - accounts:    多账号支持（playerTag 索引）
 */

// ── 数据库常量 ──────────────────────────────
const DB_NAME = "CocUpgradeDB";
const DB_VERSION = 4;
const STORE_UPGRADES = "upgrades";
const STORE_USER_DATA = "userData";
const STORE_HISTORY = "history";
const STORE_NOTIFY_CONFIG = "notifyConfig";
const STORE_NOTIFY_STATE = "notifyState";
const STORE_SETTINGS = "settings";
const STORE_VILLAGE = "village";
const STORE_JSON_HISTORY = "json_history";
const STORE_ACCOUNTS = "accounts";

// ── 类型定义 ────────────────────────────────
export interface RawUpgradeRecord {
  id?: number;
  category: string;
  item_name: string;
  item_level: number;
  finish_time: string;
  timer_seconds: number | null;
  notified: boolean;
  data_id?: number | null;
}

export interface UserRecord {
  uid: string; // keyPath，固定 "default"
  client_id: string;
  player_tag: string | null;
  player_name: string | null;
  last_json_raw: string | null;
  last_upload_at: string | null;
  last_sync_at: string | null;
}

export interface HistoryRecord {
  id: string;
  item_name: string;
  category: string;
  item_level: number;
  completed_at: string;
}

export interface NotifyConfig {
  browserNotifEnabled: boolean;
}

export type NotifyTier = "pre_30m" | "pre_10m" | "complete" | "post_complete";

export interface NotifyStateRecord {
  key: string; // `${category}:${data_id}:${level}:${tier}`
  firedAt: number;
}

export interface SchedulerSettings {
  enablePre30m: boolean;
  enablePre10m: boolean;
  enableComplete: boolean;
  enablePostComplete: boolean;
  enableBatch: boolean;
  batchWindowMinutes: number;
  dndEnabled: boolean;
  dndStart: number; // 0-23
  dndEnd: number;   // 0-23
  last_notify_at: string | null;
  last_sync_at: string | null;
}

export const DEFAULT_SETTINGS: SchedulerSettings = {
  enablePre30m: true,
  enablePre10m: true,
  enableComplete: true,
  enablePostComplete: false,
  enableBatch: true,
  batchWindowMinutes: 30,
  dndEnabled: true,
  dndStart: 22,
  dndEnd: 8,
  last_notify_at: null,
  last_sync_at: null,
};

// v3 新增：村庄快照存储
export interface VillageRecord {
  key: string; // 固定 "latest"
  snapshot: import("./types").VillageSnapshot;
  capturedAt: string;
}

// ── DB 句柄 ─────────────────────────────────
let _db: IDBDatabase | null = null;

function open(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const oldVersion = (e as IDBVersionChangeEvent).oldVersion;

      if (!db.objectStoreNames.contains(STORE_UPGRADES)) {
        const store = db.createObjectStore(STORE_UPGRADES, { keyPath: "id", autoIncrement: true });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("finished", "finish_time", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_USER_DATA)) {
        db.createObjectStore(STORE_USER_DATA, { keyPath: "uid" });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const store = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
        store.createIndex("completed_at", "completed_at", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NOTIFY_CONFIG)) {
        db.createObjectStore(STORE_NOTIFY_CONFIG, { keyPath: "key" });
      }
      // v2 新增
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NOTIFY_STATE)) {
          db.createObjectStore(STORE_NOTIFY_STATE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
        }
      }
      // v3 新增：村庄快照存储
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STORE_VILLAGE)) {
          db.createObjectStore(STORE_VILLAGE, { keyPath: "key" });
        }
      }
      // v4 新增：JSON 历史 + 多账号
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_JSON_HISTORY)) {
          const store = db.createObjectStore(STORE_JSON_HISTORY, { keyPath: "id", autoIncrement: true });
          store.createIndex("imported_at", "imported_at", { unique: false });
          store.createIndex("player_tag", "player_tag", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
          const store = db.createObjectStore(STORE_ACCOUNTS, { keyPath: "player_tag" });
          store.createIndex("active", "active", { unique: false });
          store.createIndex("last_import_time", "last_import_time", { unique: false });
        }
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db!);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── 通用 CRUD ──────────────────────────────
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function put<T extends Record<string, unknown>>(
  storeName: string,
  data: T
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(
  storeName: string,
  key: string | number
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function clear(storeName: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function del(storeName: string, key: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 按数字 ID 删除（autoIncrement 主键的 store）
async function delById(storeName: string, id: number): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── 升级项 CRUD ─────────────────────────────
export async function saveUpgrades(upgrades: RawUpgradeRecord[]): Promise<void> {
  await clear(STORE_UPGRADES);
  for (const u of upgrades) {
    const { id, ...record } = u;
    await put(STORE_UPGRADES, record as unknown as Record<string, unknown>);
  }
}

export async function loadUpgrades(): Promise<RawUpgradeRecord[]> {
  return await getAll<RawUpgradeRecord>(STORE_UPGRADES);
}

// ── 用户数据 CRUD ───────────────────────────
export async function saveUserData(data: Omit<UserRecord, "uid">): Promise<void> {
  await put(STORE_USER_DATA, { ...data, uid: "default" } as unknown as Record<string, unknown>);
}

export async function loadUserData(): Promise<UserRecord | undefined> {
  return await get<UserRecord>(STORE_USER_DATA, "default");
}

// ── 历史记录 CRUD ───────────────────────────
export async function addHistory(entry: Omit<HistoryRecord, "id">): Promise<void> {
  const id = `${entry.category}-${entry.completed_at}-${Date.now()}`;
  await put(STORE_HISTORY, { ...entry, id } as unknown as Record<string, unknown>);
}

export async function loadHistory(limit = 50): Promise<HistoryRecord[]> {
  const all = await getAll<HistoryRecord>(STORE_HISTORY);
  return all
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, limit);
}

// ── 通知配置 CRUD ───────────────────────────
export async function saveNotifyConfig(cfg: NotifyConfig): Promise<void> {
  await put(STORE_NOTIFY_CONFIG, { key: "notifyConfig", ...cfg } as unknown as Record<string, unknown>);
}

export async function loadNotifyConfig(): Promise<NotifyConfig> {
  const existing = await get<NotifyConfig & { key: string }>(STORE_NOTIFY_CONFIG, "notifyConfig");
  if (existing) return { browserNotifEnabled: existing.browserNotifEnabled };
  const fallback: NotifyConfig = { browserNotifEnabled: false };
  await put(STORE_NOTIFY_CONFIG, { key: "notifyConfig", ...fallback } as unknown as Record<string, unknown>);
  return fallback;
}

// ── 通知去重状态 CRUD ───────────────────────
export function notifyStateKey(
  category: string,
  dataId: number | null,
  level: number,
  tier: NotifyTier
): string {
  return `${category}:${dataId ?? "x"}:${level}:${tier}`;
}

export async function isTierNotified(key: string): Promise<boolean> {
  const rec = await get<NotifyStateRecord>(STORE_NOTIFY_STATE, key);
  return !!rec;
}

export async function markTierNotified(key: string): Promise<void> {
  await put(STORE_NOTIFY_STATE, { key, firedAt: Date.now() } as unknown as Record<string, unknown>);
}

export async function clearNotifyState(): Promise<void> {
  await clear(STORE_NOTIFY_STATE);
}

export async function deleteNotifyState(key: string): Promise<void> {
  await del(STORE_NOTIFY_STATE, key);
}

// ── 调度器设置 CRUD ─────────────────────────
export async function saveSettings(settings: SchedulerSettings): Promise<void> {
  await put(STORE_SETTINGS, { key: "settings", ...settings } as unknown as Record<string, unknown>);
}

export async function loadSettings(): Promise<SchedulerSettings> {
  const existing = await get<SchedulerSettings & { key: string }>(STORE_SETTINGS, "settings");
  if (existing) {
    // 合并默认值，防止旧数据缺字段
    return { ...DEFAULT_SETTINGS, ...existing };
  }
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

// ── 村庄快照 CRUD（v3 新增）─────────────────
export async function saveVillage(snapshot: import("./types").VillageSnapshot): Promise<void> {
  const record: VillageRecord = {
    key: "latest",
    snapshot,
    capturedAt: snapshot.capturedAt,
  };
  await put(STORE_VILLAGE, record as unknown as Record<string, unknown>);
}

export async function loadVillage(): Promise<VillageRecord | undefined> {
  return await get<VillageRecord>(STORE_VILLAGE, "latest");
}

export async function clearVillage(): Promise<void> {
  await clear(STORE_VILLAGE);
}

// ── v4 新增：JSON 历史记录 CRUD ───────────
// 保存最近 5 次导入历史（旧的自动淘汰）
export interface JsonHistoryRecord {
  id?: number;                  // autoIncrement
  imported_at: string;          // ISO 时间
  player_tag: string;
  player_name: string;
  town_hall_level: number;
  json_raw: string;
  active_upgrades: number;
  base_score?: number | null;
  base_grade?: string | null;
}

export async function addJsonHistory(entry: Omit<JsonHistoryRecord, "id">): Promise<void> {
  await put(STORE_JSON_HISTORY, entry as unknown as Record<string, unknown>);
  // 自动淘汰：只保留最近 5 条
  const all = await getAll<JsonHistoryRecord>(STORE_JSON_HISTORY);
  if (all.length <= 5) return;
  // 按时间降序排序，删除超出 5 条之后的旧记录
  const sorted = all.sort(
    (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
  );
  const stale = sorted.slice(5); // 超出 5 条的
  for (const item of stale) {
    if (item.id != null) {
      await delById(STORE_JSON_HISTORY, item.id);
    }
  }
}

export async function loadJsonHistory(): Promise<JsonHistoryRecord[]> {
  const all = await getAll<JsonHistoryRecord>(STORE_JSON_HISTORY);
  return all.sort(
    (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
  );
}

export async function deleteJsonHistory(id: number): Promise<void> {
  await delById(STORE_JSON_HISTORY, id);
}

export async function clearJsonHistory(): Promise<void> {
  await clear(STORE_JSON_HISTORY);
}

// ── v4 新增：多账号 CRUD ────────────────
// player_tag 作为主键；空 tag 用 fallback key "anon"
export interface AccountRecord {
  player_tag: string;            // 主键
  player_name: string;
  town_hall_level: number;
  last_import_time: string;      // ISO
  village_data: import("./types").VillageSnapshot | null;
  upgrades: import("./types").UpgradeItem[];
  base_score: number | null;
  base_grade: string | null;
  active: boolean;                // 是否为当前激活账号
  json_raw: string | null;         // 该账号最近一次 JSON 原文
}

export const ANON_TAG = "anon";

function accountKey(playerTag: string): string {
  const t = (playerTag || "").trim();
  return t.length > 0 ? t : ANON_TAG;
}

export async function upsertAccount(account: Omit<AccountRecord, "active"> & { active?: boolean }): Promise<void> {
  const key = accountKey(account.player_tag);
  // 切换账号前先把其他账号 active 置为 false
  if (account.active) {
    const all = await getAll<AccountRecord>(STORE_ACCOUNTS);
    for (const a of all) {
      if (a.active && a.player_tag !== key) {
        await put(STORE_ACCOUNTS, { ...a, active: false } as unknown as Record<string, unknown>);
      }
    }
  }
  await put(STORE_ACCOUNTS, {
    ...account,
    player_tag: key,
    active: account.active ?? false,
  } as unknown as Record<string, unknown>);
}

export async function setActiveAccount(playerTag: string): Promise<void> {
  const key = accountKey(playerTag);
  const all = await getAll<AccountRecord>(STORE_ACCOUNTS);
  for (const a of all) {
    await put(STORE_ACCOUNTS, {
      ...a,
      active: a.player_tag === key,
    } as unknown as Record<string, unknown>);
  }
}

export async function getActiveAccount(): Promise<AccountRecord | undefined> {
  const all = await getAll<AccountRecord>(STORE_ACCOUNTS);
  return all.find((a) => a.active) || all[0];
}

export async function loadAllAccounts(): Promise<AccountRecord[]> {
  const all = await getAll<AccountRecord>(STORE_ACCOUNTS);
  return all.sort(
    (a, b) => new Date(b.last_import_time).getTime() - new Date(a.last_import_time).getTime()
  );
}

export async function getAccount(playerTag: string): Promise<AccountRecord | undefined> {
  return await get<AccountRecord>(STORE_ACCOUNTS, accountKey(playerTag));
}

export async function deleteAccount(playerTag: string): Promise<void> {
  await del(STORE_ACCOUNTS, accountKey(playerTag));
}

export async function clearAccounts(): Promise<void> {
  await clear(STORE_ACCOUNTS);
}

// ── 一次性恢复全部状态（Part 8 自动恢复）──
export interface RestoredState {
  upgrades: RawUpgradeRecord[];
  userData: UserRecord | undefined;
  settings: SchedulerSettings;
  notifyConfig: NotifyConfig;
  village?: VillageRecord;
}

export async function loadAll(): Promise<RestoredState> {
  const [upgrades, userData, settings, notifyConfig, village] = await Promise.all([
    loadUpgrades(),
    loadUserData(),
    loadSettings(),
    loadNotifyConfig(),
    loadVillage(),
  ]);
  return { upgrades, userData, settings, notifyConfig, village };
}

// ── 重置全部数据 ────────────────────────────
export async function resetAll(): Promise<void> {
  const stores = [
    STORE_UPGRADES, STORE_USER_DATA, STORE_HISTORY,
    STORE_NOTIFY_CONFIG, STORE_NOTIFY_STATE, STORE_SETTINGS,
    STORE_VILLAGE, STORE_JSON_HISTORY, STORE_ACCOUNTS,
  ];
  await Promise.all(stores.map((s) => clear(s)));
  _db = null;
}
