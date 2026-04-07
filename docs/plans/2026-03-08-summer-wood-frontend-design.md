# 四季夏木前端设计说明（基于 stitch 初稿）

日期：2026-03-08  
范围：仅前端（React + TypeScript + Tailwind CSS v4），以 `D:\yeoooo\stitch` 为视觉基准。

## 1. 设计目标

1. 低门槛体验：任意账号密码即可进入应用。
2. 快速识别闭环：上传图片 -> mock AI 结果 -> 社区问答。
3. 知识检索高效：图鉴检索、虫害/病害筛选、详情浏览。
4. 长期参与激励：灵化互动、收藏、成就勋章。

## 2. 原型映射（stitch -> 路由）

- `stitch/-7` -> `/login`
- `stitch/_1` -> `/home`
- `stitch/_2` -> `/encyclopedia`
- `stitch/_4` -> `/encyclopedia/:id`
- `stitch/_3` -> `/spirit`
- `stitch/_5` -> `/community`（扩展 `/community/new`、`/community/:id`）
- `stitch/_6` -> 登录/首页背景氛围参考

## 3. 视觉策略

- 色彩：浅绿 + 米白 + 浅灰（避免偏紫）。
- 图标：全站统一 Material Symbols。
- 布局：mobile-first，主容器上限 430px。
- 安全区：支持顶部/底部安全区。
- 375 约束：全局 `overflow-x: hidden`，禁止横向滚动。

## 4. 文件路径与关键组件

### 4.1 核心路径

- `src/router/AppRouter.tsx`：路由主入口。
- `src/store/useAppStore.ts`：全局状态（Zustand + persist）。
- `src/components/MobileFrame.tsx`：移动端外框与背景。
- `src/components/ProtectedLayout.tsx`：登录守卫 + 页面容器。
- `src/components/PageHeader.tsx`：统一页头。
- `src/components/BottomTabBar.tsx`：底部固定导航。
- `src/components/DesktopSidebar.tsx`：桌面侧边导航。
- `src/components/MaterialSymbol.tsx`：图标统一封装。

### 4.2 页面路径

- `src/pages/LoginPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/IdentifyPage.tsx`
- `src/pages/EncyclopediaPage.tsx`
- `src/pages/EncyclopediaDetailPage.tsx`
- `src/pages/CommunityPage.tsx`
- `src/pages/CommunityPublishPage.tsx`
- `src/pages/CommunityDetailPage.tsx`
- `src/pages/SpiritPage.tsx`
- `src/pages/AchievementsPage.tsx`

## 5. 状态与数据流

- 登录态：`isLoggedIn`, `account`
- 社区：`posts`, `addCommunityPost`, `addAnswer`
- 收藏：`favoritePostIds`, `favoriteSpiritIds`
- 识别：`identifyHistory`, `addIdentifyRecord`
- 成就：`myAnswerCount`
- 持久化：`persist` + `partialize`

## 6. 接口预留字段（后端对接）

### 6.1 Auth

- `POST /api/auth/login`
- request: `{ account: string, password: string }`
- response: `{ token: string, user: { id: string, name: string, role?: string } }`

### 6.2 Encyclopedia

- `GET /api/encyclopedia?type=&q=`
- item: `{ id, type, name, scientificName, risk, season, host, summary, image, controlTips: string[] }`

### 6.3 Identify

- `POST /api/identify`
- request: `multipart/form-data` (`image`)
- response: `{ id, name, type, confidence, keywords: string[], cover }`

### 6.4 Community

- `GET /api/community/posts`
- `POST /api/community/posts`
- `POST /api/community/posts/:id/answers`
- post: `{ id, title, content, image?, status: 'open'|'solved', author, createdAt, likes, answers: Answer[] }`
- answer: `{ id, author, content, createdAt, fromMe?: boolean }`

### 6.5 Me / Achievements

- `GET /api/me/stats` -> `{ publishCount, answerCount, favoriteCount }`
- `GET /api/me/badges` -> `{ id, title, description, threshold, current, unlocked }[]`
- `POST /api/favorites/posts/:id`
- `POST /api/favorites/spirits/:id`

## 7. 质量门槛

- `npm run test:run` 通过
- `npm run build` 通过
- 关键流程（登录/识别/首页搜索跳转图鉴）有测试覆盖
