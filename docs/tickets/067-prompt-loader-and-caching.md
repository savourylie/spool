# [TICKET-067] Prompt Loader Refactor + Anthropic Caching

## Status
`blocked`

## Dependencies
- Requires: #065

## Description
Refactor `quality-llm.ts` and `composer-prompt.ts` to load their stable knowledge prefixes from `src/lib/prompts/*.md` instead of hard-coded string constants. Wire Anthropic prompt-caching `cache_control: { type: "ephemeral" }` breakpoints at the boundary between the knowledge prefix (stable) and the user-variable suffix (post text, topic, context). The knowledge files are large and rarely change — perfect cache candidates. This is a prerequisite for every downstream feature that adds more knowledge (brand voice, analyze, concept library).

## Acceptance Criteria
- [ ] New util `src/lib/prompts/loader.ts` exports `loadPrompt(name: string): string` that reads and caches markdown files from `src/lib/prompts/` at module-load time (server-side only).
- [ ] `quality-llm.ts` composes its system prompt from: `loadPrompt("algorithm")` + `loadPrompt("psychology")` + `loadPrompt("ai-detection")` + user-variable suffix.
- [ ] `composer-prompt.ts` composes its system prompt from: `loadPrompt("algorithm")` + `loadPrompt("psychology")` + user-variable suffix.
- [ ] Claude API calls use `cache_control: { type: "ephemeral" }` on the knowledge-prefix message block; the user-variable block is uncached.
- [ ] OpenAI BYOK path (via `openai-client.ts`) continues to work — it receives the full composed prompt without `cache_control` (OpenAI doesn't support it); add a branch in the LLM resolver path to skip cache markers for non-Anthropic providers.
- [ ] A small runtime log at the end of each Anthropic call captures `cache_creation_input_tokens` and `cache_read_input_tokens` from the response so ticket #082 can measure hit rate.

## Implementation Notes
- Read files synchronously at module load with `fs.readFileSync` relative to `process.cwd()`; Next.js bundles these into the server build.
- `cache_control` goes on individual content blocks in the Anthropic SDK `messages.create` call — reference `@anthropic-ai/sdk` README for the exact shape (see also skill `claude-api`).
- Do NOT move any runtime composition logic (post lookups, user context fetches) into prompt files. Prompts are static knowledge; the call site still assembles user-specific context.
- Keep backwards compatibility: if `src/lib/prompts/` is missing (test env), `loadPrompt` throws a clear error with the expected path.
- Update `.env.example` and `src/lib/llm-client.ts` only if you need a new env var; otherwise no config changes.

## Testing
- `npm test` — existing Scanner and Composer tests still pass.
- `npm run dev` → trigger a scan and a compose; verify in server logs that `cache_creation_input_tokens > 0` on the first call and `cache_read_input_tokens > 0` on the second.
- Swap BYOK provider to OpenAI → both flows still return without errors (cache markers absent, full prompt sent).
- Inspect sent request body (dev proxy or Anthropic dashboard) → knowledge prefix shows `cache_control`, user suffix does not.
