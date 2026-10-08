# 日记（Diary）

一个面向情侣/亲密关系的小清新日记网站，支持文字、图片、评论和伴侣绑定。

## 技术栈

- 后端：Node.js + Express + mysql2
- 前端：Vite + React + Tailwind CSS
- 认证：复用 DeepTalk 的 ks_users / ks_tokens
- 数据库：阿里云 RDS MySQL 8.0

## 本地开发

```bash
# 1. 后端
cd backend
cp .env.example .env
# 编辑 .env 填入数据库配置
npm install
npm run init-db
npm run dev

# 2. 前端（新终端）
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173/

## 部署

### 后端：Render

1. 在 Render 创建 Web Service，选择本 GitHub 仓库
2. 按 render.yaml 配置，或手动设置：
   - Build Command: cd backend && npm install
   - Start Command: cd backend && npm start
   - 环境变量：参照 backend/.env.example 填写真实值
3. 在阿里云 RDS 白名单里添加 Render 的出口 IP
4. 部署完成后复制后端域名，填入前端环境变量

### 前端：Vercel

1. 在 Vercel 导入本 GitHub 仓库
2. Root Directory 选择 frontend
3. Build Command: npm run build
4. Output Directory: dist
5. 环境变量：VITE_API_BASE=https://your-backend-domain/api
6. 部署

> 注意：当前图片上传使用本地磁盘存储，Render 免费实例重启后上传的图片会丢失。正式使用建议接入阿里云 OSS。