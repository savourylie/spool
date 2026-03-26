# [TICKET-035] Audience Fit Infrastructure

## Status
`done`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the infrastructure for audience fit analysis. The algorithm suppresses reach when followers don't match content (the "follower paradox"). This ticket creates a `demographics_history` table to archive demographic snapshots over time (the existing `demographics` table only keeps the latest), provides functions to detect audience-content mismatch, and extends the daily stats cron to archive snapshots.

## Acceptance Criteria
- [x] Supabase migration creates `demographics_history` table with columns: id, user_id, dimension, key, value, fetched_at
- [x] Daily stats cron inserts into `demographics_history` alongside the existing `demographics` upsert
- [x] `computeAudienceAlignmentScore()` compares pre-viral vs. post-viral engagement rates and returns a 0-100 alignment score
- [x] `detectDemographicShift()` analyzes `demographics_history` over time and flags significant changes in audience composition
- [x] `getAudienceFitRecommendations()` returns actionable text when mismatch detected
- [x] Unit tests for alignment scoring and shift detection

## Implementation Notes
- Create Supabase migration for `demographics_history` table (schema from SEO_FEATURES.md §2.4)
- Modify `src/lib/daily-stats.ts`:
  - In `refreshDailyStats()`, after upserting into `demographics`, also insert the same data into `demographics_history` (append-only — never upsert, always insert)
  - This creates a time series of demographic snapshots
- Create `src/lib/audience-fit.ts`:
  - `computeAudienceAlignmentScore(preViralEngagement, postViralEngagement, demographicShift)` — higher score = better alignment, lower = mismatch
  - `detectDemographicShift(history, windowDays)` — compares latest demo snapshot to one from N days ago, returns changes exceeding threshold (e.g., >10% shift in any dimension)
  - `getAudienceFitRecommendations(alignmentScore, shifts)` — generates recommendation text based on detected issues
  - Inputs: demographic history arrays, engagement rate arrays, viral post data
- Create `src/lib/__tests__/audience-fit.test.ts`
- The alignment score compares engagement before and after a significant follower influx. If engagement drops after gaining followers, it suggests audience-content mismatch.

## Testing
- Apply migration: `npx supabase db reset`
- Verify `demographics_history` table exists
- Run `npm test -- audience-fit` for unit tests
- Trigger daily stats refresh and verify data appears in both `demographics` and `demographics_history`
