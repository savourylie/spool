# [TICKET-009] Scheduled Metrics Refresh

## Status
`done`

## Dependencies
- Requires: #002 ✅, #006 ✅

## Description
Implement the every-6-hour cron job that fetches new posts and updated engagement metrics for all users with valid tokens. This keeps the post performance data fresh by appending new `post_metrics` snapshots.

## Acceptance Criteria
- [ ] Cron API route `GET /api/cron/metrics` runs every 6 hours
- [ ] Route secured with a `CRON_SECRET` header check
- [ ] For each user with a non-expired token:
  - [ ] Fetch new posts since last fetch (based on most recent `posts.published_at`)
  - [ ] Store new posts in `posts` table
  - [ ] Fetch updated metrics for posts from the last 7 days
  - [ ] Append new `post_metrics` snapshots (never overwrite — append-only)
- [ ] Decrypt access tokens before API calls
- [ ] Skip users with expired tokens (log a warning)
- [ ] Handle API errors gracefully: log and continue to next user
- [ ] Supabase Cron job registered with a 6-hour schedule

## Implementation Notes
- Key files: `app/api/cron/metrics/route.ts`
- Per PRD ingestion pipeline: "Fetch new posts (since last fetch)" and "Fetch updated metrics for recent posts (last 7 days)"
- The 7-day window for metric updates captures engagement growth as posts mature
- Post_metrics is append-only — each run creates new snapshot rows, enabling sparkline charts (#016)
- For local dev: use Supabase Cron (`pg_cron` + `pg_net`) or manual trigger via `curl`
- Consider batching users to avoid timeout on large user counts

## Testing
- Manually trigger `GET /api/cron/metrics` with correct `CRON_SECRET`
- Verify new posts appear in `posts` table
- Verify new `post_metrics` snapshots are appended (not overwritten)
- Verify users with expired tokens are skipped
- Verify unauthorized requests (wrong/missing secret) return 401
