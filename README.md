# 日记

一个手机优先的亲密关系日记社区。支持伴侣绑定、日记发布（文字 + 图片）、评论、关注和日记广场。

## 技术栈

- 后端：Express + mysql2（与 DeepTalk 保持一致）
- 前端：Vite + React + Tailwind CSS
- 认证：复用 DeepTalk 的 ks_users / ks_tokens 表
- 数据库：阿里云 RDS MySQL（utf8mb4）

## 项目结构

```
日记/
├── backend/         # Express 后端
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── lib/
│   │   └── routes/
│   └── scripts/init-db.js
├── frontend/        # React 前端
│   └── src/
│       ├── pages/
│       ├── components/
│       └── lib/api.js
```

## 启动方式

### 1. 初始化日记数据库

```bash
cd backend
npm install
cp .env.example .env   # 填写数据库密码
npm run init-db
```

### 2. 启动后端

```bash
cd backend
npm run dev
```

后端默认运行在 http://localhost:3002

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 http://localhost:5173

## 核心功能

- 账号密码登录 / 邮箱验证码登录 / 钱包登录（复用 DeepTalk 认证）
- 邮箱搜索并发送亲密关系绑定申请（情侣 / 朋友 / 家人）
- 发布日记，每次可选择公开 / 仅伴侣可见 / 仅自己可见，默认仅伴侣可见
- 日记广场支持「全部 / 关注 / 伴侣」三种视图
- 日记详情页支持评论

## 数据库说明

- knowledge：DeepTalk 数据库，共享用户和 Token 表
- dairy：日记业务数据库（关系、日记、评论、关注）

注意：当前配置中日记数据库名为 dairy。如果原意是 diary，请修改 backend/.env 中的 DIARY_DB_NAME。
