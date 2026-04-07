# 四季夏木 P6 开发记录：队列化、可靠性与安全基线（2026-03-30）

## 1. 阶段目标
- 将生图任务执行链从“单次内存执行”升级为“可重试队列执行”。
- 增加幂等创建能力，防止重复提交生成重复任务。
- 增加接口级限流、请求体大小限制、图片输入白名单与大小限制。
- 补齐运维恢复文档，形成可执行恢复手册。

## 2. 本次实现

### 2.1 任务队列与重试
- 新增通用内存队列：
  - `server/lib/queue.js`
  - 支持：并发控制、指数退避重试、状态回调、关闭清理。
- `server/lib/spiritTaskService.js` 改为队列驱动：
  - 状态：`queued/running/succeeded/failed`（内部支持 `retrying`）
  - 字段：`attempt/maxAttempts/failureReason/nextRetryAt`
  - 幂等键：`idempotencyKey`

### 2.2 接口安全与限流
- 新增限流器：
  - `server/lib/rateLimiter.js`
- `server/app.js` 接入：
  - 写接口默认限流（可通过 `rateLimitRules` 覆盖）
  - `payload too large`（默认 8MB）
  - 支持 `X-Idempotency-Key` / `Idempotency-Key`

### 2.3 上传与图片输入校验
- `server/lib/validators.js` 增强：
  - 仅允许 `http/https` 图片 URL 或 `data:image/*;base64`
  - Data URL 上限 2MB
  - 覆盖字段：社区发帖/回帖、灵化会话封面与生图图链、草稿图片

### 2.4 Worker 入口与运行脚本
- 新增 `server/worker/index.js`（P6 预留 worker 入口）
- `package.json` 新增脚本：
  - `npm run dev:worker`

### 2.5 运维文档
- 新增恢复手册：
  - `docs/runbooks/ops-and-recovery.md`

## 3. 测试与验收

### 3.1 新增测试
- `server/__tests__/queue-retry.test.ts`
  - 队列首错重试后成功
  - 任务幂等键复用
  - 超过最大重试后失败

### 3.2 扩展契约测试
- `server/__tests__/api.contract.test.ts`
  - `POST /api/spirit/generate/tasks` 幂等键复用
  - 不安全图片 URL 拒绝
  - 可配置限流返回 429

### 3.3 验收结果
- `npm run test:run -- server/__tests__/queue-retry.test.ts`：PASS
- `npm run test:api`：PASS（19 tests）
- `npm run test:run -- src/__tests__/spirit-interaction.test.tsx src/__tests__/spirit-community-draft.test.tsx src/__tests__/community-publish-image-only.test.tsx`：PASS
- `npm run build`：PASS

## 4. 当前状态结论
- P6 已达成：任务重试、幂等、限流、输入安全、运行手册均已落地并通过验证。
- 与 P4/P5 链路兼容，当前功能未出现回归。

## 5. 下一阶段建议（P7）
- 进入社区知识回流与发布准备：
  - 高质量问答候选提取
  - 候选审核与入库闭环
  - 最终答辩演示清单与彩排脚本

