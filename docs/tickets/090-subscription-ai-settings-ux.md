# [TICKET-090] Subscription AI Settings & Device Connection UX

## Status
`deferred`

> Deferred 2026-10-11: subscription sign-in was dropped. OpenAI's official Sign in with ChatGPT plan usage covers only open-source and locally hosted apps, so hosted Spool would need partner approval, and xAI was set aside. Spool's AI stays API-billed (AI SDK 7 + Vercel AI Gateway). See `docs/research/subscription-ai-provider-contracts.md`.

## Dependencies
- Requires: #085, #086, #087, #088

## Description
Add the limited-beta Settings experience for connecting, retaining, testing, activating, reconnecting, and disconnecting ChatGPT and xAI subscriptions through serverless device authorization. Preserve the existing Server Default and BYOK controls while making the single active provider, experimental status, plan usage, and fail-closed behavior unmistakable.

## Acceptance Criteria
- [ ] Subscription cards render only when `ENABLE_SUBSCRIPTION_AI_BETA=true` and the signed-in user has `subscription_ai_beta_enabled=true`; the server enforces both gates on every connection action even if a client crafts requests manually.
- [ ] `GET /api/settings/ai-connections` returns only safe connection summaries: provider, normalized state, active flag, token expiry, last verified time, beta availability, and active-provider recovery state. It never returns encrypted envelopes, tokens, account IDs, scopes, device codes, or upstream payloads.
- [ ] Provider-whitelisted routes exist for start (`POST /api/settings/ai-connections/[provider]/device`), poll/cancel (`POST`/`DELETE /api/settings/ai-connections/[provider]/device/[flowId]`), activate (`POST .../[provider]/activate`), test (`POST .../[provider]/test`), and disconnect (`DELETE /api/settings/ai-connections/[provider]`). Every route uses the verified Spool session and ownership checks.
- [ ] `src/components/dashboard/subscription-ai-settings.tsx` renders one ChatGPT card and one xAI card with an `Experimental` badge, connection state, active state, Connect/Reconnect, Use for AI, Test, and Disconnect actions appropriate to that state.
- [ ] Starting a flow opens an inline device panel with copyable one-time user code, provider verification URL, absolute expiry, and Pending/Connected/Denied/Expired/Error state. The browser receives the short-lived `userCode` only because the user must enter it; `deviceCode`, token material, and provider account ID never reach the client.
- [ ] TanStack Query polls Spool—not the provider—at `nextPollAt`; each Spool poll performs at most one upstream status check. Polling stops on completion, cancellation, denial, expiry, component unmount, tab background backoff, or global flag disable.
- [ ] Successful connection automatically selects that provider for AI and leaves the other provider connection intact. “Use for AI” switches the active provider without deleting either connection or modifying existing BYOK credentials.
- [ ] Reconnect stages a replacement and leaves the working connection selected until completion. Cancel/deny/expiry leaves the old connection untouched.
- [ ] Disconnect requires confirmation, deletes the local encrypted provider connection and active device flow, and links to the provider's session/security controls for upstream revocation. Disconnecting the active provider explicitly changes the selection to Server Default in the same transaction; it is not a resolver fallback.
- [ ] If the global flag is turned off while a subscription remains active, the normal beta cards are hidden but Settings displays a recovery alert explaining `provider_disabled` with an explicit “Switch to Server Default” action. AI requests remain failed closed until the user switches or the flag returns.
- [ ] Card copy says the connection uses an experimental Codex/Grok subscription channel, usage counts against the user's plan/weekly limits, availability can change, and provider consumer/workspace data controls apply. It never claims ordinary OpenAI API usage is included in ChatGPT Plus.
- [ ] Existing Anthropic/OpenAI-compatible BYOK save/test/clear and optional base URL/model fields behave exactly as before. Subscription cards never show or accept API-key, base-URL, or arbitrary-model fields.
- [ ] All actions are keyboard accessible, expose focus/disabled/loading state, announce connection status through an ARIA live region, and respect reduced motion; layout works at 375, 768, 1024, and 1440 pixels.

## Design Reference
- **Cards**: `docs/DESIGN.md` flat card, 1px border, `radius-lg`, no shadow or hover transform.
- **Inputs and focus**: `docs/DESIGN.md` sharp input/button geometry and accent focus ring.
- **Badges**: mono uppercase tracked tag at `radius-sm`; semantic soft background, never a pill.
- **Icons**: Phosphor regular-weight inline icons, approximately 18px, with no colored icon circles.

## Visual Reference
Below the existing AI Provider controls, eligible users see two equal flat cards titled “ChatGPT subscription” and “xAI Premium+ / SuperGrok.” Each has a small Experimental tag at the top, quiet explanatory copy, a compact state row, and right-aligned actions. During connection, that card expands into a bordered device panel showing a large monospace code, Copy button, “Open verification page” button, countdown, and an ARIA-announced status. The currently selected card says “Active for Spool AI”; the other connected card says “Connected” and offers “Use for AI.”

## Implementation Notes
- Modify `src/app/dashboard/settings/page.tsx`, `src/components/dashboard/settings-form.tsx`, `src/app/api/settings/route.ts`, and `src/app/api/settings/test/route.ts`; create the connection routes above and `src/components/dashboard/subscription-ai-settings.tsx`.
- Keep provider operations server-owned. The browser stores only route state, flow ID, user code, verification URL, and expiry in component/query memory; do not use localStorage or analytics properties for any device-flow value.
- Activation/disconnect database updates must be transactional or implemented as a Supabase RPC so `users.llm_provider` cannot reference a deleted connection after a partial failure.
- Add route tests beside the dynamic routes and a source/component test at `src/components/dashboard/__tests__/subscription-ai-settings.source.test.ts` if the project has no DOM test harness.

## Testing
- Run focused tests for every connection route, `src/app/api/settings/route`, `src/app/api/settings/test/route`, and the Settings source/component test.
- Walk every device state for each provider: connect, pending, slow poll, success/auto-activate, test, switch, reconnect cancel, reconnect success, denial, expiry, disconnect inactive, and disconnect active.
- Connect both providers, switch between them repeatedly, reload Settings, and confirm both connections persist while exactly one provider is active.
- Disable the global flag with a subscription active; verify the recovery alert can explicitly select Server Default and that no AI request silently switches before that action.
- Test keyboard-only and screen-reader status flow plus responsive widths 375/768/1024/1440 in light and dark mode.
