/**
 * 统一更新检查器（PWA + Android APK 共用）
 * ============================================
 * 双端共用同一套检查/缓存/比较逻辑，仅"数据源"不同：
 *
 *  - Android APP（Capacitor 原生平台）：
 *      读取 GitHub Releases API，自动挑选 APK 资源下载
 *      → 见 fetchLatestRelease()
 *
 *  - PWA（Cloudflare Pages，Web 平台）：
 *      读取部署在 Cloudflare 的 version.json（根目录 version.json 拷贝到 frontend/public）
 *      → 见 fetchVersionManifest()
 *
 * 由 checkForUpdate() 根据 Capacitor 平台自动分流，对外返回形状一致的
 * UpdateCheckResult，UI（settings 页）无需感知差异。
 *
 * 缓存策略：
 *  - localStorage 缓存最近一次"源数据"6 小时，避免重复网络请求
 *  - 网络失败时回退到缓存（即使过期），保证离线可用
 *
 * 版本号来源：
 *  - CURRENT_VERSION 由 frontend/next.config.js 注入 NEXT_PUBLIC_APP_VERSION
 *    （来自 frontend/package.json.version），PWA 与 APK 构建时一致
 */

import { Capacitor } from "@capacitor/core";
import { log, warn } from "./logger";

export const GITHUB_REPO = "xueren-ctrl/buluo";
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时

// version.json 拉取地址：
//  - 主源：PWA 当前站点同源 /version.json（Cloudflare Pages 部署，零跨域、最快）
//  - 备源：GitHub raw（站点未部署 version.json 或 CDN 未刷新时兜底）
export const VERSION_JSON_PRIMARY = "/version.json";
export const VERSION_JSON_FALLBACK = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json`;

// ── 当前版本号 ────────────────────────────
export const CURRENT_VERSION =
  (process.env.NEXT_PUBLIC_APP_VERSION as string) || "1.0.0";

// ── Release / Manifest 类型 ───────────────
export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type: string;
  size: number;
  download_count: number;
}

export interface ReleaseInfo {
  tag_name: string;          // e.g. "v1.1.0"
  name: string;              // release 标题
  body: string;               // 更新日志（Markdown）
  published_at: string;       // ISO 时间
  html_url: string;           // release 页面 URL
  assets: GitHubAsset[];      // 附带资源（含 APK）
  prerelease: boolean;
  draft: boolean;
}

/** version.json 中的单条 changelog 条目 */
export interface ChangelogEntry {
  version: string;
  date?: string;
  notes?: string[];
}

/** version.json 结构（PWA 更新源） */
export interface VersionManifest {
  version: string;        // e.g. "1.1.0"（不带 v 前缀）
  apkUrl?: string;        // APK 下载/Release 页面地址
  changelog?: ChangelogEntry[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;        // 不带 v 前缀
  latestTag: string;            // 带 v 前缀
  release?: ReleaseInfo;        // 统一形状（PWA 模式下由 manifest 合成）
  apkUrl?: string;              // 自动选中的 APK 下载地址
  apkSize?: number;             // APK 字节数（PWA 模式无）
  error?: string;
  fromCache: boolean;
  checkedAt: string;            // ISO 时间
  source: "github" | "version-json";  // 本次结果来源
}

// ── 版本号比较 ──────────────────────────
export function compareVersions(a: string, b: string): number {
  const normalize = (v: string) => v.replace(/^v/, "").trim();
  const parseVersion = (v: string) => {
    const parts = normalize(v).split(/[.-]/);
    return {
      major: parseInt(parts[0] || "0", 10) || 0,
      minor: parseInt(parts[1] || "0", 10) || 0,
      patch: parseInt(parts[2] || "0", 10) || 0,
      pre: parts.slice(3).join("."),
    };
  };
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  if (va.pre && vb.pre) return va.pre < vb.pre ? -1 : va.pre > vb.pre ? 1 : 0;
  return 0;
}

export function isNewerVersion(latestTag: string, currentVersion: string): boolean {
  return compareVersions(latestTag, currentVersion) > 0;
}

// ── 缓存（localStorage，双端共用）──────────────
const CACHE_KEY = "coc_update_cache";

interface CacheEntry {
  release: ReleaseInfo;   // PWA 模式存的是 manifest 合成的 release
  source: "github" | "version-json";
  checkedAt: number;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (typeof entry.checkedAt !== "number" || typeof entry.release !== "object") return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(release: ReleaseInfo, source: "github" | "version-json"): void {
  try {
    const entry: CacheEntry = { release, source, checkedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage 满了或不可用 — 忽略
  }
}

export function clearUpdateCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
}

export function getLastCacheTime(): number | null {
  const c = readCache();
  return c ? c.checkedAt : null;
}

// ── 平台检测 ────────────────────────────
/** 是否运行在 Capacitor 原生壳内（Android APK） */
export function isNativeApp(): boolean {
  try {
    return typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ── 从 GitHub Release 中挑选 APK 资源 ─────────
export function pickApkAsset(release: ReleaseInfo): GitHubAsset | undefined {
  const apks = release.assets.filter((a) =>
    a.name.toLowerCase().endsWith(".apk")
  );
  if (apks.length === 0) return undefined;

  const arm64 = apks.find((a) =>
    a.name.toLowerCase().includes("arm64") ||
    a.name.toLowerCase().includes("arm-v8") ||
    a.name.toLowerCase().includes("armv8")
  );
  if (arm64) return arm64;

  const universal = apks.find((a) =>
    a.name.toLowerCase().includes("universal")
  );
  if (universal) return universal;

  return apks.sort((a, b) => b.size - a.size)[0];
}

// ── version.json → 合成 ReleaseInfo（让 UI 形状一致）──
function changelogToMarkdown(manifest: VersionManifest): string {
  const entries = manifest.changelog ?? [];
  if (entries.length === 0) {
    return `## v${manifest.version}\n\n（详见 Release 说明）`;
  }
  return entries
    .map((e) => {
      const head = `## v${e.version}${e.date ? ` (${e.date})` : ""}`;
      const items = (e.notes ?? []).map((n) => `- ${n}`).join("\n");
      return items ? `${head}\n\n${items}` : head;
    })
    .join("\n\n");
}

function manifestToRelease(manifest: VersionManifest): ReleaseInfo {
  return {
    tag_name: `v${manifest.version}`,
    name: `v${manifest.version}`,
    body: changelogToMarkdown(manifest),
    published_at: manifest.changelog?.[0]?.date
      ? new Date(manifest.changelog[0].date as unknown as string).toISOString()
      : new Date().toISOString(),
    html_url: manifest.apkUrl || GITHUB_RELEASES_PAGE,
    assets: [],
    prerelease: false,
    draft: false,
  };
}

// ── 拉取 GitHub Release（APK 模式）─────────────
async function fetchLatestRelease(force: boolean): Promise<{ release: ReleaseInfo; source: "github" } | null> {
  if (!force) {
    const cached = readCache();
    if (cached && cached.source === "github" && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      log(`update-checker: GitHub 源命中缓存（${Math.round((Date.now() - cached.checkedAt) / 60000)} 分钟前）`);
      return { release: cached.release, source: "github" };
    }
  }

  try {
    log(`update-checker: 请求 GitHub API: ${GITHUB_API_URL}`);
    const res = await fetch(GITHUB_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "coc-upgrade-app/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      warn("update-checker: GitHub 返回 404，仓库可能还没有 release");
      return null;
    }
    if (res.status === 403 || res.status === 429) {
      warn("update-checker: GitHub API 限流（403/429），稍后再试");
      const cached = readCache();
      return cached && cached.source === "github" ? { release: cached.release, source: "github" } : null;
    }
    if (!res.ok) {
      warn(`update-checker: GitHub API 非 200 响应: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as ReleaseInfo;
    if (!data.tag_name) {
      warn("update-checker: 响应缺少 tag_name 字段");
      return null;
    }
    writeCache(data, "github");
    log(`update-checker: GitHub 拉取成功，最新版本 ${data.tag_name}`);
    return { release: data, source: "github" };
  } catch (e) {
    warn("update-checker: GitHub 网络请求失败", e);
    const cached = readCache();
    return cached && cached.source === "github" ? { release: cached.release, source: "github" } : null;
  }
}

// ── 拉取 version.json（PWA 模式）──────────────
async function fetchVersionManifest(force: boolean): Promise<{ release: ReleaseInfo; manifest: VersionManifest; source: "version-json" } | null> {
  if (!force) {
    const cached = readCache();
    if (cached && cached.source === "version-json" && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      log(`update-checker: version.json 源命中缓存（${Math.round((Date.now() - cached.checkedAt) / 60000)} 分钟前）`);
      // 缓存只存了 release，manifest 用 release 反推 apkUrl
      return { release: cached.release, manifest: { version: cached.release.tag_name.replace(/^v/, ""), apkUrl: cached.release.html_url }, source: "version-json" };
    }
  }

  const urls = [VERSION_JSON_PRIMARY, VERSION_JSON_FALLBACK];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      log(`update-checker: 请求 version.json: ${url}`);
      const res = await fetch(url, {
        method: "GET",
        cache: "no-cache",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        warn(`update-checker: version.json 响应 ${res.status}（${url}）`);
        continue;
      }
      const data = (await res.json()) as VersionManifest;
      if (!data.version) {
        warn("update-checker: version.json 缺少 version 字段");
        continue;
      }
      const release = manifestToRelease(data);
      writeCache(release, "version-json");
      log(`update-checker: version.json 拉取成功，最新版本 v${data.version}`);
      return { release, manifest: data, source: "version-json" };
    } catch (e) {
      warn(`update-checker: version.json 请求失败（${url}）`, e);
    }
  }

  // 全部源失败：回退缓存
  const cached = readCache();
  if (cached && cached.source === "version-json") {
    return { release: cached.release, manifest: { version: cached.release.tag_name.replace(/^v/, ""), apkUrl: cached.release.html_url }, source: "version-json" };
  }
  return null;
}

// ── 主入口：检查更新（自动按平台分流）──────────
/**
 * 检查更新
 * - Android APK：查 GitHub Releases，返回 APK 下载地址
 * - PWA（Web）：查 version.json，返回 apkUrl（指向 Release 页）
 * @param force 是否跳过缓存强制刷新（默认 false）
 */
export async function checkForUpdate(force = false): Promise<UpdateCheckResult> {
  const checkedAt = new Date().toISOString();
  const native = isNativeApp();

  // APK 模式
  if (native) {
    const result = await fetchLatestRelease(force);
    if (!result) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        latestTag: `v${CURRENT_VERSION}`,
        fromCache: false,
        checkedAt,
        source: "github",
        error: "无法获取最新版本信息（可能是离线或 GitHub 不可达）",
      };
    }
    const { release, source } = result;
    const hasUpdate = isNewerVersion(release.tag_name, CURRENT_VERSION);
    const apk = pickApkAsset(release);
    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion: release.tag_name.replace(/^v/, ""),
      latestTag: release.tag_name,
      release,
      apkUrl: apk?.browser_download_url,
      apkSize: apk?.size,
      fromCache: !!readCache() && !force,
      checkedAt,
      source,
    };
  }

  // PWA 模式
  const result = await fetchVersionManifest(force);
  if (!result) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      latestTag: `v${CURRENT_VERSION}`,
      fromCache: false,
      checkedAt,
      source: "version-json",
      error: "无法获取最新版本信息（可能是离线或 version.json 不可达）",
    };
  }
  const { release, manifest, source } = result;
  const hasUpdate = isNewerVersion(release.tag_name, CURRENT_VERSION);
  return {
    hasUpdate,
    currentVersion: CURRENT_VERSION,
    latestVersion: manifest.version,
    latestTag: release.tag_name,
    release,
    apkUrl: manifest.apkUrl,
    fromCache: !!readCache() && !force,
    checkedAt,
    source,
  };
}

// ── 打开 APK 下载链接（让 Android 系统接管）──
export function openApkDownload(url: string): void {
  if (typeof window === "undefined") return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

// ── 跳转到 GitHub Releases 页面（备用）──
export function openReleasesPage(): void {
  openApkDownload(GITHUB_RELEASES_PAGE);
}

// ── 格式化 APK 大小 ────────────────────
export function formatApkSize(bytes: number): string {
  if (bytes <= 0) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── 格式化发布时间 ────────────────────
export function formatPublishedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── 仅 Markdown → 简易 HTML（用于弹窗展示更新日志）──
export function renderMarkdown(md: string): string {
  if (!md) return "";
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const level = h[1].length;
      out.push(`<h${level}>${escapeHtml(h[2])}</h${level}>`);
      continue;
    }
    const li = line.match(/^\s*[-*+]\s+(.*)$/);
    if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${escapeHtml(li[1])}</li>`);
      continue;
    }
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
