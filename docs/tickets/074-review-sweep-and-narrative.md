# [TICKET-074] Review Sweep + Narrative Generator

## Status
`pending`

## Dependencies
- Requires: #067 ✅, #073 ✅

## Description
Add a scheduled endpoint that iterates `post_predictions` rows where `review_state = 'pending'`, `post_id is not null`, and `predicted_at < now() - interval '24 hours'`; pulls the post's windowed actual metrics; compares against the predicted bands; generates a short narrative explaining the deviation; marks the row `reviewed`. Narrative drives the Reviews page (#075) and Today Hub card (#076) by turning cold numbers into the kind of "why did this beat/miss baseline" story a creator gets from a thoughtful editor.

## Acceptance Criteria
- [ ] `src/app/api/reviews/sweep/route.ts` exposes `POST /api/reviews/sweep` protected by the existing cron secret (same pattern as velocity cron from #029).
- [ ] Sweep selects eligible rows (pending, linked, older than 24h), processes up to 50 per invocation, marks each `reviewed` or `discarded` (if `post_id` is still null after 7 days).
- [ ] For each row: pull the post's metrics at 24h (likes, replies, reposts, shares, views) from existing `posts` and `posts_daily_stats` tables; store in `actual_windowed_metrics`.
- [ ] Compute band verdict: `below_conservative` | `conservative` | `baseline` | `optimistic` | `above_optimistic` for each metric.
- [ ] Invoke an LLM call via `resolveLLMClient(userId)` that uses knowledge prefix from #067 and produces a 2–4 sentence narrative: what beat/missed and the likely driver. Prompt lives at `src/lib/prompts/review-narrative.md`.
- [ ] Write narrative into a new `narrative` text column on `post_predictions` (add in the migration for this ticket or extend #073's — prefer a new migration here to keep #073 minimal).
- [ ] Supabase cron entry registers the sweep (hourly). Reuses the pattern from `supabase/migrations/20260322164000_supabase_cron_scheduler.sql`.

## Implementation Notes
- Use the existing Supabase cron scheduler; do not introduce a new cron mechanism.
- Narrative prompt references `src/lib/prompts/psychology.md` so drivers reach for the right framework (Zeigarnik, Peak-End, etc.).
- Handle the "no matching day in posts_daily_stats" case by falling back to current post metrics — mark `actual_windowed_metrics.source = "latest"` so the UI can show a caveat.
- Keep the narrative LLM call under 300 output tokens — we want crisp, not verbose.
- Skip rows where `post_id` is set but the post was deleted — mark `discarded` with reason.
- Log throughput metrics (rows processed, avg LLM latency) to help debug.

## Testing
- Apply new migration → `narrative` column and any new indexes exist.
- Manually insert a `post_predictions` row with a real `post_id` and `predicted_at = now() - 25h` → POST `/api/reviews/sweep` → row becomes `reviewed`, has `actual_windowed_metrics` + `narrative`.
- Narrative reads like a thoughtful 2–4 sentence observation.
- Cron schedule confirmed via `select * from cron.job`.
- Unlinked row older than 7 days → marked `discarded`.
