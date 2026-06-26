# 部落冲突升级提醒平台 - 完整部署指南

## 目录结构

```
coc-upgrade-reminder/
├── backend/                          # 后端 (FastAPI)
│   ├── app/
│   │   ├── main.py                   # 主入口, 启动 FastAPI
│   │   ├── config.py                 # 配置管理
│   │   ├── models/
│   │   │   └── models.py             # 数据库模型
│   │   ├── routes/
│   │   │   ├── api.py                # API 路由
│   │   │   └── schemas.py            # Pydantic 模型
│   │   ├── services/
│   │   │   └── wspusher.py           # WsPusher 推送服务
│   │   ├── scheduler/
│   │   │   └── tasks.py              # APScheduler 定时任务
│   │   ├── parser/
│   │   │   └── coc_parser.py         # CoC JSON 解析器
│   │   ├── database/
│   │   │   └── base.py               # 数据库连接
│   │   ├── utils/
│   │   │   └── helpers.py            # 工具函数
│   │   └── assets/
│   │       └── building_map.json     # ID 映射表
│   ├── .env                          # 环境变量
│   ├── .env.example                  # 环境变量模板
│   ├── requirements.txt              # Python 依赖
│   ├── Dockerfile                    # Docker 镜像
│   ├── Procfile                      # Railway 部署
│   ├── runtime.txt                   # Python 版本
│   └── test_sample.json              # 测试 JSON 示例
│
├── frontend/                         # 前端 (Next.js)
│   ├── app/
│   │   ├── layout.tsx                # 根布局
│   │   ├── globals.css               # 全局样式
│   │   ├── page.tsx                  # 首页
│   │   └── panel/
│   │       └── page.tsx              # 用户面板
│   ├── components/                   # 可复用组件 (预留)
│   ├── lib/
│   │   └── utils.ts                  # 前端工具函数
│   ├── services/
│   │   └── api.ts                    # API 调用封装
│   ├── styles/                       # 样式 (预留)
│   ├── types/
│   │   └── index.ts                  # TypeScript 类型
│   ├── public/                       # 静态资源
│   ├── .env.example                  # 环境变量模板
│   ├── .env.local                    # 本地环境变量
│   ├── next.config.js                # Next.js 配置
│   ├── tailwind.config.js            # TailwindCSS 配置
│   ├── postcss.config.js             # PostCSS 配置
│   ├── tsconfig.json                 # TypeScript 配置
│   └── package.json                  # Node 依赖
│
├── .gitignore                        # Git 忽略文件
└── README.md                         # 项目说明
```

## 一、本地运行

### 1.1 后端 (FastAPI)

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows (cmd):
venv\Scripts\activate
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# (可选) 编辑 .env 配置
notepad .env

# 启动服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端启动后访问: http://localhost:8000

**API 文档:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 1.2 前端 (Next.js)

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# (可选) 编辑 .env.local
notepad .env.local

# 启动开发服务器
npm run dev
```

前端启动后访问: http://localhost:3000

### 1.3 测试

用 `backend/test_sample.json` 中的数据测试:

```bash
curl -X POST http://localhost:8000/api/upload-json \
  -H "Content-Type: application/json" \
  -d '{
    "json_data": "{\"playerTag\":\"#QY8Q8CV\",\"playerName\":\"TestPlayer\",\"buildings\":[{\"data\":1000028,\"lvl\":11,\"timer\":289397}]}",
    "wspusher_uid": "test-uid-123"
  }'
```

或直接在前端页面 http://localhost:3000 粘贴 JSON 测试。

---

## 二、Railway 部署后端

### 2.1 前置准备

1. 注册 [Railway](https://railway.app)
2. 将项目推送到 GitHub

### 2.2 部署步骤

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 进入后端目录
cd backend

# 初始化项目
railway init

# 关联项目
railway up -d

# 设置环境变量
railway variables set DATABASE_URL="sqlite:///coc_reminder.db"
railway variables set WSPUSHER_API_URL="https://wspush.xyz/api/send"
railway variables set WSPUSHER_API_KEY="你的API密钥"
railway variables set CORS_ORIGINS="https://你的前端域名.vercel.app"
railway variables set SCHEDULER_INTERVAL_SECONDS="60"
railway variables set TZ="Asia/Shanghai"

# 部署
railway up
```

### 2.3 通过 Railway Web UI 部署 (推荐新手)

1. 登录 [Railway Dashboard](https://railway.app/dashboard)
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择你的仓库, 选择 `backend` 目录
4. Railway 会自动识别 `Dockerfile` 或 `Procfile`
5. 在 **Variables** 标签页添加环境变量:
   - `DATABASE_URL` = `sqlite:///coc_reminder.db`
   - `WSPUSHER_API_KEY` = 你的密钥
   - `CORS_ORIGINS` = 前端部署后的域名
   - `TZ` = `Asia/Shanghai`
6. 点击 **Deploy**

### 2.4 获取部署 URL

部署完成后, Railway 会分配一个 URL (类似 `https://backend-xxxxx.railway.app`):

- 复制这个 URL
- 在前端 `.env.local` 中设置:
  ```
  NEXT_PUBLIC_API_URL=https://backend-xxxxx.railway.app
  ```

---

## 三、Vercel 部署前端

### 3.1 前置准备

1. 注册 [Vercel](https://vercel.com)
2. 将项目推送到 GitHub

### 3.2 部署步骤

```bash
# 安装 Vercel CLI
npm i -g vercel

# 进入前端目录
cd frontend

# 部署
vercel

# 生产部署
vercel --prod
```

### 3.3 通过 Vercel Web UI 部署 (推荐新手)

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New...** → **Project**
3. 导入你的 GitHub 仓库
4. 设置:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Environment Variables**: 留空 (或填 `NEXT_PUBLIC_API_URL`)
5. 点击 **Deploy**

### 3.4 配置 API 代理 (重要)

为了避免 CORS 问题, 在 `frontend/` 目录下创建 `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://YOUR_RAILWAY_BACKEND_URL/api/$1"
    }
  ]
}
```

> 把 `YOUR_RAILWAY_BACKEND_URL` 替换为你的 Railway 后端 URL

或者在前端 `next.config.js` 中已配置了 rewrites, 可以直接使用。

---

## 四、使用 Docker 部署 (高级)

### 4.1 后端 Docker

```bash
cd backend

# 构建镜像
docker build -t coc-reminder-backend .

# 运行容器
docker run -d \
  --name coc-backend \
  -p 8000:8000 \
  -e WSPUSHER_API_KEY=你的密钥 \
  -e TZ=Asia/Shanghai \
  coc-reminder-backend
```

### 4.2 完整 Docker Compose

在项目根目录创建 `docker-compose.yml`:

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///coc_reminder.db
      - WSPUSHER_API_KEY=${WSPUSHER_API_KEY}
      - TZ=Asia/Shanghai
      - CORS_ORIGINS=http://localhost:3000
    volumes:
      - db-data:/app/coc_reminder.db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000

volumes:
  db-data:
```

运行:

```bash
docker compose up -d
```

---

## 五、API 接口参考

### POST /api/upload-json

上传 CoC JSON 数据

**请求体:**
```json
{
  "json_data": "{ ... 完整的 CoC JSON ... }",
  "wspusher_uid": "用户UID",
  "player_tag": "玩家标签 (可选)",
  "player_name": "玩家名称 (可选)"
}
```

**响应:**
```json
{
  "success": true,
  "user_id": 1,
  "village_id": 1,
  "upgrades": [
    {
      "id": 1,
      "category": "buildings",
      "item_name": "Inferno Tower",
      "item_level": 11,
      "finish_time": "2026-07-01T10:00:00",
      "timer_seconds": 289397,
      "notified": false
    }
  ],
  "idle_times": {
    "builder_idle_at": "2026-07-01T10:00:00",
    "lab_idle_at": null,
    "builder_busy_count": 1,
    "lab_busy_count": 0
  }
}
```

### GET /api/upgrades

获取升级列表

**查询参数:** `wspusher_uid=xxx`

**响应:** 同上格式

### POST /api/manual-refresh

手动触发通知检测

**查询参数:** `wspusher_uid=xxx`

**响应:**
```json
{
  "success": true,
  "message": "检测完成, 已通知 3 项",
  "notified_count": 3
}
```

---

## 六、WsPusher 配置教程

1. 微信关注 **WsPusher** 公众号
2. 回复 `获取UID` 获得你的 UID
3. 在 WsPusher 官网 [wspush.xyz](https://wspush.xyz) 获取 API Key (可选, 免费用户可用)
4. 将 UID 填入前端页面的 **WsPusher UID** 输入框

---

## 七、常见问题

**Q1: 前端无法连接后端?**
- 检查 `frontend/.env.local` 中 `NEXT_PUBLIC_API_URL` 是否正确
- 检查后端是否正在运行: `curl http://localhost:8000/`
- 检查浏览器控制台的网络请求

**Q2: 定时任务不工作?**
- 确认 `settings.py` 中时区正确
- 检查数据库中 `upgrades` 表的 `finish_time` 是否为 UTC
- 查看后端日志: `uvicorn app.main:app --reload` 会在控制台显示

**Q3: WsPusher 推送失败?**
- 确认 UID 是否正确
- 检查 `WSPUSHER_API_URL` 是否为官方地址
- 查看后端日志中的推送错误信息

**Q4: JSON 解析失败?**
- 确保 JSON 中有 `"buildings"` / `"spells"` / `"heroes"` / `"pets"` / `"equipment"` 字段
- 确保字段是数组格式, 元素中有 `"timer"` (秒数)

**Q5: 如何在生产环境使用 PostgreSQL?**
- 修改 `backend/.env`:
  ```
  DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/coc_db
  ```
- 安装 psycopg2: `pip install psycopg2-binary`

---

## 八、项目启动清单

```
□ 1. 后端: pip install -r requirements.txt
□ 2. 后端: 配置 .env (填 WsPusher 密钥)
□ 3. 后端: uvicorn app.main:app --reload
□ 4. 前端: npm install
□ 5. 前端: npm run dev
□ 6. 浏览器打开 http://localhost:3000
□ 7. 粘贴测试 JSON, 输入 WsPusher UID
□ 8. 提交, 查看解析结果
□ 9. 等待定时任务发送通知
```

祝部署顺利! 🚀
