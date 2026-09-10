/* 七牛云文件上传路由
 * 接口：POST /api/upload/file  （字段名：file）
 * 流程：multer 接收 → 临时保存到项目根目录 tmp/ → 上传七牛云 → 删除本地临时文件
 * 成功返回：{ success: true, url: "七牛云文件在线URL" }
 * 失败返回：{ success: false, msg: "上传失败" }（状态码 500）
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { uploadToQiniu } = require('../utils/qiniu');
const { saveUploadRecord } = require('../utils/db');

const router = express.Router();

// 临时目录：项目根目录/tmp/
const TMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// multer：文件先落临时目录，文件名 = 时间戳 + 随机字符串 + 原扩展名
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, TMP_DIR); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const name = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

router.post('/file', upload.single('file'), async function (req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, msg: '未收到文件（字段名应为 file）' });
  }
  const localPath = req.file.path;
  const key = req.file.filename;
  try {
    const url = await uploadToQiniu(localPath, key);
    // 上传成功后删除本地临时文件
    try { fs.unlinkSync(localPath); } catch (e) {}
    // 前端解析结果（JSON 字符串，可选）：与七牛 URL 一并持久化
    let parsed = null;
    const dataStr = (req.body.data || '').toString();
    if (dataStr) {
      try { parsed = JSON.parse(dataStr); } catch (e) { parsed = null; }
    }
    // 同步写入上传记录：records.json（必写）+ MongoDB（可选，需配置 MONGO_URI）
    const rec = saveRecord(req, req.file, key, url, parsed);
    saveUploadRecord(rec).catch(function () {});
    res.json({ success: true, url: url });
  } catch (err) {
    // 失败也清理临时文件
    try { fs.unlinkSync(localPath); } catch (e) {}
    console.error('[qiniu upload error]', err && err.message);
    res.status(500).json({ success: false, msg: '上传失败' });
  }
});

// 上传记录写入 data/records.json（兼容原管理后台记录结构，新增 qiniuUrl/parsed 字段）
const DATA_DIR = path.join(__dirname, '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

function loadRecords() {
  try { return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8')); } catch (e) { return []; }
}
function saveRecord(req, file, key, url, parsed) {
  const records = loadRecords();
  const ftype = (req.body.type || '').toString();
  const remark = (req.body.remark || '').toString();
  const rec = {
    id: crypto.randomBytes(8).toString('hex'),
    name: file.originalname || '未命名',
    stored: key,
    qiniuUrl: url,
    type: ftype === 'zy' ? '成绩单' : ftype === 'zc' ? '综测表' : '其他',
    size: file.size,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    ts: Date.now(),
    remark
  };
  if (parsed) { rec.parsed = parsed; }
  records.push(rec);
  try {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('[save record error]', e && e.message);
  }
  return rec;
}

module.exports = router;
