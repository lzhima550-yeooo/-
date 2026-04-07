# P18 运维手册（发布冻结与答辩交付）

## 1. 目标与范围
- 目标：在无 Vercel、无科学上网环境下，保证“可启动、可演示、可恢复”。
- 范围：本地 API、本地前端、Supabase 数据、ComfyUI 可选能力、离线兜底能力。

## 2. 环境基线（答辩机）
- Node.js 20+（建议与开发机一致）。
- `npm install` 已完成。
- `.env` 已配置：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `API_HOST=127.0.0.1`
  - `API_PORT=8787`
- 如需真实识图/对话，再配置 `SILICONFLOW_*`；未配置也可走离线演示。

## 3. 一键彩排（推荐）
在项目根目录执行：

```bash
npm run rehearse:p18 -- --mode dual
```

- `dual`：先尝试 real，再强制跑 offline（offline 成功即可保底演示）。
- 输出报告：`docs/release/p18-rehearsal-latest.json`。
- 脚本会自动启动 API 和前端，并在结束后自动回收进程。

常用参数：
- `--mode offline`：只跑离线演示，最稳妥。
- `--skip-build`：跳过构建。
- `--skip-comfyui`：跳过 ComfyUI 验证。
- `--require-comfyui`：ComfyUI 失败即判定彩排失败。
- `--keep-running`：彩排后保持 API/前端进程运行。

## 4. 无 Vercel 本地演示方式
- API：`node server/index.js`
- 前端：`npm run dev -- --host 0.0.0.0 --port 5173`
- 同机演示地址：`http://127.0.0.1:5173`
- 手机同局域网演示地址：`http://<答辩机局域网IP>:5173`

说明：
- 前端使用 `/api` 代理到本地 API，不依赖 Vercel。
- 答辩现场优先同机演示，手机演示仅作为加分项。

## 5. ComfyUI 现场策略
- 主策略：将“识图-对话-发布”演示链路作为主线，不把 ComfyUI 作为必过门槛。
- 可选验证：`npm run verify:comfyui`
- 若 ComfyUI 现场不可达：
  - 继续执行 `npm run verify:final-demo -- --mode offline`
  - 用离线结果完成答辩演示与验收。

## 6. 赛前 30 分钟检查
1. `npm run rehearse:p18 -- --mode offline --skip-build`
2. `curl http://127.0.0.1:8787/api/health`
3. 打开 `http://127.0.0.1:5173`，确认首页与关键流程可访问。
4. 检查 `docs/release/p18-rehearsal-latest.json` 中 `pass=true`。

## 7. 故障快速处理
- API 启不来：检查端口占用、`.env`、Supabase 连通。
- 前端打不开：检查 `5173` 端口是否被占用，换端口重启。
- real 模式失败：直接切到 offline 模式，确保答辩不断线。
- ComfyUI 失败：不阻塞答辩主链路，记录为可选能力降级。
