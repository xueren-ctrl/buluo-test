#!/usr/bin/env node
/**
 * 部落冲突升级助手 - 一键发布系统
 * ============================================================
 * 用法：
 *   npm run release           # 仅校验 + 构建当前版本并发布
 *   npm run release:patch     # 1.1.0 → 1.1.1
 *   npm run release:minor     # 1.1.0 → 1.2.0
 *   npm run release:major     # 1.1.0 → 2.0.0
 *   node scripts/release.js --check   # 只做版本一致性校验，不构建不发布
 *   node scripts/release.js --dry-run # 模拟全流程，不真正 push / 发 Release
 *
 * 环境变量：
 *   GITHUB_TOKEN  GitHub PAT（需 repo 权限）。若已装 gh CLI 并登录可不设。
 *
 * 流程：
 *   1. 读取并校验三处版本号一致（frontend/package.json / version.json / android build.gradle）
 *   2. 可选 bump 版本号（同步更新三处 + versionCode +1）
 *   3. 构建 Web（frontend: npm install && npm run build）
 *   4. Capacitor 同步（npx cap sync android）
 *   5. 构建 APK（gradlew assembleRelease）
 *   6. 检测 APK 产物
 *   7. 生成 Release Note（从 git log 按约定式提交分类）
 *   8. 创建 GitHub Release 并上传 APK（gh CLI 优先，回退 REST API）
 *   9. 更新 version.json（version / apkUrl / changelog / publish time）
 *  10. git commit + push
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

// ── 路径 ────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const ANDROID = path.join(ROOT, "android");
const APK_DIR = path.join(ANDROID, "app", "build", "outputs", "apk", "release");
const FRONTEND_PKG = path.join(FRONTEND, "package.json");
const VERSION_JSON = path.join(ROOT, "version.json");
const BUILD_GRADLE = path.join(ANDROID, "app", "build.gradle");

const GITHUB_REPO_FALLBACK = "xueren-ctrl/buluo";

// ── 日志 ────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m",
  cyan: "\x1b[36m", magenta: "\x1b[35m",
};
const tag = (k, msg, color = C.cyan) => console.log(`${color}[${k}]${C.reset} ${msg}`);

function step(label, msg) { console.log(`\n${C.bold}${C.magenta}━━━ ${label} ━━━${C.reset} ${C.dim}${msg}${C.reset}`); }
function ok(msg)   { console.log(`${C.green}  ✓${C.reset} ${msg}`); }
function warn(msg) { console.log(`${C.yellow}  !${C.reset} ${msg}`); }
function fail(msg, code = 1) {
  console.error(`${C.red}  ✗${C.reset} ${msg}`);
  process.exit(code);
}

// ── 工具 ────────────────────────────────
function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n"); }

function run(label, cmd, opts = {}) {
  const { cwd = ROOT, shell = true, env } = opts;
  console.log(`${C.cyan}[BUILD]${C.reset} ${label}`);
  console.log(`${C.dim}  $ ${cmd}${C.reset}`);
  const r = spawnSync(cmd, { cwd, shell, stdio: "inherit", windowsHide: true, env: env ? { ...process.env, ...env } : process.env });
  if (r.status !== 0) fail(`${label} 失败 (exit ${r.status})`);
  ok(`${label} 完成`);
}

function runQuiet(cmd, opts = {}) {
  try { return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim(); }
  catch { return ""; }
}

// ── 版本号读取 ──────────────────────────
function readVersions() {
  const pkg = readJSON(FRONTEND_PKG);
  const vj = readJSON(VERSION_JSON);
  const gradle = fs.readFileSync(BUILD_GRADLE, "utf8");
  const mCode = gradle.match(/versionCode\s+(\d+)/);
  const mName = gradle.match(/versionName\s+"([^"]+)"/);
  return {
    pkg: pkg.version,
    versionJson: vj.version,
    versionCode: mCode ? parseInt(mCode[1], 10) : null,
    versionName: mName ? mName[1] : null,
  };
}

function validateVersions(v) {
  step("1/10", "版本号一致性校验");
  console.log(`  frontend/package.json : ${v.pkg}`);
  console.log(`  version.json         : ${v.versionJson}`);
  console.log(`  build.gradle         : versionName=${v.versionName}  versionCode=${v.versionCode}`);
  const consistent = v.pkg && v.pkg === v.versionJson && v.pkg === v.versionName;
  if (!consistent) {
    fail(`版本号不一致！\n  package.json=${v.pkg}\n  version.json=${v.versionJson}\n  build.gradle.versionName=${v.versionName}\n请先手动统一三处版本号，或使用 npm run release:patch/minor/major 自动对齐。`);
  }
  if (!v.versionCode) fail("无法读取 build.gradle 的 versionCode");
  ok(`三处版本号一致：v${v.pkg} (versionCode=${v.versionCode})`);
}

// ── 版本号 bump ─────────────────────────
function bumpVersion(v, type) {
  const parts = v.split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (type === "major") return `${parts[0] + 1}.0.0`;
  if (type === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  if (type === "patch") return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  return v;
}

function applyBump(newVer, newCode) {
  step("2/10", `升级版本号 → v${newVer} (versionCode=${newCode})`);
  // 1) frontend/package.json
  const pkg = readJSON(FRONTEND_PKG); pkg.version = newVer; writeJSON(FRONTEND_PKG, pkg);
  // 2) 根 package.json（保持一致）
  const rootPkg = readJSON(path.join(ROOT, "package.json")); rootPkg.version = newVer; writeJSON(path.join(ROOT, "package.json"), rootPkg);
  // 3) version.json
  const vj = readJSON(VERSION_JSON); vj.version = newVer; writeJSON(VERSION_JSON, vj);
  // 4) build.gradle
  let g = fs.readFileSync(BUILD_GRADLE, "utf8");
  g = g.replace(/(\bversionCode\s+)(\d+)/, `$1${newCode}`);
  g = g.replace(/(\bversionName\s+")([^"]+)(")/, `$1${newVer}$3`);
  fs.writeFileSync(BUILD_GRADLE, g);
  ok(`已同步更新四处版本号`);
}

// ── Git 状态校验 ────────────────────────
function checkGitClean() {
  const status = runQuiet("git status --porcelain");
  if (status) {
    fail(`工作区不干净，请先提交或 stash 以下改动：\n${status}`);
  }
  ok("Git 工作区干净");
}

// ── 构建 Web ────────────────────────────
function buildWeb() {
  step("3/10", "构建 PWA (frontend)");
  run("npm install", "npm install", { cwd: FRONTEND });
  run("next build", "npm run build", { cwd: FRONTEND });
}

// ── Capacitor 同步 ──────────────────────
function capSync() {
  step("4/10", "Capacitor 同步到 Android");
  run("cap sync android", "npx cap sync android", { cwd: FRONTEND });
}

// ── 探测 JAVA_HOME（gradlew 依赖）────────
// 优先用系统 JAVA_HOME；没有则从注册表/常见路径找 Android Studio 自带 JBR
function detectJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, "bin", "java.exe"))) {
    return process.env.JAVA_HOME;
  }
  if (os.platform() === "win32") {
    const reg = runQuiet('powershell -NoProfile -Command "try { (Get-ItemProperty \'HKLM:\\SOFTWARE\\Android Studio\').Path } catch {}; try { (Get-ItemProperty \'HKCU:\\SOFTWARE\\Google\\AndroidStudio\').Path } catch {}"');
    const asPath = reg.split("\n").map((s) => s.trim()).find(Boolean);
    if (asPath) {
      const jbr = path.join(asPath, "jbr");
      if (fs.existsSync(path.join(jbr, "bin", "java.exe"))) return jbr;
    }
    const candidates = [
      "F:\\Android Studio\\jbr",
      "D:\\Android Studio\\jbr",
      "C:\\Program Files\\Android\\Android Studio\\jbr",
      "C:\\Program Files\\Android\\Android Studio\\jre",
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, "bin", "java.exe"))) return c;
    }
  } else {
    for (const c of ["/opt/android-studio/jbr", "/Applications/Android Studio.app/Contents/jbr/Contents/Home"]) {
      if (fs.existsSync(path.join(c, "bin", "java"))) return c;
    }
  }
  return null;
}

// ── 探测 Android SDK（gradlew 依赖）─────
function detectAndroidSdk() {
  const envVars = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  for (const v of envVars) { if (v && fs.existsSync(path.join(v, "platforms"))) return v; }
  // 读 local.properties
  try {
    const lp = fs.readFileSync(path.join(ANDROID, "local.properties"), "utf8");
    const m = lp.match(/^sdk\.dir\s*=\s*(.+)$/m);
    if (m && fs.existsSync(path.join(m[1].trim(), "platforms"))) return m[1].trim();
  } catch {}
  // 常见路径
  const home = os.homedir();
  const candidates = [
    path.join(home, "AppData", "Local", "Android", "Sdk"),
    "C:\\Android\\Sdk", "D:\\Android\\Sdk", "F:\\Android\\Sdk",
    `/Users/${os.userInfo().username}/Library/Android/sdk`,
    "/usr/local/lib/android/sdk",
  ];
  for (const c of candidates) { if (fs.existsSync(path.join(c, "platforms"))) return c; }
  return null;
}

// ── 构建 APK ────────────────────────────
function buildApk() {
  step("5/10", "构建 Android APK");
  const isWin = os.platform() === "win32";
  const gradlew = isWin ? "gradlew.bat" : "./gradlew";
  const javaHome = detectJavaHome();
  const androidSdk = detectAndroidSdk();
  const env = {};
  if (javaHome) { env.JAVA_HOME = javaHome; ok(`JAVA_HOME = ${javaHome}`); }
  else warn("未检测到 JAVA_HOME，将依赖系统环境变量（若 gradle 失败请先设置 JAVA_HOME 指向 Android Studio 的 jbr）");
  if (androidSdk) { env.ANDROID_HOME = androidSdk; env.ANDROID_SDK_ROOT = androidSdk; ok(`ANDROID_HOME = ${androidSdk}`); }
  else warn("未检测到 Android SDK，将依赖 local.properties（若 gradle 失败请在 android/local.properties 配置 sdk.dir）");
  run("assembleRelease", `${gradlew} assembleRelease`, { cwd: ANDROID, env: Object.keys(env).length ? env : undefined });
}

// ── APK 检测 ────────────────────────────
function findApk() {
  step("6/10", "检测 APK 产物");
  if (!fs.existsSync(APK_DIR)) fail(`APK 目录不存在：${APK_DIR}`);
  // 优先 app-release.apk（已签名），回退 app-release-unsigned.apk
  const candidates = ["app-release.apk", "app-release-unsigned.apk"];
  let apkPath = null;
  for (const c of candidates) {
    const p = path.join(APK_DIR, c);
    if (fs.existsSync(p)) { apkPath = p; break; }
  }
  if (!apkPath) {
    // 列出目录里所有 apk 辅助排查
    const all = fs.readdirSync(APK_DIR).filter((f) => f.endsWith(".apk"));
    fail(`未找到 release APK。目录内 apk：${all.join(", ") || "（空）"}`);
  }
  const isUnsigned = path.basename(apkPath).includes("unsigned");
  const size = fs.statSync(apkPath).size;
  const mb = (size / 1024 / 1024).toFixed(1);
  ok(`APK: ${apkPath} (${mb} MB)`);
  if (isUnsigned) {
    warn("检测到【未签名】APK！该包无法在用户设备上覆盖安装。");
    warn("请为 android/app/build.gradle 的 release 配置 signingConfigs（keystore）后再发布。");
  }
  return apkPath;
}

// ── Release Note 生成（约定式提交）──────
function todayCN() {
  return new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
}

function generateChangelog(newVersion, prevTag) {
  step("7/10", "生成 Release Note");
  const range = prevTag ? `${prevTag}..HEAD` : "-20";
  const log = runQuiet(`git log ${range} --pretty=format:"%s" --no-merges`) || "";
  const lines = log.split("\n").map((l) => l.trim()).filter(Boolean);

  const added = [], fixed = [], improved = [], others = [];
  for (const l of lines) {
    if (/^(feat|add|新增|添加|feature)[:\s]/i.test(l)) added.push(l.replace(/^[^:：]*[:：]\s*/, ""));
    else if (/^(fix|修复|bugfix|hotfix)[:\s]/i.test(l)) fixed.push(l.replace(/^[^:：]*[:：]\s*/, ""));
    else if (/^(perf|refactor|opt|优化|改进|chore|style|docs)[:\s]/i.test(l)) improved.push(l.replace(/^[^:：]*[:：]\s*/, ""));
    else others.push(l);
  }

  const md = [];
  md.push(`## v${newVersion} (${todayCN()})`);
  if (added.length)    { md.push("\n### 新增"); added.forEach((x) => md.push(`- ${x}`)); }
  if (fixed.length)    { md.push("\n### 修复"); fixed.forEach((x) => md.push(`- ${x}`)); }
  if (improved.length) { md.push("\n### 优化"); improved.forEach((x) => md.push(`- ${x}`)); }
  if (others.length && !added.length && !fixed.length && !improved.length) {
    md.push("\n### 其他"); others.forEach((x) => md.push(`- ${x}`));
  }
  if (lines.length === 0) md.push("\n- 维护版本发布");

  const note = md.join("\n");
  console.log(C.dim + note + C.reset);
  ok("Release Note 生成完毕");
  return { note, notes: { added, fixed, improved } };
}

// ── GitHub Release ──────────────────────
function getRepo() {
  const url = runQuiet("git remote get-url origin");
  const m = url && url.match(/github\.com[:/]([^/]+)\/([^.\s]+)/);
  return m ? `${m[1]}/${m[2]}` : GITHUB_REPO_FALLBACK;
}

function hasGhCli() {
  return !!runQuiet("gh --version");
}

function createGitHubRelease(tagName, apkPath, note, isDryRun) {
  step("8/10", `创建 GitHub Release: ${tagName}`);
  const repo = getRepo();
  console.log(`  repo: ${repo}`);

  if (isDryRun) { warn("--dry-run: 跳过实际创建 Release"); return `https://github.com/${repo}/releases/tag/${tagName}`; }

  if (hasGhCli()) {
    const noteFile = path.join(os.tmpdir(), `buluo-release-note-${Date.now()}.md`);
    fs.writeFileSync(noteFile, note, "utf8");
    try {
      execSync(
        `gh release create "${tagName}" "${apkPath}" --repo "${repo}" --title "${tagName}" --notes-file "${noteFile}"`,
        { cwd: ROOT, stdio: "inherit", windowsHide: true }
      );
      ok(`GitHub Release 已创建（gh CLI）`);
      return `https://github.com/${repo}/releases/tag/${tagName}`;
    } catch (e) {
      warn(`gh CLI 创建失败，回退到 REST API: ${e.message}`);
    } finally {
      try { fs.unlinkSync(noteFile); } catch {}
    }
  }

  // 回退：REST API + GITHUB_TOKEN
  const token = process.env.GITHUB_TOKEN;
  if (!token) fail("未找到 GITHUB_TOKEN 环境变量，且 gh CLI 不可用/未登录。请设置 GITHUB_TOKEN 或登录 gh。");
  const [owner, name] = repo.split("/");
  return createGitHubReleaseAsync(token, owner, name, repo, tagName, apkPath, note);
}

async function createGitHubReleaseAsync(token, owner, name, repo, tagName, apkPath, note) {
  // 创建 release
  const createRes = await fetch(`https://api.github.com/repos/${owner}/${name}/releases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "buluo-release-script",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tag_name: tagName, name: tagName, body: note, draft: false, prerelease: false }),
  });
  if (!createRes.ok) {
    const t = await createRes.text();
    fail(`创建 Release 失败 (${createRes.status}): ${t}`);
  }
  const release = await createRes.json();
  ok(`Release 已创建 (id=${release.id})`);

  // 上传 APK asset
  const uploadBase = release.upload_url.replace(/\{[^}]*\}$/, "");
  const apkBuf = fs.readFileSync(apkPath);
  const apkName = `buluo-${tagName.replace(/^v/, "")}.apk`;
  const upRes = await fetch(`${uploadBase}?name=${encodeURIComponent(apkName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": Buffer.byteLength(apkBuf),
    },
    body: apkBuf,
  });
  if (!upRes.ok) {
    const t = await upRes.text();
    warn(`APK 上传失败 (${upRes.status}): ${t}（Release 已创建，可手动上传 APK）`);
  } else {
    ok(`APK 已上传: ${apkName}`);
  }
  return `https://github.com/${repo}/releases/tag/${tagName}`;
}

// ── 更新 version.json ──────────────────
function updateVersionJson(newVersion, apkUrl, notes) {
  step("9/10", "更新 version.json");
  const vj = readJSON(VERSION_JSON);
  vj.version = newVersion;
  vj.apkUrl = apkUrl;
  const allNotes = [...(notes.added || []).map((x) => x), ...(notes.fixed || []).map((x) => x), ...(notes.improved || []).map((x) => x)];
  const entry = { version: newVersion, date: todayCN(), notes: allNotes.length ? allNotes : ["维护版本发布"] };
  const changelog = Array.isArray(vj.changelog) ? vj.changelog : [];
  // 去重：移除同版本旧条目，置顶新条目
  const filtered = changelog.filter((e) => e.version !== newVersion);
  vj.changelog = [entry, ...filtered];
  writeJSON(VERSION_JSON, vj);
  ok("version.json 已更新");
}

// ── Git 提交 & 推送 ────────────────────
function gitCommitPush(newVersion, isDryRun) {
  step("10/10", "提交并推送代码");
  if (isDryRun) { warn("--dry-run: 跳过 git commit/push"); return; }
  run("git add", "git add frontend/package.json package.json version.json android/app/build.gradle", { cwd: ROOT });
  // 若有未跟踪的构建相关文件也一并加入（保守：仅版本相关文件已在上一行，这里再 add 全部改动）
  run("git commit", `git commit -m "release v${newVersion}"`, { cwd: ROOT });
  run("git push", "git push", { cwd: ROOT });
  ok("代码已推送");
}

// ── 主流程 ──────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const bumpType = argv.find((a) => ["patch", "minor", "major"].includes(a)) || null;
  const dryRun = argv.includes("--dry-run");
  const checkOnly = argv.includes("--check");

  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║  部落冲突升级助手 - 一键发布系统         ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}`);
  if (dryRun)    warn("【DRY-RUN 模式】不会真正 push / 发 Release");
  if (bumpType)  console.log(`${C.dim}  目标升级类型：${bumpType}${C.reset}`);

  // 1. 版本校验
  const v = readVersions();
  validateVersions(v);

  if (checkOnly) { ok("版本校验通过（--check 完成）"); return; }

  // Git 干净检查（bump 前）
  step("0/10", "Git 工作区检查");
  checkGitClean();

  // 2. 可选 bump
  let currentVersion = v.pkg;
  let versionCode = v.versionCode;
  if (bumpType) {
    const newVer = bumpVersion(currentVersion, bumpType);
    const newCode = versionCode + 1;
    applyBump(newVer, newCode);
    currentVersion = newVer;
    versionCode = newCode;
  }

  // 3-5. 构建
  buildWeb();
  capSync();
  buildApk();

  // 6. APK
  const apkPath = findApk();

  // 7. changelog（找上一个 tag 作基准）
  const prevTag = runQuiet("git describe --tags --abbrev=0") || null;
  if (prevTag) console.log(`  上一个 tag: ${prevTag}`);
  const { note, notes } = generateChangelog(currentVersion, prevTag);

  // 8. GitHub Release
  const tagName = `v${currentVersion}`;
  const apkUrl = await createGitHubRelease(tagName, apkPath, note, dryRun);

  // 9. version.json
  updateVersionJson(currentVersion, apkUrl, notes);

  // 10. push
  gitCommitPush(currentVersion, dryRun);

  console.log(`\n${C.bold}${C.green}╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.green}║  [SUCCESS] release v${currentVersion} completed   ║${C.reset}`);
  console.log(`${C.bold}${C.green}╚══════════════════════════════════════════╝${C.reset}`);
  console.log(`  PWA 将由 Cloudflare 在 push 后自动部署`);
  console.log(`  APK : ${apkUrl}`);
  console.log(`  APP 端 checkForUpdate() 将自动检测到新版本并提示升级\n`);
}

main().catch((e) => fail(`发布异常: ${e && e.stack ? e.stack : e}`));
