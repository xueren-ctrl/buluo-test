# Cloudflare Pages 部署指南

## 前提条件
1. 你有 Cloudflare 账号
2. 你的域名已通过 Cloudflare DNS 托管（可选）

## 部署步骤

### 第 1 步：登录 Cloudflare Dashboard
访问 https://dash.cloudflare.com 并登录。

### 第 2 步：创建站点
1. 左侧导航栏点击 **Workers & Pages**
2. 点击 **Create** 按钮，选择 **Pages** 标签
3. 选择 **Connect to Git**

### 第 3 步：连接 GitHub 仓库
1. 找到并选择仓库 `xueren-ctrl/buluo`
2. 点击 **Begin setup**

### 第 4 步：配置构建设置
在设置页面填写以下内容：

| 字段 | 值 |
|------|-----|
| **Project name** | `buluo`（或你想要的名字） |
| **Production branch** | `main` |
| **Framework preset** | **Next.js** |
| **Build command** | `cd frontend && npm run build` |
| **Build output directory** | `frontend/out` |

### 第 5 步：部署
1. 点击 **Save and Deploy**
2. Cloudflare 会自动拉取代码并构建
3. 等待约 1-3 分钟，部署成功后会显示 **Congratulations!** 页面

### 第 6 步：自定义域名（可选）
1. 进入项目的 **Custom Domains** 标签
2. 添加你的域名（例如 `buluo.yourdomain.com`）
3. Cloudflare 会自动配置 DNS

---

## 注意事项
- 前端构建输出在 `frontend/out/` 目录（Next.js 静态导出）
- 后端 `backend/` 目录需要单独部署到 Railway/Vercel/你的服务器
- 环境变量 `NEXT_PUBLIC_API_URL` 需要设置为后端 API 地址
