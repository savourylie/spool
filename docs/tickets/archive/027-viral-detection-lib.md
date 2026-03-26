# [TICKET-027] Viral Detection Library

## Status
`done`

## Dependencies
- Requires: None (v0 complete)

## Description
Create a pure-function library that detects viral posts and computes recovery state. A post is "viral" when its views exceed 5x the user's median post views AND daily_stats shows >100 new followers within 48 hours of that post's publish date. Recovery mode remains active for 7 days after detection. This provides the computation layer for the Viral Recovery Card UI (ticket #028).

## Acceptance Criteria
- [x] `detectViralPosts()` identifies posts where views > 5x user's median post views
- [x] `detectFollowerSpike()` checks `daily_stats` for >100 new followers within 48h of a post's publish date
- [x] `getViralRecoveryState()` combines both checks and returns viral post info, follower spike magnitude, recovery window (active for 7 days), and countdown to safe-to-post time (24-48h after viral post)
- [x] `computeMedianViews()` correctly computes the median views across all user posts
- [x] Functions handle edge cases: user with no posts, user with single post, no daily_stats data, post older than 7 days (recovery expired)
- [x] All functions are pure — accept typed arrays, return typed results, no side effects
- [x] Unit tests cover all detection paths and edge cases

## Implementation Notes
- Create `src/lib/viral-detection.ts`
- Input types: posts array with metrics (`{ id, text_preview, permalink, published_at, views, ... }`) and daily_stats array (`{ date, followers_count }`)
- Median computation: sort views, take middle value (or average of two middle for even counts)
- Follower spike: compare `followers_count` on the post's publish date vs. 2 days later; if delta > 100, it's a spike
- Recovery window: 7 days from the viral post's `published_at`; if current time is within this window, recovery mode is active
- Safe-to-post countdown: 24h minimum, 48h recommended after viral post (return both thresholds)
- Export named constants: `VIRAL_VIEW_MULTIPLIER = 5`, `VIRAL_FOLLOWER_SPIKE_THRESHOLD = 100`, `RECOVERY_WINDOW_DAYS = 7`, `MIN_POST_WAIT_HOURS = 24`, `RECOMMENDED_POST_WAIT_HOURS = 48`
- Create `src/lib/__tests__/viral-detection.test.ts`

## Testing
- Run `npm test -- viral-detection` to verify all unit tests pass
- Test with mock data: post with 10,000 views when median is 500 + 150 new followers → viral detected
- Test with near-miss: 4.9x median views → not viral
- Test recovery window expiry: viral post from 8 days ago → recovery expired
