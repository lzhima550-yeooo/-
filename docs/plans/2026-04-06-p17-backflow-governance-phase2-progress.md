# P17 二期进展（2026-04-06）：社区知识回流治理

## 目标
将回流流程从“候选 -> 审核 -> 入库”升级为可治理流程，补齐：
- 审核记录（可审计）
- 回滚（可撤销）
- 冲突处理（可裁决）
- 质量评分（延续既有能力）

## 本次完成

### 1) 审核记录
- 新增审核记录 API：
  - `GET /api/community/backflow/candidates/:id/reviews`
- 新增审核动作记录：
  - `approve`、`reject`、`rollback`、`conflict`
- 每次审核动作写入 `knowledge_backflow_reviews`，保留：审核人、备注、状态变更、动作快照。

### 2) 回滚能力
- 新增回滚 API：
  - `POST /api/community/backflow/candidates/:id/rollback`
- 回滚时会按候选类型执行：
  - `source_index`：删除本次入库来源项
  - `treatment_template`：回滚到审核快照中的前态（或删除新增模板）

### 3) 冲突处理
- 审批 API 支持 `conflictStrategy`：
  - `overwrite`
  - `merge`（模板场景）
  - `keep_existing`
- 当检测到冲突且未给出可执行策略时：
  - 候选进入 `lifecycle_state=conflicted`
  - 记录 `conflict_detail`
  - 写入 `conflict` 审核日志

### 4) 来源追溯
- 来源与模板入库时写入回流追溯字段：
  - `backflow_candidate_id`
  - `backflow_review_id`
  - `source_post_id`
  - `source_answer_id`
- 形成“知识条目 -> 回流候选 -> 审核记录”的反查链路。

## 主要变更文件
- `server/app.js`
- `server/lib/validators.js`
- `server/lib/supabaseService.js`
- `server/lib/knowledgeBackflowService.js`
- `supabase/schema.sql`
- `server/__tests__/community-backflow.contract.test.ts`

## 验证证据
1. `npm run test:run -- server/__tests__/community-backflow.contract.test.ts --pool=threads --maxWorkers=1`
   - 7 tests passed
2. `npm run test:api`
   - 25 tests passed
3. `npm run build`
   - TypeScript + Vite build passed

## 备注
- 本次仅覆盖 P17 二期，不包含 P18 发布冻结项。
- `supabase/schema.sql` 已更新，需在 Supabase SQL Editor 执行后再进行线上联调。
