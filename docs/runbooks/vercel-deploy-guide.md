# 四季夏木 Vercel 部署教学文档

## 1. 先明确部署边界（非常重要）

当前项目是：
- 前端：React + Vite（`src/`）
- 后端：Node HTTP API（`server/`）

Vercel 对本项目最稳妥的方式是：
- 前端部署到 Vercel
- 后端 API 独立部署到可常驻 Node 服务的平台（如云主机、Render、Railway 等）

原因：
- 前端代码通过 `VITE_API_BASE_URL` 访问 API（默认是 `/api`，仅适用于本地代理）
- 线上如果继续用 `/api`，会请求到 Vercel 域名下，除非你额外实现 Vercel Functions/代理层

## 2. 部署前准备

### 2.1 代码准备
确保当前分支可构建：

```bash
npm install
npm run build
```

### 2.2 线上 API 准备
你需要先有一个可公网访问的 API 地址，例如：

```text
https://api.your-domain.com
```

并确保前端域名被后端允许跨域（CORS）。

## 3. 方案 A（推荐）：Git 触发 Vercel 自动部署

### 3.1 导入仓库
1. 打开 [Vercel Dashboard](https://vercel.com/new)
2. 选择你的 GitHub 仓库：`lzhima550-yeooo/-`
3. Framework Preset 选择 `Vite`

### 3.2 Build Settings（若未自动识别）
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

### 3.3 配置环境变量（Project Settings -> Environment Variables）
至少配置：

- `VITE_API_BASE_URL=https://api.your-domain.com`

建议同时配置：

- `VITE_SPIRIT_CHAT_MODE=backend`
- `VITE_SPIRIT_IDENTIFY_MODE=backend`
- `VITE_IDENTIFY_TASK_MODE=backend`

> 注意：修改环境变量后要重新触发部署，旧部署不会自动生效。

### 3.5 数据库认证参数（重点）

本项目使用 Supabase，认证参数分为两层：

#### A. 前端（Vercel）可见参数
- `VITE_API_BASE_URL`：后端 API 基地址（必须）

> 前端 **不要** 配置 `SUPABASE_SERVICE_ROLE_KEY`，也不要把任何 `SUPABASE_*` 密钥放进 `VITE_` 前缀变量。

#### B. 后端（你的 API 服务）必须参数
后端服务（非 Vercel 前端）必须配置以下变量：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_HOST=0.0.0.0`
- `API_PORT`（按平台分配端口）

可选但建议：
- `SILICONFLOW_API_KEY`
- `SILICONFLOW_BASE_URL`
- `SILICONFLOW_VISION_MODEL`
- `SILICONFLOW_CHAT_MODEL`
- `SILICONFLOW_TIMEOUT_MS`

ComfyUI 可选：
- `COMFYUI_BASE_URL`
- `COMFYUI_PUBLIC_BASE_URL`
- `COMFYUI_IMAGE_DELIVERY_MODE`

#### C. 安全规则
1. `SUPABASE_SERVICE_ROLE_KEY` 只允许出现在后端环境变量中。  
2. 前端仓库、README、Vercel 前端环境变量中禁止出现 service role key。  
3. 每次改密钥后立即重启后端服务并执行最小验收（`/api/health` + 1 条读写接口）。

### 3.4 首次发布
点击 Deploy，等待构建完成。

## 4. 方案 B：Vercel CLI 手动发布

```bash
npm i -g vercel
vercel login
vercel link
vercel env add VITE_API_BASE_URL production
vercel --prod
```

如果还要配 Preview 环境：

```bash
vercel env add VITE_API_BASE_URL preview
```

## 5. SPA 刷新 404 处理（可选）

若你发现前端路由页面刷新 404，可在仓库根目录添加 `vercel.json`：

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

然后重新部署。

## 6. 发布后验收清单

1. 首页能打开（Vercel 域名正常）
2. 社区、图鉴、识别等页面无白屏
3. 浏览器 Network 中 API 请求已指向 `VITE_API_BASE_URL`
4. 关键接口返回 200/业务正常
5. 手机端访问 Vercel 域名可用
6. 后端 `GET /api/health` 返回 `ok=true`
7. 后端日志无 Supabase 鉴权错误（401/403）
8. 任意一个依赖数据库的接口可正常读写（如社区列表或图鉴详情）

## 7. 常见问题与处理

### 7.1 页面能开，但接口全失败
- 原因：`VITE_API_BASE_URL` 未配置或仍为 `/api`
- 处理：改为完整后端 URL，重新部署

### 7.2 浏览器报 CORS 错误
- 原因：后端未允许 Vercel 域名
- 处理：在后端 CORS 白名单加入 `https://<your-vercel-domain>`

### 7.3 HTTPS 页面请求 HTTP API 被拦截
- 原因：Mixed Content
- 处理：后端改 HTTPS（推荐）

### 7.4 改了环境变量但页面没变化
- 原因：变量只对新部署生效
- 处理：重新 Deploy

### 7.5 后端报 Supabase 鉴权失败（401/403）
- 原因：`SUPABASE_URL` 或 `SUPABASE_SERVICE_ROLE_KEY` 配置错误
- 处理：
  1. 重新粘贴 Supabase Project URL 与 Service Role Key
  2. 检查是否误把 anon key 当成 service role key
  3. 重启后端并重测 `/api/health`

## 8. 与 PakePlus 打包的关系

建议顺序：
1. 先把前端稳定发布到 Vercel
2. 再把这个稳定 URL 用于 PakePlus 打包

这样打包出的桌面/移动端壳应用会直接加载线上稳定版本，便于演示和分发。

## 9. 参考官方文档

- Vite on Vercel: [https://vercel.com/docs/frameworks/frontend/vite](https://vercel.com/docs/frameworks/frontend/vite)
- Deploying to Vercel: [https://vercel.com/docs/deployments/overview](https://vercel.com/docs/deployments/overview)
- Environment Variables: [https://vercel.com/docs/projects/environment-variables](https://vercel.com/docs/projects/environment-variables)
- Managing Environment Variables: [https://vercel.com/docs/environment-variables/managing-environment-variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
- Vercel CLI `deploy`: [https://vercel.com/docs/cli/deploy](https://vercel.com/docs/cli/deploy)
