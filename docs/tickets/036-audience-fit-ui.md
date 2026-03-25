# [TICKET-036] Audience Fit UI

## Status
`done`

## Dependencies
- Requires: #035 ✅

## Description
Build the Audience Fit Analysis section on the Audience tab. Shows an audience alignment score, a demographic shift timeline, and recommendations when audience-content mismatch is detected. Helps users understand whether viral-acquired followers create a mismatch with their content strategy.

## Acceptance Criteria
- [x] StickerCard titled "Audience Fit" renders on the Audience tab below demographics charts
- [x] Audience Alignment Score displays as a large bold number (0-100) with a colored indicator
- [x] Demographic shift timeline shows key demographic proportions changing over time (line chart with multiple series)
- [x] Recommendations section renders when alignment score is below threshold, with actionable suggestions
- [x] Empty state when insufficient demographic history (< 2 snapshots)
- [x] Handles `isImporting` flag for backfill-in-progress variant

## Design Reference
- **Components**: § Components > Cards ("Sticker Card")
- **Colors**: § Tokens > Colors — `quaternary` for good alignment, `tertiary` for moderate, `destructive` for poor

## Visual Reference
On `/dashboard/audience`, below demographics charts: a StickerCard with StickerCardIcon (UsersFour icon, secondary color). Large alignment score with color indicator. Below, a multi-line chart showing how key demographics (top country %, top gender %) have shifted over the past 30-90 days. If alignment is poor, a recommendation section with amber background provides specific advice.

## Implementation Notes
- Create `src/components/dashboard/audience-fit.tsx`
- Modify `src/app/dashboard/audience/page.tsx` to:
  - Query `demographics_history` for the current user (ordered by `fetched_at`)
  - Query engagement rates from `post_metrics` to compare pre/post influx
  - Call audience fit analysis functions from `src/lib/audience-fit.ts`
  - Render `<AudienceFit>` below the existing demographics section
- Timeline chart: use `ChartContainer` wrapping Recharts `LineChart` — multiple series for key demographic dimensions
- Score thresholds: ≥70 = good (quaternary), 50-69 = moderate (tertiary), <50 = poor (destructive)
- Recommendations: render in an amber-bordered section when score < 70
- Icon: UsersFour (Phosphor) in secondary circle
- Per UX_DESIGN.md §8.4: new section in Audience tab

## Testing
- Run `npm run dev` and navigate to `/dashboard/audience`
- With demographic history data: alignment score and timeline render
- With poor alignment: recommendation section appears
- With no history: empty state renders
- Mobile: card and chart resize properly
