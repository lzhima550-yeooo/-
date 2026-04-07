# P13 Progress (2026-03-31): Analytics & Task Logs

## Goal
- Close the remaining final-state gap: server-side objectified observability with:
  - `analytics_events`
  - `task_logs`
- Provide unified write and query paths.

## Completed
- Schema:
  - Added `analytics_events`, `task_logs`
  - Added indexes and RLS read policies
  - File: `supabase/schema.sql`
- Backend service:
  - Added methods:
    - `appendAnalyticsEvent`
    - `getAnalyticsEventSummary`
    - `appendTaskLog`
    - `listTaskLogs`
  - Added automatic task log writes in:
    - `upsertDiagnosisTask`
    - `upsertSpiritGenerationJob`
  - File: `server/lib/supabaseService.js`
- API:
  - Added query endpoints:
    - `GET /api/analytics/events/summary`
    - `GET /api/analytics/task-logs`
  - Added event tracking hooks for key paths:
    - community post/reply
    - identify submit
    - spirit generate submit
    - chat stream done
    - spirit session create
    - draft create/publish
    - backflow extract/approve
  - File: `server/app.js`
- Tests:
  - Added `server/__tests__/analytics-observability.contract.test.ts`

## Verification
- `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:api` PASS
- `npm run build` PASS
- Local integration check:
  - API routes are reachable, but if online Supabase has not applied latest `schema.sql`, `/api/analytics/events/summary` and `/api/analytics/task-logs` will return `PGRST205` (table not found).

## Next
- Apply latest `supabase/schema.sql` to online Supabase.
- Run one integration check:
  1. Trigger any tracked write endpoint (e.g. `POST /api/community/posts`)
  2. Query `GET /api/analytics/events/summary`
  3. Query `GET /api/analytics/task-logs`
