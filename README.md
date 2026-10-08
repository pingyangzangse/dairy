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

## 部署

### 方案：Render 后端 + GitHub Pages 前端

#### 1. 部署后端到 Render

点击上方 **Deploy to Render** 按钮，按提示连接 GitHub 仓库。

然后在 Render 的 Environment 里填入真实环境变量（参考 `backend/.env.example`）：

| Key | 说明 |
|---|---|
| AUTH_DB_HOST / AUTH_DB_PORT / AUTH_DB_USER / AUTH_DB_PASSWORD / AUTH_DB_NAME | DeepTalk 认证数据库 |
| DIARY_DB_HOST / DIARY_DB_PORT / DIARY_DB_USER / DIARY_DB_PASSWORD / DIARY_DB_NAME | 日记业务数据库 |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM | 邮箱验证码服务（可选） |
| APP_DOMAIN / APP_NAME | 钱包登录域名（可选） |

部署完成后，在阿里云 RDS 白名单里添加 Render 的出口 IP。

#### 2. 部署前端到 GitHub Pages

1. 打开仓库 Settings -> Pages
2. Source 选择 **GitHub Actions**
3. 进入 Settings -> Secrets and variables -> Actions -> Repository secrets
4. 添加 `VITE_API_BASE`，值为 Render 后端地址 + /api，例如：
   ```
   https://knowledge-share.alaric.wiki/diary/api
   ```
5. 推送一次代码触发 Actions，或手动运行工作流

> 注意：当前图片上传使用本地磁盘存储，免费实例重启后上传的图片会丢失。正式使用建议接入阿里云 OSS。