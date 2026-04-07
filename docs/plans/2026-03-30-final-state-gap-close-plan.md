# 四季夏木（对齐决赛完成态）后续渐进式开发文档
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于当前已完成的 P1-P8 能力，补齐与《决赛+四季夏木》完成态之间的核心差距，形成“识别—解释—行动—追踪—共建”可验收闭环。  
**Architecture:** 继续沿用 `React + Node BFF + Supabase + ComfyUI + SiliconFlow(OpenAI Compatible)`，以“对象先行（Task/Session/Template）+ 契约先行 + 兼容迁移（保留旧接口）”推进。  
**Tech Stack:** React + TypeScript + Vitest + Node HTTP API + Supabase(Postgres/RLS) + OpenAI SDK(SiliconFlow compatible) + ComfyUI

---

## 1. 再次检查结论（2026-03-30）

### 1.1 已验证通过
- `npm run test:api`：PASS（`server/__tests__/api.contract.test.ts`，23 tests）
- `npm run test:run -- src/__tests__/spirit-chat-api.test.ts src/__tests__/spirit-interaction.test.tsx src/__tests__/identify-flow.test.tsx`：PASS（5 tests）
- `npm run build`：PASS
- `npm run test:run -- server/__tests__/encyclopedia-evidence.contract.test.ts`：PASS（3 tests）
- `npm run test:run -- src/__tests__/encyclopedia-evidence-flow.test.tsx`：PASS（1 test）

### 1.2 与决赛文档“完成态”的主要差距
- 识别页主链仍是前端 Mock：`src/pages/IdentifyPage.tsx` 仍调用 `generateRecognition`，并显示“识别结果（Mock）”。
- 识别对象模型未落地：缺少 `diagnosis_tasks / diagnosis_results / action_cards` 三类核心表与对应 API。
- 图鉴“证据化”未完整落地：缺少 `source_index_items / treatment_templates` 与详情聚合接口。
- 长期记忆与会话对象未体系化：当前有 spirit session/draft，但未形成决赛文档定义的 `conversation_sessions / memory_items / memory_summaries` 主链。
- 分析事件未服务端对象化：缺少 `analytics_events / task_logs` 的统一采集与查询口径。

---

## 2. 目标态映射（对齐决赛文档）

### 2.1 主业务对象（必须具备）
- 诊断域：`DiagnosisTask`、`DiagnosisResult`、`ActionCard`
- 图鉴证据域：`SourceIndexItem`、`TreatmentTemplate`
- 灵化对话域：`RolePack`、`ConversationSession`、`MemoryItem/Summary`
- 观测域：`AnalyticsEvent`、`TaskLog`

### 2.2 核心接口（兼容迁移策略）
- 新增目标接口（决赛口径）：
  - `POST /api/identify/tasks`
  - `GET /api/identify/tasks/:id`
  - `GET /api/encyclopedia/search`
  - `GET /api/encyclopedia/:id`
  - `POST /api/chat/stream`
  - `POST /api/spirit/generate`（当前已具备，可扩展 jobType）
- 兼容保留旧接口（当前线上口径）：
  - `/api/spirit/identify`、`/api/spirit/chat`、`/api/spirit/chat/stream`
- 迁移策略：前端优先切到新接口；旧接口保留至少一个迭代周期并输出 deprecation 日志。

---

## 3. 渐进式实施计划（P9-P12）

### P9：识别任务化闭环（最高优先级）
**目标：** 彻底替换识别页 Mock，完成“真实识别 -> 风险等级 -> 行动卡片 -> 历史回看”。

**Task P9-1 数据与契约**
- Files:
  - Modify: `supabase/schema.sql`
  - Create: `server/__tests__/identify-task.contract.test.ts`
  - Create: `docs/contracts/identify-task-v1.md`
- Steps:
  1. 增加表：`diagnosis_tasks`、`diagnosis_results`、`action_cards`（含索引、RLS policy、更新时间触发器）。
  2. 新增契约测试，先写失败用例覆盖 `POST/GET /api/identify/tasks`。
  3. 运行：`npm run test:run -- server/__tests__/identify-task.contract.test.ts`（预期先 FAIL）。

**Task P9-2 后端实现**
- Files:
  - Create: `server/lib/identifyTaskService.js`
  - Create: `server/lib/riskEngine.js`
  - Create: `server/lib/actionCardEngine.js`
  - Modify: `server/app.js`
  - Modify: `server/lib/supabaseService.js`
- Steps:
  1. 实现任务状态流：`pending -> queued -> running -> succeeded|failed`。
  2. 复用 SiliconFlow 识别输出，写入 `diagnosis_results`。
  3. 基于规则引擎生成 `risk_level` 与 `action_cards`。
  4. 跑契约测试至 PASS。

**Task P9-3 前端替换**
- Files:
  - Modify: `src/pages/IdentifyPage.tsx`
  - Create: `src/services/identifyTaskApi.ts`
  - Modify: `src/types/models.ts`
  - Modify: `src/__tests__/identify-flow.test.tsx`
- Steps:
  1. 移除 `generateRecognition` 主路径；改为“创建任务 + 轮询状态 + 展示结构化结果”。
  2. 新增“风险等级 + 行动卡片 + 图鉴跳转”视图。
  3. 用例改为真实任务链，保留显式离线开关作为演示兜底。

**P9 验收**
- `npm run test:run -- server/__tests__/identify-task.contract.test.ts src/__tests__/identify-flow.test.tsx`
- `npm run build`
- 手工：识别页出现“风险等级 + 行动卡片”，且 Supabase 三张新表有新增记录。

---

### P10：图鉴证据化引擎
**目标：** 落地“全文检索 + 来源索引 + 治理模板 + 相关推荐”。

**状态（2026-03-30）：已完成并通过验收**

**Task P10-1 数据层**
- Files:
  - Modify: `supabase/schema.sql`
  - Modify: `supabase/seed.sql`（可选）
- Steps:
  1. 增加 `source_index_items`、`treatment_templates`。
  2. 为检索字段加索引（name/alias/host/symptoms/risk/season）。

**Task P10-2 后端接口**
- Files:
  - Modify: `server/app.js`
  - Modify: `server/lib/supabaseService.js`
  - Create: `server/lib/recommendationService.js`
  - Create: `server/__tests__/encyclopedia-evidence.contract.test.ts`
- Steps:
  1. 新增 `GET /api/encyclopedia/search` 与 `GET /api/encyclopedia/:id`。
  2. 详情接口聚合：基础条目 + 来源索引 + 治理模板 + 相关推荐。

**Task P10-3 前端接入**
- Files:
  - Modify: `src/services/encyclopediaApi.ts`
  - Modify: `src/pages/EncyclopediaPage.tsx`
  - Modify: `src/pages/EncyclopediaDetailPage.tsx`
  - Create: `src/__tests__/encyclopedia-evidence-flow.test.tsx`

**P10 验收**
- `npm run test:run -- server/__tests__/encyclopedia-evidence.contract.test.ts src/__tests__/encyclopedia-evidence-flow.test.tsx`
- 手工：详情页可见来源索引、治理模板、相关推荐三块真实数据。

---

### P11：夏木对话中枢与长期记忆
**目标：** 将当前 Spirit 对话升级为“角色包驱动 + 记忆分层 + 会话可追踪”。

**状态（2026-03-30）：P11-2 已完成，可进入 P12**

**Task P11-1 数据与对象**
- Files:
  - Modify: `supabase/schema.sql`
  - Create: `server/lib/promptOrchestrator.js`
  - Modify: `server/lib/siliconflowService.js`
- Steps:
  1. 增加 `spirit_role_packs`、`conversation_sessions`、`memory_items`、`memory_summaries`。
  2. 构建 Prompt Orchestrator 输入层：`systemPolicy / rolePack / diagnosisContext / retrievalContext / memoryContext / currentIntent`。
- 完成记录（2026-03-30）:
  - `supabase/schema.sql` 已新增四表、索引、RLS policy、`updated_at` triggers。
  - `server/lib/promptOrchestrator.js` 已创建并接入六类上下文拼装。
  - `server/lib/siliconflowService.js` 已改为通过 orchestrator 生成 chat / chatStream 消息。
  - `server/lib/validators.js` 已支持 `orchestration` 输入透传与清洗。
  - 新增测试：`server/__tests__/prompt-orchestrator.test.ts`（2 tests，PASS）。

**Task P11-2 API 与前端**
- Files:
  - Modify: `server/app.js`
  - Create: `server/__tests__/chat-stream-memory.contract.test.ts`
  - Modify: `src/services/spiritChatApi.ts`
  - Modify: `src/pages/SpiritPage.tsx`
- Steps:
  1. 新增/兼容 `POST /api/chat/stream`（保留 `/api/spirit/chat/stream`）。
  2. 对话结束回写 `conversation_sessions` + `memory_summaries`。
  3. 前端展示“当前角色包/记忆命中”调试信息（仅开发环境）。
- 完成记录（2026-03-30）:
  - `server/app.js` 已支持 `/api/chat/stream` 与 `/api/spirit/chat/stream` 双路由。
  - `server/lib/supabaseService.js` 已新增 `persistChatConversation`，写入 `conversation_sessions` + `memory_summaries`。
  - `src/services/spiritChatApi.ts` 已优先请求 `/api/chat/stream`，并保留旧路由回退兼容。
  - `src/pages/SpiritPage.tsx` 已增加开发环境调试面板（角色包、记忆命中、会话链路、摘要 ID）。
  - 新增测试：`server/__tests__/chat-stream-memory.contract.test.ts`（2 tests，PASS）。

**P11 验收**
- `npm run test:run -- server/__tests__/chat-stream-memory.contract.test.ts src/__tests__/spirit-interaction.test.tsx`
- 手工：连续两轮同对象对话可体现记忆延续。

---

### P12：社区知识回流与发布级验收
**目标：** 形成“社区优质内容 -> 知识候选 -> 图鉴增强”闭环，并完成答辩演示链路。

**Task P12-1 回流管道**
- Files:
  - Create: `server/lib/knowledgeBackflowService.js`
  - Modify: `server/app.js`
  - Create: `server/__tests__/community-backflow.contract.test.ts`
- Steps:
  1. 新增“已解决 + 高质量回答”候选抽取接口/任务。
  2. 生成候选记录并可人工审核入 `source_index_items`/`treatment_templates`。

**Task P12-2 发布验收包**
- Files:
  - Create: `docs/release/final-demo-checklist.md`
  - Modify: `docs/runbooks/ops-and-recovery.md`
- Steps:
  1. 固化一键联调脚本：`identify -> action cards -> encyclopedia detail -> spirit stream -> draft publish`。
  2. 产出“离线演示模式”和“真实 API 模式”切换说明。

**P12 验收**
- `npm run test:api`
- `npm run build`
- 按 `final-demo-checklist` 全链路演示成功。

---

## 4. 执行顺序与节奏建议
1. 先执行 P9（识别任务化），这是与决赛完成态差距最大且用户可见最强的一段。  
2. 再执行 P10（图鉴证据化），补齐“有依据”的核心答辩点。  
3. 再执行 P11（长期记忆），把灵化从“可聊”提升为“持续陪伴”。  
4. 最后执行 P12（回流与发布），把工程能力转成可演示、可交付成果。

---

## 5. 本轮结论
- 当前程序“可执行、可联调、可构建”，但“识别页主链仍是 mock + 识别对象模型缺失”是第一阻塞项。  
- 后续开发已整理为 P9-P12 四阶段，可直接按任务分段实施与验收。  
- P10 已完成“图鉴证据化链路”并通过前后端用例与构建验证。  
- 下一步建议进入 **P11-1（角色包 + 会话 + 记忆分层）**。
