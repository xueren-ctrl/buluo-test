# 部落冲突升级助手 ⚔️

上传 CoC 导出的 JSON 数据，自动追踪升级进度，到期推送通知。

单仓多端（Monorepo）：同一套 `shared` 核心逻辑同时驱动 **PWA（Cloudflare Pages）** 与 **Android APK（Capacitor）**，PWA 与 APK 只是不同的"壳"。

## 目录结构

```
buluo/
├── frontend/     # PWA：Next.js 静态导出（Cloudflare Pages），同时是 APK 的 Web 资源源
├── android/      # Capacitor Android 原生工程（APK）
├── shared/       # 核心业务逻辑（PWA + APK 共用，自包含、无重复实现）
│   ├── coc-parser.ts          # JSON 解析
│   ├── upgrade-scheduler.ts   # 升级计算 / 通知调度
│   ├── base-analyzer.ts       # 基地分析
│   ├── base-scorer.ts         # 基地评分
│   ├── notification-system.ts # 通知逻辑抽象（Web Notification + Capacitor LocalNotifications）
│   ├── indexeddb.ts           # 本地存储映射
│   ├── update-checker.ts      # 统一更新检查（双端分流）
│   ├── battery-optimizer.ts   # 安卓电池优化 / 自启动引导
│   ├── coc-database.ts        # 资源数据库
│   ├── coc-assets.ts          # 中文资源映射
│   ├── utils.ts / logger.ts
│   └── types/                 # 共享类型
├── backend/      # （可选）Python FastAPI，纯前端模式下不启用
└── version.json  # 统一更新源（PWA + APK 共用）
```

## shared 如何被两端复用

- `frontend/` 通过 `tsconfig.json` 路径别名 `@/lib/* → ../shared/*`、`@/types → ../shared/types` 引用 `shared/`，**不复制任何业务逻辑**。
- `frontend/next.config.js` 的 webpack `resolve.modules` 注入 `frontend/node_modules`，让 `shared/*.ts` 里的 `@capacitor/*` 依赖可被解析。
- `shared/` 内部一律使用**相对路径**互引，保证自包含：PWA 构建与 APK（同样复用 frontend 构建产物）零差异。
- APK（`android/`）运行的就是 `frontend` 的静态导出（`frontend/out/`），经 `npx cap sync` 拷入原生工程，因此自动复用 `shared/`。

## 更新系统（统一）

根目录 `version.json`：

```json
{ "version": "1.0.0", "apkUrl": "...", "changelog": [] }
```

`shared/update-checker.ts` 的 `checkForUpdate()` 根据 Capacitor 平台自动分流，返回形状一致的 `UpdateCheckResult`，UI（`frontend/app/settings`）无需感知差异：

| 平台 | 数据源 | 说明 |
|---|---|---|
| Android APK（原生） | GitHub Releases API | 自动挑选 arm64/universal APK 资源下载 |
| PWA（Web） | Cloudflare `/version.json`（主）+ GitHub raw（备） | Cloudflare 自动更新，UI 提示新版本 |

构建时 `frontend` 的 `prebuild` 脚本会把根 `version.json` 拷贝到 `frontend/public/version.json`，供 Cloudflare 同源托管。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + App Router（静态导出） |
| 移动端 | Capacitor 8（Android） |
| 部署 | Cloudflare Pages（PWA）/ GitHub Releases（APK） |
| 数据存储 | 用户设备本地（IndexedDB） |
| 通知 | Browser Notification API + Capacitor LocalNotifications |

## 快速开始

### PWA 本地开发

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### PWA 生产构建（静态导出）

```bash
cd frontend
npm run build        # prebuild 自动拷贝 version.json → public/version.json
# 产物在 frontend/out/
```

### Android APK

```bash
cd frontend
npm run build
npx cap sync android      # 把 out/ 同步到 android/
npx cap open android      # 在 Android Studio 中打包
```

## 部署

- **PWA**：push 到 `main` 触发 `.github/workflows/deploy-cloudflare.yml`（`frontend/`、`shared/`、`version.json` 变更均触发），部署到 Cloudflare Pages。
- **APK**：在 GitHub 创建 Release（附带 APK），APK 端 `checkForUpdate` 自动读取并提示升级。
