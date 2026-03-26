# [TICKET-041] Engagement Prediction

## Status
`done`

## Dependencies
- Requires: #037 ✅

## Description
Build the engagement prediction system — a statistical model that predicts expected engagement range for a post based on the user's historical performance data, plus an optional LLM refinement layer. The prediction widget is a reusable component displayed in both the Scanner and Compose tabs.

## Acceptance Criteria
- [x] `predictEngagement()` returns a predicted engagement range (25th/50th/75th percentile views) based on: media type, post length, posting time (day/hour), topic similarity to past high-performers, time since last post, current follower count
- [x] Statistical model derives predictions purely from user's historical averages — no external training data
- [x] Optional LLM refinement adjusts the prediction based on semantic quality analysis
- [x] `PredictionWidget` component displays a horizontal range bar showing min/expected/max predicted engagement with labels
- [x] Widget updates as draft text changes (re-predicts based on new characteristics)
- [x] Graceful fallback when insufficient historical data: "Not enough posting history to predict engagement"

## Design Reference
- **Components**: § Components > Cards — inline widget style, compact for embedding in scanner/composer panels
- **Colors**: § Tokens > Colors — `accent` for the expected value indicator, `muted` for the range bar background

## Visual Reference
A compact horizontal bar widget: gray background bar spanning the full width, with a colored range segment showing the 25th-75th percentile, and a marker at the 50th percentile (expected value). Labels below: "Low: 1.2K", "Expected: 3.4K", "High: 8.1K". Text above: "Predicted Views". Renders inline within scanner results or composer right panel.

## Implementation Notes
- Create `src/lib/engagement-prediction.ts`:
  - `predictEngagement(postCharacteristics, userHistory)` — core prediction function
  - Post characteristics: `{ mediaType, textLength, dayOfWeek, hourOfDay, topicTag?, timeSinceLastPost? }`
  - User history: array of past posts with metrics (same PostRow type)
  - Algorithm: group historical posts by matching characteristics, compute percentiles from matching posts' views
    - Primary grouping: media type (exact match)
    - Secondary: day of week (exact), hour bucket (±2 hours)
    - Fallback: if too few matches, widen criteria
  - `refineWithLLM(prediction, textContent)` — optional, calls LLM to adjust range based on content quality analysis
  - Export types: `PredictionResult`, `PostCharacteristics`, `PredictionRange`
- Create `src/components/dashboard/prediction-widget.tsx`:
  - Accepts `PredictionResult` prop
  - Renders horizontal range bar with CSS (no Recharts needed — simple div-based visualization)
  - Format numbers using existing `formatNumber()` utility (1.2K, 3.5M etc.)
  - Compact design: fits within scanner/composer panels
- Per UX_DESIGN.md §10.5: range bar with min/max labels, updates as draft changes

## Testing
- Run `npm test -- engagement-prediction` for unit tests
- Test with varied posting history: predictions should be reasonable relative to historical data
- Test with no history: fallback message displayed
- Widget renders correctly at different sizes (scanner panel vs. composer panel)
