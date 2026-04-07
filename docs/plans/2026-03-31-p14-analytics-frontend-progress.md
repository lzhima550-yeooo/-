# P14 Progress (2026-03-31): Analytics Frontend Real-Data Integration

## Goal
- Replace analytics page backend source from legacy `/api/me/stats.eventSummary` to observability endpoints introduced in P13:
  - `GET /api/analytics/events/summary`
  - `GET /api/analytics/task-logs`
- Keep local analytics events view as development fallback/inspection panel.

## Completed
- Frontend service:
  - Added `src/services/analyticsApi.ts`
  - Implemented:
    - `fetchAnalyticsEventSummaryFromServer`
    - `fetchAnalyticsTaskLogsFromServer`
  - Added response normalization and error fallback for both endpoints.
- Analytics page:
  - Updated `src/pages/AnalyticsPage.tsx`
  - Replaced old server summary fetch from `/api/me/stats` with:
    - event summary (`/api/analytics/events/summary`)
    - task logs (`/api/analytics/task-logs`)
  - Added UI block:
    - recent event totals/by-name/by-source
  - Added UI block:
    - recent task logs with `taskType/status/attempt/duration/error`
  - Preserved local analytics sections:
    - local grouped overview
    - local event detail
- Frontend integration test (TDD red->green):
  - Updated `src/__tests__/home-me-analytics-integration.test.tsx`
  - Assertions now verify analytics page rendering for:
    - server event summary from `/api/analytics/events/summary`
    - server task logs from `/api/analytics/task-logs`

## Verification
- `npm run test:run -- src/__tests__/home-me-analytics-integration.test.tsx --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- server/__tests__/api.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run build` PASS

## Notes
- In this environment, `npm run test:api` may hit worker-fork instability. Equivalent contract verification was executed using:
  - `npm run test:run -- server/__tests__/api.contract.test.ts --pool=threads --maxWorkers=1`

## Next
- Enter P15: analytics governance/dashboard enhancements
  - add filter controls (days/source/taskType/status)
  - add server-side pagination for task logs
  - add “from-to trace drilldown” jump (event -> task -> entity)
