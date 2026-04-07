# 四季夏木全栈应用（summer-wood-app）

当前项目已升级为前后端一体：

- 前端：React + Vite + TypeScript（移动端 H5）
- 后端：Node HTTP API（`server/`）
- 数据库：Supabase（Postgres）

## 目录概览

- `src/`：前端页面与业务逻辑
- `server/`：后端 API
- `supabase/schema.sql`：数据库建表与索引
- `supabase/seed.sql`：基础种子数据

## 一次性初始化

1. 在 Supabase SQL Editor 执行：
   - `supabase/schema.sql`
   - `supabase/seed.sql`
2. 复制 `.env.example` 为 `.env` 并填写（`npm run dev:api` 会自动读取 `.env`）：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

> `SUPABASE_SERVICE_ROLE_KEY` 仅供后端使用，不要暴露到前端。

## 本地开发

前端：

```bash
cd D:\yeoooo\summer-wood-app
npm install
npm run dev
```

后端（新终端）：

```bash
cd D:\yeoooo\summer-wood-app
npm run dev:api
```

默认联通方式：

- 前端请求 `/api/*`
- Vite 代理到 `http://127.0.0.1:8787`

## 主要后端接口

- `GET /api/health`
- `GET /api/encyclopedia?q=`
- `GET /api/community/posts?q=`
- `POST /api/community/posts`
- `POST /api/community/posts/:id/replies`

## 测试命令

```bash
npm run test:api
npm run test:run
```

## 当前保留策略

- 登录/注册/找回密码仍沿用前端本地逻辑。
- 图鉴与社区云端读写已接入后端 + Supabase。
## 修复图鉴错误照片（Supabase）

1. 先确认 `.env` 中的 `SUPABASE_SERVICE_ROLE_KEY` 是 **service_role(secret) key**（通常以 `sb_secret_` 开头）。
2. 执行以下任一方式：

方式 A（推荐，脚本自动执行）：

```bash
npm run db:fix:photos
```

方式 B（SQL Editor 手动执行）：

- 在 Supabase SQL Editor 执行 `supabase/fix-encyclopedia-photos.sql`。

修复结果：

- 删除分类 `天敌益虫`
- 将图鉴随机错误图（`loremflickr`）批量替换为稳定虫害/病害图片

## 灵化鉴别模式（离线演示 + 真实 API 预留）

默认离线演示：

- VITE_SPIRIT_IDENTIFY_MODE=mock
- 智能鉴别固定返回“瓢虫”，用于现场演示稳定性。

后续接入真实鉴别 API：

- VITE_SPIRIT_IDENTIFY_MODE=remote
- VITE_SPIRIT_IDENTIFY_ENDPOINT=https://your-api/identify

前端已内置自动降级：当远端接口失败时，会回退到离线瓢虫演示结果。