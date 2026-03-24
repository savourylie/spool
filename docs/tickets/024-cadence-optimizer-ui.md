# [TICKET-024] Cadence Optimizer UI

## Status
`blocked`

## Dependencies
- Requires: #023

## Description
Build the Cadence Optimizer section that renders below the timing heatmap on the Timing tab. Visualizes posting cadence patterns, the relationship between post spacing and reach, and surfaces actionable recommendations about diversity filtering effects. Uses data from the cadence analysis library (#023).

## Acceptance Criteria
- [ ] A new StickerCard titled "Posting Cadence" renders below the heatmap on `/dashboard/timing`
- [ ] Stats bar shows 4 metrics: average posts/day (30d), average gap (hours), longest gap, shortest gap
- [ ] Scatter chart renders with X = hours since previous post, Y = views (uses shadcn `ChartContainer` wrapping Recharts `ScatterChart`)
- [ ] Recommendation banner appears (amber border, `border-tertiary bg-tertiary/10`) when average gap < 18h with text: "Posts spaced 18-24+ hours apart get X% more views on average based on your data"
- [ ] Same-day collision list shows dates with 2+ posts and their view counts
- [ ] Empty state renders when fewer than 3 posts exist
- [ ] Component handles `isImporting` flag for backfill-in-progress copy variant

## Design Reference
- **Components**: § Components > Cards ("Sticker Card")
- **Layout**: § Layout > Section Patterns — card grid pattern
- **Shadows**: § Shadows — soft hard shadow on StickerCard
- **Colors**: § Tokens > Colors — `tertiary` for recommendation banners (matches timing heatmap edge-case banner pattern)

## Visual Reference
On `/dashboard/timing`, below the heatmap card: a StickerCard with StickerCardIcon (Timer icon, secondary color). Stats bar shows 4 values in a horizontal row. Below, a scatter plot shows dots at various gap/view intersections. If the user posts too frequently, an amber recommendation banner appears. Below that, a list of dates with same-day collisions and their view differentials.

## Implementation Notes
- Create `src/components/dashboard/cadence-optimizer.tsx`
- Modify `src/app/dashboard/timing/page.tsx` to render `<CadenceOptimizer>` below `<TimingHeatmap>`
- Data source: same `posts.published_at` + latest `post_metrics` already fetched for the heatmap (via `get_timing_heatmap_data` RPC) — extend the RPC or add a second query for views data
- Scatter chart: use `ChartContainer` + `ChartTooltip` + `ChartTooltipContent` (never bare Recharts)
- Stats bar: follow the horizontal stat display pattern — 4 columns with label above, value below
- Recommendation banner: follow `timing-heatmap.tsx` edge-case banner pattern (`LowDataBanner`/`SameTimeBanner`)
- StickerCardIcon: use Timer (Phosphor) icon with `secondary` color
- Add cadence-specific empty state copy to `src/lib/dashboard-empty-state-copy.ts`

## Testing
- Run `npm run dev` and navigate to `/dashboard/timing`
- Verify the cadence section appears below the heatmap
- With test data: scatter plot renders dots, stats bar shows correct values
- With sparse data: recommendation banner appears/hides correctly
- Mobile: card stacks full-width below heatmap
