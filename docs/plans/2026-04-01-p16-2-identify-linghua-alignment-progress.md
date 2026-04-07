# P16-2 Progress (2026-04-01): AI识别-灵化同源链路修复

> Scope: 修复“AI识别结果”与“灵化智能鉴别结果”不一致、图鉴强绑定、生图标签不对齐、缺少重试动作等问题。

## 1. 本轮目标

- 统一识别来源：灵化页改为与 AI识别页同源（`/api/identify/tasks`）。
- 以 AI识别结果为准：在灵化页优先消费 `latestIdentifySnapshot`。
- 取消图鉴强绑定：只有识别结果返回 `encyclopediaId` 才展示图鉴入口。
- 生图提示词对齐识别标签：按虫害/病害角色包编译正负提示词。
- 增加“重新识别”和“重新灵化”按钮，形成可重试链路。

## 2. 已完成改造

### 2.1 识别链路同源化

- `src/pages/SpiritPage.tsx`
  - 移除旧 `spiritIdentifyService` 入口。
  - 改为调用 `createIdentifyTaskOnServer + waitForIdentifyTask`。
  - 识别完成后统一转换为 `CanonicalIdentifySnapshot`。
  - 将结果回写 `useAppStore.latestIdentifySnapshot`，供全局复用。
  - 后端识别不可达时自动降级离线识别（保持流程可演示）。

### 2.2 AI识别页稳定性修复

- `src/pages/IdentifyPage.tsx`
  - 修复编码损坏导致的编译错误（未闭合字符串）。
  - 保留任务化识别流程，新增失败自动离线兜底，避免流程中断。
  - 识别成功或降级时都会写入历史与 `latestIdentifySnapshot`。

### 2.3 角色包与生图对齐

- `src/services/identifyCanonical.ts`
  - 使用虫害/病害角色包输出人格、守则、快捷回复、视觉关键词。
  - 编译生图正提示词与负提示词，避免“标签不符的二次元形象”。
  - `buildSpiritProfileFromSnapshot` 由识别结果动态生成角色资料，不再依赖固定静态匹配。

- `src/pages/SpiritPage.tsx`
  - 生图任务 payload 增加 `prompt`、`negativePrompt`、角色包关键词。
  - 角色卡、对话编排、治理建议均以识别快照为主输入。

### 2.4 图鉴非强绑 + 重试能力

- `src/pages/SpiritPage.tsx`
  - 图鉴入口改为条件渲染：无 `encyclopediaId` 时显示“图鉴暂未收录”提示。
  - 新增 `重新识别`（`data-testid="spirit-reidentify"`）。
  - 新增 `重新灵化`（`data-testid="spirit-regenerate"`）。

## 3. 本地验证结果

已通过测试：

1. `npm run test:run -- src/__tests__/identify-flow.test.tsx`
2. `npm run test:run -- src/__tests__/spirit-interaction.test.tsx`
3. `npm run test:run -- src/__tests__/spirit-community-draft.test.tsx`
4. `npm run test:run -- src/__tests__/core-flows-regression.test.tsx`

说明：

- `spirit-interaction` 已更新为“非强制图鉴映射”断言。
- `IdentifyPage` 在后端不可达时会自动降级到离线识别，保证回归通过。

## 4. 手机端/联调验收手段（当前版本）

1. 进入灵化页上传图片，确认先出现“智能鉴别”结果卡再开放灵化按钮。
2. 若识别对象无图鉴项，确认显示“图鉴暂未收录”而不是错误跳转。
3. 点击“生成灵化角色”，确认角色标签与识别关键词一致。
4. 点击“重新识别”，确认识别会重新执行并刷新识别卡。
5. 点击“重新灵化”，确认会重新发起生图任务并替换立绘。

## 5. 下一阶段（建议）

### P17: 识别任务证据贯通

- 在 session / draft / analytics 中强制落库 `identifyTaskId`。
- chat orchestration 注入识别任务来源索引（sourceRefs）。
- 社区发布链路展示“识别证据快照 + 生图参数快照”。

### P18: 生图工作流精细对齐（ComfyUI）

- 增加“识别标签 -> workflow profile”映射表（含可视化配置）。
- 支持导入你提供的工作流 JSON 并做节点级字段映射校验。
- 输出“本次生图实际 prompt/negative/workflow/profile”可追踪记录。

### P19: 真机验收与可观测性

- 增加手机端五分钟验收脚本（成功路径 + 降级路径）。
- 增加识别/生图失败原因分层统计（网络、模型、工作流、超时）。
- 增加“重试成功率”指标，闭环评估重新识别/重新灵化能力。
