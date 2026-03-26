# [TICKET-053] Compact Timing Variants

## Status
`pending`

## Dependencies
- Requires: None

## Description
Add a `compact` prop to `TimingHeatmap` and `CadenceOptimizer` components that renders a condensed version suitable for the Understand Performance page's right sidebar column. The compact heatmap groups hours into 4-hour blocks (6 columns instead of 24), and the compact cadence shows a single-line status with a "See full analysis" link.

## Acceptance Criteria
- [ ] `TimingHeatmap` accepts optional `compact?: boolean` prop
- [ ] Compact heatmap renders a 7×6 grid (days × 4-hour blocks: 12a-4a, 4a-8a, 8a-12p, 12p-4p, 4p-8p, 8p-12a)
- [ ] Compact heatmap averages engagement across the 4 hours in each block
- [ ] Compact heatmap omits the timezone selector dropdown
- [ ] `CadenceOptimizer` accepts optional `compact?: boolean` prop
- [ ] Compact cadence shows: status indicator (green/yellow/red dot), one-line summary ("Optimal spacing: 18-24h"), last post time, and "See full analysis →" link
- [ ] Compact cadence omits the scatter chart and collision list
- [ ] Full (non-compact) versions remain unchanged — no regressions
- [ ] Best-3-times list extracted as standalone section usable in compact mode

## Implementation Notes
- Key files: `src/components/dashboard/timing-heatmap.tsx`, `src/components/dashboard/cadence-optimizer.tsx`
- Group hours by dividing `Math.floor(hour / 4)` for the 6-column blocks
- The "See full analysis" link should point to a future full-view (could be a modal or expandable section)
- Keep the existing full rendering as the default (`compact` defaults to `false`)

## Testing
- Render both components with `compact={true}` and `compact={false}`
- Verify compact heatmap shows 7×6 grid
- Verify compact cadence shows one-line summary without scatter chart
- Full versions unchanged — no regressions
