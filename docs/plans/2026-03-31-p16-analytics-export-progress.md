# P16 Progress (2026-03-31): Analytics Export, Dimensions, and Review Pipeline

## Goal
- Deliver P16 closure for observability governance:
  - analytics snapshot export endpoint
  - unified observability dimensions across identify/chat/generation
  - one-click export script + runbook addendum

## Completed
- Backend export endpoint:
  - added `GET /api/analytics/export`
  - supports query:
    - `days, limit, source, eventName`
    - `taskLimit, taskOffset, taskType, status, taskId`
  - returns:
    - `eventsSummary`
    - `taskLogs.items + taskLogs.page`
    - `observability` dimensions
  - file: `server/app.js`
- Backend observability dimensions:
  - added unified payload dimensions via `withObservabilityDimensions`:
    - `channel, taskType, status, provider, model, latencyMs, errorCode`
  - applied to key events:
    - `identify_submit`
    - `spirit_generate_submit`
    - `chat_stream_done`
  - file: `server/app.js`
- Backend service extension:
  - added `listAnalyticsEvents(...)`
  - added event mapper for export aggregation
  - file: `server/lib/supabaseService.js`
- Contract tests:
  - extended `server/__tests__/analytics-observability.contract.test.ts`
  - added:
    - export snapshot contract
    - identify_submit unified dimensions assertion
- Export script:
  - added `scripts/export-analytics-snapshot.mjs`
  - added npm command:
    - `npm run export:analytics:snapshot`
  - file: `package.json`
- Runbook addendum:
  - added `docs/runbooks/p16-analytics-export-and-review.md`

## Runtime Verification
- Real local export run (API started locally):
  - `npm run export:analytics:snapshot -- --api-base http://127.0.0.1:8787 --out docs/release/analytics-snapshot-test.json`
  - output:
    - `ok: true`
    - `eventsTotal: 2`
    - `taskLogCount: 8`
    - artifact: `docs/release/analytics-snapshot-test.json`

## Test & Build Verification
- `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- server/__tests__/api.contract.test.ts --pool=threads --maxWorkers=1` PASS
- `npm run test:run -- src/__tests__/analytics-page-p15.test.tsx src/__tests__/home-me-analytics-integration.test.tsx --pool=threads --maxWorkers=1` PASS
- consolidated:
  - `npm run test:run -- server/__tests__/analytics-observability.contract.test.ts server/__tests__/api.contract.test.ts src/__tests__/analytics-page-p15.test.tsx src/__tests__/home-me-analytics-integration.test.tsx --pool=threads --maxWorkers=1` PASS (31 tests)
- `npm run build` PASS
- syntax checks:
  - `node --check server/app.js`
  - `node --check server/lib/supabaseService.js`
  - `node --check scripts/export-analytics-snapshot.mjs`

## Next
- Enter P17:
  - analytics front-end export button + snapshot compare view
  - final defense dashboard “single command” rehearsal including snapshot capture
  - observability KPI thresholds and alert baselines
