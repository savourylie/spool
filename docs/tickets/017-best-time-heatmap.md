# [TICKET-017] Best Time to Post Heatmap

## Status
`blocked`

## Dependencies
- Requires: #002 ✅, #013

## Description
Build the Timing tab content: a 7×24 heatmap showing average engagement rate by day-of-week and hour-of-day, derived from the user's post history. Includes a summary of the best posting times.

## Acceptance Criteria
- [ ] Heatmap renders at `/dashboard/timing`
- [ ] Grid: 7 rows (Monday–Sunday) × 24 columns (0–23 hours)
- [ ] Each cell colored by average engagement rate: cool (low) → warm (high) color scale
- [ ] Hover tooltip shows: number of posts in that slot, average engagement rate, average views
- [ ] Cells with < 2 posts shown as gray ("insufficient data")
- [ ] Summary text above heatmap: "Your best posting times are **[Day Time]** and **[Day Time]**" (top 3 slots)
- [ ] Timezone: auto-detected from browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- [ ] Manual timezone override dropdown
- [ ] All timestamps converted to the selected timezone for bucketing
- [ ] Data source: `posts.published_at` joined with latest `post_metrics` for engagement rate
- [ ] Engagement rate formula per CLAUDE.md: `(likes + replies + reposts + quotes + shares) / views`
- [ ] Banner shown when user has < 20 total posts: "Post more to improve accuracy. Based on N posts so far."
- [ ] Recommendation shown when all posts occur at the same time: "You always post at [time]. Try varying your schedule to discover new opportunities."

## Design Reference
- **Layout**: § Layout > Container (`max-w-6xl`)
- **Tokens**: § Tokens > Colors (interpolate from muted to accent for heatmap scale)
- **Components**: § Components > Cards (heatmap inside a Sticker Card)
- **Typography**: § Tokens > Typography (Outfit for summary text)

## Visual Reference
At `/dashboard/timing`, a Sticker Card contains the heatmap. The y-axis lists days of the week (Mon–Sun), the x-axis lists hours (12am–11pm). Cells range from light muted (low engagement) to vivid accent (high engagement). Gray cells indicate insufficient data. Above the heatmap, bold summary text highlights the top 3 time slots. A timezone selector dropdown sits in the top-right corner of the card.

## Implementation Notes
- Key files: `app/dashboard/timing/page.tsx`, `components/heatmap.tsx`
- Per PRD: "Heatmap (7 rows × 24 columns) showing average engagement rate per day-of-week × hour-of-day slot"
- Per PRD edge cases: < 20 total posts → show banner "Post more to improve accuracy. Based on N posts so far."
- Per PRD edge cases: all posts at same time → surface recommendation to vary schedule
- Build heatmap with custom CSS grid or Recharts — CSS grid is likely simpler for this layout
- Color scale: interpolate between `muted` and `accent` based on engagement rate percentile

## Testing
- Navigate to `/dashboard/timing` with a backfilled account
- Verify 7×24 grid renders with colored cells
- Hover a cell → verify tooltip shows post count, avg engagement rate, avg views
- Verify gray cells for time slots with < 2 posts
- Verify summary text shows top 3 time slots
- Change timezone → verify cells re-bucket correctly
- Test with < 20 posts → verify "Post more" banner appears
