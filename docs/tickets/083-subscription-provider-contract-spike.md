# [TICKET-083] Subscription Provider Contract Feasibility Spike

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: None

## Description
Validate the two experimental subscription channels with dedicated beta accounts before production code depends on them, and produce an independent go/no-go record for ChatGPT subscription access and xAI Premium+/SuperGrok access. This spike is the contract gate for every provider-specific ticket because both integrations rely on consumer/CLI authentication surfaces whose hosted third-party use is not fully documented as a stable public API.

## Acceptance Criteria
- [ ] `docs/research/subscription-ai-provider-contracts.md` records, for each provider, the observed authorization issuer, device-code endpoint, token endpoint, public client ID, scopes, inference endpoint, required headers, account identifier, token lifetime, refresh-token behavior, polling errors, quota errors, model entitlement behavior, and native search tool.
- [ ] The record clearly separates three evidence levels: provider-owned public documentation, behavior observed against a real account, and behavior inferred from the pinned Kilo Code source snapshot.
- [ ] OpenAI is tested with a paid ChatGPT account for device authorization, non-streaming generation, SSE streaming, refresh, quota/entitlement errors, and `web_search`; the test uses the curated beta model `gpt-5.5` and records `no-go` if that model is unavailable rather than silently selecting another model.
- [ ] xAI is tested with both a direct SuperGrok account and an X Premium+ account linked at `accounts.x.ai` for device authorization, non-streaming generation, SSE streaming, refresh-token rotation, quota/entitlement errors, and `x_search`; the test uses `grok-4.5` and records `no-go` if unavailable.
- [ ] `scripts/subscription-ai-contract-probe.mjs` performs the checks with tokens held in memory only, prints only operation name/status/latency/public error category, and never prints or writes access tokens, refresh tokens, ID tokens, device codes, authorization headers, prompts, or generated content.
- [ ] Each provider receives an independent `go`, `internal-beta-only`, or `no-go` decision with the approving product owner, date, evidence, and risk acceptance. Lack of explicit provider authorization for reuse of a CLI OAuth identity is called out; it is never presented as an official hosted-app contract.
- [ ] Decisions are independent: a `no-go` provider's adapter ticket is marked `deferred` while the other adapter and shared foundation remain eligible to proceed. Because the requested scope includes both providers, #091 remains blocked unless the provider becomes viable or the product owner explicitly narrows the rollout to a one-provider beta.
- [ ] The spike records a revalidation checklist and requires it before every production beta expansion because endpoints, client allowlists, scopes, models, and entitlements may change without notice.

## Implementation Notes
- Current OpenAI public documentation says Codex clients can “Sign in with ChatGPT” for subscription access and supports beta device-code login, while ordinary API usage remains separately billed. The documented clients are the ChatGPT desktop app, Codex CLI, and IDE extension; that does not by itself authorize Spool as a hosted consumer of the Codex channel.
- Current Kilo Code snapshot `3cb82a0907f888749435c1d208e56d8365747df2` observes OpenAI issuer `https://auth.openai.com`, public client ID `app_EMoamEEZ73f0CkXaXp7hrann`, device endpoints under `/api/accounts/deviceauth`, and `https://chatgpt.com/backend-api/codex/responses`. These values are research inputs, not a stability guarantee.
- The same Kilo snapshot observes xAI client ID `b1a00492-073a-47ea-816f-4c329264a828`, issuer endpoints under `https://auth.x.ai/oauth2`, scope `openid profile email offline_access grok-cli:access api:access`, and `https://api.x.ai/v1`. Its own source notes that it reuses an allowlisted Grok CLI identity; that risk must remain explicit.
- Current xAI public documentation says paid SuperGrok usage has one weekly pool whose product breakdown includes API usage, and that a linked X account can confer X subscription benefits. It does not document Spool's proposed reuse of the Grok CLI OAuth client.
- Primary references:
  - [OpenAI Codex authentication](https://developers.openai.com/codex/auth)
  - [OpenAI ChatGPT/API billing separation](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api)
  - [xAI Grok FAQ](https://docs.x.ai/grok/faq)
  - [Kilo OpenAI Codex adapter at the pinned commit](https://github.com/Kilo-Org/kilocode/blob/3cb82a0907f888749435c1d208e56d8365747df2/packages/opencode/src/plugin/openai/codex.ts)
  - [Kilo xAI adapter at the pinned commit](https://github.com/Kilo-Org/kilocode/blob/3cb82a0907f888749435c1d208e56d8365747df2/packages/opencode/src/plugin/xai.ts)

## Testing
- Run `node scripts/subscription-ai-contract-probe.mjs --provider chatgpt` with the dedicated paid ChatGPT beta account; confirm every required operation receives a sanitized pass/fail result.
- Run `node scripts/subscription-ai-contract-probe.mjs --provider xai` once with SuperGrok and once after linking X Premium+; compare scopes and entitlements in the research record.
- Redirect probe output to a file and scan it with `rg -n "Bearer|access_token|refresh_token|device_code|id_token|authorization"`; expect no credential values or credential-bearing payloads.
- Revoke each provider session upstream, repeat generation and refresh, and verify the probe reports `reauth_required` without retrying through a Platform API key.
