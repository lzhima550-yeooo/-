# P16 Runbook: Analytics Export & Review

## 1. Scope
- Export server-side analytics snapshot for答辩/复盘:
  - event summary
  - task log page
  - observability dimensions (channel/provider/model/taskType/status/errorCode/latency)

## 2. API Endpoint
- `GET /api/analytics/export`
- Query:
  - `days, limit, source, eventName`
  - `taskLimit, taskOffset, taskType, status, taskId`
- Response `data`:
  - `eventsSummary`
  - `taskLogs.items`
  - `taskLogs.page`
  - `observability`

## 3. One-Click Export
- Default:
  - `npm run export:analytics:snapshot`
- Custom API:
  - `npm run export:analytics:snapshot -- --api-base http://127.0.0.1:8787`
- 30-day review snapshot:
  - `npm run export:analytics:snapshot -- --days 30 --task-limit 200`
- Drilldown export:
  - `npm run export:analytics:snapshot -- --event-name chat_stream_done --task-type diagnosis_identify`

## 4. Output
- Default output file:
  - `docs/release/analytics-snapshot-latest.json`
- Custom output:
  - `npm run export:analytics:snapshot -- --out docs/release/analytics-snapshot-p16.json`

## 5. Review Checklist
1. `eventsSummary.total` > 0 and top events align with recent rehearsal.
2. `taskLogs.page` pagination fields valid (`limit/offset/hasMore/nextOffset`).
3. `observability.channels/providers/models` contains expected production values.
4. `observability.statuses` includes failure distribution for风险排查.
5. `observability.latency.averageMs/maxMs` is within acceptable threshold.
