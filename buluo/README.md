# 部落冲突升级完成提醒平台 ⚔️

上传 CoC 导出的 JSON 数据, 自动追踪升级进度, 到期推送微信通知。

## 功能

- 📋 JSON 上传自动解析 (建筑/法术/英雄/宠物/装备)
- ⏳ 实时显示升级进度 & 剩余时间
- 🔨 工人空闲时间 / 🧪 实验室空闲时间计算
- 📱 升级完成后通过 WsPusher 推送微信通知
- 🔄 定时检测 (每分钟) + 手动刷新
- 🌙 深色科技风 UI, 手机端适配

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + App Router |
| 后端 | FastAPI + SQLAlchemy + APScheduler |
| 数据库 | SQLite (兼容 PostgreSQL) |
| 通知 | WsPusher |
| 部署 | 前端 Vercel / 后端 Railway |

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 访问

- 首页: http://localhost:3000
- 用户面板: http://localhost:3000/panel?uid=你的UID

## 部署说明

详见 [DEPLOYMENT.md](DEPLOYMENT.md)

## 注意

- 仅使用用户手动导出的 JSON
- 不涉及 OCR / 模拟器 / 抓包 / 逆向协议
