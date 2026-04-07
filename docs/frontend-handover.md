# 四季夏木前端交接文档

更新时间：2026-03-08  
项目路径：`D:\yeoooo\summer-wood-app`

## 1. 功能清单

1. 登录：任意非空账号密码可登录。
2. 首页：搜索条、推荐 banner、四宫格入口、高警报、社区精选。
3. 图鉴：检索、虫害/病害筛选、卡片标签、详情页。
4. AI 识别：图片上传、mock 识别结果、最近识别记录。
5. 社区：列表、发帖、详情、回答、状态从待解决切已解决。
6. 灵化：关键词匹配角色卡、收藏。
7. 我的：发布/回答/收藏统计 + 勋章墙。

## 2. 路由清单

- `/`：按登录态重定向
- `/login`
- `/home`
- `/identify`
- `/encyclopedia`
- `/encyclopedia/:id`
- `/community`
- `/community/new`
- `/community/:id`
- `/spirit`
- `/me`

路由文件：`src/router/AppRouter.tsx`

## 3. 关键组件与文件路径

### 3.1 布局层

- `src/components/MobileFrame.tsx`
- `src/components/ProtectedLayout.tsx`
- `src/components/PageHeader.tsx`
- `src/components/BottomTabBar.tsx`
- `src/components/DesktopSidebar.tsx`
- `src/components/MaterialSymbol.tsx`

### 3.2 页面层

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

### 3.3 状态与 mock

- `src/store/useAppStore.ts`
- `src/mock/ai.ts`
- `src/mock/encyclopedia.ts`
- `src/mock/community.ts`
- `src/mock/spirits.ts`
- `src/mock/badges.ts`

## 4. 状态结构（Zustand）

状态定义文件：`src/store/useAppStore.ts`

- `isLoggedIn: boolean`
- `account: string`
- `posts: CommunityPost[]`
- `favoriteSpiritIds: string[]`
- `favoritePostIds: string[]`
- `identifyHistory: RecognitionResult[]`
- `myAnswerCount: number`

主要 actions：

- `login(account, password)`
- `logout()`
- `addCommunityPost(payload)`
- `addAnswer(postId, content)`
- `toggleFavoriteSpirit(spiritId)`
- `toggleFavoritePost(postId)`
- `addIdentifyRecord(result)`

持久化策略：`persist + partialize`（localStorage key: `summer-wood-app-store`）

## 5. 接口预留字段（后端对接点）

### 5.1 登录

- `POST /api/auth/login`
- request:
```json
{ "account": "string", "password": "string" }
```
- response:
```json
{ "token": "string", "user": { "id": "string", "name": "string", "role": "student|teacher|admin" } }
```

### 5.2 图鉴

- `GET /api/encyclopedia?type=insect|disease&q=keyword`
- item:
```json
{
  "id": "string",
  "type": "insect|disease",
  "name": "string",
  "scientificName": "string",
  "risk": "低|中|高",
  "season": "string",
  "host": "string",
  "summary": "string",
  "image": "string",
  "controlTips": ["string"]
}
```

### 5.3 AI 识别

- `POST /api/identify`
- request: `multipart/form-data` (`image`)
- response:
```json
{
  "id": "string",
  "name": "string",
  "type": "昆虫|病害",
  "confidence": 0.92,
  "keywords": ["string"],
  "cover": "string"
}
```

### 5.4 社区

- `GET /api/community/posts`
- `POST /api/community/posts`
- `POST /api/community/posts/:id/answers`
- post:
```json
{
  "id": "string",
  "title": "string",
  "content": "string",
  "image": "string",
  "status": "open|solved",
  "author": "string",
  "createdAt": "string",
  "likes": 0,
  "answers": []
}
```

### 5.5 收藏与成就

- `POST /api/favorites/posts/:id`
- `POST /api/favorites/spirits/:id`
- `GET /api/me/stats`
```json
{ "publishCount": 0, "answerCount": 0, "favoriteCount": 0 }
```
- `GET /api/me/badges`
```json
[{ "id": "string", "title": "string", "description": "string", "threshold": 10, "current": 2, "unlocked": false }]
```

## 6. 测试与构建

测试目录：`src/__tests__`

- `auth-login.test.tsx`
- `identify-flow.test.tsx`
- `home-search.test.tsx`
- `encyclopedia-tags.test.tsx`
- `core-flows-regression.test.tsx`

执行命令：

- `npm run test:run`
- `npm run build`

## 7. 后续对接建议

1. 优先替换 `useAppStore` 中的 mock 写操作为 API 调用（保留 optimistic update）。
2. 登录接入 token 后，将 `isLoggedIn` 判定改为 token + refresh 机制。
3. 识别与社区发帖打通：识别结果可一键带入发帖标题和关键词。
4. 为图鉴与社区列表增加分页字段：`page`, `pageSize`, `total`。
