# [TICKET-028] Viral Recovery Card

## Status
`pending`

## Dependencies
- Requires: #027 ✅

## Description
Build the Viral Recovery Card — a full-width alert card rendered in the dashboard layout above DashboardTabs when a viral post is detected. Shows a recovery playbook with actionable steps to avoid the post-viral slump caused by diversity enforcement throttling. Dismissible via localStorage with a 7-day TTL.

## Acceptance Criteria
- [ ] Amber/warning alert card renders above DashboardTabs (Priority 3 in banner stack, below token expiry and backfill banners)
- [ ] Card shows: viral post preview text, follower spike count ("+N new followers"), and recovery playbook
- [ ] Recovery playbook contains 4 bullet points: wait 24-48h (with countdown timer), target usual audience, actively reply to quality comments, avoid similar content (semantic similarity)
- [ ] Countdown timer shows hours/minutes until safe-to-post window (24h minimum)
- [ ] Dismissible via X button — stores dismissal in localStorage with 7-day TTL keyed to the viral post ID
- [ ] Card does not render when: no viral post detected, recovery window expired (>7 days), or previously dismissed within TTL
- [ ] Card renders on all dashboard tabs (global scope in layout)

## Design Reference
- **Components**: § Components > Cards — alert card style, follows `backfill-status-banner.tsx` pattern
- **Colors**: § Tokens > Colors — `tertiary` (amber) for warning border and background tint (`border-tertiary bg-tertiary/10`)
- **Shadows**: § Shadows — soft shadow on card

## Visual Reference
At the top of the dashboard (above the tab bar, below the backfill banner if present): a full-width amber-bordered card with a Flame icon in a tertiary circle. Title: "Your post '[preview]' went viral." Below, 4 bullet points with icons for each recovery step. A countdown shows "Safe to post in: 18h 32m". An X button in the top-right corner dismisses the card.

## Implementation Notes
- Create `src/components/dashboard/viral-recovery-card.tsx` — client component with localStorage-based dismissal
- Modify `src/app/dashboard/layout.tsx` to: query posts with metrics + daily_stats for the current user, call `getViralRecoveryState()` from `viral-detection.ts`, render `<ViralRecoveryCard>` between the backfill banner and `<DashboardTabs />`
- localStorage key format: `spool_viral_dismissed_{postId}` with value as ISO timestamp; check if dismissal is within 7 days
- Countdown timer: use `useEffect` with 60-second interval to update remaining time display
- Icon: Flame (Phosphor) in tertiary-colored circle
- Per UX_DESIGN.md §3.2: Priority 3 in banner hierarchy (after token expiry and backfill)
- Recovery playbook bullets from SEO_FEATURES.md §1.5:
  1. "Wait 24-48 hours before posting again" (with countdown)
  2. "Next post should target your usual audience, not the new followers"
  3. "Actively reply to quality comments on the viral post"
  4. "Avoid posting similar content (algorithm detects semantic similarity)"

## Testing
- Run `npm run dev` and navigate to `/dashboard`
- With test data containing a viral post (5x median views + follower spike): card appears above tabs
- Countdown timer updates every minute
- Clicking dismiss hides the card; refresh page — card stays hidden (localStorage)
- After clearing localStorage: card reappears
- Navigate between tabs: card persists (rendered in layout)
- Mobile: card is full-width with readable text
