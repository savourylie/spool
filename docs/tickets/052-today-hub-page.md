# [TICKET-052] Today Hub Page

## Status
`pending`

## Dependencies
- Requires: #049 ✅, #051 ✅

## Description
Build the Today Hub as the new default landing page at `/dashboard`. This replaces the previous redirect to `/dashboard/posts`. The page uses a 2-column grid layout with action-first ordering: "What to Post Next" and "When to Post" on top, "Pulse" and "Best Post" below, conditional alerts (reselection + viral recovery) at the bottom. Data fetching happens server-side, reusing patterns from the existing dashboard layout and compose page.

## Acceptance Criteria
- [ ] `/dashboard` renders the Today Hub (no longer redirects to `/dashboard/posts`)
- [ ] Page title: "Welcome back, {username}" with subtitle "Here's what to focus on today."
- [ ] 2-column responsive grid: `grid-cols-1 lg:grid-cols-2 gap-6`
- [ ] Top row: `WhatToPostCard` (left) + `WhenToPostCard` (right)
- [ ] Bottom row: `PulseCard` (left) + `BestPostCard` (right)
- [ ] Conditional alerts row below cards: `ReselectionAlert` (if applicable) + `ViralRecoveryCard` (if applicable)
- [ ] Server-side data fetching with `Promise.all` for parallel queries
- [ ] Page works correctly when user has no posts yet (all cards show empty states)

## Design Reference
- **Mockup**: Pencil file — Screen 2 "Today Hub"
- **Layout**: Action-first 2-column grid

## Implementation Notes
- Key file: `src/app/dashboard/page.tsx` (rewrite from single redirect)
- Data queries needed: `get_posts_with_metrics` (for best post, pulse), `daily_stats` (for pulse), `get_timing_heatmap_data` (for when-to-post), `getMostRecentBackfillJob`, `detectReselectedPosts`, `getViralRecoveryState`
- Most queries are already used in existing pages — reuse the same RPC calls
- `ViralRecoveryCard` moves here from `dashboard/layout.tsx`
- `ReselectionAlert` gets a summary variant (just count + CTA to Performance page)

## Testing
- `npm run dev` → navigate to `/dashboard`
- All 4 summary cards render with real data
- Alerts appear conditionally
- Empty states work for new accounts
- Responsive: single column on mobile, 2 columns on desktop
