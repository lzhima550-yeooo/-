# Vercel 与后端环境变量模板（四季夏木）

## 1. 前端（Vercel Project -> Environment Variables）

### Production / Preview 都建议配置

```env
VITE_API_BASE_URL=https://api.your-domain.com
VITE_SPIRIT_CHAT_MODE=backend
VITE_SPIRIT_IDENTIFY_MODE=backend
VITE_IDENTIFY_TASK_MODE=backend
```

说明：
- 这里不允许放 `SUPABASE_SERVICE_ROLE_KEY`。
- 所有 `VITE_` 变量会进入前端构建产物，等同公开信息。

## 2. 后端（你的 Node API 服务）

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
API_HOST=0.0.0.0
API_PORT=8787

SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_API_KEY=
SILICONFLOW_VISION_MODEL=Qwen/Qwen3-VL-32B-Instruct
SILICONFLOW_CHAT_MODEL=deepseek-ai/DeepSeek-V3
SILICONFLOW_TIMEOUT_MS=45000

COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_PUBLIC_BASE_URL=
COMFYUI_IMAGE_DELIVERY_MODE=proxy
```

## 3. 部署后必查

1. 前端域名打开正常。
2. API 地址可从公网访问。
3. `GET /api/health` 返回 `ok=true`。
4. 随机调用 1 个数据库读接口、1 个写接口，确认鉴权正常。
