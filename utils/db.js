/* 可选 MongoDB 持久化
 * 设置环境变量 MONGO_URI 后启用：上传记录（含七牛 URL 与解析数据）写入 MongoDB
 * 未配置 / 连接失败：自动降级，上传记录照常写入 data/records.json，不影响现有功能
 */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || '';
let state = 'none'; // none | connecting | connected | failed

function init() {
  if (!MONGO_URI || state !== 'none') { return; }
  state = 'connecting';
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 4000 })
    .then(function () {
      state = 'connected';
      console.log('[db] MongoDB 已连接');
    })
    .catch(function (err) {
      state = 'failed';
      console.warn('[db] MongoDB 连接失败（上传记录将降级写入 JSON 文件）:', err && err.message);
    });
}
init();

const uploadRecordSchema = new mongoose.Schema({
  id: String,
  name: String,
  stored: String,
  qiniuUrl: String,
  type: String,
  size: Number,
  time: String,
  ts: Number,
  remark: String,
  parsed: mongoose.Schema.Types.Mixed   // 前端解析后的学生数据（JSON 快照）
}, { collection: 'upload_records' });

const UploadRecord = mongoose.models.UploadRecord || mongoose.model('UploadRecord', uploadRecordSchema);

/** 保存一条上传记录到 MongoDB；未连接/失败返回 false */
function saveUploadRecord(rec) {
  if (state !== 'connected') { return Promise.resolve(false); }
  return UploadRecord.create(rec)
    .then(function () { return true; })
    .catch(function (err) {
      console.warn('[db] 保存上传记录失败:', err && err.message);
      return false;
    });
}

module.exports = { saveUploadRecord, isMongoConnected: function () { return state === 'connected'; } };
