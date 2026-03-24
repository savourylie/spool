# [TICKET-030] Velocity Indicator UI

## Status
`pending`

## Dependencies
- Requires: #029 ✅

## Description
Add a Launch Score indicator to each post row in the post performance table. Shows a green/yellow/red badge indicating how the post's first-3-hour engagement velocity compares to the user's historical average. Only displays for posts published within the last 3 days (where velocity data exists).

## Acceptance Criteria
- [ ] `VelocityIndicator` component renders a colored badge (green/yellow/red) inline with the post row
- [ ] Green badge: "Strong Launch" — velocity above historical average
- [ ] Yellow badge: "Average Launch" — velocity within 20% of average
- [ ] Red badge: "Slow Launch" — velocity below average
- [ ] Badge only renders for posts with `published_at` within last 3 days
- [ ] Tooltip on hover shows: "First 3-hour engagement velocity: X.Xx vs X.Xx average"
- [ ] Posts without velocity data show no indicator (graceful absence)

## Design Reference
- **Colors**: § Tokens > Colors — `quaternary` (green) for strong, `tertiary` (yellow) for average, `destructive` for slow
- **Components**: § Components > Buttons — pill-shaped badge style with `radius-full`

## Visual Reference
In each post row on `/dashboard/posts`, next to or below the WES column: a small colored pill badge. Green pill with "Strong Launch" for high-velocity posts, yellow for average, red for slow. Appears only on recently published posts (last 3 days).

## Implementation Notes
- Create `src/components/dashboard/velocity-indicator.tsx` — small client component accepting velocity score and classification
- Modify `src/components/dashboard/post-table.tsx` to:
  - Accept velocity data alongside PostRow data (keyed by post ID)
  - Render `<VelocityIndicator>` for posts with velocity data, positioned near the WES column
- Modify `src/app/dashboard/posts/page.tsx` to fetch velocity data for recent posts server-side (query post_metrics for posts published in last 3 days with multiple snapshots in first 3 hours)
- Use `classifyLaunchScore()` from `src/lib/velocity-check.ts` to determine badge color
- Badge is small (text-xs, px-2, py-0.5) to not overwhelm the table row
- Per UX_DESIGN.md §6.7: inline with post row, green/yellow/red indicator

## Testing
- Run `npm run dev` and navigate to `/dashboard/posts`
- With test data: recent posts show colored badges, older posts show none
- Hover over badge: tooltip shows velocity comparison
- Mobile: badge remains visible and doesn't break row layout
