# [TICKET-059] Grok Search Integration

## Status
`pending`

## Dependencies
- Requires: None

## Description
Create the Grok/X search integration for surfacing trending topics related to the user's content domain. This includes a new API route `/api/grok-search` that accepts the user's core topics and returns trending X/Twitter topics in that domain, plus a `GrokTrending` client component that displays the results with topic matching indicators and compose CTAs.

## Acceptance Criteria
- [ ] API route `src/app/api/grok-search/route.ts` created
- [ ] Route accepts POST with `{ topics: string[] }` and returns `{ trends: TrendingTopic[] }`
- [ ] Each `TrendingTopic` includes: `title`, `postCount`, `matchedTopic` (which user topic it relates to), `relevanceScore`
- [ ] API handles rate limiting and errors gracefully (returns empty array on failure, not 500)
- [ ] `GrokTrending` component at `src/components/dashboard/grok-trending.tsx`
- [ ] Component shows list of 3-5 trending topics with: title, post count ("12K posts today"), matched topic pill, and "Compose" button
- [ ] Top trending item has highlighted background (pink accent)
- [ ] "Compose" button links to `/dashboard/create/compose?topic={encoded_title}`
- [ ] Loading state with skeleton while API call in progress
- [ ] Error state with retry button
- [ ] Empty state when no relevant trends found

## Implementation Notes
- Key files: `src/app/api/grok-search/route.ts`, `src/components/dashboard/grok-trending.tsx`
- Grok API integration: use x.ai API or X API v2 search endpoint — exact API TBD based on available access
- User's core topics derived from `extractTopics()` applied to their posts — pass top 3-5 topic names
- Component fetches on mount with `useEffect` + abort controller pattern (similar to existing `TopicSuggestions`)
- Consider caching results for 15-30 minutes to reduce API calls

## Testing
- API route: test with mock topics, verify response shape
- Component: render with mock trend data, verify layout
- Compose button navigation works
- Error/loading/empty states display correctly
