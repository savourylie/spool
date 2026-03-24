# [TICKET-033] Semantic Focus Infrastructure

## Status
`pending`

## Dependencies
- Requires: None (v0 complete)

## Description
Build the infrastructure for semantic focus analysis. The algorithm classifies content by topic and builds per-account performance expectations — consistent posting in one topic builds classification confidence. This ticket adds full post text storage, implements TF-IDF keyword extraction for topic classification, and auto-populates the `topic_tag` column on posts. No LLM required — keyword-based for Phase 2.

## Acceptance Criteria
- [ ] Supabase migration adds `text_full text` column to `posts` table
- [ ] Backfill pipeline stores full post text in `text_full` (requesting `text` field from Threads API)
- [ ] Metrics refresh stores full text for newly discovered posts
- [ ] `extractTopics()` performs TF-IDF keyword extraction on post text and returns top topic clusters
- [ ] `classifyPostTopic()` assigns a `topic_tag` to a post based on its content
- [ ] `computeFocusScore()` returns 0-100 score representing % of recent posts within top 2-3 topics
- [ ] Posts table `topic_tag` column is auto-populated during backfill and metrics refresh
- [ ] Unit tests for topic extraction and focus score computation

## Implementation Notes
- Create Supabase migration adding `text_full text` column to `posts` table (keep `text_preview` for display)
- Modify `src/lib/threads-api.ts`:
  - Update post query fields to include `text` (full text content)
  - Add `text` to `ThreadsPost` type in `threads-api.types.ts`
- Modify `src/lib/backfill.ts`:
  - Store `text_full` from API response (the full `text` field)
  - After storing a post, call topic classification to set `topic_tag`
- Modify `src/lib/metrics-refresh.ts`:
  - Store `text_full` for new posts
  - Classify topic for new posts
- Create `src/lib/topic-classification.ts`:
  - `extractTopics(posts)` — TF-IDF implementation: compute term frequency per post, inverse document frequency across all posts, return top N topic keywords
  - `classifyPostTopic(postText, topicClusters)` — assigns best-matching topic tag
  - `computeFocusScore(posts, windowDays = 30)` — % of posts in window matching top 2-3 topics
  - Implement TF-IDF from scratch (lightweight, ~50-80 lines): tokenize → remove stop words → compute TF-IDF → cluster by similarity
  - Export stop words list as constant
- Create `src/lib/__tests__/topic-classification.test.ts`
- Note: existing posts will only get `text_full` populated on next backfill or metrics refresh. A migration backfill script could be added but is optional.

## Testing
- Apply migration: `npx supabase db reset`
- Verify `text_full` column exists on `posts` table
- Run `npm test -- topic-classification` for unit tests
- Trigger a backfill for a test user and verify `text_full` and `topic_tag` are populated
