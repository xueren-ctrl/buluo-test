/**
 * IndexedDB 本地存储层
 * 替代 localStorage，用于离线持久化升级数据
 */

// ── 数据库常量 ──────────────────────────────
const DB_NAME = "CocUpgradeDB";
const DB_VERSION = 1;
const STORE_UPGRADES = "upgrades";
const STORE_USER_DATA = "userData";
const STORE_HISTORY = "history";
const STORE_NOTIFY_CONFIG = "notifyConfig";

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
  client_id: string;
  player_tag: string | null;
  player_name: string | null;
  last_json_raw: string | null;
  last_upload_at: string | null;
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
  pwaPushEnabled: boolean;
}

// ── DB 句柄 ─────────────────────────────────
let _db: IDBDatabase | null = null;

function open(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
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

// ── 业务接口 ────────────────────────────────

// 升级项 CRUD
export async function saveUpgrades(upgrades: RawUpgradeRecord[]): Promise<void> {
  await clear(STORE_UPGRADES);
  for (const u of upgrades) {
    const { id, ...record } = u;
    await put(STORE_UPGRADES, record);
  }
}

export async function loadUpgrades(): Promise<RawUpgradeRecord[]> {
  return await getAll<RawUpgradeRecord>(STORE_UPGRADES);
}

// 用户数据 CRUD
export async function saveUserData(data: UserRecord): Promise<void> {
  await put(STORE_USER_DATA, { ...data, uid: "default" });
}

export async function loadUserData(): Promise<UserRecord | undefined> {
  return await get<UserRecord>(STORE_USER_DATA, "default");
}

// 历史记录 CRUD
export async function addHistory(entry: Omit<HistoryRecord, "id">): Promise<void> {
  const id = `${entry.category}-${entry.completed_at}-${Date.now()}`;
  await put(STORE_HISTORY, { ...entry, id });
}

export async function loadHistory(limit = 50): Promise<HistoryRecord[]> {
  const all = await getAll<HistoryRecord>(STORE_HISTORY);
  return all.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()).slice(0, limit);
}

// 通知配置 CRUD
export async function saveNotifyConfig(cfg: NotifyConfig): Promise<void> {
  await put(STORE_NOTIFY_CONFIG, { key: "notifyConfig", ...cfg });
}

export async function loadNotifyConfig(): Promise<NotifyConfig> {
  const existing = await get<NotifyConfig>(STORE_NOTIFY_CONFIG, "notifyConfig");
  if (existing) return existing;
  const fallback: NotifyConfig = {
    browserNotifEnabled: false,
    pwaPushEnabled: false,
  };
  await put(STORE_NOTIFY_CONFIG, { key: "notifyConfig", ...fallback });
  return fallback;
}

// 重置全部数据
export async function resetAll(): Promise<void> {
  const db = await open();
  const stores = [STORE_UPGRADES, STORE_USER_DATA, STORE_HISTORY, STORE_NOTIFY_CONFIG];
  await Promise.all(stores.map((s) => clear(s)));
  _db = null;
}
