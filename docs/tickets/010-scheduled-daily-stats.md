# [TICKET-010] Scheduled Daily Stats & Demographics

## Status
`pending`

## Dependencies
- Requires: #002 ✅, #006 ✅

## Description
Implement the daily cron job that polls follower count and refreshes demographic data for all users. This populates the `daily_stats` and `demographics` tables used by the Audience tab (#018, #019).

## Acceptance Criteria
- [ ] Cron API route `GET /api/cron/daily` runs once per day
- [ ] Route secured with `CRON_SECRET` header check
- [ ] For each user with a non-expired token:
  - [ ] Fetch `followers_count` via API → insert into `daily_stats` with today's date
  - [ ] Fetch demographics for all 3 dimensions (country, city, gender) → upsert into `demographics`
  - [ ] Handle `unique(user_id, date)` constraint gracefully (skip if already run today)
- [ ] Demographics: 3 separate API calls per CLAUDE.md decision #8
- [ ] Users with < 100 followers: skip demographics fetch (API requirement), still record follower count
- [ ] Decrypt access tokens before API calls
- [ ] Skip users with expired tokens (log warning)

## Implementation Notes
- Key files: `app/api/cron/daily/route.ts`
- Per PRD: "Fetch followers_count → insert daily_stats" and "Refresh demographics" daily
- Per CLAUDE.md decision #8: demographics requires 3 separate API calls (country, city, gender)
- Per Threads API: `follower_demographics` requires minimum 100 followers
- Demographics upsert: replace previous values for each dimension (latest data is authoritative)
- Vercel cron config in `vercel.json` with daily schedule (e.g., `0 6 * * *`)

## Testing
- Manually trigger `GET /api/cron/daily` with correct `CRON_SECRET`
- Verify `daily_stats` record created with today's date and correct follower count
- Verify `demographics` records updated for country, city, gender
- Run twice in same day — verify no duplicate `daily_stats` (unique constraint)
- Test with user < 100 followers: verify follower count stored, demographics skipped
