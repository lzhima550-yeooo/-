# P18 验收清单（发布冻结与答辩交付包）

## A. 冻结版本信息
- [ ] 当前代码已固定到本地可复现状态（记录 commit id）。
- [ ] `.env` 已按答辩机配置完成。
- [ ] `npm install`、`npm run build` 均通过。

## B. 一键演示脚本
- [ ] `npm run rehearse:p18 -- --mode offline` 返回 `pass=true`。
- [ ] 生成 `docs/release/p18-rehearsal-latest.json`。
- [ ] 报告中包含：
  - [ ] `api-up.ok=true`
  - [ ] `web-up.ok=true`
  - [ ] `verify-final-demo-offline.ok=true`

## C. 关键链路验收（P17 + P18）
- [ ] `GET /api/community/backflow/candidates/:id/reviews` 可返回审核记录。
- [ ] `POST /api/community/backflow/candidates/:id/reject` 执行成功并写入 review。
- [ ] `POST /api/community/backflow/candidates/:id/rollback` 执行成功并写入 review。
- [ ] 回滚后可再次 `approve`，形成完整可追溯链路。

## D. 本地化可演示能力（解决 Vercel 依赖）
- [ ] 前端本地启动：`npm run dev -- --host 0.0.0.0 --port 5173`。
- [ ] API 本地启动：`node server/index.js`。
- [ ] 不依赖 Vercel 也可完整演示主链路。

## E. ComfyUI 风险控制
- [ ] `npm run verify:comfyui` 通过，或已确认采用 offline 兜底方案。
- [ ] 已准备“ComfyUI 不可用时”的演示切换说明。

## F. 交付包完整性
- [ ] 运维手册：`docs/runbooks/p18-ops-manual.md`
- [ ] 验收清单：`docs/release/p18-acceptance-checklist.md`
- [ ] 回滚方案：`docs/release/p18-rollback-plan.md`
- [ ] 彩排报告：`docs/release/p18-rehearsal-latest.json`

## G. 最终判定
- [ ] 全部 A-F 勾选完成后，判定“可进入答辩发布态”。
