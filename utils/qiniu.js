/* 七牛云对象存储上传工具
 * 所有配置从环境变量读取（Railway 中配置）：
 *   QINIU_AK     七牛 AccessKey
 *   QINIU_SK     七牛 SecretKey
 *   QINIU_BUCKET 存储空间名称
 *   QINIU_DOMAIN 外链域名（可含路径前缀，如 shturl.cc/D4ipe8er9omfMOTRRV）
 * 存储区域：华南（ZoneHuanan）
 */
const qiniu = require('qiniu');

const AK = process.env.QINIU_AK || '';
const SK = process.env.QINIU_SK || '';
const BUCKET = process.env.QINIU_BUCKET || '';
const DOMAIN = process.env.QINIU_DOMAIN || '';

// 七牛鉴权对象
const mac = new qiniu.auth.digest.Mac(AK, SK);

// 上传配置：华南区域
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.ZoneHuanan;

/**
 * 上传本地文件到七牛云
 * @param {string} localFilePath 本地文件绝对路径
 * @param {string} key 七牛云中的对象名（文件名）
 * @returns {Promise<string>} 文件完整在线 URL：https://外链域名/文件名
 */
function uploadToQiniu(localFilePath, key) {
  return new Promise((resolve, reject) => {
    if (!AK || !SK || !BUCKET || !DOMAIN) {
      return reject(new Error('七牛云环境变量未配置（QINIU_AK/QINIU_SK/QINIU_BUCKET/QINIU_DOMAIN）'));
    }
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: BUCKET + ':' + key
    });
    const uploadToken = putPolicy.uploadToken(mac);
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();
    formUploader.putFile(uploadToken, key, localFilePath, putExtra, function (err, body, info) {
      if (err) {
        return reject(err);
      }
      if (info && info.statusCode === 200) {
        resolve('https://' + DOMAIN + '/' + key);
      } else {
        const msg = (body && body.error) ? body.error : ('HTTP ' + (info && info.statusCode));
        reject(new Error('七牛上传失败：' + msg));
      }
    });
  });
}

module.exports = { uploadToQiniu };
