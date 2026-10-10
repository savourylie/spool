# [TICKET-025] Format Analysis

## Status
`done`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the Optimal Post Format Analysis feature — a library of pure analysis functions and a dashboard UI section that breaks down engagement by media type and post length. Shows which content formats perform best for the user's audience. Renders below the post table on the Posts tab.

## Acceptance Criteria
- [x] `computeFormatBreakdown()` returns average views, average WES, and post count per media type (TEXT, IMAGE, VIDEO, CAROUSEL)
- [x] `computeTextLengthBuckets()` buckets posts by character count (0-50 short, 50-150 medium, 150-280 long) with average engagement per bucket
- [x] `generateFormatRecommendation()` produces recommendation text comparing best vs. worst performing types and lengths
- [x] A StickerCard titled "Content Format Analysis" renders below the PostTable on `/dashboard/posts`
- [x] Grouped bar chart shows avg views + avg WES per media type (uses shadcn `ChartContainer`)
- [x] Text length analysis section shows engagement by length bucket
- [x] Recommendation text renders below charts with specific percentage comparisons
- [x] Empty state renders when fewer than 5 posts exist across all types

## Design Reference
- **Components**: § Components > Cards ("Sticker Card")
- **Colors**: § Tokens > Colors — media type colors: accent (TEXT), secondary (IMAGE), tertiary (VIDEO), quaternary (CAROUSEL)

## Visual Reference
On `/dashboard/posts`, below the post table card: a StickerCard with StickerCardIcon (ChartBarHorizontal icon, tertiary color). Contains a grouped bar chart with 4 media type groups, each showing two bars (avg views in blue, avg WES in purple). Below, a text length section with 3 horizontal bars for short/medium/long. At the bottom, recommendation text like "Your IMAGE posts get 45% more engagement than TEXT posts. Long-form posts (150+ chars) outperform short ones by 30%."

## Implementation Notes
- Create `src/lib/format-analysis.ts` — pure functions accepting PostRow arrays, using `computeNormalizedWES()` from `weighted-engagement.ts`
- Create `src/components/dashboard/format-analysis.tsx` — StickerCard with charts
- Modify `src/app/dashboard/posts/page.tsx` to render `<FormatAnalysis>` below the existing PostTable StickerCard
- Data source: the `postsResult` data already fetched on the Posts page contains all needed fields (media_type, text_preview, views, likes, replies, reposts, quotes, shares)
- For grouped bar chart: use `ChartContainer` wrapping Recharts `BarChart` with grouped bars
- Text length bucketing uses `text_preview.length` (capped at 280, sufficient for classification)
- Media type colors match the icon color mapping in `post-table.tsx`
- StickerCardIcon: ChartBarHorizontal (Phosphor), tertiary color
- Unit tests in `src/lib/__tests__/format-analysis.test.ts`

## Testing
- Run `npm test -- format-analysis` for unit tests
- Run `npm run dev` and navigate to `/dashboard/posts`
- Verify format analysis card appears below the post table
- With varied media types: grouped bar chart shows correct breakdown
- With all same type: chart shows single group, recommendation reflects this
- Mobile: card is full-width, charts resize responsively
