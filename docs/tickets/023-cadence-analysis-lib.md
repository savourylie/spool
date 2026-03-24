# [TICKET-023] Cadence Analysis Library

## Status
`done`

## Dependencies
- Requires: None (v0 complete)

## Description
Create a pure-function library that analyzes posting cadence patterns from existing post data. This provides the computation layer for the Cadence Optimizer UI (ticket #024). Derives all insights from `posts.published_at` timestamps and latest `post_metrics` — no new API calls or schema changes needed. Follows the same pure-function pattern as `src/lib/weighted-engagement.ts`.

## Acceptance Criteria
- [x] `computeCadenceStats()` returns average posts/day (last 30d), average gap between posts (hours), longest gap, and shortest gap
- [x] `computeCadenceScatterData()` returns array of `{ hoursSincePrevious, views }` data points for scatter chart rendering
- [x] `detectSameDayCollisions()` returns dates with 2+ posts and their individual view counts for reach differential display
- [x] `getCadenceRecommendation()` returns a recommendation object when average gap < 18 hours, including the percentage improvement from better spacing
- [x] All functions accept typed arrays and return typed results — no database calls or side effects
- [x] Unit tests cover edge cases: single post, all same day, no posts in last 30 days, posts spanning multiple months

## Implementation Notes
- Create `src/lib/cadence-analysis.ts`
- Input types: array of `{ published_at: string; views: number }` (matches data already fetched for timing heatmap)
- Sort posts by `published_at`, compute sequential gaps in hours
- For scatter data: each point pairs `hoursSincePreviousPost` (X) with `views` (Y)
- For 30-day stats: filter to posts within last 30 days from most recent post date
- For collision detection: group by date string (YYYY-MM-DD in user timezone — accept timezone as parameter)
- Recommendation threshold: average gap < 18h triggers a recommendation; compute view differential between <18h and ≥18h gap buckets
- Follow `weighted-engagement.ts` pattern: exported `as const` thresholds, named interfaces, JSDoc on public functions
- Create `src/lib/__tests__/cadence-analysis.test.ts` with unit tests

## Testing
- Run `npm test -- cadence-analysis` to verify all unit tests pass
- Import functions in a scratch file and verify output shapes with sample data
