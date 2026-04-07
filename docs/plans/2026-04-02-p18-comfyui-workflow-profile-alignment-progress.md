# P18 Progress (2026-04-02): 生图工作流精细对齐（ComfyUI）

## Goal
- 完成 P18 三个目标：
  - 建立“识别标签 -> workflow profile”映射表（可视化可查看）。
  - 支持导入工作流 JSON 后做节点级字段映射校验。
  - 输出并持久化“本次生图实际 prompt/negative/workflow/profile”追踪记录。

## Completed
- 配置中心增强（后端）：
  - 文件：`server/lib/spiritGenerationConfig.js`
  - 新增 `workflowRoutingRules`（默认规则 + 环境变量覆盖）。
  - 新增 `COMFYUI_WORKFLOW_ROUTING_RULES` 支持。
  - `resolvePayload` 支持 `autoRoute + identifyTypeLabel + identifyRiskLevel`，并输出：
    - `routingRuleId`
    - `routingRuleLabel`
    - `routingMatchedKeywords`
- ComfyUI 工作流校验能力：
  - 文件：`server/lib/comfyuiService.js`
  - 新增 `validateWorkflowProfile(...)`：
    - 读取工作流并判定 `sourceFormat`（prompt/ui）
    - 输出 `mode/nodeCount/classTypes/fieldCoverage/unsupportedNodes`
  - `generateSpiritPortrait` 增加追踪返回字段：
    - `workflowMode/workflowPath/workflowFallbackReason`
    - `presetId/workflowId`
    - `routingRuleId/routingRuleLabel/routingMatchedKeywords`
- 新增 API：
  - 文件：`server/app.js`
  - `GET /api/spirit/workflow/validate`
    - 支持 `workflowId` 或 `workflowPath`
    - 返回 `items[]`（每个工作流的节点映射校验结果）
- 前端配置与任务结果解析：
  - 文件：`src/services/spiritConfigApi.ts`
    - 新增 `workflowRoutingRules` 类型与解析。
  - 文件：`src/services/spiritGenerateApi.ts`
    - 新增生图结果追踪字段解析（workflow/profile/routing）。
  - 文件：`src/services/spiritGenerationTaskApi.ts`
    - 新增任务 `payload` 解析。
    - 新增任务 `result` 追踪字段解析。
- 灵化页 P18 可视化：
  - 文件：`src/pages/SpiritPage.tsx`
  - 新增“识别标签 -> 工作流画像映射”面板（规则列表 + 当前命中）。
  - 生图请求增加 `autoRoute/identifyTypeLabel/identifyRiskLevel`。
  - 新增 “P18 生图追踪快照” 面板，展示：
    - taskId/promptId
    - preset/workflow
    - workflow mode/path/fallback reason
    - prompt/negative prompt
- 会话/草稿持久化追踪字段：
  - 文件：`server/lib/validators.js`
  - 文件：`server/lib/spiritSessionService.js`
  - 文件：`server/lib/supabaseService.js`
  - 文件：`server/lib/spiritDraftBuilder.js`
  - 文件：`src/services/spiritSessionApi.ts`
  - 追踪字段已进入 session.generation，并写入社区草稿正文。

## New/Updated Config
- `.env.example` 新增：
  - `COMFYUI_WORKFLOW_ROUTING_RULES`

## Verification
- 测试通过：
  1. `npm run test:run -- server/__tests__/api.contract.test.ts src/__tests__/spirit-generation-trace-api.test.ts src/__tests__/spirit-interaction.test.tsx src/__tests__/spirit-community-draft.test.tsx src/__tests__/core-flows-regression.test.tsx`
  2. `npm run build`
- 结果摘要：
  - 回归：5 files / 32 tests passed
  - 构建：TypeScript + Vite build passed

## 联调手段（P18）
1. 在 `.env` 配置 `COMFYUI_WORKFLOW_PROFILES`（导入你的工作流 JSON 路径）。
2. 可选配置 `COMFYUI_WORKFLOW_ROUTING_RULES`（标签路由规则）。
3. 启动 API 后调用：
   - `GET /api/spirit/config`：确认有 `workflowRoutingRules`。
   - `GET /api/spirit/workflow/validate?workflowId=default`：查看 `fieldCoverage` 与 `unsupportedNodes`。
4. 前端灵化页上传识别并生成角色，查看：
   - “识别标签 -> 工作流画像映射”面板命中结果。
   - “P18 生图追踪快照”中的 prompt/negative/workflow/profile。
5. 生成社区草稿后，确认草稿正文含：
   - 工作流画像
   - 工作流路径/说明
   - 正向提示词/反向提示词

## Next (建议)
- P19: 真机验收与可观测性闭环
  - 增加手机端五分钟验收脚本（成功/降级双路径）。
  - 增加识别与生图失败原因分层统计。
  - 增加“重新识别/重新灵化”的成功率指标面板。
