# [TICKET-059] Grok Search Integration

## Status
`done`

## Dependencies
- Requires: None

## Description
Create the Grok/X search integration for surfacing trending topics related to the user's content domain. This includes a new API route `/api/grok-search` that accepts the user's core topics and returns trending X/Twitter topics in that domain, plus a `GrokTrending` client component that displays the results with topic matching indicators and compose CTAs.

## Acceptance Criteria
- [x] API route `src/app/api/grok-search/route.ts` created
- [x] Route accepts POST with `{ topics: string[] }` and returns `{ trends: TrendingTopic[] }`
- [x] Each `TrendingTopic` includes: `title`, `postCount`, `matchedTopic` (which user topic it relates to), `relevanceScore`
- [x] API calls xAI Responses API (`POST https://api.x.ai/v1/responses`) with `x_search` tool
- [x] `XAI_API_KEY` env var added to `.env.local.example`
- [x] API handles rate limiting and errors gracefully (returns empty array on failure, not 500)
- [x] `GrokTrending` component at `src/components/dashboard/grok-trending.tsx`
- [x] Component shows list of 3-5 trending topics with: title, post count ("12K posts today"), matched topic pill, and "Compose" button
- [x] Top trending item has highlighted background (pink accent)
- [x] "Compose" button links to `/dashboard/create/compose?topic={encoded_title}`
- [x] Loading state with skeleton while API call in progress
- [x] Error state with retry button
- [x] Empty state when no relevant trends found

## Implementation Notes

### Key Files
- `src/app/api/grok-search/route.ts` — API route
- `src/components/dashboard/grok-trending.tsx` — Client component
- `.env.local.example` — Add `XAI_API_KEY` entry

### xAI Responses API

Both search tools use the same endpoint and auth:
- **Endpoint**: `POST https://api.x.ai/v1/responses`
- **Auth**: `Authorization: Bearer $XAI_API_KEY`
- **Model**: `grok-4.20-reasoning` (required for search tools)
- **Docs**: https://docs.x.ai/developers/tools/x-search, https://docs.x.ai/developers/tools/web-search

Search is invoked by passing tool objects in the `tools` array of the request body. The API returns model-generated text + a `citations` array referencing source posts/pages — not raw trending topic objects. The route must parse the model response and citations to construct the `TrendingTopic[]` shape.

#### `x_search` tool (primary — X/Twitter post search)
```json
{
  "type": "x_search",
  "allowed_x_handles": ["handle1"],   // up to 10, mutually exclusive with excluded
  "excluded_x_handles": ["handle2"],  // up to 10, mutually exclusive with allowed
  "from_date": "2026-03-20",          // ISO8601 date range
  "to_date": "2026-03-27",
  "enable_image_understanding": false,
  "enable_video_understanding": false
}
```

#### `web_search` tool (supplementary — broader web context)
```json
{
  "type": "web_search",
  "allowed_domains": ["example.com"],   // up to 5, mutually exclusive with excluded
  "excluded_domains": ["spam.com"],     // up to 5, mutually exclusive with allowed
  "enable_image_understanding": false
}
```

#### Example request
```json
{
  "model": "grok-4.20-reasoning",
  "input": [
    {
      "role": "user",
      "content": "What are the top trending topics on X right now related to: AI agents, developer tools, open source?"
    }
  ],
  "tools": [{ "type": "x_search" }]
}
```

### Route Design
- User's core topics derived from `extractTopics()` applied to their posts — pass top 3-5 topic names as the prompt context
- Route constructs a prompt asking Grok to find trending X topics related to the user's topics
- Parse model text + citations into `TrendingTopic[]` (title, postCount, matchedTopic, relevanceScore)
- Use structured prompt to request JSON-formatted output for reliable parsing
- Consider caching results for 15-30 minutes to reduce API calls

### Component
- Fetches on mount with `useEffect` + abort controller pattern (similar to existing `TopicSuggestions`)
- Handles loading/error/empty states

## Testing
- API route: test with mock topics, verify response shape
- Component: render with mock trend data, verify layout
- Compose button navigation works
- Error/loading/empty states display correctly
