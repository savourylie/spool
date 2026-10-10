# [TICKET-034] Semantic Focus UI

## Status
`done`

## Dependencies
- Requires: #033 ✅

## Description
Build the Semantic Focus Score section on the Audience tab. Shows a 0-100 focus score representing topical consistency, a rolling 30-day trend line, and warnings when the score drops (indicating the algorithm may be re-classifying the account). Based on TF-IDF topic classification data from ticket #033.

## Acceptance Criteria
- [x] StickerCard titled "Semantic Focus" renders on the Audience tab
- [x] Focus Score displays as a large bold number (0-100) with a colored indicator (quaternary for high, tertiary for medium, destructive for low)
- [x] 30-day rolling trend line chart shows focus score over time (line chart via shadcn `ChartContainer`)
- [x] Top topic clusters displayed as labeled badges (showing the 2-3 dominant topics)
- [x] Warning text appears when score drops below 50: "Your content has become less focused. The algorithm may be re-classifying your account."
- [x] Empty state when insufficient posts for topic classification (< 10 posts with `text_full`)
- [x] Handles `isImporting` flag for backfill-in-progress variant

## Design Reference
- **Components**: § Components > Cards ("Sticker Card")
- **Colors**: § Tokens > Colors — `quaternary` (green) for high score, `tertiary` (amber) for medium, `destructive` for low

## Visual Reference
On `/dashboard/audience`, after demographics charts: a StickerCard with StickerCardIcon (Crosshair icon, accent color). Large "78" focus score in the top-left with a green indicator dot. Below, a line chart showing focus score fluctuating between 60-85 over the last 30 days. Topic badges: "Marketing", "AI", "Startups". If score is low, an amber warning banner appears below the chart.

## Implementation Notes
- Create `src/components/dashboard/semantic-focus.tsx`
- Modify `src/app/dashboard/audience/page.tsx` to:
  - Query posts with `text_full` and `topic_tag` for the current user
  - Call `computeFocusScore()` from `topic-classification.ts`
  - Compute 30-day rolling scores (iterate day-by-day, compute score for posts in trailing 30-day window)
  - Render `<SemanticFocus>` below demographics section
- Trend line: use `ChartContainer` wrapping Recharts `LineChart` — X axis = date, Y axis = focus score (0-100)
- Score thresholds: ≥70 = high (quaternary), 50-69 = medium (tertiary), <50 = low (destructive)
- Topic badges: small pill-shaped badges with the topic name
- Icon: Crosshair (Phosphor) in accent circle
- Per UX_DESIGN.md §8.5: new section in Audience tab

## Testing
- Run `npm run dev` and navigate to `/dashboard/audience`
- With test data containing classified posts: focus score, trend line, and topic badges render
- With low focus score: warning text appears
- With no classified posts: empty state renders
- Mobile: card stacks full-width, chart resizes
