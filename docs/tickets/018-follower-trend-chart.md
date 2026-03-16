# [TICKET-018] Follower Trend Line Chart

## Status
`blocked`

## Dependencies
- Requires: #002 ✅, #013

## Description
Build the follower count trend line chart for the Audience tab. Shows daily follower count over time from the `daily_stats` table, with notable spike annotations linked to posts published near those dates.

## Acceptance Criteria
- [ ] Follower trend chart renders at `/dashboard/audience`
- [ ] Line chart: x-axis = date, y-axis = follower count
- [ ] Data source: `daily_stats.followers_count` ordered by `date`
- [ ] Chart uses shadcn/ui chart component (Recharts LineChart)
- [ ] Hover tooltip shows date and exact follower count
- [ ] Notable spikes annotated: if follower count increases by >5% day-over-day, show a marker
- [ ] Spike annotations link to the post published closest to that date (from `posts` table)
- [ ] On first connect: only one data point (today) — show a message "Your follower trend will grow over time as we collect daily data"
- [ ] Chart line uses accent color; area fill with accent at low opacity
- [ ] Responsive: chart resizes to container width

## Design Reference
- **Tokens**: § Tokens > Colors (accent for chart line)
- **Components**: § Components > Cards (chart inside a Sticker Card)
- **Typography**: § Tokens > Typography (Outfit for chart title)

## Visual Reference
At `/dashboard/audience`, the top section shows a Sticker Card with the title "Follower Growth" in Outfit 700. Inside, a line chart with the accent-colored line tracks daily follower count. The area beneath the line has a faint accent fill. Notable spikes show small dot markers; hovering reveals "Gained X followers — possibly from [post preview]" with a link to the post.

## Implementation Notes
- Key files: `app/dashboard/audience/page.tsx`, `components/follower-chart.tsx`
- Per PRD: "Follower count trend — line chart showing daily follower count over time"
- Per PRD: "Annotate notable spikes with the post published closest to that date"
- Spike detection: compare each day's count to previous day; flag increases >5%
- For spike annotation: query `posts` table for the post with `published_at` closest to the spike date
- On first connect, only 1 data point exists — chart grows as daily cron (#010) runs

## Testing
- Navigate to `/dashboard/audience` with multiple days of `daily_stats` data
- Verify line chart renders with correct dates and follower counts
- Hover data points → verify tooltip shows date and count
- Verify spike annotations appear for significant increases
- Test with single data point → verify "will grow over time" message
- Resize browser → verify chart is responsive
