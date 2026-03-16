# [TICKET-007] Backfill Pipeline

## Status
`done`

## Dependencies
- Requires: #002 ✅, #005 ✅, #006 ✅

## Description
Implement the post-OAuth backfill pipeline that fetches all of a user's Threads posts and their engagement metrics, stores them in the database, and updates the backfill job progress in real-time. This runs immediately after a user connects their account.

## Acceptance Criteria
- [x] API route `POST /api/backfill/start` triggers backfill for the authenticated user
- [x] Backfill job record updated to `running` status with `started_at` timestamp
- [x] All user posts fetched via `ThreadsAPI.getUserPosts()` (paginated, from April 13 2024 onward)
- [x] Repost facades excluded (handled by API service layer)
- [x] For each post: insights fetched via `ThreadsAPI.getPostInsights()`
- [x] Posts stored in `posts` table; initial metrics stored in `post_metrics` table
- [x] `backfill_jobs.total_posts` set after post list fetch; `processed_posts` incremented as each post's insights are fetched
- [x] User-level insights fetched: `followers_count`, demographics (country, city, gender — 3 calls)
- [x] Initial `daily_stats` record created with current follower count
- [x] Initial `demographics` records created
- [x] Backfill job updated to `complete` with `completed_at` timestamp on success
- [x] On failure: job updated to `failed` status, partial data preserved, error logged
- [x] Rate limit awareness: respect 429 responses with backoff

## Implementation Notes
- Key files: `lib/backfill.ts`, `app/api/backfill/start/route.ts`
- Per CLAUDE.md decision #1: use Supabase Realtime on `backfill_jobs` table for progress — client subscribes to row changes
- Per PRD: for a user with 500 posts, expect ~501 API calls (1 paginated list + 500 insight fetches)
- Decrypt the user's access token via `lib/crypto.ts` before making API calls
- Process posts sequentially (not in parallel) to avoid rate limits
- Per CLAUDE.md decision #5: engagement rate = `(likes + replies + reposts + quotes + shares) / views` — computed at query time, not stored

## Testing
- Connect a test Threads account with known posts
- Verify all posts appear in `posts` table (check count matches API)
- Verify `post_metrics` has one snapshot per post
- Verify `backfill_jobs` progresses: `pending` → `running` → `complete`
- Verify `daily_stats` has one record with current follower count
- Verify `demographics` has records for country, city, gender dimensions
- Test failure case: revoke token mid-backfill, verify job marked `failed`
