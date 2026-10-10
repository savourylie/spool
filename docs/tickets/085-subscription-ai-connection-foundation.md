# [TICKET-085] Subscription AI Connection Foundation

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #083, #084

## Description
Add the service-role-only persistence, beta gates, encrypted credential repositories, device-flow state machine, refresh concurrency guard, typed failures, and provider-neutral Responses adapter shared by both subscription providers. This ticket creates no user-facing connection controls and contains no provider-specific endpoint or client identity.

## Acceptance Criteria
- [ ] `supabase/migrations/20260713000000_subscription_ai_connections.sql` adds `users.subscription_ai_beta_enabled boolean not null default false` and expands the `users.llm_provider` check to include `chatgpt_subscription` and `xai_subscription` while preserving `null`, `anthropic`, and `openai` behavior.
- [ ] The migration creates `user_ai_connections` with a unique `(user_id, provider)` key, encrypted credential envelope, provider account ID, connection status, token expiry, revision, last-verified timestamp, and created/updated timestamps; provider is restricted to the two subscription values.
- [ ] The migration creates short-lived `ai_oauth_device_flows` rows with owner, provider, encrypted flow envelope, status, next allowed poll, expiry, and timestamps. A partial unique index allows at most one active flow per user/provider; success, denial, cancellation, and expiry delete the credential-bearing row.
- [ ] RLS is enabled on both tables with no authenticated/anon policies. Only code using `createAdminClient()` can read or mutate connection credentials or device-flow envelopes.
- [ ] `src/lib/subscription-ai.ts` defines `SubscriptionProvider`, `SubscriptionCredentials`, `AIConnectionStatus`, and typed public error categories: `provider_disabled`, `not_connected`, `reauth_required`, `entitlement`, `quota`, `rate_limit`, `timeout`, `upstream`, and `invalid_response`.
- [ ] `isSubscriptionAIBetaEnabled(userId)` requires both `ENABLE_SUBSCRIPTION_AI_BETA=true` and `users.subscription_ai_beta_enabled=true`. Every foundation service accepts the authenticated `userId`; callers cannot query or poll another user's connection/flow by UUID.
- [ ] `src/lib/ai-connections.ts` encrypts one versioned JSON credential envelope with the existing AES-256-GCM helper and exposes repository methods to read, upsert, mark reauthentication, delete, and compare-and-swap refreshed credentials by `revision`.
- [ ] Access tokens, refresh tokens, ID tokens, scopes, device codes, user codes, verification URLs, PKCE material, nonces, and raw upstream payloads are encrypted at rest. Only provider/account IDs, normalized status, expiry/poll times, revision, and timestamps remain plaintext.
- [ ] Reconnect is staged: the last working connection remains active until a replacement flow completes successfully, and connecting/switching one provider never deletes the other provider's row.
- [ ] `src/lib/ai-device-flow.ts` defines `SubscriptionAuthAdapter.startDeviceAuthorization`, `.pollDeviceAuthorization`, and `.refresh`; it enforces upstream poll intervals/`slow_down`, owner checks, expiry, single completion, and deletion of terminal flow data.
- [ ] Concurrent refreshes are single-flight within one request process and compare-and-swap across Vercel processes. A compare-and-swap loser rereads the winning revision and uses it; it never replays or overwrites a rotated refresh token.
- [ ] `src/lib/subscription-responses-client.ts` implements all three `ILLMClient` methods through an injected provider transport, flattens Anthropic system blocks, preserves timeouts/max output/reasoning options supported by the transport, parses full Responses output, and parses `response.output_text.delta`/terminal SSE events without leaking internal event frames to callers.
- [ ] `src/lib/supabase/database.types.ts` is regenerated after the migration without dropping the in-progress replies schema changes already present in the worktree.

## Implementation Notes
- The credential envelope should be shaped as `{ version: 1, accessToken, refreshToken?, idToken?, scopes, issuedAt }`; token expiry stays duplicated in plaintext only so the resolver can decide whether to refresh without decrypting every connection listing.
- The flow envelope should be shaped as `{ version: 1, deviceCode, userCode, verificationUri, verificationUriComplete?, intervalSeconds, providerPayload }`. API/UI code added later may return the short-lived `userCode` and verification URL to the authenticated owner, but must never return `deviceCode` or token material.
- Suggested files: `src/lib/subscription-ai.ts`, `src/lib/ai-connections.ts`, `src/lib/ai-device-flow.ts`, `src/lib/subscription-responses-client.ts`, and corresponding tests in `src/lib/__tests__/`.
- The provider-neutral transport receives a resolved bearer token from the repository layer; it must not read `LLM_API_KEY`, `OPENAI_API_KEY`, or `XAI_API_KEY`.
- When either beta gate becomes false, stored connections are retained but all subscription operations return `provider_disabled`; disabling the gate never changes `users.llm_provider` or silently selects Server Default.

## Testing
- Apply the migration locally, regenerate types with `npm run db:types`, and inspect the diff to ensure both subscription tables and the existing reply tables remain represented.
- Run focused tests for `ai-connections`, `ai-device-flow`, `subscription-responses-client`, and the beta gate; cover cross-user access, ciphertext round-trip, corrupt ciphertext, expiry, terminal cleanup, poll throttling, `slow_down`, reconnect staging, and compare-and-swap refresh races.
- Query both tables through anon and authenticated Supabase clients and confirm reads/writes are denied; repeat through `createAdminClient()` and confirm repository operations succeed.
- Spy on `fetch` and `process.env` access during foundation tests and confirm no shared API key or provider endpoint is used.
