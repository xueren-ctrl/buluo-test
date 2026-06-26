# 部落冲突升级助手 PWA

基于 Next.js 14 + TypeScript + TailwindCSS + next-pwa 开发的部落冲突升级追踪 PWA 应用。

## 功能特性

- 🏰 **JSON 上传**：从游戏内导出数据，自动解析升级项目
- 📊 **实时倒计时**：每秒刷新，按剩余时间排序
- 🔔 **本地通知**：升级完成自动提醒（浏览器通知 API）
- 📱 **PWA 安装**：支持添加到手机/电脑主屏幕
- 💾 **离线缓存**：IndexedDB 持久化，支持离线访问
- 🇨🇳 **中文映射**：完整的 CoC 中文资源系统
- 🎨 **游戏感 UI**：深色科技风 + 分类色彩编码 + 玻璃拟态

## 快速开始

```bash
# 安装依赖
cd frontend && npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

## 部署

参见 [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md)

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: TailwindCSS
- **PWA**: next-pwa + Workbox
- **存储**: IndexedDB
- **通知**: Notification API + WsPusher
- **部署**: Cloudflare Pages / Vercel
