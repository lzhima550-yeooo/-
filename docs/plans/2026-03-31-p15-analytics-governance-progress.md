# P15 Progress (2026-03-31): Analytics Governance & Drilldown

## Goal
- Upgrade analytics from read-only view to operable observability panel:
  - filter controls (days/source/eventName/taskType/status/taskId)
  - task-log pagination (`offset` + `hasMore`)
  - event-to-task drilldown linkage

## Completed
- Backend API pagination enhancement:
  - `GET /api/analytics/task-logs` now supports `offset`
  - response now includes:
    - `items`
    - `page { limit, offset, hasMore, nextOffset }`
  - Files:
    - `server/app.js`
    - `server/lib/supabaseService.js`
- Backend contract tests:
  - updated `server/__tests__/analytics-observability.contract.test.ts`
  - added pagination metadata assertion and offset forwarding check.
- Frontend analytics service:
  - upgraded `src/services/analyticsApi.ts`
  - task-log API now supports `offset` query and normalizes pagination metadata.
- Frontend analytics page:
  - updated `src/pages/AnalyticsPage.tsx`
  - added:
    - summary filters: `days/source/eventName`
    - task-log filters: `taskType/status/taskId`
    - event summary row as clickable drilldown trigger
    - log pagination button: `加载更多日志`
  - kept local analytics sections for dev fallback.
- Frontend tests:
  - added `src/__tests__/analytics-page-p15.test.tsx`
  - validates:
    - click summary event triggers log drilldown filter
    - load-more pagination fetches next offset page

## Verification
- `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts server/__tests__/api.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- src/__tests__/analytics-page-p15.test.tsx --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- src/__tests__/home-me-analytics-integration.test.tsx --pool=threads --maxWorkers=1` PASS
- `npm run build` PASS

## Notes
- No new DB schema migration is required for P15.
- Task-log pagination is backward-compatible: existing consumers that read only `items` continue to work.

## Next
- Enter P16:
  - add analytics export and review snapshots
  - unify observability dimensions across identify/chat/generation
  - prepare final defense dashboard script and runbook
