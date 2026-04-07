# 2026-04-06 P18 发布冻结与答辩交付包进展

## 完成项
- 新增一键彩排脚本：`scripts/rehearse-p18-release.mjs`
  - 自动启动本地 API 与前端
  - 支持 real/offline/dual 三种演示模式
  - 支持 ComfyUI 可选验收与降级口径
  - 输出报告：`docs/release/p18-rehearsal-latest.json`
- 新增运维手册：`docs/runbooks/p18-ops-manual.md`
- 新增验收清单：`docs/release/p18-acceptance-checklist.md`
- 新增回滚方案：`docs/release/p18-rollback-plan.md`
- 更新 `docs/release/final-demo-checklist.md`，补充 P18 一键彩排命令与本地部署口径。

## 关键命令
- 一键彩排（推荐）：
  - `npm run rehearse:p18 -- --mode dual`
- 保底彩排：
  - `npm run rehearse:p18 -- --mode offline --skip-build`

## 风险应对（针对当前两大问题）
1. ComfyUI 现场不可达：
   - 默认不阻塞主链路验收，可切 offline 模式继续演示。
2. Vercel 在国内不可达：
   - 采用本地 API + 本地前端运行方案，完全脱离 Vercel。

## 进入答辩发布态的门槛
- `docs/release/p18-rehearsal-latest.json` 中 `pass=true`
- 验收清单 `docs/release/p18-acceptance-checklist.md` 全部勾选完成。
