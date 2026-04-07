# P18 回滚方案（答辩现场可恢复）

## 1. 回滚触发条件
- 一键彩排脚本失败且 10 分钟内无法修复。
- real 模式外部依赖不可用（网络/密钥/模型不可达）。
- ComfyUI 不可用且影响当前演示流程。

## 2. 回滚优先级
1. 模式回滚：real -> offline（首选，最快）。
2. 进程回滚：重启本地 API 与前端到已验证命令。
3. 版本回滚：切回上一个已验收 commit（仅在必须时执行）。

## 3. 快速回滚操作
### 3.1 real 切 offline
```bash
npm run verify:final-demo -- --mode offline --api-base http://127.0.0.1:8787
```

### 3.2 重启服务（本地）
```bash
node server/index.js
npm run dev -- --host 0.0.0.0 --port 5173
```

### 3.3 回到稳定版本（如需）
```bash
git checkout <stable-commit-id>
npm install
npm run rehearse:p18 -- --mode offline
```

## 4. 数据与功能保护策略
- P17 回流数据采用“审核记录 + 回滚记录”保留审计链，不做硬删除清空。
- 即使触发模式回滚，也不破坏 Supabase 既有业务数据。
- 对答辩演示，优先保证“可用链路”而非“所有可选能力同时可用”。

## 5. 现场口径（答辩说明建议）
- 若外部依赖失败：说明系统已按预案切换到 offline 演示模式，核心业务链路仍完整可验收。
- 若 ComfyUI 失败：说明生图为可选增强能力，主链路不依赖该组件。

## 6. 回滚完成判定
- `docs/release/p18-rehearsal-latest.json` 中 `pass=true`。
- 页面可打开，核心演示链路可跑通。
- 关键 API：`/api/health`、`/api/community/backflow/candidates/:id/reviews` 正常响应。
