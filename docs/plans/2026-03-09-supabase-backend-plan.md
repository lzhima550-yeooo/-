# Summer Wood Supabase Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Node backend with Supabase persistence and connect the existing frontend remote service calls to create a working full-stack app.

**Architecture:** Add `server/` Express API endpoints for encyclopedia and community modules, backed by Supabase tables. Keep frontend page behaviors stable, but default API base to `/api` and proxy requests in Vite for local dev.

**Tech Stack:** React + Vite + TypeScript frontend, Node.js + Express API, Supabase Postgres via `@supabase/supabase-js`, Vitest.

---

### Task 1: Add backend test (RED first)

**Files:**
- Create: `server/__tests__/api.contract.test.ts`
- Create: `server/test/createTestApp.ts`

**Step 1: Write failing tests**
- Add tests for:
  - `GET /api/health` returns `{ ok: true }`.
  - `GET /api/encyclopedia` returns `{ items: [] }` shape from mocked service.
  - `POST /api/community/posts` validates required `title/content`.

**Step 2: Run test to verify it fails**
- Run: `npm run test:run -- server/__tests__/api.contract.test.ts`
- Expected: FAIL because backend app does not exist yet.

### Task 2: Implement backend API app (GREEN)

**Files:**
- Create: `server/app.ts`
- Create: `server/index.ts`
- Create: `server/lib/errors.ts`
- Create: `server/lib/validators.ts`
- Create: `server/lib/mappers.ts`
- Create: `server/lib/supabaseService.ts`

**Step 1: Implement minimal app to pass tests**
- Build Express app factory with injected data service for testability.
- Add API routes:
  - `GET /api/health`
  - `GET /api/encyclopedia`
  - `GET /api/community/posts`
  - `POST /api/community/posts`
  - `POST /api/community/posts/:id/replies`
- Add centralized error handling.

**Step 2: Re-run tests**
- Run: `npm run test:run -- server/__tests__/api.contract.test.ts`
- Expected: PASS.

### Task 3: Integrate Supabase persistence

**Files:**
- Modify: `server/lib/supabaseService.ts`
- Create: `supabase/schema.sql`
- Create: `supabase/seed.sql`
- Create: `.env.example`

**Step 1: Add supabase client and query/write operations**
- Read data from `encyclopedia_entries`, `community_posts`, `community_answers`.
- Create posts/replies with computed floor for replies.

**Step 2: Add SQL initialization scripts**
- Create schema and seed data SQL for immediate startup.

**Step 3: Run backend tests again**
- Run: `npm run test:run -- server/__tests__/api.contract.test.ts`
- Expected: PASS (tests use mocked service, independent from real DB).

### Task 4: Connect frontend to backend default path

**Files:**
- Modify: `src/services/communityApi.ts`
- Modify: `src/services/encyclopediaApi.ts`
- Modify: `vite.config.ts`

**Step 1: Set default API base**
- Use `/api` as default when `VITE_API_BASE_URL` is absent.

**Step 2: Add Vite dev proxy**
- Proxy `/api` to backend server (default `http://localhost:8787`).

**Step 3: Run targeted tests**
- Run: `npm run test:run -- src/__tests__/community-search.test.tsx src/__tests__/encyclopedia-category-filter.test.tsx src/__tests__/http-client.test.ts`
- Expected: PASS.

### Task 5: Update scripts and documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Add backend dev scripts**
- Add `dev:api`, `dev:full`, `build:api` or equivalent.

**Step 2: Add runbook**
- Document env setup, Supabase SQL execution, and local run commands.

**Step 3: Final verification**
- Run:
  - `npm run test:run -- server/__tests__/api.contract.test.ts`
  - `npm run test:run -- src/__tests__/community-search.test.tsx src/__tests__/http-client.test.ts`
- Expected: PASS.