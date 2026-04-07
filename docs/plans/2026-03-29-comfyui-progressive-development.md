# 四季夏木 ComfyUI 渐进式开发文档（2026-03-29）

## 1. 当前完成态（基线）

### 1.1 已完成能力
- 四季夏木后端已接入本地 ComfyUI 生图：`POST /api/spirit/generate`。
- 默认工作流接入：优先读取 `D:\yeoooo\comfyui\默认原始工作流.json`。
- 工作流兼容策略：
  - 工作流可直接执行时，使用 `workflow` 模式。
  - 若仅缺失 `WeiLinPromptUI`，自动进入 `workflow-weilin-fallback`（以标准节点替代）。
  - 若工作流不可执行，自动回退 `fallback-template`，保证功能不中断。
- 灵化页“生成灵化角色”按钮已改为真实后端生图请求，不再是纯前端延时 mock。

### 1.2 关键代码位置
- 后端路由：`server/app.js`
- ComfyUI 服务：`server/lib/comfyuiService.js`
- 前端灵化页：`src/pages/SpiritPage.tsx`
- 前端生图 API：`src/services/spiritGenerateApi.ts`

## 2. 本次增量（P1：可观测 + 可验收）

### 2.1 新增运行时状态接口
- 新增 `GET /api/spirit/runtime`，返回：
  - ComfyUI 在线状态
  - checkpoint 数量与列表
  - WeiLin 节点可用状态
  - 工作流路径、加载状态、候选执行模式、原因

### 2.2 前端新增运行时状态面板
- 灵化页新增“生图引擎状态”卡片，展示：
  - `可用 / 降级 / 离线 / 检测中`
  - 当前候选模式（`workflow` 等）
  - WeiLin 是否加载
  - checkpoint 数量
  - 失败或降级原因

### 2.3 新增一键验收脚本
- 新增脚本：`scripts/verify-comfyui-integration.mjs`
- 新增命令：`npm run verify:comfyui`
- 脚本验证顺序：
  1. 启动临时 API 实例
  2. 调用 `/api/spirit/runtime`
  3. 调用 `/api/spirit/generate`
  4. 回拉生成图片并校验字节数 > 0
  5. 输出 JSON 验收结果

## 3. 渐进式开发路线（下一阶段）

### P2：生图任务化（建议下一步）
- 目标：把一次性 `generate` 调用演进为任务对象。
- 计划：
  - 新增 `POST /api/spirit/generate/tasks`
  - 新增 `GET /api/spirit/generate/tasks/:id`
  - 前端改为任务轮询状态（queued/running/succeeded/failed）
  - 失败重试与超时策略标准化

> 状态（2026-03-29）：已完成首版实现。

### P3：参数与工作流配置化
- 目标：从“固定参数”演进为“策略配置”。
- 计划：
  - 增加预设配置（校园风/科普插画风/写实风）
  - 支持不同工作流文件切换
  - 暴露安全白名单参数（steps/cfg/size/sampler）

> 状态（2026-03-29）：已完成首版实现。

### P4：与会话/社区闭环
- 目标：生图结果可追踪、可复用、可发布。
- 计划：
  - 生成结果绑定会话消息与识别记录
  - 一键发布到社区草稿
  - 统计产出成功率与平均生成时长

## 4. 验收标准

### 4.1 开发态验收
- `npm run test:api` 通过
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx` 通过
- `npm run build` 通过
- `npm run verify:comfyui` 输出 `pass: true`

### 4.2 业务态验收
- 灵化页可显示“生图引擎状态”
- 点击“生成灵化角色”可返回真实图片 URL
- 生成图片可访问且大小大于 0

## 6. P2 实施结果（2026-03-29）
- 已新增任务接口：
  - `POST /api/spirit/generate/tasks`
  - `GET /api/spirit/generate/tasks/:id`
- 已新增服务对象：内存任务表 + 异步执行器（queued/running/succeeded/failed）。
- 前端灵化页已从“直接生图请求”切换为“创建任务 + 轮询任务状态”。
- 一键验收脚本已切换为任务链路验证（创建任务、轮询完成、回拉图片字节校验）。

### P2 验收记录
- `npm run test:api`：PASS（8 tests）
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx`：PASS
- `npm run build`：PASS
- `npm run verify:comfyui`：PASS（task.status=succeeded，imageBytes>0）

### P3 实施结果（2026-03-29）
- 已新增配置接口：`GET /api/spirit/config`
- 后端新增配置中心：
  - 预设：`campus_anime`、`science_card`、`portrait_real`
  - 工作流白名单：`COMFYUI_WORKFLOW_PROFILES`（默认含 `default`）
  - 白名单参数：sampler/scheduler 枚举 + 宽高/steps/cfg/denoise 安全范围收敛
- 生成与任务接口统一接入 `resolvePayload` 配置解析。
- 前端灵化页新增“风格预设 + 工作流”选择器，并随任务提交。
- 验收脚本已纳入 `/api/spirit/config` 检查。

### P3 验收记录
- `npm run test:api`：PASS（9 tests）
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx`：PASS
- `npm run build`：PASS
- `npm run verify:comfyui`：PASS（config.presetCount=3，workflowCount=1，task.status=succeeded）

## 5. 风险与策略
- 风险：ComfyUI 自定义节点变动导致工作流不可执行。  
  策略：保留兼容层与 `fallback-template`，不中断主流程。
- 风险：模型/节点更新后参数不兼容。  
  策略：运行时接口持续暴露 `workflowReason`，便于定位。
- 风险：接口成功但图片回拉失败。  
  策略：验收脚本强制执行“图片字节校验”。

### P4 实施结果（2026-03-29）
- 新增会话闭环接口：`POST /api/spirit/sessions`、`GET /api/spirit/sessions`、`GET /api/spirit/sessions/:id`
- 新增社区草稿接口：`POST /api/spirit/community-drafts`，支持基于灵化会话一键生成社区发布草稿
- 新增统计接口：`GET /api/spirit/stats`，输出生图成功率与平均耗时
- 生图任务对象扩展：补充 `startedAt/finishedAt/durationMs`，用于统计与追踪
- 前端灵化页新增 P4 面板：展示会话ID、成功率、平均耗时，并支持“一键生成社区草稿”
- 社区发布页支持接收灵化草稿并自动预填标题/正文/图片/标签，用户可二次编辑后发布

### P4 验收记录
- `npm run test:api`：PASS（新增 P4 接口契约覆盖）
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx src/__tests__/spirit-community-draft.test.tsx`：PASS
- `npm run build`：PASS
- `npm run verify:comfyui`：PASS（ComfyUI 链路保持可用）

### P4 持久化增强（2026-03-29）
- 已将会话与统计从内存迁移为 Supabase 持久化主链路：
  - 会话表：`spirit_sessions`
  - 生图任务统计表：`spirit_generation_jobs`
  - 草稿表：`spirit_community_drafts`
- 后端新增草稿完整链路接口：
  - `GET /api/spirit/community-drafts`（草稿历史）
  - `GET /api/spirit/community-drafts/:id`（草稿详情）
  - `PATCH /api/spirit/community-drafts/:id`（二次编辑回填保存）
  - `POST /api/spirit/community-drafts/:id/publish`（一键正式发布）
- 生图任务服务新增任务状态变更回调，自动 upsert 到 `spirit_generation_jobs`，`/api/spirit/stats` 优先使用 Supabase 聚合统计。
- 前端发布页新增“灵化草稿历史”面板，支持：
  - 草稿列表查看
  - 回填编辑
  - 一键正式发布
  - 编辑后“更新草稿并正式发布”

### P4 持久化增强验收记录
- `npm run test:api`：PASS（14 tests）
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx src/__tests__/spirit-community-draft.test.tsx src/__tests__/community-publish-image-only.test.tsx`：PASS
- `npm run build`：PASS
- `npm run verify:comfyui`：PASS
