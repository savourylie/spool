# [TICKET-037] LLM Client Infrastructure

## Status
`pending`

## Dependencies
- Requires: None (v0 complete)

## Description
Create the shared LLM API abstraction that all Phase 3 AI features depend on. Provides a typed client for the Claude API with both streaming (SSE) and non-streaming modes, error handling, rate limit awareness, and timeout management. This is the foundational infrastructure for the Content Quality Scanner (§3.1), Engagement Prediction (§3.2), AI Composer (§3.3), and Topic Suggestions (§3.4).

## Acceptance Criteria
- [ ] `LLMClient` class or module provides `generate(prompt, options)` returning a full completion string
- [ ] `generateStream(prompt, options)` returns a `ReadableStream` suitable for SSE responses to the client
- [ ] Configurable via `LLM_API_KEY` environment variable
- [ ] Supports system prompt, user prompt, and optional message history
- [ ] Handles API errors gracefully: rate limits (429), auth errors (401), server errors (5xx) with typed error responses
- [ ] Request timeout configurable (default 30s for generate, 60s for streaming)
- [ ] Supports configurable model selection and max token limits
- [ ] TypeScript types for all request/response shapes

## Implementation Notes
- Create `src/lib/llm-client.ts`
- Use the `@anthropic-ai/sdk` package (install via `npm install @anthropic-ai/sdk`)
- Use `claude-sonnet-4-6` as default model (cost-effective for content analysis; allow override)
- `generate()`: simple request/response — await full completion
- `generateStream()`: return a `ReadableStream` that emits text chunks as they arrive from the API
  - Use the SDK's streaming support (`.stream()` method)
  - Transform to text/event-stream format for SSE delivery to client
- Error handling:
  - Rate limit: throw typed `LLMRateLimitError` with retry-after header
  - Auth: throw `LLMAuthError`
  - Server: throw `LLMServerError`
  - Timeout: throw `LLMTimeoutError`
- Types to export: `LLMGenerateOptions`, `LLMStreamOptions`, `LLMMessage`, `LLMError`
- Do NOT store the API key in Supabase Vault for now — use `process.env.LLM_API_KEY` (Vault integration can be added later)
- Add `LLM_API_KEY` to `.env.example` and `.env.local` documentation

## Testing
- Verify `npm install @anthropic-ai/sdk` succeeds
- Create a simple test script that calls `generate()` with a test prompt (requires API key)
- Verify streaming works by piping `generateStream()` output to console
- Verify error handling with invalid API key
