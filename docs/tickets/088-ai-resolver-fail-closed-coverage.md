# [TICKET-088] AI Resolver Integration & Fail-Closed Feature Coverage

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #086, #087

## Description
Make the two subscription adapters first-class selections in the central resolver and prove that every existing text-generation feature uses the selected user's provider. An explicitly active subscription must fail with a typed error for every connection, gate, credential, quota, or upstream problem and must never spend Spool's shared key behind the user's back.

## Acceptance Criteria
- [ ] `src/lib/llm-provider.ts` adds `chatgpt_subscription` and `xai_subscription` to the canonical provider registry, including display metadata and auth mode, so API routes, resolver, and Settings no longer maintain separate string whitelists.
- [ ] `src/lib/llm-resolver.ts` distinguishes an explicit Server Default (`users.llm_provider is null`) from all configured providers. Only the explicit Server Default branch may instantiate `new LLMClient()` with `LLM_API_KEY`.
- [ ] An active subscription with a database error, beta gate disabled, missing connection, non-connected status, decrypt failure, expired/revoked token, refresh failure, entitlement failure, quota exhaustion, unknown provider value, or invalid response throws the normalized provider error and never returns another client.
- [ ] Existing Anthropic and OpenAI-compatible BYOK behavior remains compatible. Subscription credential fields are never mixed with `users.llm_api_key_encrypted`, `llm_base_url`, or `llm_model`.
- [ ] A shared `createLLMClient(config)` factory removes direct provider construction from `src/app/api/settings/route.ts` and `src/app/api/settings/test/route.ts`; unsaved BYOK tests use the factory, while saved subscription tests use `resolveLLMClient(userId)`.
- [ ] Foreground routes preserve typed, user-actionable failures for Scanner, Composer, prediction, topics, and brand voice without returning raw upstream text or credentials.
- [ ] Background/server work in concept extraction, review sweep, freshness reframe, Today Hub topic work, and replies sync catches normalized provider errors, skips only the AI-dependent result, and records a sanitized degraded reason. Deterministic output may remain only when explicitly labeled as non-AI/degraded; it never masquerades as a successful provider completion.
- [ ] The resolver audit covers `src/app/api/scanner/route.ts`, `src/app/api/compose/route.ts`, `src/app/api/prediction/route.ts`, `src/app/api/topics/route.ts`, `src/lib/brand-voice.ts`, `src/lib/concept-library.ts`, `src/lib/review-sweep.ts`, `src/lib/freshness-reframe.ts`, `src/lib/today-hub-freshness.ts`, and `src/lib/user-replies-sync.ts` if the replies work is present.
- [ ] `src/lib/__tests__/llm-provider-coverage.source.test.ts` fails when production AI code introduces direct `new LLMClient`, `new OpenAILLMClient`, subscription-client construction, `LLM_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY` outside the approved resolver/factory and legacy trend adapter allowlist.
- [ ] `src/lib/__tests__/llm-resolver.test.ts` includes success and every fail-closed state for both subscription providers, with constructor/fetch/environment spies proving shared clients, shared keys, and other-provider endpoints remain untouched.
- [ ] Both streaming forms and non-streaming structured JSON parsing still pass the existing Scanner, Composer, topic, prediction, brand voice, concept, review, freshness, Today Hub, and reply-risk test suites against an `ILLMClient` fake.

## Implementation Notes
- Keep `ILLMClient` as the feature boundary. Provider selection belongs in the resolver; individual product features must not branch on ChatGPT versus xAI.
- Add typed route serialization in one helper, such as `toAIProviderErrorResponse`, so all foreground routes use the same status/category/copy and the helper can guarantee redaction.
- Do not broaden this ticket into provider-native search. `src/lib/grok-search.ts` remains the one temporary source-test exception until #089 replaces it.
- `src/lib/supabase/database.types.ts` may already contain unrelated reply changes. Regeneration and conflict resolution must preserve those rows/types.
- Server Default remains a user-visible, explicit selection. Resetting to it is a Settings action added in #090, never a resolver recovery path.

## Testing
- Run `npm test -- src/lib/__tests__/llm-resolver.test.ts src/lib/__tests__/llm-provider-coverage.source.test.ts src/app/api/compose/route.test.ts src/lib/__tests__/quality-llm.test.ts src/lib/__tests__/topic-suggestions.test.ts src/lib/__tests__/engagement-prediction.test.ts src/lib/__tests__/concept-library.test.ts src/lib/__tests__/review-sweep.test.ts src/lib/__tests__/freshness-reframe.test.ts src/lib/__tests__/today-hub-freshness.test.ts` plus reply tests when present.
- For each subscription provider, inject every fail-closed state and assert no request reaches the Server Default, BYOK, other subscription, or legacy xAI-search transport.
- Run `rg -n "new (LLMClient|OpenAILLMClient)|LLM_API_KEY|OPENAI_API_KEY|XAI_API_KEY" src`; confirm every production occurrence is in the explicit source-test allowlist.
- Smoke-test Scanner and Composer streaming with each provider, then trigger one background concept/review operation and confirm the selected provider account is used end to end.
