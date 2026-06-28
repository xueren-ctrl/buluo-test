/**
 * Android 图标资源生成器
 * ============================================
 * 从 public/icons/icon-512.svg 生成 Android 工程所需的所有图标资源：
 *  - mipmap-XXX/ic_launcher.png + ic_launcher_round.png   APP 图标
 *  - mipmap-XXX/ic_launcher_foreground.png                Adaptive Icon 前景
 *  - drawable-XXX/ic_stat_icon.png                        通知小图标（白色剪影）
 *
 * 用法: node scripts/generate-android-icons.mjs
 * 依赖: sharp (devDependency)
 */
import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(__dirname, "..");
const SOURCE_SVG = resolve(FRONTEND, "public", "icons", "icon-512.svg");
const ANDROID_RES = resolve(FRONTEND, "android", "app", "src", "main", "res");

// 通知小图标：纯白盾牌剪影（Android 状态栏小图标必须是单色 alpha 剪影）
const NOTIFICATION_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 80 L380 140 L380 260 Q380 360 256 420 Q132 360 132 260 L132 140 Z" fill="#ffffff"/>
</svg>`;

// Adaptive Icon 前景：盾牌居中，留 25% 安全边距
const FOREGROUND_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- 居中 70% 区域，留安全边距 -->
  <g transform="translate(76.8 76.8) scale(0.7)">
    <path d="M256 80 L380 140 L380 260 Q380 360 256 420 Q132 360 132 260 L132 140 Z" fill="url(#shield)" stroke="#818cf8" stroke-width="8"/>
    <path d="M256 120 L340 165 L340 255 Q340 330 256 380 Q172 330 172 255 L172 165 Z" fill="#1e293b" stroke="#6366f1" stroke-width="4"/>
    <text x="256" y="280" text-anchor="middle" fill="#fff" font-size="120" font-weight="bold" font-family="Arial, sans-serif">C</text>
    <text x="256" y="360" text-anchor="middle" fill="#94a3b8" font-size="40" font-family="Arial, sans-serif">CoC</text>
  </g>
</svg>`;

mkdirSync(ANDROID_RES, { recursive: true });

const svgBuffer = readFileSync(SOURCE_SVG);
const notifSvgBuffer = Buffer.from(NOTIFICATION_SVG);
const fgSvgBuffer = Buffer.from(FOREGROUND_SVG);

// ── 1. ic_launcher / ic_launcher_round ──
// Android 标准密度：mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192
const LAUNCHER_DENSITIES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

// ── 2. ic_launcher_foreground ──
// Adaptive Icon 前景：mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432
const FOREGROUND_DENSITIES = [
  { dir: "mipmap-mdpi", size: 108 },
  { dir: "mipmap-hdpi", size: 162 },
  { dir: "mipmap-xhdpi", size: 216 },
  { dir: "mipmap-xxhdpi", size: 324 },
  { dir: "mipmap-xxxhdpi", size: 432 },
];

// ── 3. ic_stat_icon（通知小图标，白色剪影）──
// mdpi 24, hdpi 36, xhdpi 48, xxhdpi 72, xxxhdpi 96
const NOTIF_DENSITIES = [
  { dir: "drawable-mdpi", size: 24 },
  { dir: "drawable-hdpi", size: 36 },
  { dir: "drawable-xhdpi", size: 48 },
  { dir: "drawable-xxhdpi", size: 72 },
  { dir: "drawable-xxxhdpi", size: 96 },
];

async function generate() {
  if (!existsSync(SOURCE_SVG)) {
    console.error(`✗ 源 SVG 不存在: ${SOURCE_SVG}`);
    process.exit(1);
  }

  // 1. ic_launcher.png
  for (const { dir, size } of LAUNCHER_DENSITIES) {
    const outDir = resolve(ANDROID_RES, dir);
    mkdirSync(outDir, { recursive: true });
    await sharp(svgBuffer).resize(size, size).png().toFile(resolve(outDir, "ic_launcher.png"));
    await sharp(svgBuffer).resize(size, size).png().toFile(resolve(outDir, "ic_launcher_round.png"));
    console.log(`✓ ${dir}/ic_launcher.png + ic_launcher_round.png (${size}x${size})`);
  }

  // 2. ic_launcher_foreground.png
  for (const { dir, size } of FOREGROUND_DENSITIES) {
    const outDir = resolve(ANDROID_RES, dir);
    mkdirSync(outDir, { recursive: true });
    await sharp(fgSvgBuffer).resize(size, size).png().toFile(resolve(outDir, "ic_launcher_foreground.png"));
    console.log(`✓ ${dir}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // 3. ic_stat_icon.png（通知小图标）
  for (const { dir, size } of NOTIF_DENSITIES) {
    const outDir = resolve(ANDROID_RES, dir);
    mkdirSync(outDir, { recursive: true });
    await sharp(notifSvgBuffer).resize(size, size).png().toFile(resolve(outDir, "ic_stat_icon.png"));
    console.log(`✓ ${dir}/ic_stat_icon.png (${size}x${size})`);
  }

  console.log("\n✓ Android 图标全部生成完成");
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
