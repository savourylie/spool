# Subscription AI provider contracts

> Review date: 2026-07-13
> Kilo source snapshot: `3cb82a0907f888749435c1d208e56d8365747df2`
> Status: **deferred 2026-10-11.** Public-source research and automated probe coverage were completed; the dedicated-account matrix was never run. The product owner dropped subscription sign-in. OpenAI's official Sign in with ChatGPT plan usage (developers.openai.com/siwc) covers only open-source and locally hosted apps through a `127.0.0.1` loopback callback, and remotely hosted apps need partner approval. xAI was set aside. Spool's AI stays API-billed through AI SDK 7 and Vercel AI Gateway. This record and `scripts/subscription-ai-contract-probe.mjs` are kept for reference only.

This record is the contract gate for Spool's experimental ChatGPT and xAI subscription connections. It deliberately treats each provider independently and does not describe either consumer/CLI channel as a supported hosted-app API.

## Evidence levels

- **Provider-owned public** — documentation, help content, or discovery metadata published on a provider-controlled domain. This proves only what that source says; Platform API-key documentation does not prove subscription-token entitlement.
- **Real-account observation** — a sanitized result from `scripts/subscription-ai-contract-probe.mjs` against a dedicated beta account. No qualifying live run has been completed yet.
- **Pinned-source inference** — behavior in the exact Kilo Code snapshot linked below. It is implementation evidence, not provider authorization or a stability guarantee.

No value inferred at one level is promoted to another level in this record.

## Decision gate

Public evidence does not authorize Spool to reuse either CLI OAuth identity from a hosted third-party service. The safe recommendation is therefore `no-go` for both providers until written provider authorization and the dedicated-account matrix are complete.

| Provider | Recommended decision | Approving product owner | Decision date | Evidence | Risk acceptance |
| --- | --- | --- | --- | --- | --- |
| ChatGPT subscription | `no-go` | **Pending** | **Pending** | Official support is scoped to OpenAI's ChatGPT/Codex clients; hosted reuse, custom device endpoints, backend endpoint, and account header are not a public third-party contract. | None accepted. Do not ship or defer #086 until the product owner records the final decision. |
| xAI Premium+ / SuperGrok | `no-go` | **Pending** | **Pending** | Kilo says it reuses an allowlisted Grok CLI client; xAI's FAQ warns about third-party apps using Grok credentials. | None accepted. Do not ship or defer #087 until the product owner records the final decision. |

These are recommendations, not approved decisions. TICKET-083 must not be marked `done` while the approver/date fields and live evidence remain pending.

If one provider is ultimately approved as `go` or `internal-beta-only`, its adapter may proceed independently. If a provider is approved `no-go`, mark only that provider's adapter ticket `deferred`; #085 and the other provider remain eligible. Because the requested rollout includes both providers, #091 remains blocked unless the rejected provider becomes viable or the product owner explicitly accepts a one-provider beta.

## ChatGPT / Codex subscription channel

### Contract inventory

| Field | Provider-owned public evidence | Real-account observation | Pinned-source inference |
| --- | --- | --- | --- |
| Authorization issuer | OpenAI's [OIDC discovery document](https://auth.openai.com/.well-known/openid-configuration) reports `https://auth.openai.com`. | Not run. | `https://auth.openai.com`. |
| Device-code endpoint | [Codex authentication](https://developers.openai.com/codex/auth) documents beta device-code login for Codex CLI but does not publish the HTTP endpoint. | Not run. | Start: `POST https://auth.openai.com/api/accounts/deviceauth/usercode`; poll: `POST https://auth.openai.com/api/accounts/deviceauth/token`; verification UI: `https://auth.openai.com/codex/device`. This is a bespoke flow, not an RFC 8628 response shape. |
| Token endpoint | Discovery publishes `https://auth.openai.com/api/accounts/oauth/token`. | Not run. | Kilo uses `POST https://auth.openai.com/oauth/token` for authorization-code and refresh grants. The path difference is unresolved contract drift or aliasing. |
| Public client ID | Not published in the reviewed OpenAI documentation. | Not run. | `app_EMoamEEZ73f0CkXaXp7hrann`. |
| Scopes | Discovery lists `openid`, `profile`, `email`, and `offline_access`. | Not run. | Browser flow requests `openid profile email offline_access`; the custom headless start request supplies only the client ID, so effective device-flow scopes require observation. |
| Inference endpoint | OpenAI documents the Platform Responses endpoint, not the subscription backend. | Not run. | `https://chatgpt.com/backend-api/codex/responses`. Kilo rewrites Responses and Chat Completions requests to it. |
| Required headers | Public Platform examples require bearer authorization and JSON content type, but do not document the subscription backend or account header. | Not run. A `--check-headers` control truly omits authorization, JSON content type (using a byte body so Fetch cannot recreate it), and provider-specific headers. Because Undici supplies `Accept`/`User-Agent` on the wire, separate controls substitute neutral values and record whether the probe-specific values are required. | Kilo sends bearer authorization and `ChatGPT-Account-Id` when available, plus adapter identity/session headers. Which are server-required is unknown until the live controls run. The Spool probe identifies itself honestly as `spool-contract-probe/0.1`; it does not impersonate Kilo or Codex. |
| Account identifier | Public docs describe account/workspace selection but not a stable claim/header contract. | Not run. | Decode ID token first, then access token; select top-level `chatgpt_account_id`, `https://api.openai.com/auth.chatgpt_account_id`, or `organizations[0].id`, then send `ChatGPT-Account-Id`. |
| Token lifetime | Public docs say Codex refreshes credentials but publish no duration. | Not run. | Use `expires_in`, with a 3,600-second fallback. The fallback is not an observed provider lifetime. |
| Refresh-token behavior | Discovery supports `refresh_token`; replacement/rotation behavior is not documented. | Not run. | Refresh uses the same public client. Rotation/persistence is delegated to another Kilo helper and is not established by the reviewed adapter file. |
| Polling errors | Not publicly specified beyond beta device login. | Not run. | Parse interval with a 5-second default and 1-second floor. Kilo treats HTTP 403/404 as pending and other failures as terminal; device expiry/error bodies are not a stable public contract. |
| Quota errors | No subscription-backend status/body/reset contract is published. | Not run. | Not specified. |
| Model entitlement | The [GPT-5.5 model page](https://developers.openai.com/api/docs/models/gpt-5.5) documents Platform Responses, streaming, and web search support. It does not prove subscription-backend entitlement. | Not run with the required paid account. | Kilo's local filter permits `gpt-5.5`; that does not prove server availability. The probe never substitutes another model. |
| Native search | OpenAI's [web search guide](https://developers.openai.com/api/docs/guides/tools-web-search) documents `{ "type": "web_search" }` with `gpt-5.5` on the Platform Responses API. | Not run against the subscription backend. | The pinned adapter does not establish `web_search` behavior. |
| Streaming | Platform GPT-5.5 supports streaming. | No subscription SSE frames observed. | The pinned adapter rewrites requests but does not define the subscription SSE contract. |

### Hosted-contract caveat

OpenAI documents “Sign in with ChatGPT” for the ChatGPT desktop app, Codex CLI, IDE extension, and Codex cloud. The same page describes device authorization as beta and recommends controlled, trusted automation. It does not authorize Spool to reuse the Codex public client or subscription backend from a hosted multi-user service.

OpenAI also states that [ChatGPT and API billing are separate](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api). The public Platform documentation for GPT-5.5 and `web_search` therefore cannot be used as proof that a ChatGPT subscription bearer is entitled to those operations on the inferred backend.

### Live matrix — dedicated paid ChatGPT account

| Check | Required evidence | Status |
| --- | --- | --- |
| Device authorization | Issuer/endpoints, effective scopes, polling interval/errors, account claim present | Not run — dedicated account and operator approval required. |
| Non-streaming generation | Exact `gpt-5.5`; subscription backend; non-empty structured output | Not run. |
| Header controls | Required versus optional `Authorization`, JSON content type, and account/adapter headers; required versus replaceable `Accept` and `User-Agent` values | Not run. |
| SSE streaming | At least one `response.output_text.delta` and a terminal event | Not run. |
| Refresh | Observed access-token lifetime, replacement access token, refresh-token rotation/retention | Not run. |
| Entitlement/model error | Exact public category; `no-go` if `gpt-5.5` is unavailable; no model fallback | Not run. |
| Quota error | Prepared exhausted-plan state; sanitized `quota` category | Not run. |
| Native search | Actual `web_search_call` evidence on the subscription backend | Not run. |
| Revocation | Generation and refresh both become `reauth_required`; no Platform/shared-key request | Not run. |

## xAI Premium+ / SuperGrok channel

### Contract inventory

| Field | Provider-owned public evidence | Real-account observation | Pinned-source inference |
| --- | --- | --- | --- |
| Authorization issuer | xAI's [OIDC discovery document](https://auth.x.ai/.well-known/openid-configuration) reports `https://auth.x.ai`. | Not run. | The `/oauth2` endpoint base is inferred from the endpoint constants. |
| Device-code endpoint | Discovery publishes `https://auth.x.ai/oauth2/device/code` and the RFC 8628 grant type. | Not run. | Same endpoint. |
| Token endpoint | Discovery publishes `https://auth.x.ai/oauth2/token`. | Not run. | Same endpoint for device, authorization-code, and refresh grants. |
| Public client ID | Not published in reviewed xAI documentation. | Not run. | `b1a00492-073a-47ea-816f-4c329264a828`, described by Kilo as the allowlisted Grok CLI identity. |
| Scopes | Discovery lists the selected scopes among its supported set. | Not run. | `openid profile email offline_access grok-cli:access api:access`. |
| Inference endpoint | The [grok-4.5 API guide](https://docs.x.ai/developers/grok-4-5) documents `https://api.x.ai/v1/responses` with API-key bearer auth. | Not run with a subscription OAuth bearer. | Kilo relies on the xAI SDK default base `https://api.x.ai/v1`; the exact generation path is not established in the adapter. |
| Required headers | Official API examples send bearer authorization and JSON content type. | Not run with OAuth. A `--check-headers` control truly omits authorization/JSON content type and separately substitutes neutral `Accept`/`User-Agent` values; it records only allowlisted header names. | Kilo injects bearer authorization and its own user agent. The Spool probe sends an honest `spool-contract-probe/0.1` identity. |
| Account identifier | Discovery publishes the standard ID-token `sub` claim but no Spool-facing account-header contract. | Not run; direct SuperGrok versus linked Premium+ identity shape unknown. | The pinned adapter does not decode or persist an account identifier. The probe treats `sub` as the candidate identifier claim only for validation and never prints its value. |
| Token lifetime | Not published for this OAuth client. | Not run. | Use `expires_in`, defaulting to 3,600 seconds; decode access-token JWT `exp` for refresh timing. |
| Refresh-token behavior | Discovery supports refresh grants but does not promise rotation. | Not run. | Kilo assumes rotating refresh tokens, refreshes 120 seconds early, single-flights within one process, and notes that replaying a consumed stale token can force re-login. |
| Polling errors | RFC 8628 endpoint/grant support is public; concrete error behavior is not documented in the reviewed product pages. | Not run. | `authorization_pending` continues; `slow_down` adds at least 5 seconds; denial/expiry are terminal; the returned expiry bounds polling. |
| Quota errors | The [Grok FAQ](https://docs.x.ai/grok/faq) says paid usage draws from one weekly pool whose product breakdown includes API, and paid features pause at exhaustion. It does not publish HTTP error shapes for OAuth inference. | Not run with an exhausted account. | Not specified. |
| Model entitlement | The official API guide documents `grok-4.5` for API-key use and notes regional availability. It does not prove direct SuperGrok or linked Premium+ OAuth entitlement. | Not run for either required account type. | The pinned adapter performs no model entitlement validation. The probe never substitutes another model. |
| Native search | xAI's [X Search guide](https://docs.x.ai/developers/tools/x-search) documents `{ "type": "x_search" }` on the API-key Responses endpoint. | Not run with a subscription OAuth bearer. | The pinned adapter does not define `x_search` request/result behavior. |
| Streaming | Official model docs list Responses support, but the OAuth SSE contract is not separately documented. | No OAuth SSE frames observed. | The pinned adapter only injects authentication into SDK requests. |

### Hosted-contract caveat

xAI's FAQ says linking an X account lets xAI retrieve subscription status and grant applicable benefits, and its weekly-pool breakdown includes API usage. Its API quickstart still directs developers to create an API key and fund API use. Neither source documents hosted third-party reuse of the Grok CLI OAuth identity.

The pinned Kilo source is explicit that non-allowlisted clients are rejected and that Kilo reuses the allowlisted Grok CLI client. The xAI FAQ additionally advises users who encounter a third-party app using their Grok credentials to revoke and change those credentials. That evidence supports a `no-go` recommendation unless xAI provides explicit authorization.

### Live matrix — direct SuperGrok and linked X Premium+

Run every row once with a direct SuperGrok account and again with an X Premium+ account linked at `accounts.x.ai`.

| Check | Required evidence | Direct SuperGrok | Linked X Premium+ |
| --- | --- | --- | --- |
| Device authorization | Effective scopes, issuer/endpoints, RFC 8628 polling/errors, `sub` claim present | Not run. | Not run. |
| Non-streaming generation | Exact `grok-4.5`; non-empty structured output | Not run. | Not run. |
| Header controls | Required versus optional authorization/JSON content type; required versus replaceable transport-default header values | Not run. | Not run. |
| SSE streaming | Delta plus terminal event | Not run. | Not run. |
| Refresh | Observed lifetime and a distinct rotated refresh token | Not run. | Not run. |
| Entitlement/model error | `no-go` if exact model unavailable; no fallback | Not run. | Not run. |
| Weekly quota error | Prepared exhausted weekly pool; sanitized `quota` category | Not run. | Not run. |
| Native search | Actual `x_search_call` evidence | Not run. | Not run. |
| Revocation | Generation and refresh become `reauth_required`; no API-key/other-provider request | Not run. | Not run. |

## Probe operation and security boundary

The probe is dependency-free Node ESM and uses fixed endpoints, public client identities, scopes, models, prompts, bounded output limits, and tool types. It accepts no token, model, prompt, endpoint, or verbose/debug override. Tokens, authorization material, prompts, generated content, and raw provider payloads exist only in process memory and are discarded at exit. The script never reads a provider CLI credential cache. Its only filesystem write is an opt-in, exclusive (`wx`), mode-`0600` evidence file built from a strict non-secret allowlist.

Standard runs:

```bash
node scripts/subscription-ai-contract-probe.mjs --provider chatgpt --check-headers --evidence-file /tmp/chatgpt-contract-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider xai --check-headers --evidence-file /tmp/xai-contract-evidence.json
```

Run the xAI command once with a direct SuperGrok account and again with a linked X Premium+ account, using a fresh evidence-file name for each run. Evidence files never overwrite an existing path.

On macOS the script opens only the static provider verification page and displays the short-lived human `user_code` in a transient local dialog delivered over child stdin. It ignores code-bearing complete URIs and never uses the clipboard or child-process arguments for the code; the secret machine `device_code` never leaves process memory. Standard output remains JSON Lines with exactly `operation`, `status`, `latency_ms`, and `error_category`.

The evidence file contains only pinned contract metadata and allowlisted observations: a matching known issuer, issuer-match boolean, device interval/expiry, known polling outcomes, granted known scope names, account-claim name (never its value), token lifetime in seconds, access-token replacement, refresh-token rotation, required/optional omitted header names, required/replaceable known header-value names, expected public error category, and revocation result. Raw issuer/scope values that do not match the pinned allowlist, provider messages, response bodies, tokens, identifiers, prompts, and generated text cannot enter the record.

Prepared error-state runs:

```bash
node scripts/subscription-ai-contract-probe.mjs --provider chatgpt --expect-error entitlement --evidence-file /tmp/chatgpt-entitlement-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider chatgpt --expect-error quota --evidence-file /tmp/chatgpt-quota-evidence.json

# Run both xAI commands with direct SuperGrok, then repeat with linked X Premium+.
node scripts/subscription-ai-contract-probe.mjs --provider xai --expect-error entitlement --evidence-file /tmp/xai-supergrok-entitlement-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider xai --expect-error quota --evidence-file /tmp/xai-supergrok-quota-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider xai --expect-error entitlement --evidence-file /tmp/xai-premium-entitlement-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider xai --expect-error quota --evidence-file /tmp/xai-premium-quota-evidence.json
```

These modes pass only when the exact expected public category is observed. They do not manufacture an account state and must be run against an account genuinely lacking entitlement or with its plan pool exhausted.

Same-process revocation run:

```bash
node scripts/subscription-ai-contract-probe.mjs --provider chatgpt --check-headers --revoke-check --evidence-file /tmp/chatgpt-revocation-evidence.json
node scripts/subscription-ai-contract-probe.mjs --provider xai --check-headers --revoke-check --evidence-file /tmp/xai-revocation-evidence.json
```

After the normal matrix passes, a local dialog asks the operator to revoke the provider session upstream. The process retains the in-memory credential pair long enough to prove both generation and refresh return `reauth_required`, then discards it.

Capture and inspect only the sanitized output:

```bash
node scripts/subscription-ai-contract-probe.mjs --provider chatgpt --check-headers --evidence-file /tmp/chatgpt-contract-evidence.json > /tmp/chatgpt-contract-probe.jsonl
rg -n "Bearer|access_token|refresh_token|device_code|id_token|authorization|Reply with|generated" /tmp/chatgpt-contract-probe.jsonl /tmp/chatgpt-contract-evidence.json
```

Any match must be inspected; no credential value, header, payload, prompt, or generated content is permitted. Public operation labels intentionally avoid the word `authorization` to keep this scan signal clean.

Automated protocol/security coverage:

```bash
npm test -- scripts/subscription-ai-contract-probe.test.mjs
```

The tests use synthetic recognizable values only. They cover exact contracts, issuer and polling observations, body-independent ChatGPT pending statuses, polling safety margins and `slow_down`, non-streaming output, official SSE error shapes, refreshed-token replacement, mandatory xAI rotation, forced native-tool evidence, reasoning/output bounds, wire-level content-type omission, transport-header value substitution, OAuth client rejection classification, prepared quota classification, same-process revocation, model fail-closed behavior, output/evidence allowlisting, exclusive evidence writes, safe device-code presentation, and absence of credential-cache or shared-key fallbacks.

## Revalidation checklist

Complete this checklist before every production beta expansion and attach a new dated, sanitized matrix:

- [ ] Re-read provider-owned authentication, billing/subscription, model, Responses, and native-search documentation.
- [ ] Fetch both provider OIDC discovery documents and compare issuer, token, device, scopes, grants, and auth methods.
- [ ] Compare public client IDs, endpoints, scopes, redirect/device semantics, and required headers with the pinned implementation record.
- [ ] Obtain explicit provider authorization for hosted third-party use or keep that provider `no-go`.
- [ ] Use fresh dedicated accounts; never a developer's personal cached CLI session.
- [ ] Verify exact curated models `gpt-5.5` and `grok-4.5`; record `no-go` rather than falling back.
- [ ] Repeat non-streaming, SSE, refresh/rotation, native search, entitlement, quota, and revocation checks.
- [ ] Run xAI once with direct SuperGrok and once with linked X Premium+.
- [ ] Confirm account-identifier claim/header behavior without recording identifier values.
- [ ] Redirect probe output and complete the credential-pattern scan.
- [ ] Record product-owner decision, date, evidence, and explicit risk acceptance independently for each provider.
- [ ] Defer only a rejected provider's adapter; keep #091 blocked unless the rollout scope is explicitly narrowed.

## Sources

### Provider-owned public

- [OpenAI Codex authentication](https://developers.openai.com/codex/auth)
- [OpenAI OIDC discovery](https://auth.openai.com/.well-known/openid-configuration)
- [OpenAI ChatGPT/API billing separation](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api)
- [OpenAI GPT-5.5 model](https://developers.openai.com/api/docs/models/gpt-5.5)
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [xAI OIDC discovery](https://auth.x.ai/.well-known/openid-configuration)
- [xAI Grok FAQ](https://docs.x.ai/grok/faq)
- [xAI grok-4.5](https://docs.x.ai/developers/grok-4-5)
- [xAI X Search](https://docs.x.ai/developers/tools/x-search)

### Pinned source

- [Kilo OpenAI Codex adapter at `3cb82a0`](https://github.com/Kilo-Org/kilocode/blob/3cb82a0907f888749435c1d208e56d8365747df2/packages/opencode/src/plugin/openai/codex.ts)
- [Kilo xAI adapter at `3cb82a0`](https://github.com/Kilo-Org/kilocode/blob/3cb82a0907f888749435c1d208e56d8365747df2/packages/opencode/src/plugin/xai.ts)
