# 综合测评排名系统 - 腾讯云 CloudBase 云托管构建镜像
FROM node:20-alpine

WORKDIR /app

# 使用腾讯 npm 镜像加速依赖安装
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# 先复制依赖清单，利用 Docker 层缓存加速构建
COPY package*.json ./
RUN npm install --omit=dev

# 复制项目全部代码（含 data 目录初始数据）
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
