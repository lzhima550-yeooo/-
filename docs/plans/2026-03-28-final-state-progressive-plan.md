# 四季夏木完成态渐进开发实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前可运行但含 Mock 的四季夏木，渐进升级为“识别-解释-行动-追踪-共建”闭环完成态，并保持每个阶段都可演示、可回归、可部署。

**Architecture:** 保持现有 React + Node BFF + Supabase 结构不推倒重来；按“接口契约优先、任务对象优先、前后端双轨兼容（Mock 可回退）”推进。先补关键对象与 API，再替换页面数据源，最后补队列、观测与安全。

**Tech Stack:** React + Vite + TypeScript、Node HTTP API、Supabase(Postgres + Storage + RLS)、Vitest、DeepSeek/Ollama(文本)、ComfyUI(图像)。

---

## 0. 基线快照（2026-03-28）

### 0.1 已有基础（可复用）
- 路由骨架齐全（欢迎、登录、首页、识别、图鉴、灵化、社区、我的、分析）。
- 图鉴与社区已有后端联通能力（`/api/encyclopedia`、`/api/community/posts`、回帖）。
- 社区楼层、图片标注、收藏、本地埋点、勋章成长等页面能力已具备。
- 构建与大部分测试可通过，具备持续迭代基础。

### 0.2 与决赛目标的核心差距
- 识别主链仍是 Mock：`IdentifyPage` 直接调用 `generateRecognition`，并显示“识别结果（Mock）”。
- 灵化对话仍是 Mock：`SpiritPage` 使用 `buildDeepSeekMockReply` 前端模拟流式文本。
- 灵化识别服务默认 `mock`，远端失败也回退 mock 结果。
- 后端缺失完成态关键接口：`/api/identify/tasks`、`/api/chat/stream`、`/api/spirit/generate`、`/api/home/feed`、`/api/me/stats`。
- Supabase 仅有图鉴与社区三张主表，缺少任务、来源索引、治理模板、角色包、会话记忆等完成态对象。

### 0.3 代码证据（当前现状）
- Mock 识别页：[IdentifyPage.tsx](/D:/yeoooo/summer-wood-app/src/pages/IdentifyPage.tsx:4) [IdentifyPage.tsx](/D:/yeoooo/summer-wood-app/src/pages/IdentifyPage.tsx:76)
- 灵化 Mock 对话：[SpiritPage.tsx](/D:/yeoooo/summer-wood-app/src/pages/SpiritPage.tsx:40) [SpiritPage.tsx](/D:/yeoooo/summer-wood-app/src/pages/SpiritPage.tsx:240)
- 灵化识别默认 Mock：[spiritIdentifyService.ts](/D:/yeoooo/summer-wood-app/src/services/spiritIdentifyService.ts:22) [spiritIdentifyService.ts](/D:/yeoooo/summer-wood-app/src/services/spiritIdentifyService.ts:174)
- 当前后端路由范围：[app.js](/D:/yeoooo/summer-wood-app/server/app.js:59) [app.js](/D:/yeoooo/summer-wood-app/server/app.js:88)
- 当前数据库对象范围：[schema.sql](/D:/yeoooo/summer-wood-app/supabase/schema.sql:13) [schema.sql](/D:/yeoooo/summer-wood-app/supabase/schema.sql:51)

### 0.4 可执行性检查（已验证）
- `npm run build`：通过。
- `npm run test:api`：通过（4/4）。
- 关键回归集（识别/灵化/社区/图鉴）7/7 通过。
- 全量测试出现 1 次超时（`encyclopedia-category-filter`），单测重跑通过，判定为稳定性问题而非结构性阻塞。

结论：**当前“可执行”，可作为渐进开发起点。**

---

## Task 1: 完成态契约与数据模型先行（M1）

**Files:**
- Create: `docs/contracts/final-state-api-v1.md`
- Modify: `supabase/schema.sql`
- Modify: `supabase/seed.sql`
- Create: `server/lib/contracts.js`
- Create: `server/__tests__/api.final-state.contract.test.ts`

**Step 1: 先写失败契约测试（RED）**
- 覆盖接口骨架：
  - `POST /api/identify/tasks`
  - `GET /api/identify/tasks/:id`
  - `GET /api/encyclopedia/search`
  - `GET /api/encyclopedia/:id`
  - `POST /api/chat/stream`
  - `POST /api/spirit/generate`
  - `GET /api/home/feed`
  - `GET /api/me/stats`
- 先只校验状态码、字段结构、状态枚举，不校验 AI 真实性能。

**Step 2: 扩展数据库对象**
- 新增表（最小可用）：
  - `diagnosis_tasks`, `diagnosis_results`, `action_cards`
  - `source_index_items`, `treatment_templates`
  - `spirit_role_packs`, `generation_jobs`, `conversation_sessions`
  - `memory_items`, `analytics_events`
- 新增必要索引与 RLS 基线策略。

**Step 3: 跑测试确认失败点集中在“未实现接口”**
- Run: `npm run test:run -- server/__tests__/api.final-state.contract.test.ts`
- Expected: FAIL，且失败点为接口未实现/返回结构不匹配。

---

## Task 2: 打通识别任务链（M2）

**Files:**
- Modify: `server/app.js`
- Create: `server/lib/identifyService.js`
- Create: `server/lib/riskEngine.js`
- Create: `server/lib/actionCardEngine.js`
- Modify: `src/pages/IdentifyPage.tsx`
- Create: `src/services/identifyApi.ts`
- Modify: `src/types/models.ts`
- Create: `src/__tests__/identify-task-flow.test.tsx`

**Step 1: 先写前后端失败测试**
- 前端：上传后拿到 `taskId`，轮询状态到 `succeeded`，渲染风险等级+行动卡片。
- 后端：`pending|queued|running|succeeded|failed` 状态流转正确。

**Step 2: 后端最小实现**
- 实现任务创建与查询接口。
- 先用“适配层”封装第三方识别 API；失败回退标准化错误，不回退伪造成功结果。
- 风险等级与行动卡片基于规则先落地（可先规则引擎，后续再模型增强）。

**Step 3: 前端替换 Mock**
- 去掉 `generateRecognition` 主路径，改为 `identifyApi`。
- 保留“演示兜底”开关，仅在配置显式开启时允许 mock fallback。

**Step 4: 回归验证**
- Run: `npm run test:run -- src/__tests__/identify-task-flow.test.tsx server/__tests__/api.final-state.contract.test.ts`
- Expected: PASS。

---

## Task 3: 升级图鉴为“证据化知识引擎”（M3）

**Files:**
- Modify: `server/app.js`
- Modify: `server/lib/supabaseService.js`
- Create: `server/lib/recommendationService.js`
- Modify: `src/services/encyclopediaApi.ts`
- Modify: `src/pages/EncyclopediaPage.tsx`
- Modify: `src/pages/EncyclopediaDetailPage.tsx`
- Create: `src/__tests__/encyclopedia-evidence-flow.test.tsx`

**Step 1: 扩展接口**
- 新增：
  - `GET /api/encyclopedia/search`（多字段检索+结构化筛选）
  - `GET /api/encyclopedia/:id`（含来源索引、治理模板、相关推荐）

**Step 2: 前端详情页补齐三块内容**
- 来源索引（source type、可信度、出处片段）
- 治理模板（观察项/立即处理/复查节奏）
- 相关推荐（同类、同寄主、同季节）

**Step 3: 验收**
- Run: `npm run test:run -- src/__tests__/encyclopedia-evidence-flow.test.tsx`
- Expected: PASS。

---

## Task 4: 灵化对话与生图任务化（M4）

**Files:**
- Modify: `server/app.js`
- Create: `server/lib/chatService.js`
- Create: `server/lib/spiritGenerationService.js`
- Create: `server/lib/modelRouter.js`
- Modify: `src/pages/SpiritPage.tsx`
- Create: `src/services/chatApi.ts`
- Create: `src/services/spiritGenerationApi.ts`
- Create: `src/__tests__/spirit-stream-and-generation.test.tsx`

**Step 1: 文本对话从前端 mock 改为后端流式**
- 接口：`POST /api/chat/stream`
- 前端接入 SSE 或分块文本流，保留首字延迟与加载态。

**Step 2: 生图任务化接入**
- 接口：`POST /api/spirit/generate` + `GET /api/spirit/generate/:id`
- 先支持 `persona_portrait` 一种 `jobType`，后续扩展 `pathology_explainer`。

**Step 3: 多模型路由最小版**
- `modelRouter` 根据任务类型决定走 DeepSeek/Ollama/ComfyUI。
- 先实现可配置路由，不做复杂学习策略。

**Step 4: 验收**
- Run: `npm run test:run -- src/__tests__/spirit-stream-and-generation.test.tsx`
- Expected: PASS。

---

## Task 5: 首页/我的/分析与后端对象闭环（M5）

**Files:**
- Modify: `server/app.js`
- Create: `server/lib/feedService.js`
- Create: `server/lib/statsService.js`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/AchievementsPage.tsx`
- Modify: `src/pages/AnalyticsPage.tsx`
- Create: `src/services/homeApi.ts`
- Create: `src/services/meApi.ts`
- Create: `src/__tests__/home-me-analytics-integration.test.tsx`

**Step 1: 接口**
- `GET /api/home/feed`：高警报、社区精选、任务提醒。
- `GET /api/me/stats`：发布/解答/收藏/识别统计。

**Step 2: 页面替换本地聚合逻辑**
- 首页“本月高警报/社区精选”改为服务端聚合返回。
- 我的页面统计来源改为后端。
- 分析页支持服务端事件摘要（保留本地埋点视图作为开发开关）。

**Step 3: 验收**
- Run: `npm run test:run -- src/__tests__/home-me-analytics-integration.test.tsx`
- Expected: PASS。

---

## Task 6: 队列、可靠性与安全（M6）

**Files:**
- Create: `server/lib/queue.js`
- Create: `server/worker/index.js`
- Modify: `server/lib/supabaseService.js`
- Modify: `supabase/schema.sql`
- Create: `server/__tests__/queue-retry.test.ts`
- Create: `docs/runbooks/ops-and-recovery.md`

**Step 1: 把识别/生图任务统一入队**
- 支持重试、失败原因、幂等键、最大重试次数。

**Step 2: 安全基线**
- 上传白名单、大小限制、内容类型校验。
- 接口速率限制（至少识别与对话端点）。
- RLS 与服务角色使用边界文档化。

**Step 3: 验收**
- Run: `npm run test:run -- server/__tests__/queue-retry.test.ts`
- Expected: PASS。

---

## Task 7: 社区知识回流与发布准备（M7）

**Files:**
- Create: `server/lib/knowledgeBackflowService.js`
- Modify: `server/app.js`
- Modify: `src/pages/CommunityDetailPage.tsx`
- Create: `src/__tests__/community-backflow-candidate.test.tsx`
- Modify: `README.md`
- Create: `docs/release/final-demo-checklist.md`

**Step 1: 社区高质量内容标记与候选入库**
- 支持“已解决 + 高质量答复”生成知识候选对象。

**Step 2: 演示与发布清单**
- 补齐环境变量、启动顺序、回滚策略、演示数据准备。

**Step 3: 验收**
- Run: `npm run test:run -- src/__tests__/community-backflow-candidate.test.tsx`
- Expected: PASS。

---

## 里程碑与验收门槛

- M1（契约与模型）：所有目标接口有契约测试，数据对象落库可查。
- M2（识别闭环）：识别页面不再依赖 `generateRecognition`。
- M3（图鉴证据化）：详情页出现来源索引/治理模板/相关推荐三块真实数据。
- M4（灵化真实化）：对话不再走 `buildDeepSeekMockReply` 主路径；生图有任务对象。
- M5（用户闭环）：首页与我的统计由后端对象驱动。
- M6（工程可靠）：任务队列、重试、限流、日志可回放。
- M7（答辩发布）：社区知识回流和演示清单可执行。

---

## 风险与规避

- 第三方 API 不稳定：所有外部调用必须任务化 + 错误可见 + 可重试。
- AI 输出漂移：对话层加入来源约束、风险提示、禁止误导规则。
- 开发节奏过快导致回归破坏：每个里程碑要求“契约测试 + 关键路径 UI 测试”双通过。
- 演示时网络不稳：保留可控离线兜底，但与正式主链隔离，不混淆真实能力声明。

---

## 执行顺序建议（最小可交付）

1. 先做 Task 1 + Task 2（把识别闭环从 Mock 变真实）。
2. 再做 Task 3（图鉴证据化，支撑“可查证”）。
3. 接着做 Task 4（灵化真实流式对话与生图任务）。
4. 最后做 Task 5~7（工程化、回流、发布准备）。

