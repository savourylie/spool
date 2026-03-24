# [TICKET-031] Comment Quality Infrastructure

## Status
`pending`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the infrastructure for comment quality analysis. Meaningful comments (5+ words) carry 30x the weight of likes in the algorithm's MSI scoring. This ticket creates the `post_replies` database table, adds reply-fetching capability to the Threads API service, extends the metrics refresh job to collect replies, and provides a reply classification library. Requires the new `threads_read_replies` OAuth scope.

## Acceptance Criteria
- [ ] Supabase migration creates `post_replies` table with columns: id, post_id, threads_reply_id (unique), text, word_count, replied_at, fetched_at
- [ ] Index `idx_post_replies_post` on `post_replies (post_id)` is created
- [ ] `ThreadsAPI.getPostReplies(mediaId)` method fetches reply threads from `GET /{media-id}/replies`
- [ ] OAuth scope updated to include `threads_read_replies`
- [ ] Metrics refresh job (`refreshMetrics`) extended to fetch and store replies for recent posts (last 7 days)
- [ ] `classifyReplies()` categorizes replies by word count: short (<5 words), medium (5-20), long (20+)
- [ ] `computeDiscussionQualityScore()` returns a weighted average score based on reply length distribution
- [ ] Unit tests for reply classification and quality scoring

## Implementation Notes
- Create Supabase migration for `post_replies` table (schema from SEO_FEATURES.md §2.2)
- Modify `src/lib/threads-api.ts`:
  - Add `getPostReplies(mediaId: string)` method returning array of reply objects
  - Add reply types to `src/lib/threads-api.types.ts`
- Modify `src/lib/metrics-refresh.ts`:
  - In the per-user refresh loop, after fetching post metrics, also fetch replies for recent posts
  - Upsert into `post_replies` with `threads_reply_id` as conflict key
  - Compute `word_count` from reply text on insert
- Modify OAuth scope in `src/app/api/auth/threads/route.ts` or the auth utility that constructs the authorization URL — add `threads_read_replies` to the scope list
- Create `src/lib/reply-analysis.ts`:
  - `classifyReplies(replies)` — returns `{ short: Reply[], medium: Reply[], long: Reply[] }`
  - `computeDiscussionQualityScore(replies)` — weighted: short=1, medium=5, long=10; normalized 0-100
  - Export constants: `SHORT_REPLY_THRESHOLD = 5`, `MEDIUM_REPLY_THRESHOLD = 20`
- Create `src/lib/__tests__/reply-analysis.test.ts`
- Note: existing users will need to re-authenticate to grant the new scope. Consider how to handle this gracefully (the token expiry banner already prompts re-auth).

## Testing
- Apply migration: `npx supabase db reset`
- Verify `post_replies` table exists with correct schema
- Run `npm test -- reply-analysis` for unit tests
- Test metrics refresh manually to verify replies are fetched and stored
