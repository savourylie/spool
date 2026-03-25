# [TICKET-042] Composer Infrastructure

## Status
`pending`

## Dependencies
- Requires: #037 ✅

## Description
Build the backend infrastructure for the AI Content Composer. Creates the `drafts` database table, prompt construction logic that assembles user context for the LLM, and a streaming API endpoint that generates 2-3 draft post variations targeting different share-trigger categories.

## Acceptance Criteria
- [ ] Supabase migration creates `drafts` table with columns: id, user_id, topic, content, quality_score, predicted_engagement (jsonb), created_at
- [ ] `buildComposerPrompt()` assembles LLM context from: top 10 performing posts + metrics, audience demographics, topic clusters, current cadence state, and recent topics (for semantic variation)
- [ ] Prompt targets the 4 content types that trigger private shares: (1) articulating what readers think but can't express, (2) systematic time-saving compilations, (3) counterintuitive data-backed conclusions, (4) shareable conversation frameworks
- [ ] API endpoint `POST /api/compose` accepts topic + style parameters and streams 2-3 draft variations via SSE
- [ ] Each draft variation targets a different share-trigger category
- [ ] Endpoint secured by session cookie authentication
- [ ] Drafts are saved to the `drafts` table after generation completes

## Implementation Notes
- Create Supabase migration for `drafts` table (schema from SEO_FEATURES.md §3.3)
- Create `src/lib/composer-prompt.ts`:
  - `buildComposerPrompt(topic, style, userContext)` — constructs the system + user prompt
  - User context type includes: top posts with WES scores, audience demographics, topic tags, last post timestamp, follower count
  - The prompt should instruct Claude to generate 2-3 variations with clear `---` separators between drafts
  - Each variation should specify which share-trigger category it targets
  - Include the user's top posts as few-shot examples of their voice/style
  - Export types: `ComposerInput`, `ComposerUserContext`, `GeneratedDraft`
- Create `src/app/api/compose/route.ts`:
  - POST handler accepting `{ topic: string, style?: string }` in body
  - Validates session, fetches user context from DB (top posts, demographics, topic tags, last post time)
  - Calls `generateStream()` from LLM client with composed prompt
  - Returns `Response` with streaming body (Content-Type: `text/event-stream`)
  - On stream completion: parse the full response, split into individual drafts, save each to `drafts` table
- The streaming format should allow the client to distinguish between drafts (e.g., emit `draft_start`, `draft_text`, `draft_end` events)

## Testing
- Apply migration: `npx supabase db reset`
- Verify `drafts` table exists with correct schema
- Test endpoint with valid session: streaming response with 2-3 draft variations
- Verify drafts are saved to database after generation
- Test without API key: appropriate error response
