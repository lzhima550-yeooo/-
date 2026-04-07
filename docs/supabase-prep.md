# Supabase 接入准备（前端阶段）

## 结论（沿用上次可行性判断）
- 使用 Supabase 可以解决图鉴图片重复问题。
- 关键不在“有没有数据库”，而在“每个物种要绑定固定主图与可追溯来源”。
- 前端已为后续迁移预留分类、学名、属名、寄主、高发季、症状、防治与放置建议字段。

## 前端当前状态
- 图鉴：`104` 条（昆虫 `52` + 病害 `52`）。
- 字段：支持 `categoryCode`、`category`、`references` 等后端映射关键字段。
- 用户：前端本地账户密码登录，支持昵称和头像编辑。
- 社区：支持图文求助与问答。

## 建议的 Supabase 表结构
1. `species`
- 作用：病虫害主表。
- 核心列：`id`、`type`、`name`、`scientific_name`、`genus`、`category_code`、`category_name`、`risk_level`、`season`、`host_range`、`summary`、`morphology`、`symptoms`、`control_tips`、`placement_tips`、`references`、`created_at`、`updated_at`。

2. `species_images`
- 作用：图片与版权信息。
- 核心列：`id`、`species_id`、`url`、`source`、`license`、`attribution`、`is_primary`、`created_at`。

3. `user_profiles`
- 作用：账号资料。
- 核心列：`id`、`account`、`nickname`、`avatar_url`、`campus_role`、`created_at`、`updated_at`。

4. `community_posts`
- 作用：求助帖子。
- 核心列：`id`、`author_profile_id`、`title`、`content`、`image_url`、`status`、`likes`、`created_at`、`updated_at`。

5. `community_answers`
- 作用：帖子回答。
- 核心列：`id`、`post_id`、`author_profile_id`、`content`、`created_at`。

6. `badge_definitions` + `user_metrics`
- 作用：勋章定义与用户统计。

## 迁移顺序建议
1. 先迁移图鉴主表和图片表，替换前端随机图片链接。
2. 再迁移用户资料与社区。
3. 最后迁移勋章统计。

## 前端接入要点
- 所有列表查询先按分页实现，避免一次加载全部图片。
- 图片优先读取 `species_images.is_primary = true`。
- 对外链图片必须保留 `source/license/attribution`。
- 分类筛选直接使用 `category_code`，UI 展示 `category_name`。
