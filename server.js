/* 学生综合素质测评排名系统（联网版）— 服务器
 * Express + multer：主看板 / 管理后台 / 上传存储 / 鉴权 / 内置数据管理
 * 上传的文件以原格式原样保存（不转换、不改变源文件）
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const uploadRouter = require('./routes/upload');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const RECORDS_FILE = path.join(DATA, 'records.json');
const CONFIG_FILE = path.join(DATA, 'config.json');
const BUILTIN_FILE = path.join(DATA, 'builtin.json');
const BUILTIN_HISTORY_FILE = path.join(DATA, 'builtin_history.json');

for (const d of [DATA, UPLOADS]) {
  if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); }
}

function loadJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; }
}
function saveJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

let CONFIG = Object.assign(
  { password: '123456', title: '综合测评排名看板', subtitle: '2025-2026学年 · 学生综合素质测评排名' },
  loadJSON(CONFIG_FILE, {})
);
let RECORDS = loadJSON(RECORDS_FILE, []);
let BUILTIN = loadJSON(BUILTIN_FILE, { zy: [], zc: { courses: [], credits: [], students: [] }, version: '内置', updatedAt: '' });
let HISTORY = loadJSON(BUILTIN_HISTORY_FILE, []);

// ---------------- 鉴权 ----------------
const TOKENS = new Map(); // token -> expiry(ms)
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 3; // 3天

function newToken() {
  const raw = CONFIG.password + '|' + Date.now() + '|' + crypto.randomBytes(16).toString('hex');
  const token = crypto.createHash('sha256').update(raw).digest('hex') + '.' + Date.now();
  TOKENS.set(token, Date.now() + TOKEN_TTL);
  return token;
}
function checkToken(req) {
  const t = (req.query.token || req.body.token || '').toString();
  if (!t) { return false; }
  const exp = TOKENS.get(t);
  if (!exp) { return false; }
  if (Date.now() > exp) { TOKENS.delete(t); return false; }
  return true;
}
function cleanTokens() {
  const now = Date.now();
  for (const [k, v] of TOKENS) { if (now > v) { TOKENS.delete(k); } }
}

/* ================= 原有本地文件上传（已迁移至七牛云，注释保留以便回滚） =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(8).toString('hex');
    let orig = file.originalname || 'file';
    try {
      if (/[\u0080-\u00ff]/.test(orig)) {
        const fixed = Buffer.from(orig, 'latin1').toString('utf8');
        if (/[\u4e00-\u9fff]/.test(fixed)) { orig = fixed; }
      }
    } catch (e) {}
    const safe = orig.replace(/[\\\/:*?"<>|]/g, '_');
    cb(null, id + '-' + safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
*/

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------- 页面 ----------------
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'rankboard.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'admin.html'));
});

// ---------------- 公开接口 ----------------
app.get('/api/config', (req, res) => {
  res.json({ title: CONFIG.title, subtitle: CONFIG.subtitle });
});
app.get('/api/builtin', (req, res) => {
  res.json({
    zy: BUILTIN.zy || [],
    zc: BUILTIN.zc || { courses: [], credits: [], students: [] },
    version: BUILTIN.version || '内置',
    updatedAt: BUILTIN.updatedAt || ''
  });
});
app.get('/api/builtin/meta', (req, res) => {
  res.json({ version: BUILTIN.version || '内置', updatedAt: BUILTIN.updatedAt || '' });
});

/* ================= 访客上传（原本地存储，已迁移至七牛云，注释保留以便回滚） =================
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: '未收到文件（字段名应为 file）' });
  }
  // 修复中文文件名（multer 默认按 latin1 解码 originalname）
  try {
    const orig = req.file.originalname;
    if (/[\u0080-\u00ff]/.test(orig)) {
      const fixed = Buffer.from(orig, 'latin1').toString('utf8');
      if (/[\u4e00-\u9fff]/.test(fixed)) { req.file.originalname = fixed; }
    }
  } catch (e) {}
  const ftype = (req.body.type || '').toString();
  const remark = (req.body.remark || '').toString();
  const id = crypto.randomBytes(8).toString('hex');
  const rec = {
    id,
    name: req.file.originalname || '未命名',
    stored: req.file.filename,
    type: ftype === 'zy' ? '成绩单' : ftype === 'zc' ? '综测表' : '其他',
    size: req.file.size,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    ts: Date.now(),
    remark
  };
  RECORDS.push(rec);
  saveJSON(RECORDS_FILE, RECORDS);
  res.status(201).json({ ok: true, id, record: rec });
});
*/

// ---------------- 七牛云文件上传（访客免登录） ----------------
// 接口：POST /api/upload/file（字段名 file），上传成功返回 { success: true, url }
// 文件不落本地磁盘，直接上传七牛云；上传记录（含七牛 URL）写入 records.json 供管理后台查看/下载
app.use('/api/upload', uploadRouter);

// ---------------- 管理后台 ----------------
app.post('/api/admin/login', (req, res) => {
  const pwd = (req.body.password || '').toString();
  if (pwd === CONFIG.password) {
    cleanTokens();
    res.json({ ok: true, token: newToken() });
  } else {
    res.status(401).json({ ok: false, error: '密码错误' });
  }
});

// 上传记录列表（实时读文件，兼容七牛路由写入的新记录）
app.get('/api/admin/files', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const list = loadJSON(RECORDS_FILE, []).slice().sort((a, b) => b.ts - a.ts);
  res.json({ ok: true, records: list });
});

// 常见表格文件 MIME 映射
const MIME_MAP = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// 下载源文件：七牛云记录 → 后端代理拉流下载（避免 302 跨域问题）；旧本地记录回退本地文件下载
app.get('/api/admin/files/:id/download', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const id = req.params.id.toString();
  const rec = loadJSON(RECORDS_FILE, []).find((r) => r.id === id);
  if (!rec) { return res.status(404).json({ ok: false, error: '记录不存在' }); }
  // 文件名（UTF-8）写入 Content-Disposition，前端用 decodeURIComponent 还原
  const fname = encodeURIComponent(rec.name || '下载文件');
  const ext = path.extname(rec.name || '').toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + fname);
  if (rec.qiniuUrl) {
    // 七牛云模式：后端代理拉取七牛文件流，pipe 给浏览器
    let urlObj;
    try { urlObj = new URL(rec.qiniuUrl); } catch (e) { return res.status(502).json({ ok: false, error: '七牛 URL 无效' }); }
    const mod = urlObj.protocol === 'https:' ? https : http;
    const proxy = mod.get(urlObj, function (upstream) {
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return res.status(502).json({ ok: false, error: '七牛文件拉取失败 HTTP ' + upstream.statusCode });
      }
      res.status(200);
      upstream.pipe(res);
    });
    proxy.on('error', function () {
      res.status(502).json({ ok: false, error: '七牛文件拉取失败（网络错误）' });
    });
    return;
  }
  // 旧本地记录：直接读本地文件
  const p = path.join(UPLOADS, rec.stored);
  if (!fs.existsSync(p)) { return res.status(404).json({ ok: false, error: '文件不存在' }); }
  res.download(p, rec.name);
});

// 删除记录（实时读文件）
app.delete('/api/admin/files/:id', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const id = req.params.id.toString();
  const recs = loadJSON(RECORDS_FILE, []);
  const idx = recs.findIndex((r) => r.id === id);
  if (idx < 0) { return res.status(404).json({ ok: false, error: '记录不存在' }); }
  const rec = recs[idx];
  try { fs.unlinkSync(path.join(UPLOADS, rec.stored)); } catch (e) {}
  recs.splice(idx, 1);
  saveJSON(RECORDS_FILE, recs);
  res.json({ ok: true });
});

// 内置数据管理：查看版本/历史
app.get('/api/admin/builtin', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  res.json({
    ok: true,
    current: { version: BUILTIN.version, updatedAt: BUILTIN.updatedAt },
    history: HISTORY.slice().reverse()
  });
});

// 更新智育内置数据（data 为解析好的学生数组）
app.post('/api/admin/builtin/zy', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const data = req.body.data;
  const remark = (req.body.remark || '').toString();
  if (!Array.isArray(data) || !data.length) {
    return res.status(400).json({ ok: false, error: '数据无效' });
  }
  HISTORY.push({ kind: 'zy', data: BUILTIN.zy, version: BUILTIN.version, updatedAt: BUILTIN.updatedAt, remark: '（旧版）' });
  if (HISTORY.length > 20) { HISTORY.shift(); }
  BUILTIN.zy = data;
  BUILTIN.version = '智育 v' + new Date().toLocaleString('zh-CN', { hour12: false });
  BUILTIN.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  BUILTIN.remark = remark;
  saveJSON(BUILTIN_FILE, BUILTIN);
  saveJSON(BUILTIN_HISTORY_FILE, HISTORY);
  res.json({ ok: true, version: BUILTIN.version });
});

// 更新综测内置数据
app.post('/api/admin/builtin/zc', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const data = req.body.data;
  const remark = (req.body.remark || '').toString();
  if (!data || !data.students || !data.students.length || !Array.isArray(data.courses) || !data.courses.length) {
    return res.status(400).json({ ok: false, error: '数据无效' });
  }
  HISTORY.push({ kind: 'zc', data: BUILTIN.zc, version: BUILTIN.version, updatedAt: BUILTIN.updatedAt, remark: '（旧版）' });
  if (HISTORY.length > 20) { HISTORY.shift(); }
  BUILTIN.zc = data;
  BUILTIN.version = '综测 v' + new Date().toLocaleString('zh-CN', { hour12: false });
  BUILTIN.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  BUILTIN.remark = remark;
  saveJSON(BUILTIN_FILE, BUILTIN);
  saveJSON(BUILTIN_HISTORY_FILE, HISTORY);
  res.json({ ok: true, version: BUILTIN.version });
});

// 回滚内置数据
app.post('/api/admin/builtin/rollback', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  if (!HISTORY.length) { return res.status(400).json({ ok: false, error: '没有可回滚的版本' }); }
  const old = HISTORY.pop();
  if (old.kind === 'zy') {
    BUILTIN.zy = old.data || BUILTIN.zy;
  } else if (old.kind === 'zc') {
    BUILTIN.zc = old.data || BUILTIN.zc;
  }
  saveJSON(BUILTIN_HISTORY_FILE, HISTORY);
  saveJSON(BUILTIN_FILE, BUILTIN);
  res.json({ ok: true, version: BUILTIN.version });
});

// 配置管理
app.get('/api/admin/config', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  res.json({ ok: true, config: { title: CONFIG.title, subtitle: CONFIG.subtitle } });
});
app.post('/api/admin/config', (req, res) => {
  if (!checkToken(req)) { return res.status(401).json({ ok: false, error: '未授权' }); }
  const { title, subtitle, password } = req.body;
  if (typeof title === 'string' && title.trim()) { CONFIG.title = title.trim(); }
  if (typeof subtitle === 'string') { CONFIG.subtitle = subtitle.trim(); }
  if (typeof password === 'string' && password.trim() && password.trim().length >= 4) {
    CONFIG.password = password.trim();
    TOKENS.clear();
  }
  saveJSON(CONFIG_FILE, CONFIG);
  res.json({ ok: true });
});

// 404 JSON 兜底
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: '接口不存在' }));

// 静态（非 api 路径）
app.use(express.static(PUBLIC));

// 统一 JSON 错误兜底（multer 超限 / JSON 过大等，避免返回 HTML 500）
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: '文件上传失败：' + err.message });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: '上传内容过大（超过 20MB 限制）' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: '请求体 JSON 格式错误' });
  }
  console.error('[server error]', err && err.message);
  res.status(500).json({ ok: false, error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('综合测评排名系统已启动: http://localhost:' + PORT);
  console.log('管理后台: http://localhost:' + PORT + '/admin （初始密码 ' + CONFIG.password + '）');
});
