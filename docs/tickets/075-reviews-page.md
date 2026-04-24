# [TICKET-075] Reviews Page

## Status
`done`

## Dependencies
- Requires: #066 ✅, #072 ✅, #074 ✅

## Description
Ship `/dashboard/understand/reviews` — a timeline of predictions vs actuals with cumulative stats. Each row shows the post, the original predicted ranges, the actual metrics, the band verdict, and the narrative from #074. A top-of-page summary answers "how good are my predictions?" with calibration stats ("Your predictions land in the Baseline band 62% of the time"). Also fills in the freshness-log health stub that #072 linked to.

## Acceptance Criteria
- [x] New route `/dashboard/understand/reviews/page.tsx` renders a two-section layout: cumulative stats at top, timeline below.
- [x] Cumulative stats section: hit-rate per band (below_conservative / conservative / baseline / optimistic / above_optimistic) shown as a horizontal stacked bar + numeric breakdown; trend arrow if last-30-days hit-rate differs from all-time.
- [x] Timeline section: list of `post_predictions` rows where `review_state = 'reviewed'`, sorted by `reviewed_at desc`, paginated at 20 per page.
- [x] New component `src/components/dashboard/prediction-review-card.tsx` renders one row: post excerpt, predicted range widget, actual metric, band verdict chip, narrative.
- [x] `<ConfidenceBadge />` on the cumulative stats header reflecting total reviewed count.
- [x] Freshness-log health section: embeds `freshness-log-card.tsx` (from #072) and extends it with a full 30-day verdict breakdown plus a small table of red verdicts (topic + timestamp + reason) — answering "what did I almost post that got flagged?".
- [x] Empty state for zero reviews: "Your first review will appear here 24 hours after your next published post" with a link to Composer.
- [x] Sidebar link added for `/dashboard/understand/reviews` under Understand section.

## Design Reference
- **Components**: shadcn `Card`, `Table`, `Badge`; chart stacked bar via shadcn chart components.
- **Layout**: reuses Understand page container + max-width.
- **Typography**: narrative text uses `text-muted-foreground` for calm reading.

## Visual Reference
At `/dashboard/understand/reviews`, the page title "Prediction Review" sits next to a green `Strong · 47 reviews` pill. Directly below, a horizontal stacked bar shows the distribution: 12% below-conservative (gray), 20% conservative (blue), 48% baseline (green), 16% optimistic (emerald), 4% above-optimistic (violet). A muted trend line reads "Last 30 days: baseline hit-rate up 4%." Below the stats, a timeline of cards — each card has a light left border matching the band color, the post excerpt in bold, a two-row metric layout (predicted range on top, actual on bottom with delta), and a narrative paragraph in muted text. At the bottom, a "Freshness log" subsection shows the last 30 days of gate verdicts plus a collapsible table of red verdicts.

## Implementation Notes
- Server component fetches prediction rows with joined post data; client component handles pagination.
- Band verdict color maps to existing design tokens — reuse the tier palette from `<ConfidenceBadge />` where possible.
- Trend arrow: `(last30_hit_rate - prior30_hit_rate)` expressed as a simple up/down/flat indicator; no fancy smoothing.
- Narrative can be long — truncate to 2 lines with an expand toggle when needed.
- Empty state must not 500 when the table is empty.

## Testing
- Navigate to `/dashboard/understand/reviews` with ≥5 reviewed rows → stats bar + timeline render.
- Zero reviews → empty state + Composer link.
- Pagination: 25 reviewed rows → page 1 shows 20, page 2 shows 5.
- Freshness section renders identical numbers to Today Hub's freshness-log card (#072).
- Sidebar link present; click routes correctly; `<ConfidenceBadge />` matches review count.
