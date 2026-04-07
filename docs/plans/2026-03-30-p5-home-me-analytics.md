# 四季夏木 P5 开发记录：首页/我的/分析后端闭环（2026-03-30）

## 1. 阶段目标
- 在 P4（生图 + 会话 + 草稿发布链路）完成后，继续推进 M5：
  - 首页聚合由后端驱动（高警报、社区精选、任务提醒）
  - 我的页面统计优先使用后端对象
  - 分析页新增服务端摘要，保留本地埋点视图

## 2. 本次实现范围

### 2.1 后端接口
- 新增 `GET /api/home/feed`
  - 返回：
    - `alerts`（高风险图鉴）
    - `picks`（社区精选）
    - `reminders`（灵化草稿待发布提醒）
    - `generatedAt`
- 新增 `GET /api/me/stats`
  - 支持 query：
    - `account`
    - `profileName`
    - `favoriteCount`
    - `identifyCount`
  - 返回：
    - `publish/answer/favorite/identify`
    - `eventSummary`
    - `generatedAt`

### 2.2 后端服务层
- 新增 `server/lib/feedService.js`
  - 在无专用服务实现时，基于既有服务聚合首页数据（兜底）
- 新增 `server/lib/statsService.js`
  - 在无专用服务实现时，基于社区数据聚合我的统计（兜底）
- 扩展 `server/lib/supabaseService.js`
  - 新增 `getHomeFeed()`
  - 新增 `getMeStats()`
  - 统一返回结构，兼容前端直接消费
- 更新 `server/app.js`
  - 挂载 `/api/home/feed`、`/api/me/stats`
  - 支持优先走 `service.getHomeFeed/getMeStats`，否则走聚合兜底服务

### 2.3 前端接入
- 新增 `src/services/homeApi.ts`
  - 首页聚合数据请求与归一化
- 新增 `src/services/meApi.ts`
  - 我的统计请求与归一化
- 更新 `src/pages/HomePage.tsx`
  - 首页优先读 `/api/home/feed`
  - 保留本地图鉴/帖子兜底
  - 新增“任务提醒”区块
- 更新 `src/pages/AchievementsPage.tsx`
  - 统计优先读 `/api/me/stats`
  - 本地统计作为兜底
- 更新 `src/pages/AnalyticsPage.tsx`
  - 新增服务端事件摘要区块（来自 `/api/me/stats.eventSummary`）
  - 保留本地埋点总览与明细

## 3. 测试与验收

### 3.1 后端契约（新增接口）
- 更新 `server/__tests__/api.contract.test.ts`
  - 新增：
    - `GET /api/home/feed returns high alerts, picks and reminders`
    - `GET /api/me/stats returns profile counters and event summary`

执行结果：
- `npm run test:api`：PASS（16 tests）

### 3.2 前端联动回归
- 新增 `src/__tests__/home-me-analytics-integration.test.tsx`
  - 覆盖：登录后首页拉取聚合、我的页显示后端统计、分析页展示服务端摘要
- 同时回归：
  - `src/__tests__/home-search.test.tsx`
  - `src/__tests__/my-profile-edit.test.tsx`
  - `src/__tests__/achievements-badge-progress.test.tsx`

执行结果：
- `npm run test:run -- src/__tests__/home-me-analytics-integration.test.tsx src/__tests__/home-search.test.tsx src/__tests__/my-profile-edit.test.tsx src/__tests__/achievements-badge-progress.test.tsx`：PASS（6 tests）

### 3.3 构建验收
- `npm run build`：PASS

## 4. 当前状态结论
- P5 已完成“应用可用 + 契约可测 + 构建可过”的阶段目标。
- 当前链路：
  - 灵化生图任务化 + 会话草稿发布（P4）
  - 首页/我的/分析后端聚合闭环（P5）
  - 均可在现有 Supabase + 本地前端环境运行。

## 5. 下一阶段建议（P6）
- 目标：可靠性与安全基线（对应 M6）
  - 任务统一队列化（重试、幂等、失败原因）
  - 识别/对话端点速率限制
  - 上传白名单与内容类型校验
  - 补充运维 runbook（恢复与回滚）

