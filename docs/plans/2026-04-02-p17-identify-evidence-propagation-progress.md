# P17 Progress (2026-04-02): 识别任务证据贯通

## Goal
- 完成识别证据在灵化全链路的可追踪贯通：
  - session 落库并回传 `identify.taskId/sourceRefs`
  - draft 自动写入“识别证据 + 生图参数”快照
  - chat orchestration 注入识别证据上下文
  - analytics 事件补齐 `identifyTaskId/artifacts`
  - 发布页可视化显示证据快照

## Completed
- 前端数据模型与快照：
  - `src/types/models.ts`
    - `CanonicalIdentifySnapshot` 增加 `sourceRefs: string[]`
  - `src/services/identifyCanonical.ts`
    - `toCanonicalIdentifySnapshot` 映射 `IdentifyTask.sourceRefs`
- 灵化页证据注入：
  - `src/pages/SpiritPage.tsx`
    - 创建 session 时透传 `identify.taskId/sourceRefs/provider/model`
    - 本地草稿 fallback 透传 `identifyTaskId/sourceRefs/generation*`
    - `orchestration.diagnosisContext` 注入 `identifyTaskId/sourceRefs`
    - 检索来源索引追加识别来源 `sourceRefs`
- 前端草稿构建文本：
  - `src/services/spiritSessionApi.ts`
    - 本地草稿内容增加：
      - `识别任务ID：...`
      - `识别来源：...`
      - `生图参数：preset=... / workflow=... / promptId=...`
- 后端校验与持久化：
  - `server/lib/validators.js`
    - `validateSpiritSessionPayload` 接收并校验 `identify.taskId/sourceRefs/provider/model`
    - `validateSpiritChatPayload` 接收 `diagnosisContext.identifyTaskId/sourceRefs`
  - `server/lib/spiritSessionService.js`
    - session 规范化包含 `identify.taskId/sourceRefs/provider/model`
  - `server/lib/supabaseService.js`
    - session 映射回传 `identify.taskId/sourceRefs/provider/model`
- 草稿生成证据化：
  - `server/lib/spiritDraftBuilder.js`
    - 草稿正文增加证据行：
      - `识别任务ID：...`
      - `识别来源：...`
      - `生图任务ID：...`
      - `生图参数：preset=... / workflow=... / promptId=...`
- 事件分析维度补齐：
  - `server/app.js`
    - `spirit_session_create` 增加 `identifyTaskId/artifacts`
    - `spirit_draft_create` 增加 `identifyTaskId/artifacts`
    - `spirit_draft_publish` 增加 `identifyTaskId/artifacts`
- 发布页证据可视化：
  - `src/pages/CommunityPublishPage.tsx`
    - 新增“证据快照”展示：
      - 识别任务ID
      - 识别来源
      - 生图任务ID
      - 生图参数

## Contract/Test Updates
- `server/__tests__/api.contract.test.ts`
  - `POST /api/spirit/sessions` 断言回传 `identify.taskId/sourceRefs`
  - `POST /api/spirit/community-drafts` 断言正文包含：
    - `识别任务ID：identify-task-draft-001`
    - `识别来源：diag:field-note-01`

## Verification
- 已通过：
  1. `npm run test:run -- server/__tests__/api.contract.test.ts`
  2. `npm run test:run -- src/__tests__/spirit-community-draft.test.tsx src/__tests__/spirit-interaction.test.tsx src/__tests__/core-flows-regression.test.tsx`
  3. `npm run build`
- 结果摘要：
  - `api.contract`: 23/23 passed
  - 前端回归：3 files / 5 tests passed
  - 构建：TypeScript + Vite production build passed

## Acceptance Checklist (联调)
1. 先完成识别并进入灵化，触发生成角色后点击“生成社区草稿”。
2. 调 `POST /api/spirit/sessions`，确认响应 `data.identify.taskId` 与 `data.identify.sourceRefs` 存在。
3. 调 `POST /api/spirit/community-drafts`，确认 `data.content` 含“识别任务ID/识别来源/生图参数”。
4. 进入发布页，确认“证据快照”面板显示以上字段。
5. 到 Supabase Table Editor 复核 `conversation_sessions`、`spirit_community_drafts` 新增记录内容与页面一致。

## Next (建议)
- P18: 生图工作流精细对齐（ComfyUI）
  - “识别标签 -> workflow profile”映射配置
  - 导入你提供的工作流 JSON 并做节点映射校验
  - 持久化并展示“本次生图实际 prompt/negative/workflow/profile”
