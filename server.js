const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8090;

const DB_FILE = path.join(__dirname, "db.json");
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); }
  catch (e) { return { users: [], results: [], sessions: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}
if (!fs.existsSync(DB_FILE)) saveDB({ users: [], results: [], sessions: [] });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "..")));

function genToken() { return crypto.randomBytes(32).toString("hex"); }
function authMiddleware(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "未登录" });
  const db = loadDB();
  const session = db.sessions.find(s => s.token === token);
  if (!session) return res.status(401).json({ error: "登录已过期" });
  req.userId = session.userId;
  req.token = token;
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "邮箱和密码不能为空" });
  if (password.length < 6) return res.status(400).json({ error: "密码至少6位" });
  const db = loadDB();
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error: "该邮箱已注册" });
  const hash = bcrypt.hashSync(password, 10);
  const userId = Date.now();
  db.users.push({ id: userId, email, passwordHash: hash });
  const token = genToken();
  db.sessions.push({ token, userId });
  saveDB(db);
  res.json({ token, user: { id: userId, email } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "邮箱和密码不能为空" });
  const db = loadDB();
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "该邮箱尚未注册" });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: "密码错误" });
  const token = genToken();
  db.sessions.push({ token, userId: user.id });
  saveDB(db);
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post("/api/logout", authMiddleware, (req, res) => {
  const db = loadDB();
  db.sessions = db.sessions.filter(s => s.token !== req.token);
  saveDB(db);
  res.json({ message: "已退出登录" });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "用户不存在" });
  const count = db.results.filter(r => r.userId === req.userId).length;
  res.json({ user: { id: user.id, email: user.email, testCount: count } });
});

app.post("/api/results", authMiddleware, (req, res) => {
  const { typeCode, mode, answers } = req.body;
  if (!typeCode || !answers) return res.status(400).json({ error: "缺少必要参数" });
  const db = loadDB();
  const id = Date.now();
  db.results.push({ id, userId: req.userId, typeCode, mode: mode || "detailed", answers, createdAt: new Date().toISOString() });
  saveDB(db);
  res.json({ id, message: "结果已保存" });
});

app.get("/api/results", authMiddleware, (req, res) => {
  const db = loadDB();
  const results = db.results
    .filter(r => r.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map(r => ({ id: r.id, type_code: r.typeCode, mode: r.mode, answers: r.answers, created_at: r.createdAt }));
  res.json({ results });
});

app.delete("/api/results/:id", (req, res) => {
  const db = loadDB();
  db.results = db.results.filter(r => !(r.id == req.params.id && r.userId === req.userId));
  saveDB(db);
  res.json({ message: "已删除" });
});

app.get("/api/stats", (req, res) => {
  const db = loadDB();
  const dist = {};
  db.results.forEach(r => { dist[r.typeCode] = (dist[r.typeCode] || 0) + 1; });
  const typeDistribution = Object.entries(dist).map(([type_code, count]) => ({ type_code, count })).sort((a, b) => b.count - a.count);
  res.json({ totalTests: db.results.length, typeDistribution });
});

app.listen(PORT, () => {
  console.log("\nMBTI 性格测试服务已启动");
  console.log("   本地访问：http://localhost:" + PORT);
  console.log("   API文档：http://localhost:" + PORT + "/api/health\n");
});
