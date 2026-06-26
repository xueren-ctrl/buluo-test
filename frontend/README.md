# 部落冲突升级助手 PWA

基于 Next.js 14 + TypeScript + TailwindCSS + next-pwa 开发的部落冲突升级追踪 PWA 应用。

## 功能特性

- 🏰 **JSON 上传**：从游戏内导出数据，自动解析升级项目
- 📊 **实时倒计时**：每秒刷新，按剩余时间排序
- 🔔 **本地通知**：升级完成自动提醒（浏览器 Notification API）
- 📱 **PWA 安装**：支持添加到手机/电脑主屏幕
- 💾 **离线缓存**：IndexedDB 持久化，支持离线访问
- 🇨🇳 **中文映射**：完整的 CoC 中文资源系统（建筑/法术/英雄/宠物/装备/兵种/攻城机器/陷阱）
- 🎨 **游戏感 UI**：深色科技风 + 分类色彩编码 + 玻璃拟态
- 📈 **智能排序**：按剩余时间升序，即将完成的项目置顶
- 📝 **JSON Diff**：重新上传时对比新增/已完成的升级项目
- ⚠️ **数据过期提醒**：超过 24 小时未更新时提示重新上传

## 快速开始

```bash
# 安装依赖
cd frontend && npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

打开 `http://localhost:3000` 即可使用。

## 使用步骤

1. 获取 CoC 游戏数据：游戏内 设置 → 更多设置 → 数据导出 → 复制 JSON
2. 粘贴到网页输入框，点击「开始解析」
3. 页面自动显示所有正在升级的项目，按剩余时间排序
4. 点击「申请权限」允许浏览器通知，升级完成将弹窗提醒
5. 点击地址栏右侧安装图标，将网页安装为桌面/手机 App

## 部署

参见 [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md) 获取 Cloudflare Pages 完整部署教程。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: TailwindCSS
- **PWA**: next-pwa + Workbox
- **存储**: IndexedDB
- **通知**: Notification API
- **部署**: Cloudflare Pages / Vercel
