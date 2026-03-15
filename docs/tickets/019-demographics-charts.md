# [TICKET-019] Demographics Charts

## Status
`blocked`

## Dependencies
- Requires: #002, #013

## Description
Build the demographics section of the Audience tab: horizontal bar chart for top 10 countries, horizontal bar chart for top 10 cities, and a donut chart for gender split. Data sourced from the `demographics` table.

## Acceptance Criteria
- [ ] Demographics section renders below the follower trend chart at `/dashboard/audience`
- [ ] Geography — Countries: horizontal bar chart showing top 10 countries by follower percentage
- [ ] Geography — Cities: horizontal bar chart showing top 10 cities by follower percentage
- [ ] Gender: donut chart showing gender split (percentages and labels)
- [ ] Charts use shadcn/ui chart components (Recharts BarChart, PieChart)
- [ ] Data source: `demographics` table filtered by dimension (`country`, `city`, `gender`)
- [ ] Uses most recent data (latest `fetched_at` per dimension)
- [ ] Country/city bars use accent color; gender donut uses secondary/tertiary/quaternary for segments
- [ ] Users with < 100 followers: show placeholder "Audience insights unlock at 100 followers. You're at N."
- [ ] Charts have proper labels and legends

## Design Reference
- **Tokens**: § Tokens > Colors (accent for bars, secondary/tertiary/quaternary for donut segments)
- **Components**: § Components > Cards (each chart in its own Sticker Card)
- **Typography**: § Tokens > Typography (Outfit for chart titles, Plus Jakarta Sans for labels)
- **Layout**: § Layout > Grid (2-column layout for country + city, full width for gender)

## Visual Reference
Below the follower trend chart, a "Demographics" heading in Outfit 700. Two Sticker Cards side-by-side: left shows "Top Countries" with horizontal accent-colored bars (e.g., US 45%, UK 12%), right shows "Top Cities" with similar bars. Below, a centered Sticker Card shows "Gender Split" with a donut chart using pink/yellow/mint segments. Each chart has hover tooltips with exact percentages. For users under 100 followers, a single card shows the placeholder message with current follower count.

## Implementation Notes
- Key files: `app/dashboard/audience/page.tsx`, `components/demographics-charts.tsx`
- Per PRD: "Geography — horizontal bar chart of top 10 countries and top 10 cities"
- Per PRD: "Gender — donut chart showing gender split"
- Per PRD: "If user has < 100 followers: show placeholder state"
- Per CLAUDE.md decision #8: demographics requires 3 separate API calls (country, city, gender) — but this is handled by cron #010, not this ticket
- Query: `SELECT * FROM demographics WHERE user_id = ? AND dimension = ? ORDER BY fetched_at DESC LIMIT 10`
- Donut chart: use Recharts `<PieChart>` with `innerRadius` for donut style

## Testing
- Navigate to `/dashboard/audience` with demographics data
- Verify country bar chart shows top 10 countries with correct percentages
- Verify city bar chart shows top 10 cities with correct percentages
- Verify gender donut chart shows correct split
- Hover bars/segments → verify tooltips with exact values
- Test with user < 100 followers → verify placeholder message with correct count
- Verify 2-column layout for country/city on desktop, stacked on mobile
