# [TICKET-026] Reselection Alerts

## Status
`pending`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the Content Reselection Alert system — detection logic that identifies old posts re-entering distribution, and a dismissible alert banner displayed above the post table. When a post older than 7 days shows a significant engagement spike between its two most recent metric snapshots, the user is alerted so they can engage with new comments to maintain momentum.

## Acceptance Criteria
- [ ] `detectReselectedPosts()` queries two most recent `post_metrics` rows per post where `published_at` > 7 days ago and returns posts exceeding thresholds (>20% view increase OR >50% total engagement increase between snapshots)
- [ ] Alert banner renders above the PostTable within the Posts tab showing: post preview text, specific metrics delta (e.g., "+240 views, +12 likes"), and a link to the post on Threads
- [ ] Banner is dismissible per session (React state, not localStorage — reappears on next visit)
- [ ] CTA text reads "Engage with new comments to keep momentum" with ArrowSquareOut link to Threads permalink
- [ ] Multiple reselected posts show as a scrollable list within the banner
- [ ] No alert renders when no posts meet the threshold or when user has fewer than 2 metric snapshots per post

## Design Reference
- **Components**: § Components > Cards — follows `backfill-status-banner.tsx` alert pattern
- **Colors**: § Tokens > Colors — `accent` border for positive alert (content gaining traction)

## Visual Reference
On `/dashboard/posts`, above the post table: an alert banner with accent-colored left border, a Lightning icon in an accent circle, text showing the re-selected post preview and metrics gain, and a link to view on Threads. An X button in the top-right dismisses the alert for the current session.

## Implementation Notes
- Create `src/lib/reselection-detection.ts` — server-side function that queries Supabase for posts with `published_at` > 7 days ago, fetches their two most recent `post_metrics` rows, computes deltas, and returns matches. Consider creating a Supabase RPC for efficiency.
- Create `src/components/dashboard/reselection-alert.tsx` — client component with dismiss state. Follow the structure of `backfill-status-banner.tsx` (border color, icon circle, text, action link)
- Modify `src/app/dashboard/posts/page.tsx` to call detection server-side and pass results to `<ReselectionAlert>`, rendered above `<PostTable>`
- Threshold constants: `RESELECTION_VIEW_INCREASE_THRESHOLD = 0.2` (20%), `RESELECTION_ENGAGEMENT_INCREASE_THRESHOLD = 0.5` (50%), `RESELECTION_MIN_AGE_DAYS = 7`
- Total engagement = likes + replies + reposts + quotes + shares (same as existing engagement formula)
- Icon: Lightning (Phosphor) in accent-colored circle
- Per UX_DESIGN.md §6.5: dismissible per session, within Posts tab (not global banner stack)

## Testing
- Run `npm run dev` and navigate to `/dashboard/posts`
- With test data containing old posts with recent metric spikes: alert banner appears
- Clicking dismiss hides the banner; navigating away and back shows it again (session-scoped)
- Clicking the Threads link opens in a new tab
- With no qualifying posts: no alert renders
