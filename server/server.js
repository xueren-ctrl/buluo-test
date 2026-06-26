const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const db = new Database(path.join(__dirname, 'mbti.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type_code TEXT NOT NULL,
    mode TEXT NOT NULL,
    answers TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: '登录已过期，请重新登录' });
  req.userId = session.user_id;
  req.token = token;
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: '该邮箱已注册' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const userId = result.lastInsertRowid;
  const token = generateToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  res.json({ token, user: { id: userId, email } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: '该邮箱尚未注册' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: '密码错误' });
  const token = generateToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ message: '已退出登录' });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const count = db.prepare('SELECT COUNT(*) as count FROM test_results WHERE user_id = ?').get(req.userId);
  res.json({ user: { ...user, testCount: count.count } });
});

app.post('/api/results', authMiddleware, (req, res) => {
  const { typeCode, mode, answers } = req.body;
  if (!typeCode || !answers) return res.status(400).json({ error: '缺少必要参数' });
  const result = db.prepare('INSERT INTO test_results (user_id, type_code, mode, answers) VALUES (?, ?, ?, ?)').run(req.userId, typeCode, mode || 'detailed', JSON.stringify(answers));
  res.json({ id: result.lastInsertRowid, message: '结果已保存' });
});

app.get('/api/results', authMiddleware, (req, res) => {
  const results = db.prepare('SELECT id, type_code, mode, answers, created_at FROM test_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.userId);
  res.json({ results: results.map(r => ({ ...r, answers: JSON.parse(r.answers) })) });
});

app.delete('/api/results/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM test_results WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ message: '已删除' });
});

app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM test_results').get();
  const byType = db.prepare('SELECT type_code, COUNT(*) as count FROM test_results GROUP BY type_code ORDER BY count DESC').all();
  res.json({ totalTests: total.count, typeDistribution: byType });
});

app.listen(PORT, () => {
  console.log('\n🧭 MBTI 性格测试服务已启动');
  console.log('   本地访问：http://localhost:' + PORT);
  console.log('   API文档：http://localhost:' + PORT + '/api/health\n');
});
