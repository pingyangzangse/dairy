# 日记（Diary）

一个面向情侣/亲密关系的小清新日记网站，支持文字、图片、评论和伴侣绑定。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/pingyangzangse/dairy)

## 技术栈

- 后端：Node.js + Express + mysql2
- 前端：Vite + React + Tailwind CSS
- 认证：复用 DeepTalk 的 ks_users / ks_tokens（密码、邮箱验证码、钱包三种登录通用）
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

## 部署（Vercel 前端 + Render 后端）

### 1. 部署后端到 Render

点击上方 **Deploy to Render** 按钮，按提示连接 GitHub 仓库。

然后在 Render 的 Environment 里填入真实环境变量（参考 `backend/.env.example`）：

| Key | 说明 |
|---|---|
| AUTH_DB_HOST / AUTH_DB_PORT / AUTH_DB_USER / AUTH_DB_PASSWORD / AUTH_DB_NAME | DeepTalk 认证数据库 |
| DIARY_DB_HOST / DIARY_DB_PORT / DIARY_DB_USER / DIARY_DB_PASSWORD / DIARY_DB_NAME | 日记业务数据库 |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM | 邮箱验证码服务（可选） |
| APP_DOMAIN / APP_NAME | 钱包登录域名（可选） |

部署完成后，在阿里云 RDS 白名单里添加 Render 的出口 IP。

### 2. 部署前端到 Vercel

1. 打开 https://vercel.com/new 并导入 `pingyangzangse/dairy` 仓库
2. Root Directory 选择 `frontend`
3. Build Command 保持默认：`npm run build`
4. Output Directory 保持默认：`dist`
5. 添加环境变量：
   - `VITE_API_BASE` = `https://你的render域名.onrender.com/api`
6. 点击 Deploy

> 注意：当前图片上传使用本地磁盘存储，免费实例重启后上传的图片会丢失。正式使用建议接入阿里云 OSS。