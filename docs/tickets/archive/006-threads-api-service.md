# [TICKET-006] Threads API Service Layer

## Status
`done`

## Dependencies
- Requires: #001 ✅
  - TypeScript project structure ready; service files go in `src/lib/`
  - `@/*` import alias configured in `tsconfig.json` (maps to `./src/*`)

## Description
Create a typed service layer that wraps all Threads API calls used by Spool. This abstraction isolates the rest of the app from the raw API, handles pagination, rate limit awareness, and provides typed responses. Per PRD risk mitigation: "Abstract API calls behind a service layer; monitor Meta changelog."

## Acceptance Criteria
- [x] `lib/threads-api.ts` exports a `ThreadsAPI` class/module that accepts an access token
- [x] Method: `getUserProfile()` → returns `{ id, username }` from `GET /me`
- [x] Method: `getUserPosts(since?: Date)` → returns paginated list of posts from `GET /{user-id}/threads`, handles cursor-based pagination automatically
- [x] Method: `getPostInsights(mediaId: string)` → returns `{ views, likes, replies, reposts, quotes, shares }` from `GET /{media-id}/insights`
- [x] Method: `getUserInsights(metric: string, since?: Date, until?: Date)` → returns user-level insights from `GET /{user-id}/threads_insights`
- [x] Method: `getFollowerDemographics(dimension: 'country' | 'city' | 'gender')` → returns demographic breakdown
- [x] Method: `getFollowersCount()` → returns current follower count
- [x] Method: `refreshToken(token: string)` → returns new long-lived token from `GET /refresh_access_token`
- [x] All methods return typed interfaces (not `any`)
- [x] Repost facades filtered out from `getUserPosts()` results (per CLAUDE.md decision #4)
- [x] Posts before April 13, 2024 filtered out (per CLAUDE.md decision #3)
- [x] Rate limit headers logged; exponential backoff on 429 responses

## Implementation Notes
- Key files: `lib/threads-api.ts`, `lib/threads-api.types.ts`
- Base URL: `https://graph.threads.net/v1.0`
- Per CLAUDE.md decision #8: demographics requires 3 separate API calls (country, city, gender) due to single-dimension filtering
- Per CLAUDE.md decision #4: exclude repost facades entirely
- Per CLAUDE.md decision #3: only fetch posts from April 13, 2024 onward
- Pagination: Threads API uses cursor-based pagination with `before`/`after` fields
- Use `fetch` — no external HTTP client needed

## Testing
- Unit test with mocked responses: verify pagination assembles all pages
- Unit test: verify repost facades are filtered out
- Unit test: verify pre-April-2024 posts are filtered out
- Unit test: verify 429 response triggers backoff
- Integration test (with test app token): fetch real user profile and posts
