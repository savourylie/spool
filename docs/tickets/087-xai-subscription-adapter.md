# [TICKET-087] xAI Premium+/SuperGrok OAuth & Responses Adapter

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #085

## Description
Implement the provider adapter that connects a linked X Premium+ or direct SuperGrok account through the contract approved in #083 and exposes xAI's subscription-backed Responses channel through `ILLMClient`. The adapter must consume the user's xAI allowance, handle rotating refresh tokens correctly, and never fall back to the server `XAI_API_KEY` or another Spool-funded provider.

## Acceptance Criteria
- [ ] This ticket starts only when #083 records `go` or `internal-beta-only` for xAI; a `no-go` result changes this ticket to `deferred` without browser-cookie scraping or an undeclared API-key fallback.
- [ ] `src/lib/xai-subscription-auth.ts` implements `SubscriptionAuthAdapter` using the exact RFC 8628 device endpoint, public client identity, scopes, poll interval/`slow_down`, token endpoint, and refresh behavior validated in #083. It works in Vercel without a callback server or fixed localhost port.
- [ ] The flow response exposes only the authenticated owner's short-lived `flowId`, `userCode`, verification URI, expiry, and next poll time. Device code, nonce/PKCE data, access/refresh/ID tokens, and raw authorization payloads stay encrypted and server-only.
- [ ] Completion persists the xAI account identifier and atomically replaces an older xAI connection while retaining the ChatGPT connection. A linked X Premium+ entitlement and a direct SuperGrok entitlement normalize to the same `xai_subscription` provider value.
- [ ] `src/lib/xai-subscription-client.ts` composes `SubscriptionResponsesClient` with `https://api.x.ai/v1/responses`, the curated `XAI_SUBSCRIPTION_MODEL` default `grok-4.5`, and the user's OAuth bearer token.
- [ ] All three `ILLMClient` methods support the prompts, messages, timeouts, max output, non-streaming parse, and streaming event shapes required by existing Spool AI call sites.
- [ ] Refresh occurs before expiry, honors refresh-token rotation, and uses single-flight plus compare-and-swap persistence. A compare-and-swap loser rereads the winning token pair and never overwrites or replays the consumed refresh token.
- [ ] Revoked/invalid credentials map to `reauth_required`; missing API scope, linked-account benefit, plan, or model maps to `entitlement`; weekly pool exhaustion maps to `quota`; transient throttling maps to `rate_limit`; abort/deadline, 5xx/network, and malformed output map to their shared categories.
- [ ] Every failure fails closed. For an active xAI subscription the adapter never reads `XAI_API_KEY`, `LLM_API_KEY`, or `llm_api_key_encrypted`; never creates the legacy Grok search client; and never switches to ChatGPT, Anthropic, OpenAI BYOK, or Server Default.
- [ ] Logs and returned errors omit upstream bodies, authorization headers, provider account IDs, credentials, user/device codes, prompts, and generated content.
- [ ] `src/lib/__tests__/xai-subscription-auth.test.ts` and `src/lib/__tests__/xai-subscription-client.test.ts` cover both entitlement sources, device pending/slow/denied/expired/success, all completion methods, refresh rotation/race, revoked credentials, scope/plan failure, weekly quota, timeout, 5xx, invalid responses, and zero shared-key fallback.

## Implementation Notes
- Current research inputs are client ID `b1a00492-073a-47ea-816f-4c329264a828`, `https://auth.x.ai/oauth2/device/code`, `https://auth.x.ai/oauth2/token`, scope `openid profile email offline_access grok-cli:access api:access`, and `https://api.x.ai/v1`. Use the values approved in #083, not a second hard-coded copy of the research notes.
- xAI's current public FAQ shows API as one product in the shared SuperGrok weekly pool and says linking X lets xAI retrieve subscription status. This supports the product hypothesis but is not proof that the reused Grok CLI OAuth identity is a stable third-party integration contract.
- Keep the model server-curated and defaulted to `grok-4.5`; an unavailable model is an entitlement/configuration error, not permission to choose a different model.
- Keep `src/lib/grok-search.ts` unchanged in this ticket. Provider-native `x_search` and the legacy-server-key compatibility policy are handled explicitly in #089.

## Testing
- Run `npm test -- src/lib/__tests__/xai-subscription-auth.test.ts src/lib/__tests__/xai-subscription-client.test.ts src/lib/__tests__/subscription-responses-client.test.ts`.
- Connect and test once with direct SuperGrok and once with X Premium+ linked to xAI; verify both use `xai_subscription` and consume the expected account allowance.
- Force access expiry and two concurrent refreshes; verify the rotated pair is written once and both callers converge on the same revision.
- Exhaust or simulate the weekly pool and revoke authorization; confirm `quota` and `reauth_required` respectively, with no request carrying `XAI_API_KEY`.
