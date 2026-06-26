# CoC 升级助手 PWA 升级完成

## 已完成工作

### 1. PWA 基础设施
- **next-pwa**: 已安装并配置 `next.config.js`
  - CacheFirst: 图标/图片/字体/静态资源（最长1年）
  - NetworkFirst: 页面/API（超时10秒）
  - `disable: process.env.NODE_ENV === "development"`（开发时关闭）
  - `output: "standalone"`（Cloudflare Pages 专用构建）
- **manifest.json**: 完整 PWA 清单（standalone 模式）
- **Service Worker**: 由 next-pwa 自动生成到 `public/sw.js`
- **PWA 图标**: SVG 盾牌造型 192/512 尺寸

### 2. 中文资源映射系统
- **lib/coc-assets.ts**: 完整中文映射（40+ 条目）
  - BUILDING_MAP: 建筑（橙色）
  - SPELL_MAP: 法术（蓝色）
  - HERO_MAP: 英雄（金色）
  - PET_MAP: 宠物（绿色）
  - EQUIPMENT_MAP: 装备（紫色）
  - UNIT_MAP: 兵种（蓝色）
  - SIEGE_MAP: 攻城机器（青色）
  - HELPER_MAP: 助力（青色）
  - TRAP_MAP: 陷阱（红色）
- **分类颜色**: 完整的 TailwindCSS 色号体系
- **自动推断**: `inferCategory()` 根据 SC ID 推断分类
- **格式化**: `formatUpgradeDisplay()` 输出 "部落城堡 Lv6"

### 3. Cloudflare Pages 部署配置
- **wrangler.toml**: 完整 Wrangler 配置
- **_headers**: HTTP 头配置（SW 不缓存、静态资源长期缓存）
- **CLOUDFLARE_DEPLOY.md**: 逐步部署教程
- **.gitignore**: 排除 build output/node_modules

### 4. 移动端优化
- **安全区域**: iPhone 刘海屏/底部安全条适配
- **触摸目标**: 更大按钮（py-3）
- **隐藏滚动条**: 移动端更好的视觉
- **防止输入缩放**: iOS Safari 16px 最小字体

### 5. 其他改进
- **README.md**: 完整项目文档
- **项目记忆**: 记录本次所有变更

## 待办事项

1. **推送代码到 GitHub**: 需要创建新仓库 coc-upgrade-assistant
2. **测试 next-pwa**: 运行 `npm run build` 验证 Service Worker 生成
3. **校准 coc-assets.ts**: 中文名称需要与游戏内实际名称对齐
4. **接入后端 API**: 如需数据同步，需配置 `API_BASE`

## 核心文件清单

| 文件 | 用途 |
|------|------|
| `frontend/next.config.js` | next-pwa + Cloudflare 配置 |
| `frontend/public/manifest.json` | PWA 应用清单 |
| `frontend/public/sw.js` | Service Worker（自动生成） |
| `frontend/public/_headers` | HTTP 头缓存配置 |
| `frontend/public/icons/icon-192.svg` | PWA 图标（192px） |
| `frontend/public/icons/icon-512.svg` | PWA 图标（512px） |
| `frontend/lib/coc-assets.ts` | 中文资源映射 |
| `frontend/wrangler.toml` | Wrangler 配置 |
| `frontend/.gitignore` | Git 忽略规则 |
| `frontend/README.md` | 项目文档 |
| `CLOUDFLARE_DEPLOY.md` | 部署教程 |
