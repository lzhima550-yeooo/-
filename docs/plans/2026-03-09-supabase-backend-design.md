# Summer Wood Supabase Backend Design

**Date:** 2026-03-09  
**Scope:** Build a backend for the existing frontend, connect both sides, and store data in Supabase.

## 1. Goal

Create a single full-stack app for the existing React frontend by adding a Node API layer and Supabase storage for the two core remote data domains:

- Encyclopedia (list/search)
- Community (list/post/reply)

## 2. Constraints and Existing State

- Frontend already has optional remote service calls in:
  - `src/services/encyclopediaApi.ts`
  - `src/services/communityApi.ts`
- Current frontend falls back to local mock data when `VITE_API_BASE_URL` is not configured.
- App currently has no backend folder and no database runtime setup.
- Current user auth flow is local store based and is out of this phase scope.

## 3. Architecture

- Add `server/` folder with Express API.
- Backend reads/writes Supabase using service role key.
- Frontend points to `/api` by default (override still supported by `VITE_API_BASE_URL`).
- For local development, Vite proxies `/api/*` to backend port.

Flow:

1. Frontend page triggers service method.
2. Service method calls backend endpoint (`/api/...`).
3. Backend queries or writes Supabase table(s).
4. Backend returns normalized JSON payload expected by existing model guards.

## 4. Data Model (Supabase)

Tables:

- `encyclopedia_entries`
  - full encyclopedia record fields used by frontend
- `community_posts`
  - post content and author metadata
- `community_answers`
  - threaded floor replies linked to `community_posts`

Indexes:

- `encyclopedia_entries(name)`, `encyclopedia_entries(type)`
- `community_posts(created_at desc)`
- `community_answers(post_id, floor)`

## 5. API Contract

- `GET /api/health`
  - health and Supabase connectivity check
- `GET /api/encyclopedia?q=`
  - search by name/category/scientific name
  - response: `{ items: EncyclopediaItemLike[] }`
- `GET /api/community/posts?q=`
  - list posts with nested answers
  - response: `{ items: CommunityPostLike[] }`
- `POST /api/community/posts`
  - create post
  - response: `{ id: string }`
- `POST /api/community/posts/:id/replies`
  - create reply/followup floor
  - response: `{ id: string }`

## 6. Error Handling

- API returns `400` for invalid payload.
- API returns `404` when post does not exist for reply creation.
- API returns `500` for Supabase failures.
- Frontend already converts errors to user-facing messages via existing remote service wrappers.

## 7. Testing Strategy

- Backend unit/integration tests with Vitest:
  - failing tests first for endpoint shape and main validation logic
  - use injected Supabase mock service (no external DB required during CI)
- Existing frontend tests remain unchanged and are re-run to prevent regressions.

## 8. Non-Goals

- Replacing local auth with Supabase Auth in this phase.
- Migrating identify/spirit modules to backend.
- Real object storage upload pipeline (current image URLs are persisted as text).