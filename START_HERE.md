# 部落冲突升级提醒平台 - 快速开始指南

## 已完成的内容

我已经为你创建了一个完整的全栈项目，包括：

### 后端 (FastAPI)
- ✅ JSON 解析器 - 自动识别 CoC 升级进度
- ✅ 数据库 - SQLite (users / villages / upgrades 表)
- ✅ 定时任务 - 每分钟检测到期升级项
- ✅ WsPusher 推送 - 微信通知服务
- ✅ RESTful API - 3 个主要接口

### 前端 (Next.js 14)
- ✅ 首页 - JSON 上传 + 实时进度展示
- ✅ 用户面板 - 倒计时 + 统计概览
- ✅ 深色科技风 UI - 手机端适配
- ✅ Toast 提示 + Loading 状态

---

## 如何运行

### 第一步：配置后端

1. 打开 `backend/.env` 文件
2. 修改这一行：
   ```
   WSPUSHER_API_KEY=你的API密钥
   ```
   （如果只是本地测试，可以暂时留空）

3. 安装后端依赖 (只需第一次)：
   ```powershell
   cd C:\Users\Administrator.BF-202411262320\server\buluo\backend
   pip install -r requirements.txt
   ```

4. 启动后端服务：
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   看到 `Started server` 就说明成功了！

### 第二步：配置前端

1. 打开新的终端窗口
2. 进入前端目录：
   ```powershell
   cd C:\Users\Administrator.BF-202411262320\server\buluo\frontend
   ```

3. 安装依赖 (只需第一次)：
   ```powershell
   npm install
   ```

4. 启动前端开发服务器：
   ```powershell
   npm run dev
   ```

5. 打开浏览器访问: **http://localhost:3000**

---

## 使用方法

1. 在首页粘贴 CoC JSON 数据
2. 输入你的 WsPusher UID (微信推送用)
3. 点击"开始解析"
4. 系统会自动：
   - 识别所有正在升级的项目
   - 显示剩余时间和完成进度
   - 计算工人/实验室空闲时间
5. 升级完成后，系统会通过 WsPusher 推送通知

---

## API 接口

后端启动后可访问：
- Swagger 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/

---

## 测试用 JSON

可以使用 `backend/test_sample.json` 进行测试，里面的数据会模拟多个正在升级的项目。

有问题随时问我！🚀
