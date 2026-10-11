# AI SDK Provider Layer — Design

**Date:** 2026-10-11
**Status:** Approved in conversation; written spec awaiting review

## Purpose

Spool's AI features run through two hand-written clients: `LLMClient` (Anthropic SDK) and `OpenAILLMClient` (OpenAI Chat Completions). This sub-project replaces both with one adapter built on **AI SDK 7**. The `ILLMClient` interface stays the same, so the 11 call sites do not change.

After the change:

- The server default routes through **Vercel AI Gateway**, so Spool can use any provider's model by changing one string. The Gateway adds no token markup and provides budgets and spend observability.
- BYOK supports current OpenAI models through the Responses API, and **xAI** becomes a first-class provider.
- Later agent work runs on the same runtime.

This is **sub-project 0** of the Spool agent roadmap below.

## Context and decisions

- **No subscription sign-in.** OpenAI's official "Sign in with ChatGPT" plan usage covers only open-source and locally hosted apps, and hosted Spool would need partner approval. xAI was set aside. TICKET-083 and TICKET-085–091 are deferred (commit `dcf202b`). AI stays API-billed.
- **AI SDK 7 instead of pi-agent-core.** Spool needs a streaming chat UI, durable background runs, and tool approvals. AI SDK integrates all three with Next.js and Vercel (`useChat`, `WorkflowAgent`, tool approval policies). Pi's agent core would require building the UI integration, persistence, and durability ourselves.
- **Server default:** AI Gateway when `SPOOL_DEFAULT_MODEL` is set. Otherwise it is configured like a BYOK setting through `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL` and `LLM_MODEL`, so it can be an OpenAI-compatible server such as DashScope (amended 2026-10-11 at the product owner's request). With only `LLM_API_KEY` set it calls Anthropic directly, as before, so existing deployments and self-hosters keep working.
- **BYOK:** connects directly to each provider. Gateway BYOK is team-level, so it cannot hold per-user keys.
- **Interface:** `ILLMClient` (`generate`, `generateStream`, `generateStreamIterator`) is unchanged.

### Roadmap

| # | Sub-project | Depends on |
|---|---|---|
| 0 | AI SDK provider layer (this spec) | — |
| 1 | Conversational assistant: agent runtime, Spool tool library (read-only first), streaming chat UI, saved threads, usage limits | 0, TICKET-084 |
| 2 | Background agent tasks (weekly review, reply triage, draft prep) | 1 |
| 3 | Agentic upgrades of existing features, one feature at a time, including provider-native trend search | 1 |

TICKET-084 (signed sessions) must land before sub-project 1, because the assistant reads and acts on user data.

## Architecture

### Modules

| File | Change |
|---|---|
| `src/lib/ai-sdk-llm-client.ts` | **New.** `AiSdkLLMClient implements ILLMClient`, wrapping one AI SDK `LanguageModel` plus a small capability descriptor (Anthropic cache support, reasoning-model flag). |
| `src/lib/llm-models.ts` | **New.** Builds the `LanguageModel` and descriptor for the server default and for each BYOK provider. Holds the model capability map. |
| `src/lib/llm-resolver.ts` | Uses `llm-models.ts` and returns `AiSdkLLMClient`. Branch semantics below. |
| `src/lib/llm-client.ts` | Drops the unused per-call `model` override option (no caller passes it). Keeps the shared types (`LLMMessage`, `SystemBlock`, `LLMGenerateOptions`, `LLMStreamOptions`, `flattenSystemBlocks`) and the error classes (`LLMError`, `LLMRateLimitError`, `LLMAuthError`, `LLMServerError`, `LLMTimeoutError`). The Anthropic-SDK `LLMClient` class is removed, so existing imports of types and errors keep working. |
| `src/lib/openai-client.ts` | **Removed.** |
| `src/lib/llm-provider.ts` | `LLMProvider` gains `"xai"`. `PROVIDER_DEFAULTS` gains an `xai` entry and updated defaults (see Models). |
| `src/app/api/settings/route.ts`, `src/app/api/settings/test/route.ts` | Build the key-validation client through `llm-models.ts` and `AiSdkLLMClient`. Accept `xai`. |
| `src/components/dashboard/settings-form.tsx` | Adds the "xAI (Grok)" provider card. |
| `package.json` | Adds `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/xai`, and `@ai-sdk/openai-compatible`. Removes `@anthropic-ai/sdk` and `openai`, which only the two replaced clients import. |

AI SDK 7 is ESM-only and requires Node 22+. The repo runs Node 22.20, Next.js bundles ESM dependencies, and Vitest runs ESM, so `"type": "module"` is not required. `next build` confirms this.

### Model resolution (`resolveLLMClient`)

| User setting | Model |
|---|---|
| No BYOK provider, `SPOOL_DEFAULT_MODEL` set | AI Gateway with that model string (for example the Gateway slug for `claude-sonnet-4-6`). The AI SDK gateway provider authenticates with `AI_GATEWAY_API_KEY`, or with Vercel OIDC on deployments. Missing or invalid Gateway auth surfaces as `LLMAuthError`; there is no silent switch to `LLM_API_KEY`. |
| No BYOK provider, `SPOOL_DEFAULT_MODEL` unset | `createByokModel` with `LLM_PROVIDER` (default `anthropic`), `LLM_API_KEY`, `LLM_BASE_URL` and `LLM_MODEL`, same rules as BYOK. `openai` with a non-OpenAI base URL is an OpenAI-compatible server and requires `LLM_MODEL`; only that case may omit the key. An unknown provider, a missing key, or a missing model raises `LLMAuthError`. With only `LLM_API_KEY`, this is direct Anthropic `claude-sonnet-4-6`, as before. |
| `anthropic` with key | Direct Anthropic with the user's key and model (default `PROVIDER_DEFAULTS.anthropic`). |
| `openai`, no base URL | Direct OpenAI **Responses API** with the user's key and model. |
| `openai` with base URL | OpenAI-compatible Chat Completions at that URL (Ollama, LM Studio, OpenRouter, Together). The key is optional, as today. |
| `xai` with key | Direct xAI with the user's key and model (default `PROVIDER_DEFAULTS.xai`). |

Unchanged in this sub-project: a BYOK key that fails to decrypt still falls back to the server default, and an `anthropic` setting without a key still uses the server default.

### Environment variables

| Variable | Purpose |
|---|---|
| `SPOOL_DEFAULT_MODEL` | Turns on Gateway routing for the server default and names its model, for example `anthropic/<model>`, `openai/<model>`, or `spacexai/<model>` (AI Gateway lists xAI models under `spacexai/`). An explicit switch, so the app never guesses whether OIDC is available. |
| `AI_GATEWAY_API_KEY` | Gateway auth for local development and self-hosting. On Vercel, OIDC is used automatically once AI Gateway is enabled for the project. |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | The server default when `SPOOL_DEFAULT_MODEL` is unset, with the same meaning as a BYOK setting. `LLM_PROVIDER` defaults to `anthropic`, so an existing `LLM_API_KEY` keeps calling Anthropic. |

## Behavior parity

The adapter must behave like today's clients, so feature code and its tests stay untouched.

- **System prompts.** A string `systemPrompt` becomes `instructions`. A `SystemBlock[]` on an Anthropic-family model (direct Anthropic, or a Gateway `anthropic/*` model) becomes leading system messages, with `providerOptions.anthropic.cacheControl = { type: "ephemeral" }` on each `cacheable` block. This enables system messages in `messages` (`allowSystemInMessages: true` in AI SDK 7). On other providers the blocks are flattened with `flattenSystemBlocks`, as `OpenAILLMClient` does today.
- **SSE framing.** `generateStream` emits exactly today's frames: `data: <JSON string chunk>\n\n` per text delta, `data: [DONE]\n\n` at the end, and `data: {"error": "<message>"}\n\n` on failure before closing. `generateStreamIterator` yields raw text chunks and throws mapped errors.
- **Errors.** HTTP 401/403 → `LLMAuthError`. 429 → `LLMRateLimitError`. ≥500 → `LLMServerError(status)`. Timeouts and aborts → `LLMTimeoutError`. Anything else → `LLMError` with its status when known. Errors wrapped by AI SDK retries are unwrapped to the last attempt before mapping. Routes keep their existing 503/429 handling.
- **Timeouts and retries.** Defaults stay at 30s for `generate` and 60s for streams, and callers' `timeout` overrides are honored. As in the replaced SDKs, a timeout bounds each attempt until its response starts: a stream may run as long as it keeps sending, and a retry gets a fresh budget. AI SDK's own `timeout` caps the whole call, so the adapter applies the timeout in the provider `fetch` instead (`src/lib/llm-fetch.ts`). AI SDK's default of two retries matches the replaced SDKs; an attempt that times out is not retried.
- **Token budgets.** `maxTokens` (default 1024) becomes `maxOutputTokens`. On reasoning models, where thinking counts toward the output limit (OpenAI reasoning models, xAI reasoning models, adaptive-thinking-only Claude 5.x), the adapter adds a fixed **4,096-token reasoning allowance**. If the caller didn't set `reasoningEffort`, it requests the provider's low effort level. This prevents empty or truncated answers when callers size `maxTokens` for visible output. The capability map in `llm-models.ts` identifies reasoning models by provider and model-id family.
- **`reasoningEffort`.** Mapped to AI SDK's top-level `reasoning` option when the caller sets it.

### Models

- **Server default:** `claude-sonnet-4-6`, today's model, kept through this migration so outputs don't shift together with the transport. Upgrading it (for example to Claude Sonnet 5.5) is a separate step: change `SPOOL_DEFAULT_MODEL` after checking feature outputs.
- **BYOK defaults:** `anthropic` stays `claude-sonnet-4-6`. `openai` moves from `gpt-4o` to `gpt-6.1-sol`. `xai` defaults to `grok-4.7`. Both were checked against the AI Gateway model list on 2026-10-11.
- **Verifying identifiers.** The implementation plan records exact model IDs and Gateway slugs taken from `gateway.getAvailableModels()` and the providers' model docs on the day of implementation. Users who saved an explicit model keep it.

## Settings and data

- **Migration** `supabase/migrations/20261011000001_llm_provider_xai.sql` (`20261011000000` is the `post_replies` RLS fix): replace the `users.llm_provider` CHECK constraint (`IN ('anthropic', 'openai')`) with `IN ('anthropic', 'openai', 'xai')`. Existing rows are unaffected.
- **Settings form:** an "xAI (Grok)" card with a required API key and an optional model (placeholder shows the default). The Server Default card keeps "Use Spool's shared AI key", which is accurate whether or not the Gateway is enabled. The OpenAI-compatible card is unchanged.
- **Settings API:** `VALID_PROVIDERS` includes `xai`, and xAI keys are validated with one short `generate` through the new adapter, like Anthropic and OpenAI today.
- **Regenerated types:** `npm run db:types` after the migration.

## Testing

- **Adapter tests** (`src/lib/__tests__/ai-sdk-llm-client.test.ts`) use AI SDK's mock language model from `ai/test`. They cover: `generate` text; both stream forms, including exact SSE frames and the error frame; string versus block system prompts; Anthropic cache-control placement versus flattening; `maxOutputTokens`, including the reasoning allowance; `reasoning` mapping; each error mapping, including a wrapped retry error; and timeout mapping.
- **Model and resolver tests** (`llm-models` and `llm-resolver`) cover each branch in the resolution table: Gateway configured or not, `SPOOL_DEFAULT_MODEL` set or invalid without the Gateway, each BYOK provider, the base URL switch, and decrypt-failure fallback.
- **Settings route tests** cover `xai` acceptance, key validation, and rejection of unknown providers. The source test covers the new settings card.
- **Existing feature tests** mock `ILLMClient` and must pass unchanged. Tests for the deleted clients are replaced, not kept.
- **Live check (manual, local)** runs one `generate` and one streamed call through the Gateway, and through each BYOK provider whose key is available. Results are recorded in the plan's completion notes.

## Rollout

1. Merge with `SPOOL_DEFAULT_MODEL` unset. The server default keeps calling Anthropic directly with `LLM_API_KEY`, so there is no behavior change.
2. Add `AI_GATEWAY_API_KEY` locally. Enable AI Gateway for the Vercel project so OIDC applies, and set a Gateway budget.
3. Set `SPOOL_DEFAULT_MODEL` to the Gateway slug for `claude-sonnet-4-6` to move the server default onto the Gateway with the same model. Compare feature outputs before switching it to a different model.

## Out of scope

- Grok trend search (`src/lib/grok-search.ts`) keeps its direct xAI call and server key. It is revisited in sub-project 3.
- Structured output (`Output.object`) for call sites that currently parse JSON from text. This belongs with the agentic upgrades in sub-project 3.
- Changing decrypt-failure fallback to fail closed.
- Any agent, tool, or chat functionality (sub-project 1).

## Risks

- **ESM or bundling surprises** with AI SDK 7 packages in Next.js 16 and Vitest. Mitigation: `next build` and the full test suite are gates.
- **Output drift** from the transport swap alone, such as different defaults inside the SDK. Mitigation: parity tests, unchanged default models, and the manual live check.
- **Gateway outage** affects the server default. There is no runtime fallback to direct Anthropic; the Gateway's own provider fallbacks cover provider outages.
- **Reasoning allowance cost:** reasoning models may spend up to 4,096 extra tokens per call. Gateway budgets bound the server default, and BYOK users pay their own providers.
