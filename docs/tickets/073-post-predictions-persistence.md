# [TICKET-073] Post Predictions Persistence

## Status
`pending`

## Dependencies
- Requires: #066 ✅

## Description
Today `engagement-prediction.ts` computes Conservative / Baseline / Optimistic ranges at call time and the result is ephemeral. Persist the prediction at draft save time so we can later compare against actuals. Also wire a "Mark as published" action in Composer + a text-fuzzy-match fallback in `backfill-job.ts` so that when a new post appears, we can link it back to the draft that predicted it. This is the foundation for the prediction-vs-actual review loop (#074–#076).

## Acceptance Criteria
- [ ] Supabase migration creates `post_predictions` with: `id uuid pk`, `user_id uuid`, `post_id uuid null` (filled when linked), `draft_text_hash text not null`, `draft_text text` (first 1000 chars), `predicted_at timestamptz default now()`, `ranges jsonb` (p25/p50/p75 for views, likes, replies, reposts, shares), `driver_factors jsonb`, `actual_windowed_metrics jsonb null`, `review_state text check (review_state in ('pending','reviewed','discarded')) default 'pending'`, `reviewed_at timestamptz null`.
- [ ] New `src/lib/post-review.ts` exports `snapshotPrediction({userId, draftText, ranges, driverFactors}): Promise<PredictionId>` that hashes the draft text (SHA-256) and inserts a row.
- [ ] Composer `/api/compose` endpoint writes a snapshot immediately after successful draft generation (one row per returned variation).
- [ ] Scanner `/api/scanner` endpoint, when the user clicks "Mark as published", also writes a snapshot for the analyzed text.
- [ ] Composer UI gains a "Mark as published" action on each generated variation that calls a new `POST /api/compose/publish` endpoint to flag the chosen variation — sets `draft_text` for downstream fuzzy matching.
- [ ] `src/lib/backfill-job.ts` — after ingesting a new post, compares its text to `post_predictions.draft_text` rows where `post_id is null` in the last 7 days using Jaccard trigram similarity ≥ 0.7; matches update `post_id`.
- [ ] A `<ConfidenceBadge />` renders on every prediction range in the Composer UI, reflecting the `matchedCount` from the prediction (reuses #066 util).

## Implementation Notes
- `draft_text_hash` prevents duplicate rows if the Composer streams re-generate the same variation.
- Jaccard trigram similarity lib: implement in `src/lib/post-review.ts` as a small pure function; don't add a new npm dep.
- Respect user BYOK privacy: `draft_text` is stored in the same DB as posts, no external system.
- The `ranges` shape must match what `engagement-prediction.ts` already returns — do not re-shape; just persist.
- Cleanup: rows where `post_id is null` and `predicted_at < now() - interval '30 days'` can be auto-marked `discarded` — add a tiny scheduled sweep or leave as a TODO for #074.

## Testing
- Apply migration → table exists.
- Draft via Composer → one row per variation in `post_predictions`, `post_id` is null.
- Click "Mark as published" → `draft_text` populated.
- Run `backfill-job.ts` after a real post appears matching the draft text → `post_id` is backfilled.
- Mismatched text → no false link; similarity threshold holds.
- ConfidenceBadge shows on Composer predictions with correct sample counts.
