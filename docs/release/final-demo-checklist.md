# Final Demo Checklist (P12-2)

## 1. Goal
- Rehearse the full chain in one run:
`identify -> action cards -> encyclopedia detail -> chat stream -> spirit draft -> publish`

## 2. Preconditions
- Local API is running at `http://127.0.0.1:8787`.
- Supabase `schema.sql` has been fully applied.
- For real mode:
  - `SILICONFLOW_API_KEY` is valid.
  - `SILICONFLOW_VISION_MODEL` and `SILICONFLOW_CHAT_MODEL` are available.

## 3. One-Click Rehearsal (Script)
- P18 integrated rehearsal (starts API + web + verification, writes report):
```bash
npm run rehearse:p18 -- --mode dual
```
- Real API mode:
```bash
npm run verify:final-demo -- --mode real
```
- Offline demo mode (allows fallback when identify/chat provider is unavailable):
```bash
npm run verify:final-demo -- --mode offline
```

Optional arguments:
- `--api-base http://127.0.0.1:8787`
- `--timeoutMs 120000`
- `--intervalMs 1500`
- `--image https://...` (or set `DEMO_IDENTIFY_IMAGE_URL` in `.env` for real mode)

## 4. Pass Criteria
- Script exits with code `0`.
- Output JSON has:
  - `"pass": true`
  - non-empty `publishedPostId`
  - populated step list with all required stages.

## 5. Manual Spot Checks (Supabase)
- `conversation_sessions` has new row(s).
- `memory_summaries` has new row(s).
- `spirit_community_drafts` has draft row updated to `published`.
- `community_posts` has new published post.

## 6. Troubleshooting Quick Guide
- `identify-task` fails:
  - check `SILICONFLOW_API_KEY`, model names, and provider quota.
- `chat-stream` fails:
  - verify `/api/chat/stream` is reachable and provider key is valid.
- publish fails:
  - ensure `spirit_sessions` and `spirit_community_drafts` are writable in Supabase.

## 7. Demo Day Recommendation
- Prefer local deployment on demo machine (no Vercel dependency):
  - API: `node server/index.js`
  - Web: `npm run dev -- --host 0.0.0.0 --port 5173`
- Keep both commands ready:
  - primary: real mode
  - fallback: offline mode
- Keep one previous successful output JSON as backup evidence.
