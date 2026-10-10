# [TICKET-086] ChatGPT Subscription OAuth & Responses Adapter

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #085

## Description
Implement the provider adapter that connects a paid ChatGPT account through the contract approved in #083 and exposes its Codex subscription Responses channel through Spool's existing `ILLMClient` interface. The adapter must refresh and persist the user's own credentials safely and must never route a failed subscription request through OpenAI Platform billing or Spool's shared Anthropic key.

## Acceptance Criteria
- [ ] This ticket starts only when #083 records `go` or `internal-beta-only` for ChatGPT; a `no-go` result changes this ticket to `deferred` without adding a workaround that scrapes ChatGPT web sessions.
- [ ] `src/lib/chatgpt-subscription-auth.ts` implements `SubscriptionAuthAdapter` using the exact issuer, public client identity, device endpoints, poll semantics, scopes, and token exchange validated in #083. Browser callback servers, localhost redirects, and cookies containing provider credentials are not used.
- [ ] The device start result contains only `flowId`, `userCode`, `verificationUri`, optional `verificationUriComplete`, `expiresAt`, and `nextPollAt`; access token, refresh token, ID token, device authorization ID/code, PKCE material, and raw upstream bodies remain server-only and encrypted.
- [ ] Successful authorization extracts and persists the ChatGPT account/workspace identifier required by the Responses channel, then atomically replaces any older ChatGPT connection while retaining the xAI connection.
- [ ] `src/lib/chatgpt-subscription-client.ts` composes `SubscriptionResponsesClient` with the validated Codex subscription transport, curated default `CHATGPT_SUBSCRIPTION_MODEL` value `gpt-5.5`, bearer authorization, and the required `ChatGPT-Account-Id` header.
- [ ] `generate`, `generateStream`, and `generateStreamIterator` work with string and structured system prompts, multi-turn messages, max-output limits, timeout/abort, and empty-output handling used by Scanner, Composer, topics, prediction, brand voice, concept extraction, reviews, freshness reframe, Today Hub, and reply-risk analysis.
- [ ] The access token is refreshed before expiry using the repository's single-flight and revision compare-and-swap path. Refresh-token rotation is persisted atomically; a losing Vercel invocation rereads the winner instead of replaying the old refresh token.
- [ ] HTTP/auth conditions map to the shared typed categories: revoked/invalid token → `reauth_required`; missing subscription/model/workspace access → `entitlement`; plan limit exhausted → `quota`; transient 429 → `rate_limit`; abort/deadline → `timeout`; 5xx/network → `upstream`; malformed output → `invalid_response`.
- [ ] Model unavailability and every error above fail closed. The adapter never reads `OPENAI_API_KEY`, `LLM_API_KEY`, `llm_api_key_encrypted`, or a custom BYOK base URL; never calls `api.openai.com`; and never instantiates `OpenAILLMClient` or the server-default `LLMClient`.
- [ ] Provider error messages returned to routes contain the public category and reconnect/limit guidance only; upstream bodies, account IDs, headers, tokens, prompts, and generated content are absent from errors and logs.
- [ ] `src/lib/__tests__/chatgpt-subscription-auth.test.ts` and `src/lib/__tests__/chatgpt-subscription-client.test.ts` cover device pending/slow/denied/expired/success, response parsing, both streaming APIs, refresh success/rotation/race, revoked access, missing entitlement, quota, timeout, 5xx, invalid SSE, and zero shared-key fallback.

## Implementation Notes
- Current research inputs are `https://auth.openai.com`, public client ID `app_EMoamEEZ73f0CkXaXp7hrann`, device authorization endpoints under `/api/accounts/deviceauth`, and `https://chatgpt.com/backend-api/codex/responses`. Copy the approved values from the #083 contract record so drift is reviewed in one place.
- Set the model through a server-only environment variable with the curated default `gpt-5.5`; do not expose arbitrary model input in Settings and do not add automatic model fallback.
- Use an injected `fetch` in tests. Fixtures must be hand-sanitized protocol shapes and contain recognizable fake values such as `test-access-token`; never snapshot a real response from a beta account.
- Keep `src/lib/openai-client.ts` unchanged as the API-key/OpenAI-compatible BYOK implementation. Subscription traffic has a separate class and transport.
- Native `web_search` is intentionally added in #089, not folded into generic `ILLMClient` generation.

## Testing
- Run `npm test -- src/lib/__tests__/chatgpt-subscription-auth.test.ts src/lib/__tests__/chatgpt-subscription-client.test.ts src/lib/__tests__/subscription-responses-client.test.ts`.
- With the global and per-user beta gates enabled, connect the dedicated ChatGPT beta account and exercise one non-streaming call, one Scanner stream, and one Composer iterator stream; confirm each is attributed to the subscription account.
- Expire the stored access token, issue two concurrent requests from separate test workers, and verify one refresh is persisted while both requests complete with the winning credentials.
- Remove/revoke the provider session and confirm the next call returns `reauth_required`; assert fetch spies see neither `api.openai.com` nor another provider endpoint.
