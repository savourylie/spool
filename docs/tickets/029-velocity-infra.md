# [TICKET-029] Velocity Tracking Infrastructure

## Status
`pending`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the infrastructure for first-3-hour engagement velocity tracking. The algorithm disproportionately weights early engagement signals — this feature captures frequent metric snapshots for recently published posts and computes a Launch Score classification. Includes a Supabase migration for a partial index, a velocity computation library, and a new cron endpoint that runs every 30 minutes.

## Acceptance Criteria
- [ ] Supabase migration creates partial index `idx_post_metrics_recent` on `post_metrics (post_id, fetched_at DESC) WHERE fetched_at > now() - interval '3 days'`
- [ ] `computeVelocityScore()` calculates engagement velocity ratio: (engagement at 3h) / (engagement at 30min), compared to user's historical 3h average
- [ ] `classifyLaunchScore()` returns green (above average), yellow (within 20% of average), or red (below average) based on velocity ratio
- [ ] Cron endpoint `GET /api/cron/velocity` processes all users with valid tokens, fetches metrics for posts published in last 3 hours
- [ ] Cron endpoint is secured with CRON_SECRET bearer token auth (matches existing cron pattern)
- [ ] Velocity data is stored as regular `post_metrics` rows (reuses existing table, just at higher frequency for recent posts)

## Implementation Notes
- Create Supabase migration file in `supabase/migrations/` for the partial index
- Create `src/lib/velocity-check.ts`:
  - `getRecentPosts(userId)` — finds posts published within last 3 hours
  - `computeVelocityScore(snapshots)` — takes metric snapshots for a post, computes velocity ratio
  - `classifyLaunchScore(velocityRatio, historicalAverage)` — returns `"green" | "yellow" | "red"`
  - `getHistoricalVelocityAverage(userId)` — computes user's average 3h engagement velocity
- Create `src/app/api/cron/velocity/route.ts`:
  - Follow `src/app/api/cron/metrics/route.ts` pattern exactly (CRON_SECRET auth, batch all users, per-user try/catch)
  - For each user: find posts published in last 3h, fetch fresh metrics via ThreadsAPI, insert new `post_metrics` rows
  - Run every 30 minutes (configured externally via Supabase Cron / Vercel Cron)
- The partial index improves query performance for recent-post metric lookups without affecting older data

## Testing
- Apply migration locally: `npx supabase db reset` or `npx supabase migration up`
- Verify index exists in Supabase dashboard
- Run `npm test -- velocity-check` for unit tests
- Test cron endpoint: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/velocity`
