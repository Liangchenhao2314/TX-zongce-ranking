# 综合测评排名系统 - 腾讯云 CloudBase 云托管构建镜像
FROM node:20-alpine

WORKDIR /app

# 使用腾讯 npm 镜像加速依赖安装
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# 先复制依赖清单，利用 Docker 层缓存加速构建
COPY package*.json ./
RUN npm install --omit=dev

# 复制项目全部代码
COPY . .

# 保留一份初始数据作为种子，供持久化挂载首次启动时导入
RUN cp -r data /app/data-init

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 启动前：若 /app/data 为空（首次挂载持久化存储），从种子数据初始化
CMD ["sh", "-c", "if [ ! -d /app/data ] || [ -z \"$(ls -A /app/data 2>/dev/null)\" ]; then mkdir -p /app/data && cp -r /app/data-init/. /app/data/; fi; npm start"]
