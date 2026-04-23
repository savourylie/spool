# [TICKET-080] Concept Library Infrastructure

## Status
`pending`

## Dependencies
- Requires: #065 ✅, #067 ✅

## Description
Build the classifier that extracts concepts and analogies from every post, the `concept_ledger` table to persist them, and the incremental update path that catches new posts as they arrive via backfill. This is the foundation for the "have I explained this before?" surface (#081). The ledger tracks `{concept, analogy, post_id, seen_at}` rows plus a computed reuse risk aggregate (green / yellow / red) per concept.

## Acceptance Criteria
- [ ] Supabase migration creates `concept_ledger` with: `id uuid pk`, `user_id uuid`, `concept text`, `analogy text null`, `post_id uuid`, `seen_at timestamptz`, unique index on `(user_id, concept, post_id)` to prevent dup rows.
- [ ] `src/lib/prompts/concept-extraction.md` contains the classifier prompt: emits an array of `{concept, analogy?, evidence}` from a single post's full text.
- [ ] `src/lib/concept-library.ts` exports: `extractConceptsForPost(postId): Promise<LedgerRow[]>`, `extractForUser(userId, batchSize=20): Promise<{processed: number}>`, `computeReuseRisk(userId, concept): "green"|"yellow"|"red"`.
- [ ] Initial backfill: `POST /api/concept-library/rebuild` (cron-secret protected) processes all of a user's posts in batches and upserts into the ledger.
- [ ] Incremental update: `src/lib/backfill-job.ts` calls `extractConceptsForPost` immediately after ingesting a new post.
- [ ] Reuse risk thresholds: green = concept used 0–1 times in last 90 days; yellow = 2 times; red = 3+ times (tune-friendly constants at top of file).
- [ ] LLM call goes through `resolveLLMClient(userId)` — respects BYOK.
- [ ] Rate limit `/api/concept-library/rebuild` to 1 call per user per hour.

## Implementation Notes
- Classifier should err toward precision — better to miss a concept than fabricate one. Prompt explicitly says "skip if uncertain."
- Each post ≤ 500 input tokens to the classifier; batch 10 posts per request where feasible to amortize cost.
- Do not extract concepts from repost facades (skipped per CLAUDE.md anyway).
- The "reuse risk" aggregate is a pure function — no DB trigger needed; compute at read time in #081.
- Watch prompt cost: for a large user (500 posts), initial backfill may cost $$; log the token usage per user.

## Testing
- Apply migration → table exists with unique index.
- Call `extractConceptsForPost` with a test post mentioning "rainforest ecosystem" analogy → ledger has a row with that analogy and post_id linked.
- Rebuild for a 50-post user → ledger has realistic row count (typically 100–300 rows for a content-heavy account).
- `computeReuseRisk` returns `red` when same concept appears 3+ times in last 90 days.
- Rate limit: second rebuild call within an hour → 429.
- Incremental update: add a post via backfill → new rows appear without a full rebuild.
