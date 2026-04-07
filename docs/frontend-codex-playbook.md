# VS Code Codex 前端指挥手册（四季夏木）

本手册给你可直接复制到 VS Code Codex 的指令，按阶段推进，避免一次性大改。

## 0. 项目启动指令

```text
在 D:\yeoooo\summer-wood-app 工作。先阅读 stitch 文件夹下 _1 ~ _6 和 -7 的 code.html/screen.png，按这些原型完成移动端前端。技术栈固定 React + TypeScript + Tailwind。先不要接后端，全部用 mock 数据。
```

## 1. 阶段一：搭建页面骨架（先跑通路由）

```text
只做页面结构，不做复杂交互。完成以下路由并可互相跳转：/login /home /encyclopedia /encyclopedia/:id /identify /spirit /community /community/new /community/:id /me。底部 tab 需要固定，移动端优先。
完成后运行 npm run build，并告诉我每个页面对应哪个 stitch 原型。
```

验收：
- 每个路由可打开
- 页面标题和分区完整
- build 通过

## 2. 阶段二：补交互（核心业务）

```text
在现有骨架上实现交互：
1) 任意账号密码登录（非空即可）
2) 图鉴检索与虫害/病害筛选
3) 图片上传 + mock AI 识别结果
4) 社区发帖、详情、回答、已解决状态
5) 灵化互动：关键词匹配角色卡 + 收藏
6) 我的成就：发布/回答/收藏统计 + 勋章墙
使用 Zustand 持久化状态。
```

验收：
- 刷新后状态保留
- 主流程无阻塞

## 3. 阶段三：对齐视觉（按 stitch 细化）

```text
把 UI 细化到接近 stitch：
- 统一使用 Material Symbols，不允许 emoji 图标
- 首页加入搜索条、推荐 banner、四宫格入口
- 图鉴页做卡片网格和标签
- 社区页做状态 badge（待解决/已解决）
- 色彩控制在浅绿/米白/浅灰，不要偏紫
同时保证移动端 375px 不出现横向滚动。
```

验收：
- 视觉风格统一
- 组件间距与层级清晰

## 4. 阶段四：测试与回归

```text
为登录流程、识别流程、首页搜索跳转图鉴流程补测试（Vitest + Testing Library）。
先写失败测试，再实现，再跑通。
最后执行 npm run test:run 和 npm run build，并汇总结果。
```

验收：
- 测试全绿
- 构建成功

## 5. 阶段五：交付文档

```text
生成 docs 下两份文档：
1) docs/plans/YYYY-MM-DD-summer-wood-frontend-design.md（设计说明）
2) docs/frontend-handover.md（功能清单、路由、状态结构、后续后端对接点）
文档必须给出文件路径、关键组件、接口预留字段。
```

## 6. 你每次给 Codex 的固定追加约束

```text
要求：
- 每次改动后列出修改文件清单
- 不允许删除现有可用功能
- 每个阶段结束必须运行测试或构建再汇报
- 汇报中给出下一阶段建议，不要空泛描述
```

## 7. 推荐节奏

1. 先下“阶段一”指令，确认路由和框架
2. 再下“阶段二”，拿到可用版本
3. 再下“阶段三”，做视觉打磨
4. 最后“阶段四+五”，确保可交付
