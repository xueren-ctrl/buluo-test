# Cloudflare Pages 部署教程

## 前置准备

1. 拥有 GitHub 账号
2. 拥有 Cloudflare 账号（免费注册）
3. 前端项目代码已就绪（含 `frontend/` 目录）

---

## 一、将代码推送到 GitHub

```bash
# 在项目根目录 buluo/ 下执行
cd C:\Users\Administrator.BF-202411262320\server\buluo

# 1. 初始化 git（如果还没有）
git init

# 2. 添加所有文件
git add .

# 3. 提交
git commit -m "feat: CoC 升级助手 PWA 完整实现"

# 4. 在 GitHub 新建仓库（如 coc-upgrade-assistant）
# 5. 添加远程仓库
git remote add origin https://github.com/xueren-ctrl/coc-upgrade-assistant.git

# 6. 推送
git push -u origin main
```

---

## 二、Cloudflare Pages 配置步骤

### 1. 登录 Cloudflare
打开 https://dash.cloudflare.com 并登录

### 2. 进入 Pages 管理
左侧菜单点击 **Workers & Pages** → 顶部选 **Pages** 标签

### 3. 创建项目
点击 **Create application** → 选择 **Connect to Git**

### 4. 关联 GitHub 仓库
- 选择 **coc-upgrade-assistant** 仓库
- 点击 **Begin setup**

### 5. 填写项目设置

| 配置项 | 值 |
|--------|-----|
| Project name | `coc-upgrade-assistant`（自定义） |
| Production branch | `main` |
| Build command | `cd frontend && npm run build` |
| Build output directory | `frontend/.next` |
| Root Directory | （留空） |
| Node.js version | `20.x` |

### 6. 环境变量（可选）
如果没有后端 API，此项可跳过。
如果有，添加：
- `API_BASE_URL` → 你的后端地址

### 7. 保存并部署
点击 **Save and Deploy**

---

## 三、等待部署完成

Cloudflare 会自动构建并部署，通常 2-5 分钟完成。

完成后你会获得一个类似这样的 URL：
```
https://coc-upgrade-assistant.xxx.pages.dev
```

---

## 四、验证 PWA 功能

1. 用手机或电脑浏览器打开上述 URL
2. 测试功能：
   - 粘贴 CoC JSON 数据
   - 查看升级列表
   - 测试通知权限
   - 测试 PWA 安装（手机）

---

## 五、自定义域名（可选）

1. 在 Cloudflare Pages 项目页面点击 **Custom Domains**
2. 点击 **Set up a custom domain**
3. 输入你的域名（需在 Cloudflare 托管）
4. 按提示配置 DNS

---

## 六、常见问题

### Q1: 构建失败？
检查：
- `frontend/package.json` 中是否有 `build` 脚本
- Node.js 版本是否为 18+
- 依赖是否完整（`npm install` 成功）

### Q2: Service Worker 不生效？
Cloudflare Pages 默认不支持 SW，需要在 `frontend/public/_headers` 中添加：

```
/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /
```

或在 Cloudflare 面板中创建 **Worker** 来注册 SW。

### Q3: 前端如何直连后端 API？
修改 `frontend/services/api.ts` 中的 `API_BASE`：
```typescript
const API_BASE = "https://your-backend-url.com/api";
```

### Q4: 如何启用 next-pwa？
已在 `next.config.js` 中配置 `next-pwa`，构建时会自动生成 SW。

---

## 七、性能优化建议

1. **启用 CDN**：Cloudflare Pages 自带全球 CDN
2. **图片压缩**：使用 WebP/AVIF 格式
3. **代码分割**：Next.js 自动处理
4. **静态资源缓存**：已在 next-pwa 中配置

---

## 八、后续扩展

- 接入后端 API（FastAPI/Node.js）
- 集成 WxPusher/飞书/钉钉通知
- 增加多账户支持
- 增加数据导出/分享功能
- 国际化（中英双语）
