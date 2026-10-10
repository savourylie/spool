# [TICKET-089] Provider-Native Trend Search & Freshness Routing

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #088

## Description
Replace the Grok-specific trend-search bypass with a user-aware, provider-neutral router so ChatGPT subscription users search with `web_search` and xAI subscription users search with `x_search`. Preserve the legacy shared-xAI behavior only for existing Server Default/BYOK users, and make every source/failure explicit so an active subscription can never cross-fallback to a Spool-funded key.

## Acceptance Criteria
- [ ] `src/lib/trend-search.ts` replaces `src/lib/grok-search.ts` and exports `searchTrendsForUser(userId, topics)` plus provider-neutral `TrendingTopic`, `TrendSearchSource`, `TrendSearchUnavailableReason`, and `TrendSearchResult` types.
- [ ] The routing matrix is explicit and tested: `chatgpt_subscription` → the user's ChatGPT bearer plus `web_search`; `xai_subscription` → the user's xAI bearer plus `x_search`; Server Default/Anthropic BYOK/OpenAI-compatible BYOK → the existing server `XAI_API_KEY` adapter for backward compatibility.
- [ ] The legacy matrix branch is named `legacy_shared_xai` in code/results and is reachable only when the active selection is not a subscription. It is not a fallback from any subscription auth, entitlement, quota, model, tool, timeout, parse, or provider-disabled failure.
- [ ] Subscription search obtains credentials through the same connection/refresh repository as generation. It never accepts bearer tokens from the browser and never reads another provider's key or connection.
- [ ] ChatGPT uses the endpoint/headers/model validated in #083/#086 with `tools: [{ type: "web_search" }]`; xAI uses the endpoint/model validated in #083/#087 with `tools: [{ type: "x_search" }]`.
- [ ] Provider responses normalize to the existing five-item maximum and validate `title`, `postCount`, exact matched topic, and clamped relevance score. Markdown fences, prose, invalid JSON, empty output, and tool failures return `unavailable` with a public reason rather than pretending there are zero trends.
- [ ] `src/app/api/trends/route.ts` replaces `/api/grok-search`, validates the signed Spool session/topics, passes `userId`, and returns provider-neutral data. The old internal route is removed after all call sites migrate.
- [ ] `src/lib/freshness-gate.ts` passes its existing `userId` to trend search and preserves source/unavailable metadata in the external signal. Composer and Today Hub distinguish “search unavailable” from “search found no saturation”; they never block or bless a topic based on a silent cross-provider result.
- [ ] `src/components/dashboard/trending-topics.tsx` replaces `grok-trending.tsx`; `src/components/dashboard/discover-client.tsx` and `src/app/dashboard/create/page.tsx` use provider-neutral “Trends” copy with no Grok claim when ChatGPT supplied the data.
- [ ] Structured logs identify only provider/source, operation, public error category, status, latency, and correlation ID. Queries, account IDs, tokens, authorization headers, upstream bodies, prompts, and returned trend content are not logged.
- [ ] Tests cover every routing-matrix row, both native tool payloads, token refresh, missing legacy key, subscription gate disabled, auth/quota/tool/timeout/parse errors, input validation, user-ID forwarding, normalization, and the invariant that subscription errors never call `legacy_shared_xai`.

## Design Reference
- **Components**: existing dashboard card chrome; provider-neutral source/status text; no new branded provider colors.
- **Typography**: `docs/DESIGN.md` eyebrow/title/body hierarchy.
- **Icons**: Phosphor regular-weight inline icons only.

## Visual Reference
The Discover page keeps the current trending-topics card in the same position and layout, but the title is “Trends for your topics” rather than “Grok trending.” Loading, empty, unavailable, and retry states remain inside the flat bordered card. No provider logo dominates the card; optional source text is quiet metadata so the content, not the model vendor, remains primary.

## Implementation Notes
- Keep native search outside `ILLMClient`; tool-bearing discovery has a different result/error contract from text generation.
- Update `src/lib/__tests__/freshness-gate.test.ts` mocks to expect `(userId, topics)` and add `src/lib/__tests__/trend-search.test.ts` plus `src/app/api/trends/route.test.ts`.
- This ticket deliberately preserves current search for non-subscription users. Removing `XAI_API_KEY` entirely is a separate product decision and is not required for the subscription beta.
- If #083 shows that `web_search` or `x_search` is unavailable for a validated plan, that provider's search returns `entitlement`/`tool_unavailable`; it does not switch search providers.

## Testing
- Run `npm test -- src/lib/__tests__/trend-search.test.ts src/lib/__tests__/freshness-gate.test.ts src/lib/__tests__/today-hub-freshness.test.ts src/app/api/trends/route.test.ts`.
- Exercise Discover, Composer freshness, and Today Hub with each active subscription; inspect captured requests to confirm `web_search` versus `x_search` and the correct user account.
- Revoke each subscription and repeat search; confirm an unavailable/provider-action state and zero calls to `XAI_API_KEY` or the other subscription.
- Test Server Default and both existing BYOK selections with and without `XAI_API_KEY` to verify the documented legacy matrix and unavailable state.
