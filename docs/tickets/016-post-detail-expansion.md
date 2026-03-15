# [TICKET-016] Post Detail Expansion & Sparkline

## Status
`blocked`

## Dependencies
- Requires: #014

## Description
Add row expansion to the post performance table. Clicking a row reveals the full post text and a mini engagement-over-time sparkline chart built from historical `post_metrics` snapshots.

## Acceptance Criteria
- [ ] Clicking a post row expands it to show detail content below the row
- [ ] Expanded view shows full post text (not truncated)
- [ ] Expanded view shows a sparkline chart: engagement metrics over time
- [ ] Sparkline data source: all `post_metrics` snapshots for that post, ordered by `fetched_at`
- [ ] Sparkline shows views (primary line) and engagement rate (secondary line) over time
- [ ] Sparkline uses shadcn/ui chart (Recharts) with minimal styling (no axis labels, small form factor)
- [ ] Sparkline tooltip on hover shows exact values at that snapshot
- [ ] Only one row expanded at a time (clicking another row closes the first)
- [ ] Expanded row has a subtle visual indicator (e.g., accent left border)
- [ ] Permalink to original Threads post shown as a link in expanded view

## Design Reference
- **Tokens**: § Tokens > Colors (accent for sparkline, muted-foreground for secondary line)
- **Components**: § Components > Cards (expanded area styled as nested card)
- **Motion**: § Motion & Animation (smooth expand animation)

## Visual Reference
When a row is clicked, it expands downward revealing the full post text in Plus Jakarta Sans 400, a small sparkline chart (~100px tall) showing views and engagement rate growing over time (using accent and secondary colors), and a "View on Threads" link. The expanded area has a left accent border and a slightly muted background.

## Implementation Notes
- Key files: `components/post-row-detail.tsx`, update `components/post-table.tsx`
- Per PRD: "Click a row to expand full post text and a mini engagement-over-time sparkline (from `post_metrics` snapshots)"
- Query: fetch all `post_metrics` rows for the selected post, ordered by `fetched_at`
- Sparkline: use Recharts `<LineChart>` with minimal config (no grid, no axes, small height)
- Lazy-load sparkline data on expand (don't prefetch for all rows)
- Use CSS transition for smooth expand/collapse animation

## Testing
- Click a post row → verify it expands with full text and sparkline
- Hover sparkline → verify tooltip shows values
- Click another row → verify first row collapses
- Verify sparkline shows multiple data points (requires post with multiple metric snapshots)
- Verify "View on Threads" link opens correct permalink
