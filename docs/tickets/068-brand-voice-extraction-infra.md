# [TICKET-068] Brand Voice Extraction Infrastructure

## Status
`blocked`

## Dependencies
- Requires: #067

## Description
Build the backend that extracts a qualitative brand voice profile across 11 dimensions (sentence structure, tone switching, emotional expression, knowledge presentation, fan-vs-critic reply tone, analogies, humor, self-reference, taboo phrases, paragraph rhythm, comment-reply characteristics). This is the foundation for F1 — the Composer will use it as a primary voice driver, and the Scanner will use it as an observer to flag drift. The profile is extracted on demand from the user's posts + comment replies, persisted as JSONB in Supabase, and refreshed when the user clicks a button or the post count crosses a threshold.

## Acceptance Criteria
- [ ] Supabase migration creates `brand_voice_profiles` table with columns: `user_id uuid primary key`, `profile jsonb not null`, `source_post_count int`, `confidence_tier text`, `updated_at timestamptz default now()`.
- [ ] `src/lib/prompts/brand-voice.md` contains the extraction prompt (11 dimensions, require 2–3 real post excerpts per dimension, output as JSON matching the shape documented in the file).
- [ ] `src/lib/brand-voice.ts` exports `analyzeBrandVoice(userId: string): Promise<BrandVoiceProfile>` that fetches the user's posts + comment replies, calls the LLM (via `llm-resolver.ts`), validates JSON output against the schema, and upserts into `brand_voice_profiles`.
- [ ] `POST /api/brand-voice/refresh` endpoint authenticates via session cookie, invokes `analyzeBrandVoice`, and returns the new profile. Rate-limited to 1 call per user per 5 minutes.
- [ ] Profile shape (exported type `BrandVoiceProfile`) has one entry per dimension, each with `{ pattern: string; evidence: Array<{ postId: string; excerpt: string }> }`.
- [ ] `source_post_count` and `confidence_tier` (computed via `getConfidenceTier` from #066) are populated; under 10 posts the profile is still extracted but flagged `directional`.

## Implementation Notes
- The LLM call goes through `resolveLLMClient(userId)` from `llm-resolver.ts` — respects BYOK.
- Prompt includes `loadPrompt("psychology")` prefix from #067 to ground voice analysis in behavioral terminology.
- Fetch top 30–50 posts by WES + the last 50 comment replies as the extraction corpus; don't send every post.
- Store the raw LLM output in `profile` JSONB; never trust the shape without validating against a Zod schema at the boundary.
- Do NOT expose a "delete profile" endpoint; refresh is upsert-only.
- The migration file goes in `supabase/migrations/` with a date-prefixed name following the repo's convention.

## Testing
- Apply migration: `npx supabase db reset` → `brand_voice_profiles` table exists.
- Call `POST /api/brand-voice/refresh` with a valid session → returns profile JSON with 11 dimensions and excerpts.
- Call twice within 5 minutes → second call hits rate limit.
- Query `select * from brand_voice_profiles where user_id = ...` → profile row present, `source_post_count` matches fetched corpus size, `confidence_tier` reflects the count.
- Run with a user who has 3 posts → profile still extracts, tier is `directional`.
