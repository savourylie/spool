# [TICKET-060] YouTube Suggestions Integration

## Status
`done`

## Dependencies
- Requires: None

## Description
Create the YouTube video suggestions feature for surfacing content inspiration. This includes a new API route `/api/youtube-suggestions` that accepts user topics and returns relevant YouTube videos, plus a `YouTubeInspiration` client component that displays video cards with thumbnails, metadata, and "Use as inspiration" CTAs that link to the composer.

## Acceptance Criteria
- [x] API route `src/app/api/youtube-suggestions/route.ts` created
- [x] Route accepts POST with `{ topics: string[] }` and returns `{ videos: YouTubeVideo[] }`
- [x] Each `YouTubeVideo` includes: `title`, `channelName`, `viewCount`, `thumbnailUrl`, `videoUrl`, `matchedTopic`, `publishedAt`
- [x] API returns 4-6 relevant videos sorted by relevance and recency
- [x] API handles errors gracefully (empty array on failure)
- [x] `YouTubeInspiration` component at `src/components/dashboard/youtube-inspiration.tsx`
- [x] Component shows a horizontal grid of 3 video cards
- [x] Each card shows: dark thumbnail placeholder (or actual thumbnail if URL available), title (2 lines max), channel name + view count, "Matches: {topic}" in topic color
- [x] "Use as inspiration" action links to `/dashboard/create/compose?topic={encoded_title}`
- [x] Loading state with skeleton cards
- [x] Error state with retry
- [x] Empty state when no relevant videos found

## Implementation Notes
- Key files: `src/app/api/youtube-suggestions/route.ts`, `src/components/dashboard/youtube-inspiration.tsx`
- YouTube Data API v3 search endpoint — requires API key (env var `YOUTUBE_API_KEY`)
- Search query: combine user's top topics into search terms
- Consider caching results for 1 hour to reduce API quota usage
- Thumbnails: use `medium` quality (320×180) from YouTube API response
- Video cards should use `next/image` with YouTube thumbnail domains in `next.config`

## Testing
- API route: test with mock topics, verify response shape
- Component: render with mock video data, verify card layout
- Thumbnail images load (or show dark placeholder)
- "Use as inspiration" navigation works
- Responsive: 3 columns on desktop, 2 on tablet, 1 on mobile
