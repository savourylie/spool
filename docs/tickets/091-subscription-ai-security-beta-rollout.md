# [TICKET-091] Subscription AI Security Audit & Limited-Beta Rollout

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #083, #084, #085, #086, #087, #088, #089, #090

## Description
Complete the security, observability, integration, and live-account gate for the limited subscription-AI beta. Ship migrations and signed sessions with the beta disabled, prove every AI feature and failure mode against both providers, then admit users individually with a kill switch that disables subscription traffic without silently moving anyone to a shared key.

## Acceptance Criteria
- [ ] `src/lib/ai-observability.ts` emits structured events containing only correlation ID, provider, operation, public error category, HTTP status, latency, refresh outcome, and safe connection state.
- [ ] Redaction tests reject access/refresh/ID tokens, authorization headers, encrypted envelopes, provider account IDs, device/user codes, verification URLs, upstream request/response bodies, prompts, user content, and generated content in logs, analytics, error responses, snapshots, and captured telemetry.
- [ ] Automated integration coverage exercises signed-session rejection, both beta gates, connect/reconnect/disconnect, switching with both connections retained, non-streaming generation, `generateStream`, `generateStreamIterator`, structured JSON parsing, expiry refresh, cross-process refresh races, quota, revocation, provider disable, and native search.
- [ ] The generic AI inventory passes with each provider: Scanner, Composer, topic suggestions, engagement prediction, brand voice refresh, concept extraction/rebuild, review narrative sweep, freshness reframe, Today Hub suggestions, and reply-risk analysis if present.
- [ ] The search inventory passes with each provider: Discover trends, Composer external freshness, and Today Hub freshness use `web_search` for ChatGPT and `x_search` for xAI. Subscription failures never call `legacy_shared_xai`.
- [ ] Foreground failures show typed reconnect/limit/unavailable guidance; background tasks skip only their AI-dependent output and record a sanitized degraded state. No deterministic fallback is labeled as an AI/provider result.
- [ ] A live acceptance matrix is completed with a paid ChatGPT beta account, direct SuperGrok, and linked X Premium+. It covers initial authorization, at least one refresh cycle, generation, both stream forms, native search, disconnect/revocation, plan quota behavior, and the curated models from #083.
- [ ] `docs/runbooks/subscription-ai-beta.md` documents prerequisites, provider-contract revalidation, environment variables, session invalidation, migrations, enabling one user, monitoring, support responses, credential incident response, global disable, explicit Server Default recovery, and provider-specific rollback/defer procedures.
- [ ] Deployment order is enforced: set `SESSION_SIGNING_KEY`; deploy schema/session changes with `ENABLE_SUBSCRIPTION_AI_BETA=false`; verify legacy Server Default/BYOK and the one-time session invalidation; enable one test user's database flag; turn on the global flag; complete the live matrix; then admit users individually.
- [ ] `.env.local.example` and the runbook document `SESSION_SIGNING_KEY`, `ENABLE_SUBSCRIPTION_AI_BETA=false`, `CHATGPT_SUBSCRIPTION_MODEL=gpt-5.5`, and `XAI_SUBSCRIPTION_MODEL=grok-4.5` without including client secrets or real tokens.
- [ ] Turning the global flag off causes active subscription requests to return `provider_disabled`, stops device polling/new connections, retains encrypted connections for later recovery, and exposes the Settings recovery action. It never mutates active providers or initiates shared-key traffic.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass; no pending acceptance criterion in #083-#091 is marked complete without its recorded automated or live evidence.

## Implementation Notes
- Create `src/lib/ai-observability.ts`, `src/lib/__tests__/ai-observability.test.ts`, `src/lib/__tests__/subscription-ai-integration.test.ts`, and `docs/runbooks/subscription-ai-beta.md`; update `.env.local.example` and the relevant README deployment section.
- Correlation IDs are random request identifiers, not user/provider account IDs. Do not hash tokens, prompts, or user content into correlation or deduplication fields because stable hashes still leak equality information.
- Keep per-user enrollment manual for this beta through `users.subscription_ai_beta_enabled`. Self-service enrollment, billing claims, provider auto-discovery, and automatic model fallback are outside scope.
- Treat the #083 contract record as an expiring operational dependency. If a provider changes its client allowlist, scope, endpoint, entitlement, or terms, switch only that provider's ticket/rollout state to deferred and leave the other provider available.
- The database type file may include concurrent replies work; verification must preserve it rather than regenerating from an older schema snapshot.

## Testing
- Run `npm test`, `npm run lint`, and `npm run build` from a clean application process with the beta flag off, then repeat focused subscription integration tests with the flag on for one test user.
- Search production code, tests, snapshots, and captured logs with `rg -n "Bearer|access_token|refresh_token|id_token|device_code|authorization|ChatGPT-Account-Id"`; inspect every match and confirm only protocol code and synthetic fixtures contain those field names, never real values.
- Execute the runbook's live matrix against all three entitlement paths and attach sanitized pass/fail evidence to the rollout record.
- Exercise the emergency kill switch during active generation and while a device flow is pending; the next operation must report `provider_disabled`, no provider may receive a fallback request, and Settings must still offer explicit recovery.
