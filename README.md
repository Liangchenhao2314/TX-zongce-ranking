# 综合测评排名系统（联网版）

学生综合素质测评排名看板：主看板免登录即可查看排名、上传成绩单解析；管理后台（密码登录）可查看/下载访客上传的源文件、更新全站内置数据、修改配置。

## 一、功能

- **主看板**（免登录）：智育/综测双榜排名、班级筛选、搜索高亮、核验明细、上传成绩单/综测表解析排名
- **访客上传**：朋友打开网址即可上传成绩单解析排名，上传的**原始文件**（.xlsx/.xls/.csv/.json，原格式不转换）上传到**七牛云对象存储**（Railway 重新部署不丢失），数据库/记录文件保存七牛在线 URL
- **管理后台** `/admin`：登录后可
  - 查看所有上传记录（文件名/类型/大小/时间），**下载源文件（原格式，跳转七牛 URL）**、删除记录
  - 数据管理：上传新智育/综测数据（支持 .xlsx/.xls/.csv/.json），解析预览后设为全站生效，支持版本回滚
  - 基础配置：页面标题/副标题、修改管理员密码

## 二、本地运行（测试用）

```bash
npm install
npm start
# 打开 http://localhost:3000 （主看板）
# 打开 http://localhost:3000/admin （管理后台，初始密码 123456）
```

> 本地不带七牛配置也能跑：系统降级为「上传记录可用但文件不持久存储」，并返回上传失败提示；配置好环境变量后即启用七牛存储。

## 三、部署到 Railway（免费公网）

前提：有 GitHub 账号。

### 第 1 步：把工程推到 GitHub

1. 打开 https://github.com/new ，新建仓库（Public，名字随意，如 `zongce-ranking`）
2. 在电脑上打开终端，进入本工程目录，执行：

```bash
cd "C:\Users\fool1\Desktop\综合测评排名系统"
git init
git add -A
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你的GitHub用户名>/zongce-ranking.git
git push -u origin main
```

> 推送时若提示登录，按提示用浏览器登录 GitHub 即可。

### 第 2 步：Railway 连接仓库自动部署

1. 打开 https://railway.com/login 用 GitHub 账号登录
2. 点 **New Project** → **Deploy from GitHub repo** → 选择刚建的 `zongce-ranking` 仓库
3. Railway 会自动识别 `package.json` 并部署（Node.js）
4. 部署完成后，点项目里的 **Settings** → **Networking** → **Generate Domain**，生成公网地址（形如 `xxx.up.railway.app`）
5. 把该地址发给朋友即可访问主看板；在地址后加 `/admin` 进入管理后台

### 第 3 步：在 Railway 配置环境变量（关键！）

打开项目 **Variables** 面板，添加以下 4 个**七牛云**环境变量（值来自你的七牛控制台/账号）：

| 变量名 | 值（示例） | 说明 |
|---|---|---|
| `QINIU_AK` | `NLKrNKVCX11-...` | 七牛 AccessKey |
| `QINIU_SK` | `SSuoos0XY...` | 七牛 SecretKey |
| `QINIU_BUCKET` | `zonge-files` | 存储空间名 |
| `QINIU_DOMAIN` | `shturl.cc/D4ipe8er9omfMOTRRV` | 外链域名（不含 https://） |

可选：**MongoDB**（上传记录持久化到数据库，推荐生产使用）

| 变量名 | 说明 |
|---|---|
| `MONGO_URI` | MongoDB 连接串（如 Railway 提供的 Mongo 或 Atlas）。未配置时自动降级为 JSON 文件存储，不影响运行 |

> 添加后 Railway 会自动重新部署。配置缺失时系统仍可运行（主看板/后台正常），仅访客上传会返回失败提示——所以 4 个七牛变量务必配齐。

> 内置数据已含：智造23级 180 人智育 + 45 人综测（张健永 90.75074 第一等）。管理后台更新数据后，访客打开即看到新数据。

## 四、管理后台使用

- 入口：`https://你的域名/admin`
- 初始密码：`123456`（登录后请立即在「基础配置」中修改）
- **上传记录**：访客每次上传的原文件都会出现在这里（记录含七牛 URL），点「下载」跳转七牛在线地址下载**原格式文件**；可删除记录
- **数据管理**：选成绩单/综测表 → 解析预览 → 确认后全站生效；「回滚」可恢复上一版本
- 数据存储：`data/builtin.json`（全站生效数据）、`data/records.json`（上传记录，含七牛 URL）、`data/config.json`（配置）；原始文件在七牛云端，本地不再保存

## 五、目录结构

```
综合测评排名系统/
├── server.js          # 服务器（Express，接入 /api/upload 路由）
├── package.json
├── routes/
│   └── upload.js      # 访客上传路由：multer→tmp/→七牛云→删临时→写记录（+MongoDB）
├── utils/
│   ├── qiniu.js       # 七牛上传工具（环境变量读取，华南 ZoneHuanan）
│   └── db.js          # 可选 MongoDB 持久化（未配置自动降级）
├── tmp/               # 上传临时目录（成功/失败都会自动清理）
├── public/
│   ├── rankboard.html # 主看板（上传钩子：解析完成后连同解析数据上传）
│   └── admin.html     # 管理后台
└── data/              # 运行时数据（builtin.json、records.json、config.json）
```

## 六、如何测试上传功能

1. 本地：`npm install` → 配置 4 个七牛环境变量 → `npm start`
2. 打开 `http://localhost:3000`，在「上传成绩单」选择一个 `.xlsx/.xls/.csv/.json` 文件
3. 解析成功后页面显示人数/班级预览 → 点击「应用数据」生效
4. 打开 `http://localhost:3000/admin`（密码 123456）→ 「上传记录」里可见该文件，点「下载」可拿到**原格式**文件

## 七、原有本地上传的文件如何处理

- 改造前保存在服务器 `data/uploads/` 的本地文件，因 Railway 重新部署已丢失，**无法迁移**
- 本次改造后，新上传文件全部进七牛云，后续 Railway 重新部署**不会丢失**
- 代码中旧的本地上传实现已**注释保留**（server.js），需要回滚时取消注释即可

## 八、注意事项

- 部署后如需改内置数据或密码，直接登录管理后台操作即可，无需改代码
- 上传文件保存的是**原文件**（不转换格式），下载即原始字节；文件名 = 时间戳 + 随机串 + 原扩展名
- 管理后台 token 有效期 3 天，过期需重新登录
- 七牛外链域名需保持公网可访问；若外链域名更换，同时更新 `QINIU_DOMAIN` 环境变量并重新部署
