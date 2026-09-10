# 综合测评排名系统（联网版）

学生综合素质测评排名看板：主看板免登录即可查看排名、上传成绩单解析；管理后台（密码登录）可查看/下载访客上传的源文件、更新全站内置数据、修改配置。

## 一、功能

- **主看板**（免登录）：智育/综测双榜排名、班级筛选、搜索高亮、核验明细、上传成绩单/综测表解析排名
- **访客上传**：朋友打开网址即可上传成绩单解析排名，上传的**原始文件**（xlsx/xls/csv/txt，原格式不转换）自动保存到服务器
- **管理后台** `/admin`：登录后可
  - 查看所有上传记录（文件名/类型/大小/时间），**下载源文件（原格式）**、删除记录
  - 数据管理：上传新智育/综测数据（支持 .xlsx/.xls/.csv/.json），解析预览后设为全站生效，支持版本回滚
  - 基础配置：页面标题/副标题、修改管理员密码

## 二、本地运行（测试用）

```bash
npm install
npm start
# 打开 http://localhost:3000 （主看板）
# 打开 http://localhost:3000/admin （管理后台，初始密码 123456）
```

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

> 内置数据已含：智造23级 180 人智育 + 45 人综测（张健永 90.75074 第一等）。管理后台更新数据后，访客打开即看到新数据。

## 四、管理后台使用

- 入口：`https://你的域名/admin`
- 初始密码：`123456`（登录后请立即在「基础配置」中修改）
- **上传记录**：访客每次上传的原文件都会出现在这里，可下载（原格式）、可删除
- **数据管理**：选成绩单/综测表 → 解析预览 → 确认后全站生效；「回滚」可恢复上一版本
- 数据存储在服务器 `data/` 目录：`builtin.json`（全站生效数据）、`records.json`（上传记录）、`uploads/`（原始文件）、`config.json`（配置）

## 五、目录结构

```
综合测评排名系统/
├── server.js          # 服务器（Express + multer）
├── package.json
├── public/
│   ├── rankboard.html # 主看板（含上传钩子，访客上传自动存原文件）
│   └── admin.html     # 管理后台
└── data/              # 运行时数据（uploads/、builtin.json 等）
```

## 六、注意事项

- 部署后如需改内置数据或密码，直接登录管理后台操作即可，无需改代码
- 上传文件保存的是**原文件**（不转换格式），下载即原始字节
- 管理后台 token 有效期 3 天，过期需重新登录
