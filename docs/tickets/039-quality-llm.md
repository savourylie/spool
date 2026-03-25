# [TICKET-039] Quality LLM Analysis

## Status
`pending`

## Dependencies
- Requires: #037 ✅

## Description
Create the server-side LLM analysis layer for the Content Quality Scanner. This is the second analysis layer — it runs on the server using the Claude API to provide deeper content analysis: tone detection, topic coherence assessment, semantic similarity checking against recent posts, and shareability evaluation. Provides a streaming API endpoint for real-time results.

## Acceptance Criteria
- [ ] `analyzeWithLLM()` accepts post text + user context (recent posts, topics) and returns structured analysis results
- [ ] Analysis covers: tone (AI-generated feel), topic coherence (alignment with user's usual topics), semantic similarity (too similar to recent posts), shareability (scores against 4 private-share triggers)
- [ ] Returns typed `LLMAnalysisResult` with issues array (same `QualityIssue` format as heuristics) and optional suggested rewrites
- [ ] API endpoint `POST /api/scanner` accepts draft text + user ID, streams analysis results via SSE
- [ ] Endpoint secured by session cookie authentication
- [ ] Handles LLM errors gracefully (returns partial results from heuristic layer if LLM fails)
- [ ] Prompt construction includes user's recent posts and topic profile for context

## Implementation Notes
- Create `src/lib/quality-llm.ts`:
  - `buildScannerPrompt(text, userContext)` — constructs the analysis prompt with:
    - User's last 10 posts (for tone comparison)
    - User's topic tags (for coherence check)
    - The 4 share-trigger categories (from SEO_FEATURES.md §3.3)
    - Instructions to return structured JSON with issues and rewrites
  - `analyzeWithLLM(text, userContext)` — calls `llm-client.generate()`, parses structured response
  - `analyzeWithLLMStream(text, userContext)` — calls `llm-client.generateStream()` for streaming
  - Types: `LLMAnalysisResult`, `SuggestedRewrite`, `UserContext`
- Create `src/app/api/scanner/route.ts`:
  - POST handler accepting `{ text: string }` in body
  - Validates session, fetches user context (recent posts + topics from DB)
  - Calls `analyzeWithLLMStream()` and returns `Response` with streaming body
  - Content-Type: `text/event-stream` for SSE
  - Error handling: if LLM fails, return error event (client falls back to heuristic-only results)
- The LLM response should be structured JSON. Use a system prompt that instructs Claude to return:
  ```json
  { "issues": [...], "rewrites": [...], "shareability": {...}, "tone": "..." }
  ```

## Testing
- Test with valid API key: endpoint returns streaming analysis
- Test without API key: appropriate error response
- Test with various post types: clickbait, genuine content, AI-sounding text
- Verify session authentication works
