# [TICKET-051] Today Hub Summary Components

## Status
`pending`

## Dependencies
- Requires: None

## Description
Build the four summary card components for the Today Hub: `WhatToPostCard` (trending topic suggestions with compose CTA), `WhenToPostCard` (next best posting slot + mini heatmap + cadence status), `PulseCard` (7-day metrics: followers, posts, avg engagement, velocity trend), and `BestPostCard` (top-performing post with "why it worked" analysis). These are lightweight client components that receive pre-computed data as props.

## Acceptance Criteria
- [ ] `WhatToPostCard` — shows 2-3 topic suggestions with colored dots, topic text, and a "Go compose" pill button linking to `/dashboard/create/compose?topic={encoded}`
- [ ] `WhenToPostCard` — shows "NEXT BEST SLOT" with day/time, avg engagement; a mini 3×7 heatmap (hour blocks grouped into AM/PM/Evening); cadence status indicator (on track / due / overdue)
- [ ] `PulseCard` — shows 7-day delta for followers (+N), post count, avg engagement rate, and velocity trend (up/down/flat arrow with color)
- [ ] `BestPostCard` — shows top WES post preview (truncated), metrics (views, likes, replies), and "Why it worked" section listing format, timing, and topic factors
- [ ] All cards use `StickerCard` or consistent card styling (rounded-16, white fill, border, padding-24)
- [ ] All cards have proper loading skeletons
- [ ] All cards have empty states for new accounts with no data

## Design Reference
- **Mockup**: Pencil file — Screen 2 "Today Hub"
- **Layout**: 2-column grid, action cards on top row, metrics cards on bottom row

## Implementation Notes
- Key files: Create in `src/components/dashboard/` — `what-to-post-card.tsx`, `when-to-post-card.tsx`, `pulse-card.tsx`, `best-post-card.tsx`
- `WhenToPostCard` reuses `computeBestTimes()` from `src/lib/timing-analysis.ts` (already used in compose page)
- `BestPostCard` sorts posts by WES and takes the top result from last 7 days
- `PulseCard` computes deltas from `daily_stats` table data
- Mini heatmap is a simplified version of `TimingHeatmap` — just colored rectangles, no interactivity

## Testing
- Render each component in isolation with mock data
- Verify loading skeletons display during data fetch
- Verify empty states for accounts with <5 posts
- Visual check against Pencil mockup
