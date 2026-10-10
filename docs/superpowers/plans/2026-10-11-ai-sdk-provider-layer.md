# AI SDK Provider Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Spool's hand-written Anthropic and OpenAI clients with one AI SDK 7 adapter behind the unchanged `ILLMClient` interface. The server default can route through Vercel AI Gateway, and BYOK supports the OpenAI Responses API and xAI.

**Architecture:** `llm-models.ts` turns either the server configuration or a user's BYOK settings into a `ResolvedModel`: an AI SDK `LanguageModel` plus a small capability descriptor (model family, whether the model always reasons, whether it accepts a caller's reasoning effort). `AiSdkLLMClient` implements `ILLMClient` over a `ResolvedModel` with `generateText` and `streamText`, and preserves today's SSE frames, error classes, timeouts, and cache-usage log line. `resolveLLMClient` keeps its branch semantics and builds the new client.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest 4, AI SDK 7 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/xai`, `@ai-sdk/openai-compatible`), Supabase.

**Spec:** `docs/superpowers/specs/2026-10-11-ai-sdk-provider-layer-design.md`

## Global Constraints

- Package versions: `ai@^7.0.137`, `@ai-sdk/anthropic@^4.0.78`, `@ai-sdk/openai@^4.0.91`, `@ai-sdk/xai@^5.0.20`, `@ai-sdk/openai-compatible@^3.0.67`. AI SDK 7 is ESM-only and needs Node 22+. The repo runs Node 22.20. Do not add `"type": "module"` to `package.json`.
- `ILLMClient` method signatures (`generate`, `generateStream`, `generateStreamIterator`) do not change. None of the 11 feature call sites change.
- SSE frames are byte-identical to today: `data: ${JSON.stringify(chunk)}\n\n` per text chunk, then `data: [DONE]\n\n`. On failure: `data: ${JSON.stringify({ error: message })}\n\n`, then close, with no `[DONE]`.
- Error classes keep their names and statuses (`LLMError`, `LLMAuthError` 401, `LLMRateLimitError` 429, `LLMServerError` ≥500, `LLMTimeoutError` 408). Mapping: 401/403 → `LLMAuthError`, 429 → `LLMRateLimitError` (with `retryAfter` from the `retry-after` header), ≥500 → `LLMServerError(status)`, `TimeoutError`/`AbortError` → `LLMTimeoutError`, missing API key → `LLMAuthError`, anything else → `LLMError` (with status when known). Unwrap `RetryError.lastError` before mapping.
- Defaults: `maxTokens` 1024, `generate` timeout 30,000 ms, stream timeout 60,000 ms, `maxRetries` 2, reasoning allowance 4,096 tokens, default reasoning effort `"low"`.
- Server default: `SPOOL_DEFAULT_MODEL` set (after trimming) → `gateway(SPOOL_DEFAULT_MODEL)`. Unset → direct Anthropic `claude-sonnet-4-6` with `LLM_API_KEY`. Missing `LLM_API_KEY` in that case throws `LLMAuthError`.
- BYOK defaults: `anthropic` → `claude-sonnet-4-6`, `openai` → `gpt-6.1-sol`, `xai` → `grok-4.7`. Gateway family prefixes: `anthropic/`, `openai/`, `spacexai/` (also `xai/`). Any other prefix is family `other`.
- Usage log line, verbatim format: `[llm-client:${kind}] cache_creation=${cacheWrite} cache_read=${cacheRead} input=${noCacheInput} output=${output}` (missing numbers print `0`). TICKET-082 parses it.
- The xAI migration version is `20261011000001`, because `20261011000000` is `post_replies` RLS.
- The 3 pre-existing `tsc` errors (`src/lib/__tests__/threads-api.test.ts` ×2, `src/lib/__tests__/today-hub-freshness.test.ts` ×1) are out of scope. No new `tsc` errors are allowed.
- Commits: Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Decisions this plan adds to the spec

- **Unused `model` override removed.** The `model` override option is removed from `LLMGenerateOptions`/`LLMStreamOptions`. No caller passes it, and keeping it would mean silently ignoring it, so the compiler should reject future use instead.
- **Streams read the full event stream.** Streams iterate `result.stream`, not `textStream`. Lab check against `ai@7.0.137`: `textStream` never throws. A provider failure before or during streaming yields an empty or partial text stream plus a `console.error`. The full stream emits `error` and `abort` parts, which the adapter turns into thrown `LLMError`s.
- **`reasoningEffort` forwarding.** A caller's `reasoningEffort` (only the Scanner v2 sets it) is forwarded only to models that always reason, and to OpenAI-compatible endpoints that are Inception Labs or `mercury*` models. That matches today's behavior. Sending effort to `claude-sonnet-4-6` would switch on extended thinking.

## Review Focus

1. **Provider fails mid-stream after partial text.** Composer and Scanner must get the partial chunks followed by an error frame, never a silent `[DONE]`. Pinned in Task 3.
2. **Empty system prompt (`""` or `[]`).** No empty system message is sent; Anthropic rejects empty system text. Pinned in Task 2.
3. **`SPOOL_DEFAULT_MODEL` that is only whitespace.** Treated as unset (direct Anthropic), not a Gateway call with an empty model ID. Pinned in Task 4.
4. **Gateway model outside the known families** (for example `google/gemini-3.8-flash`). Its system blocks are flattened, and it gets no Anthropic cache options, forced reasoning, or token allowance. Pinned in Tasks 1, 2, and 4.
5. **Scanner reasoning effort sent to a plain OpenAI-compatible server (Ollama).** Not forwarded, because servers that don't know `reasoning_effort` reject the request. Inception or Mercury endpoints still get it. Pinned in Tasks 1 and 2.

---

### Task 1: Sync dependencies, add AI SDK 7, and the model capability map

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `src/lib/llm-provider.ts`
- Create: `src/lib/llm-models.ts`
- Test: `src/lib/__tests__/llm-models.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks rely on these exact names):
  - `type LLMProvider = "anthropic" | "openai" | "xai"` (in `llm-provider.ts`)
  - `PROVIDER_DEFAULTS.xai === "grok-4.7"` (`openai` stays `"gpt-4o"` until Task 8)
  - `type ModelFamily = "anthropic" | "openai" | "xai" | "openai-compatible" | "other"`
  - `interface ModelCapabilities { family: ModelFamily; alwaysReasons: boolean; acceptsReasoningEffort: boolean }`
  - `interface ResolvedModel extends ModelCapabilities { model: LanguageModel }`
  - `function describeModel(family: ModelFamily, modelId: string, baseURL?: string): ModelCapabilities`

- [ ] **Step 1: Bring `node_modules` in line with the lockfile and record a baseline**

`node_modules` is stale: Next 16.1.6 and `@anthropic-ai/sdk` 0.80.0 are installed, but the lockfile pins 16.2.9 and 0.104.1 since commit `34199a1`. Sync first, so a Next upgrade problem is not confused with this work.

Run:
```bash
cd /Users/calvinku/FunProjects/spool && npm ci
npx vitest run 2>&1 | tail -4
npx tsc --noEmit -p . 2>&1 | grep -c "error TS"
npm run build 2>&1 | tail -5
```
Expected: 59 test files and 808 tests pass, `tsc` reports exactly 3 errors, and the build succeeds. If anything else fails, stop and report it. That would be a pre-existing break from the Next 16.2.9 bump, not part of this plan.

- [ ] **Step 2: Install the AI SDK packages**

Run:
```bash
cd /Users/calvinku/FunProjects/spool && npm install "ai@^7.0.137" "@ai-sdk/anthropic@^4.0.78" "@ai-sdk/openai@^4.0.91" "@ai-sdk/xai@^5.0.20" "@ai-sdk/openai-compatible@^3.0.67"
```
Expected: `package.json` gains the five dependencies. No other dependency versions change; check with `git diff package.json`.

- [ ] **Step 3: Write the failing capability tests**

Create `src/lib/__tests__/llm-models.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { describeModel } from "../llm-models";

describe("describeModel", () => {
  it.each([
    ["anthropic", "claude-sonnet-4-6", false],
    ["anthropic", "claude-sonnet-4.6", false],
    ["anthropic", "claude-sonnet-5-5", true],
    ["anthropic", "claude-sonnet-5.5", true],
    ["anthropic", "claude-opus-5-5", true],
    ["anthropic", "claude-haiku-5-5", true],
    ["anthropic", "claude-fable-5-1", true],
    ["openai", "gpt-4o", false],
    ["openai", "gpt-6.1-sol", true],
    ["openai", "gpt-5.6-luna", true],
    ["openai", "o3", true],
    ["xai", "grok-4.7", true],
    ["xai", "grok-4.20-reasoning", true],
    ["xai", "grok-4.20-non-reasoning", false],
    ["openai-compatible", "llama3.1", false],
    ["other", "gemini-3.8-flash", false],
  ] as const)("%s %s → alwaysReasons=%s", (family, modelId, expected) => {
    expect(describeModel(family, modelId).alwaysReasons).toBe(expected);
  });

  it("forwards a caller's reasoning effort only to models that reason", () => {
    expect(describeModel("anthropic", "claude-sonnet-4-6").acceptsReasoningEffort).toBe(false);
    expect(describeModel("anthropic", "claude-sonnet-5-5").acceptsReasoningEffort).toBe(true);
    expect(describeModel("openai", "gpt-6.1-sol").acceptsReasoningEffort).toBe(true);
    expect(describeModel("other", "gemini-3.8-flash").acceptsReasoningEffort).toBe(false);
  });

  it("forwards reasoning effort to OpenAI-compatible servers only for Inception Labs or Mercury", () => {
    expect(
      describeModel("openai-compatible", "llama3.1", "http://localhost:11434/v1")
        .acceptsReasoningEffort,
    ).toBe(false);
    expect(
      describeModel("openai-compatible", "mercury-2", "https://llm.example.test/v1")
        .acceptsReasoningEffort,
    ).toBe(true);
    expect(
      describeModel("openai-compatible", "any-model", "https://api.inceptionlabs.ai/v1")
        .acceptsReasoningEffort,
    ).toBe(true);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/llm-models.test.ts`
Expected: FAIL, `Failed to load url ../llm-models` (the module does not exist).

- [ ] **Step 5: Implement the provider type and capability map**

In `src/lib/llm-provider.ts`, replace the type and defaults block (lines 12–17) with:

```ts
export type LLMProvider = "anthropic" | "openai" | "xai";

export const PROVIDER_DEFAULTS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  xai: "grok-4.7",
};
```

Create `src/lib/llm-models.ts`:

```ts
/**
 * Model resolution for the AI SDK provider layer.
 *
 * Describes what each model needs from the adapter: whether Anthropic cache
 * breakpoints apply, whether thinking is always on (and so consumes output
 * tokens), and whether a caller's reasoning effort may be forwarded.
 */

import type { LanguageModel } from "ai";

export type ModelFamily =
  | "anthropic"
  | "openai"
  | "xai"
  | "openai-compatible"
  | "other";

export interface ModelCapabilities {
  family: ModelFamily;
  /** Thinking cannot be switched off and counts toward maxOutputTokens. */
  alwaysReasons: boolean;
  /** Whether a caller-supplied reasoningEffort is forwarded to the model. */
  acceptsReasoningEffort: boolean;
}

export interface ResolvedModel extends ModelCapabilities {
  model: LanguageModel;
}

// Matches both direct IDs (claude-sonnet-5-5) and Gateway IDs (claude-sonnet-5.5).
const ANTHROPIC_ALWAYS_REASONS = /^claude-(?:(?:opus|sonnet|haiku)-5|fable)/;
const OPENAI_ALWAYS_REASONS = /^(?:gpt-5|gpt-6|o\d)/;
const XAI_ALWAYS_REASONS = /^grok-(?:[4-9]|3-mini)/;

function alwaysReasons(family: ModelFamily, modelId: string): boolean {
  switch (family) {
    case "anthropic":
      return ANTHROPIC_ALWAYS_REASONS.test(modelId);
    case "openai":
      return OPENAI_ALWAYS_REASONS.test(modelId);
    case "xai":
      return (
        XAI_ALWAYS_REASONS.test(modelId) && !modelId.includes("non-reasoning")
      );
    default:
      return false;
  }
}

export function describeModel(
  family: ModelFamily,
  modelId: string,
  baseURL?: string,
): ModelCapabilities {
  const reasons = alwaysReasons(family, modelId);
  const acceptsReasoningEffort =
    family === "openai-compatible"
      ? (baseURL ?? "").toLowerCase().includes("inceptionlabs.ai") ||
        modelId.toLowerCase().startsWith("mercury")
      : reasons;

  return { family, alwaysReasons: reasons, acceptsReasoningEffort };
}
```

- [ ] **Step 5b: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/llm-models.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 6: Run the full suite and type check**

Run: `npx vitest run 2>&1 | tail -4 && npx tsc --noEmit -p . 2>&1 | grep -c "error TS"`
Expected: all tests pass and `tsc` reports 3 errors (the pre-existing ones).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/llm-provider.ts src/lib/llm-models.ts src/lib/__tests__/llm-models.test.ts
git commit -F - <<'EOF'
feat: add AI SDK 7 and model capability map

Installs ai@7 and the Anthropic, OpenAI, xAI, and OpenAI-compatible
providers. describeModel() records which models always reason (thinking
consumes output tokens) and which accept a caller's reasoning effort,
so the adapter can budget tokens without enabling thinking on models
that don't use it today. LLMProvider gains "xai" (default grok-4.7).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: `AiSdkLLMClient.generate`, error mapping, and usage log

**Files:**
- Create: `src/lib/ai-sdk-llm-client.ts`
- Test: `src/lib/__tests__/ai-sdk-llm-client.test.ts`

**Interfaces:**
- Consumes: `ResolvedModel`, `describeModel`, `ModelFamily` (Task 1). From `@/lib/llm-client`: `LLMGenerateOptions`, `LLMStreamOptions`, `LLMMessage`, `SystemBlock`, `flattenSystemBlocks`, and the error classes.
- Produces:
  - `class AiSdkLLMClient implements ILLMClient`, `constructor(resolved: ResolvedModel)`
  - `function mapAiSdkError(error: unknown): LLMError`
  - `const REASONING_TOKEN_ALLOWANCE = 4096`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/ai-sdk-llm-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { APICallError, LoadAPIKeyError, RetryError } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { AiSdkLLMClient, mapAiSdkError } from "../ai-sdk-llm-client";
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  type SystemBlock,
} from "../llm-client";
import { describeModel, type ModelFamily, type ResolvedModel } from "../llm-models";

const USAGE = {
  inputTokens: { total: 120, noCache: 20, cacheRead: 90, cacheWrite: 10 },
  outputTokens: { total: 7, text: 5, reasoning: 2 },
};

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: USAGE,
    warnings: [],
  };
}

function resolved(
  model: MockLanguageModelV4,
  family: ModelFamily,
  modelId: string,
  baseURL?: string,
): ResolvedModel {
  return { model, ...describeModel(family, modelId, baseURL) };
}

function apiError(statusCode: number, responseHeaders?: Record<string, string>) {
  return new APICallError({
    message: `status ${statusCode}`,
    url: "https://llm.example.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders,
    isRetryable: false,
  });
}

const HI = [{ role: "user" as const, content: "Hi" }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiSdkLLMClient.generate", () => {
  it("returns the text and sends a string system prompt as instructions", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("Hello") });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    const text = await client.generate({ systemPrompt: "Be brief.", messages: HI });

    expect(text).toBe("Hello");
    expect(model.doGenerateCalls[0].prompt).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: [{ type: "text", text: "Hi" }] },
    ]);
  });

  it("places Anthropic cache breakpoints on cacheable system blocks", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    await client.generate({
      systemPrompt: [{ text: "Rules", cacheable: true }, { text: "Context" }],
      messages: HI,
    });

    expect(model.doGenerateCalls[0].prompt.slice(0, 2)).toEqual([
      {
        role: "system",
        content: "Rules",
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
      { role: "system", content: "Context" },
    ]);
  });

  it.each([
    ["openai", "gpt-4o"],
    ["other", "gemini-3.8-flash"],
  ] as const)("joins system blocks into one instruction for %s models", async (family, modelId) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const client = new AiSdkLLMClient(resolved(model, family, modelId));

    await client.generate({
      systemPrompt: [{ text: "Rules", cacheable: true }, { text: "Context" }],
      messages: HI,
    });

    expect(model.doGenerateCalls[0].prompt[0]).toEqual({
      role: "system",
      content: "Rules\n\nContext",
    });
  });

  const emptySystemPrompts: Array<[string, string | SystemBlock[]]> = [
    ["an empty string", ""],
    ["an empty block list", []],
  ];

  it.each(emptySystemPrompts)("sends no system message for %s", async (_label, systemPrompt) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    await client.generate({ systemPrompt, messages: HI });

    expect(model.doGenerateCalls[0].prompt.map((message) => message.role)).toEqual(["user"]);
  });

  it("uses maxTokens as the output limit, defaulting to 1024, without reasoning", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    await client.generate({ messages: HI });
    await client.generate({ messages: HI, maxTokens: 300, reasoningEffort: "medium" });

    expect(model.doGenerateCalls.map((call) => [call.maxOutputTokens, call.reasoning])).toEqual([
      [1024, undefined],
      [300, undefined],
    ]);
  });

  it("adds the reasoning allowance and low effort for models that always reason", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-5-5"));

    await client.generate({ messages: HI, maxTokens: 512 });
    await client.generate({ messages: HI, maxTokens: 512, reasoningEffort: "high" });

    expect(model.doGenerateCalls.map((call) => [call.maxOutputTokens, call.reasoning])).toEqual([
      [4608, "low"],
      [4608, "high"],
    ]);
  });

  it("forwards reasoning effort to OpenAI-compatible servers only for Mercury models", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const ollama = new MockLanguageModelV4({ doGenerate: textResult("ok") });
    const mercury = new MockLanguageModelV4({ doGenerate: textResult("ok") });

    await new AiSdkLLMClient(
      resolved(ollama, "openai-compatible", "llama3.1", "http://localhost:11434/v1"),
    ).generate({ messages: HI, maxTokens: 100, reasoningEffort: "high" });
    await new AiSdkLLMClient(
      resolved(mercury, "openai-compatible", "mercury-2", "https://llm.example.test/v1"),
    ).generate({ messages: HI, maxTokens: 100, reasoningEffort: "high" });

    expect([ollama.doGenerateCalls[0].reasoning, ollama.doGenerateCalls[0].maxOutputTokens]).toEqual([undefined, 100]);
    expect([mercury.doGenerateCalls[0].reasoning, mercury.doGenerateCalls[0].maxOutputTokens]).toEqual(["high", 100]);
  });

  it("logs token usage in the cache-usage line format", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const model = new MockLanguageModelV4({ doGenerate: textResult("ok") });

    await new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6")).generate({ messages: HI });

    expect(log).toHaveBeenCalledWith(
      "[llm-client:generate] cache_creation=10 cache_read=90 input=20 output=7",
    );
  });

  it("rejects with a mapped error when the provider fails", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw apiError(401);
      },
    });

    await expect(
      new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6")).generate({ messages: HI }),
    ).rejects.toBeInstanceOf(LLMAuthError);
  });
});

describe("mapAiSdkError", () => {
  it("passes Spool LLM errors through unchanged", () => {
    const original = new LLMServerError("upstream", 502);
    expect(mapAiSdkError(original)).toBe(original);
  });

  it.each([
    [401, "LLMAuthError", LLMAuthError],
    [403, "LLMAuthError", LLMAuthError],
    [429, "LLMRateLimitError", LLMRateLimitError],
    [503, "LLMServerError", LLMServerError],
  ] as const)("maps HTTP %i to %s", (status, _name, ErrorClass) => {
    expect(mapAiSdkError(apiError(status))).toBeInstanceOf(ErrorClass);
  });

  it("keeps the status of other client errors on a plain LLMError", () => {
    const mapped = mapAiSdkError(apiError(400));
    expect([mapped.name, mapped.status]).toEqual(["LLMError", 400]);
  });

  it("reads retry-after on rate limits", () => {
    const mapped = mapAiSdkError(apiError(429, { "retry-after": "12" }));
    expect((mapped as LLMRateLimitError).retryAfter).toBe(12);
  });

  it("maps a Gateway-style error by its statusCode", () => {
    const gatewayAuth = Object.assign(new Error("Invalid API key"), { statusCode: 401 });
    expect(mapAiSdkError(gatewayAuth)).toBeInstanceOf(LLMAuthError);
  });

  it("unwraps the last error of a retry failure", () => {
    const retry = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), apiError(429)],
    });
    expect(mapAiSdkError(retry)).toBeInstanceOf(LLMRateLimitError);
  });

  it.each([
    ["TimeoutError", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["AbortError", Object.assign(new Error("aborted"), { name: "AbortError" })],
  ])("maps %s to LLMTimeoutError", (_name, error) => {
    expect(mapAiSdkError(error)).toBeInstanceOf(LLMTimeoutError);
  });

  it("maps a missing API key to LLMAuthError", () => {
    expect(mapAiSdkError(new LoadAPIKeyError({ message: "API key is missing" }))).toBeInstanceOf(LLMAuthError);
  });

  it("wraps unknown values in LLMError", () => {
    const mapped = mapAiSdkError("boom");
    expect([mapped.name, mapped.message]).toEqual(["LLMError", "boom"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/ai-sdk-llm-client.test.ts`
Expected: FAIL, `Failed to load url ../ai-sdk-llm-client`.

- [ ] **Step 3: Implement the adapter's generate path**

Create `src/lib/ai-sdk-llm-client.ts`:

```ts
/**
 * AI SDK LLM Client
 *
 * ILLMClient implementation over one AI SDK LanguageModel. Keeps the
 * behavior of the clients it replaced: SSE framing, Spool's LLMError
 * hierarchy, default timeouts, and the cache-usage log line.
 */

import {
  APICallError,
  LoadAPIKeyError,
  RetryError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";

import type { ILLMClient } from "@/lib/llm-provider";
import type { ModelFamily, ResolvedModel } from "@/lib/llm-models";
import {
  LLMAuthError,
  LLMError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  flattenSystemBlocks,
  type LLMGenerateOptions,
  type LLMMessage,
  type LLMStreamOptions,
  type SystemBlock,
} from "@/lib/llm-client";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_GENERATE_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const DEFAULT_REASONING_EFFORT = "low";

/** Extra output budget for models whose thinking counts toward the limit. */
export const REASONING_TOKEN_ALLOWANCE = 4096;

// ── Error Mapping ────────────────────────────────────────────────────

function statusCodeOf(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (error && typeof error === "object" && "statusCode" in error) {
    const { statusCode } = error as { statusCode: unknown };
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return undefined;
}

function retryAfterOf(error: unknown): number | undefined {
  if (!APICallError.isInstance(error)) return undefined;
  const value = error.responseHeaders?.["retry-after"];
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function mapAiSdkError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (RetryError.isInstance(error)) return mapAiSdkError(error.lastError);

  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new LLMTimeoutError(`LLM request timed out: ${error.message}`);
  }

  const message = error instanceof Error ? error.message : String(error);
  const status = statusCodeOf(error);

  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message, retryAfterOf(error));
  if (status !== undefined && status >= 500) return new LLMServerError(message, status);
  if (status !== undefined) return new LLMError(message, status);
  if (LoadAPIKeyError.isInstance(error)) return new LLMAuthError(message);
  return new LLMError(message);
}

// ── Request Building ─────────────────────────────────────────────────

const ANTHROPIC_CACHE_BREAKPOINT = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

function toInstructions(
  systemPrompt: string | SystemBlock[] | undefined,
  family: ModelFamily,
): string | SystemModelMessage[] | undefined {
  if (systemPrompt === undefined) return undefined;
  if (typeof systemPrompt === "string") {
    return systemPrompt.length > 0 ? systemPrompt : undefined;
  }
  if (systemPrompt.length === 0) return undefined;
  if (family !== "anthropic") return flattenSystemBlocks(systemPrompt);

  return systemPrompt.map((block) => ({
    role: "system" as const,
    content: block.text,
    ...(block.cacheable ? { providerOptions: ANTHROPIC_CACHE_BREAKPOINT } : {}),
  }));
}

function toModelMessage(message: LLMMessage): ModelMessage {
  return message.role === "user"
    ? { role: "user", content: message.content }
    : { role: "assistant", content: message.content };
}

interface CallSettings {
  model: LanguageModel;
  instructions?: string | SystemModelMessage[];
  messages: ModelMessage[];
  maxOutputTokens: number;
  reasoning?: "low" | "medium" | "high";
  timeout: number;
  maxRetries: number;
}

function logUsage(kind: "generate" | "stream", usage: LanguageModelUsage | undefined): void {
  if (!usage) return;
  const details = usage.inputTokenDetails;
  console.log(
    `[llm-client:${kind}] cache_creation=${details?.cacheWriteTokens ?? 0} cache_read=${details?.cacheReadTokens ?? 0} input=${details?.noCacheTokens ?? usage.inputTokens ?? 0} output=${usage.outputTokens ?? 0}`,
  );
}

// ── Client ───────────────────────────────────────────────────────────

export class AiSdkLLMClient implements ILLMClient {
  constructor(private readonly resolved: ResolvedModel) {}

  private callSettings(
    options: LLMGenerateOptions | LLMStreamOptions,
    defaultTimeout: number,
  ): CallSettings {
    const {
      systemPrompt,
      messages,
      maxTokens = DEFAULT_MAX_TOKENS,
      reasoningEffort,
      timeout = defaultTimeout,
    } = options;
    const { model, family, alwaysReasons, acceptsReasoningEffort } = this.resolved;

    const instructions = toInstructions(systemPrompt, family);
    const reasoning = alwaysReasons
      ? (reasoningEffort ?? DEFAULT_REASONING_EFFORT)
      : acceptsReasoningEffort
        ? reasoningEffort
        : undefined;

    return {
      model,
      ...(instructions !== undefined ? { instructions } : {}),
      messages: messages.map(toModelMessage),
      maxOutputTokens: maxTokens + (alwaysReasons ? REASONING_TOKEN_ALLOWANCE : 0),
      ...(reasoning ? { reasoning } : {}),
      timeout,
      maxRetries: MAX_RETRIES,
    };
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    try {
      const result = await generateText(
        this.callSettings(options, DEFAULT_GENERATE_TIMEOUT_MS),
      );
      logUsage("generate", result.usage);
      return result.text;
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }

  // Implemented in Task 3. Plain methods (not generators) so lint's
  // require-yield rule passes while they only throw.
  generateStreamIterator(options: LLMStreamOptions): AsyncIterable<string> {
    throw new LLMError(`streaming not implemented (${options.messages.length})`);
  }

  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    throw new LLMError(`streaming not implemented (${options.messages.length})`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/ai-sdk-llm-client.test.ts`
Expected: PASS (all `generate` and `mapAiSdkError` tests).

- [ ] **Step 5: Type check and lint the new files**

Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npx eslint src/lib/ai-sdk-llm-client.ts src/lib/llm-models.ts src/lib/__tests__/ai-sdk-llm-client.test.ts`
Expected: no output from the `tsc` filter, and ESLint exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-sdk-llm-client.ts src/lib/__tests__/ai-sdk-llm-client.test.ts
git commit -F - <<'EOF'
feat: add AI SDK LLM client generate path

AiSdkLLMClient implements ILLMClient.generate over an AI SDK model.
String prompts become instructions. Anthropic-family models get one
system message per block with cache breakpoints on cacheable blocks,
and other families get the blocks joined. Models that always reason
get a 4,096-token output allowance and low effort unless the caller
sets one. Provider, Gateway, retry, timeout, and missing-key errors map
onto Spool's LLMError hierarchy, and the cache-usage log line keeps
its format.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Streaming (`generateStreamIterator` and SSE `generateStream`)

**Files:**
- Modify: `src/lib/ai-sdk-llm-client.ts` (replace the two placeholder stream methods)
- Test: `src/lib/__tests__/ai-sdk-llm-client.test.ts` (append a `describe` block)

**Interfaces:**
- Consumes: `AiSdkLLMClient`, `mapAiSdkError`, `callSettings` (Task 2).
- Produces: working `generateStreamIterator(options): AsyncIterable<string>` and `generateStream(options): ReadableStream<Uint8Array>`.

- [ ] **Step 1: Write the failing stream tests**

Append to `src/lib/__tests__/ai-sdk-llm-client.test.ts`. Add `simulateReadableStream` to the existing `ai` import.

```ts
function streamOf(chunks: unknown[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) as never }),
  });
}

const FINISH = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  logprobs: undefined,
  usage: USAGE,
};

async function collect(iterable: AsyncIterable<string>) {
  const chunks: string[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

describe("AiSdkLLMClient streaming", () => {
  it("yields text deltas in order and logs stream usage", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const model = streamOf([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Hel" },
      { type: "text-delta", id: "t", delta: "lo" },
      { type: "text-end", id: "t" },
      FINISH,
    ]);
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    expect(await collect(client.generateStreamIterator({ messages: HI }))).toEqual(["Hel", "lo"]);
    expect(log).toHaveBeenCalledWith(
      "[llm-client:stream] cache_creation=10 cache_read=90 input=20 output=7",
    );
  });

  it("sends the same request settings as generate", async () => {
    const model = streamOf([FINISH]);
    const client = new AiSdkLLMClient(resolved(model, "openai", "gpt-6.1-sol"));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await collect(client.generateStreamIterator({ systemPrompt: "Be brief.", messages: HI, maxTokens: 100 }));

    const call = model.doStreamCalls[0];
    expect([call.prompt[0], call.maxOutputTokens, call.reasoning]).toEqual([
      { role: "system", content: "Be brief." },
      4196,
      "low",
    ]);
  });

  it("throws a mapped error when the provider fails before streaming", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw apiError(401);
      },
    });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    await expect(collect(client.generateStreamIterator({ messages: HI }))).rejects.toBeInstanceOf(LLMAuthError);
  });

  it("throws after the partial text when the provider fails mid-stream", async () => {
    const model = streamOf([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "partial" },
      { type: "error", error: apiError(529) },
    ]);
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));
    const received: string[] = [];

    await expect(
      (async () => {
        for await (const chunk of client.generateStreamIterator({ messages: HI })) received.push(chunk);
      })(),
    ).rejects.toBeInstanceOf(LLMServerError);
    expect(received).toEqual(["partial"]);
  });

  it("throws LLMTimeoutError when the stream times out", async () => {
    const model = new MockLanguageModelV4({
      doStream: ({ abortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener("abort", () => reject(abortSignal.reason));
        }),
    });
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    await expect(
      collect(client.generateStreamIterator({ messages: HI, timeout: 20 })),
    ).rejects.toBeInstanceOf(LLMTimeoutError);
  });

  it("frames chunks as SSE and ends with [DONE]", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const model = streamOf([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Hel" },
      { type: "text-delta", id: "t", delta: "lo" },
      { type: "text-end", id: "t" },
      FINISH,
    ]);
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    const body = await new Response(client.generateStream({ messages: HI })).text();

    expect(body).toBe('data: "Hel"\n\ndata: "lo"\n\ndata: [DONE]\n\n');
  });

  it("ends with an error frame instead of [DONE] when the stream fails mid-way", async () => {
    const model = streamOf([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "partial" },
      { type: "error", error: apiError(529) },
    ]);
    const client = new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"));

    const body = await new Response(client.generateStream({ messages: HI })).text();

    expect(body).toBe('data: "partial"\n\ndata: {"error":"status 529"}\n\n');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/ai-sdk-llm-client.test.ts -t "streaming"`
Expected: FAIL. Every stream test fails with `LLMError: streaming not implemented`; the placeholder throws synchronously as soon as the method is called.

- [ ] **Step 3: Implement streaming**

In `src/lib/ai-sdk-llm-client.ts`, add `streamText` to the `ai` import (next to `generateText`), then replace the two placeholder methods with:

```ts
  /**
   * Streams raw text chunks. Reads the full event stream because
   * `textStream` swallows provider errors (it ends empty or partial).
   */
  async *generateStreamIterator(options: LLMStreamOptions): AsyncIterable<string> {
    try {
      const result = streamText({
        ...this.callSettings(options, DEFAULT_STREAM_TIMEOUT_MS),
        onError: () => {},
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          yield part.text;
        } else if (part.type === "error") {
          throw mapAiSdkError(part.error);
        } else if (part.type === "abort") {
          throw new LLMTimeoutError(
            `LLM request timed out: ${String(part.reason ?? "stream aborted")}`,
          );
        } else if (part.type === "finish") {
          logUsage("stream", part.totalUsage);
        }
      }
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }

  /**
   * Streams SSE frames: one JSON-encoded text chunk per frame, then [DONE],
   * or a final {"error": message} frame on failure.
   */
  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    const iterator = this.generateStreamIterator(options);
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const text of iterator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const mapped = mapAiSdkError(error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: mapped.message })}\n\n`),
          );
          controller.close();
        }
      },
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/ai-sdk-llm-client.test.ts`
Expected: PASS (all generate, error, and streaming tests).

- [ ] **Step 5: Type check and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npx eslint src/lib/ai-sdk-llm-client.ts src/lib/__tests__/ai-sdk-llm-client.test.ts`
Expected: no `tsc` output, and ESLint exits 0. If `part.reason` or `part.totalUsage` fail to type-check, read the `TextStreamPart` union in `node_modules/ai/dist/index.d.ts` and use the field names it declares. The lab run against 7.0.137 observed `reason` on `abort` and `totalUsage` on `finish`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-sdk-llm-client.ts src/lib/__tests__/ai-sdk-llm-client.test.ts
git commit -F - <<'EOF'
feat: stream through the AI SDK client with SSE parity

generateStreamIterator reads streamText's full event stream: it yields
text deltas, throws mapped errors on error parts, and throws
LLMTimeoutError on abort. textStream alone ends silently on provider
failures. generateStream keeps the existing SSE framing, with chunk
frames then [DONE], or an error frame without [DONE] on failure.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Model builders (server default and BYOK)

**Files:**
- Modify: `src/lib/llm-models.ts` (append builders)
- Modify: `.env.local.example`
- Test: `src/lib/__tests__/llm-models.test.ts` (append)

**Interfaces:**
- Consumes: `describeModel`, `ResolvedModel` (Task 1), `PROVIDER_DEFAULTS` and `LLMProvider`, `LLMAuthError`.
- Produces:
  - `function resolveServerDefaultModel(env?: Record<string, string | undefined>): ResolvedModel`. Not `NodeJS.ProcessEnv`: Next's global types make `NODE_ENV` required on it, which would reject test env objects.
  - `interface ByokModelInput { provider: LLMProvider; apiKey?: string; baseURL?: string; model?: string }`
  - `function createByokModel(input: ByokModelInput): ResolvedModel`

- [ ] **Step 1: Write the failing builder tests**

Append to `src/lib/__tests__/llm-models.test.ts`. Change the import line to:

```ts
import { createByokModel, describeModel, resolveServerDefaultModel, type ResolvedModel } from "../llm-models";
import { LLMAuthError } from "../llm-client";
import { PROVIDER_DEFAULTS } from "../llm-provider";
```

```ts
function info(resolved: ResolvedModel) {
  const model = resolved.model as unknown as { provider: string; modelId: string };
  return {
    provider: model.provider,
    modelId: model.modelId,
    family: resolved.family,
    alwaysReasons: resolved.alwaysReasons,
  };
}

describe("resolveServerDefaultModel", () => {
  it("calls Anthropic directly with LLM_API_KEY when no Gateway model is set", () => {
    expect(info(resolveServerDefaultModel({ LLM_API_KEY: "sk-ant-server" }))).toEqual({
      provider: "anthropic.messages",
      modelId: "claude-sonnet-4-6",
      family: "anthropic",
      alwaysReasons: false,
    });
  });

  it("throws LLMAuthError when neither a Gateway model nor LLM_API_KEY is set", () => {
    expect(() => resolveServerDefaultModel({})).toThrow(LLMAuthError);
  });

  it("treats a whitespace-only SPOOL_DEFAULT_MODEL as unset", () => {
    expect(
      info(resolveServerDefaultModel({ SPOOL_DEFAULT_MODEL: "   ", LLM_API_KEY: "sk-ant-server" })).provider,
    ).toBe("anthropic.messages");
  });

  it.each([
    ["anthropic/claude-sonnet-4.6", "anthropic", false],
    ["openai/gpt-6.1-sol", "openai", true],
    ["spacexai/grok-4.7", "xai", true],
    ["google/gemini-3.8-flash", "other", false],
  ] as const)("routes %s through AI Gateway as family %s", (gatewayModel, family, reasons) => {
    expect(info(resolveServerDefaultModel({ SPOOL_DEFAULT_MODEL: gatewayModel }))).toEqual({
      provider: "gateway",
      modelId: gatewayModel,
      family,
      alwaysReasons: reasons,
    });
  });
});

describe("createByokModel", () => {
  it("uses the provider default when no model is saved", () => {
    expect(info(createByokModel({ provider: "anthropic", apiKey: "sk-ant" })).modelId).toBe(
      PROVIDER_DEFAULTS.anthropic,
    );
    expect(info(createByokModel({ provider: "xai", apiKey: "xai-key" })).modelId).toBe(
      PROVIDER_DEFAULTS.xai,
    );
  });

  it("builds a direct Anthropic model with the saved model", () => {
    expect(info(createByokModel({ provider: "anthropic", apiKey: "sk-ant", model: "claude-sonnet-5-5" }))).toEqual({
      provider: "anthropic.messages",
      modelId: "claude-sonnet-5-5",
      family: "anthropic",
      alwaysReasons: true,
    });
  });

  it("uses the OpenAI Responses API when no base URL is set", () => {
    expect(info(createByokModel({ provider: "openai", apiKey: "sk-openai", model: "gpt-6.1-sol" }))).toEqual({
      provider: "openai.responses",
      modelId: "gpt-6.1-sol",
      family: "openai",
      alwaysReasons: true,
    });
  });

  it("treats an OpenAI provider with a base URL as an OpenAI-compatible endpoint", () => {
    expect(
      info(createByokModel({ provider: "openai", baseURL: "http://localhost:11434/v1", model: "llama3.1" })),
    ).toEqual({
      provider: "openai-compatible.chat",
      modelId: "llama3.1",
      family: "openai-compatible",
      alwaysReasons: false,
    });
  });

  it("builds a direct xAI model", () => {
    expect(info(createByokModel({ provider: "xai", apiKey: "xai-key", model: "grok-4.7" }))).toEqual({
      provider: "xai.responses",
      modelId: "grok-4.7",
      family: "xai",
      alwaysReasons: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/llm-models.test.ts`
Expected: FAIL. `resolveServerDefaultModel` and `createByokModel` are not exported (`TypeError: ... is not a function`).

- [ ] **Step 3: Implement the builders**

In `src/lib/llm-models.ts`, change the imports to:

```ts
import { gateway, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";

import { LLMAuthError } from "@/lib/llm-client";
import { PROVIDER_DEFAULTS, type LLMProvider } from "@/lib/llm-provider";
```

Append:

```ts
const GATEWAY_FAMILIES: Record<string, ModelFamily> = {
  anthropic: "anthropic",
  openai: "openai",
  spacexai: "xai",
  xai: "xai",
};

/**
 * Server default. SPOOL_DEFAULT_MODEL switches it onto AI Gateway (auth via
 * AI_GATEWAY_API_KEY, or Vercel OIDC on deployments). Without it, Spool calls
 * Anthropic directly with LLM_API_KEY, as before.
 */
export function resolveServerDefaultModel(
  env: Record<string, string | undefined> = process.env,
): ResolvedModel {
  const gatewayModel = env.SPOOL_DEFAULT_MODEL?.trim();
  if (gatewayModel) {
    const slash = gatewayModel.indexOf("/");
    const prefix = slash > 0 ? gatewayModel.slice(0, slash) : "";
    const modelId = slash > 0 ? gatewayModel.slice(slash + 1) : gatewayModel;
    return {
      model: gateway(gatewayModel),
      ...describeModel(GATEWAY_FAMILIES[prefix] ?? "other", modelId),
    };
  }

  const apiKey = env.LLM_API_KEY;
  if (!apiKey) {
    throw new LLMAuthError(
      "LLM_API_KEY is not set. Set it, or set SPOOL_DEFAULT_MODEL to route the server default through AI Gateway.",
    );
  }

  const modelId = PROVIDER_DEFAULTS.anthropic;
  return {
    model: createAnthropic({ apiKey })(modelId),
    ...describeModel("anthropic", modelId),
  };
}

export interface ByokModelInput {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

/** A user's bring-your-own-key model, called directly at the provider. */
export function createByokModel({
  provider,
  apiKey,
  baseURL,
  model,
}: ByokModelInput): ResolvedModel {
  const modelId = model ?? PROVIDER_DEFAULTS[provider];

  switch (provider) {
    case "anthropic":
      return {
        model: createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId),
        ...describeModel("anthropic", modelId),
      };
    case "xai":
      return {
        model: createXai({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId),
        ...describeModel("xai", modelId),
      };
    case "openai":
      if (baseURL) {
        return {
          model: createOpenAICompatible({
            name: "openai-compatible",
            baseURL,
            ...(apiKey ? { apiKey } : {}),
          }).chatModel(modelId),
          ...describeModel("openai-compatible", modelId, baseURL),
        };
      }
      return {
        model: createOpenAI({ apiKey })(modelId),
        ...describeModel("openai", modelId),
      };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/llm-models.test.ts`
Expected: PASS.

- [ ] **Step 5: Document the new environment variables**

In `.env.local.example`, replace the line `LLM_API_KEY=<your-anthropic-api-key>` with:

```
# Server-default AI. Set SPOOL_DEFAULT_MODEL to route it through Vercel AI Gateway
# (for example anthropic/claude-sonnet-4.6). Leave it unset to call Anthropic
# directly with LLM_API_KEY.
SPOOL_DEFAULT_MODEL=
# AI Gateway auth for local development and self-hosting. Deployments on Vercel
# use OIDC automatically once AI Gateway is enabled for the project.
AI_GATEWAY_API_KEY=
LLM_API_KEY=<your-anthropic-api-key>
```

- [ ] **Step 6: Type check, lint, and commit**

Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npx eslint src/lib/llm-models.ts src/lib/__tests__/llm-models.test.ts`
Expected: no `tsc` output, and ESLint exits 0.

```bash
git add src/lib/llm-models.ts src/lib/__tests__/llm-models.test.ts .env.local.example
git commit -F - <<'EOF'
feat: build server-default and BYOK models with AI SDK

resolveServerDefaultModel() routes through AI Gateway when
SPOOL_DEFAULT_MODEL is set (anthropic/, openai/, and spacexai/ prefixes
map to their families) and otherwise calls Anthropic directly with
LLM_API_KEY. createByokModel() builds direct Anthropic, OpenAI
Responses, OpenAI-compatible (when a base URL is set), and xAI models.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Rewire `resolveLLMClient`

**Files:**
- Modify: `src/lib/llm-resolver.ts`
- Test: `src/lib/__tests__/llm-resolver.test.ts` (rewrite)

**Interfaces:**
- Consumes: `resolveServerDefaultModel`, `createByokModel` (Task 4), `AiSdkLLMClient` (Tasks 2–3).
- Produces: `resolveLLMClient(userId: string): Promise<ILLMClient>`, with the same signature and new internals.

- [ ] **Step 1: Rewrite the resolver tests (failing)**

Replace the whole of `src/lib/__tests__/llm-resolver.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
}));

vi.mock("@/lib/llm-models", () => ({
  resolveServerDefaultModel: vi.fn(() => ({ source: "server-default" })),
  createByokModel: vi.fn((input: unknown) => ({ source: "byok", input })),
}));

vi.mock("@/lib/ai-sdk-llm-client", () => ({
  AiSdkLLMClient: class {
    constructor(public resolved: unknown) {}
  },
}));

import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { resolveLLMClient } from "../llm-resolver";

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

function userRow(row: Partial<Record<"llm_provider" | "llm_api_key_encrypted" | "llm_base_url" | "llm_model", string | null>>) {
  return {
    data: {
      llm_provider: null,
      llm_api_key_encrypted: null,
      llm_base_url: null,
      llm_model: null,
      ...row,
    },
  };
}

async function resolvedFor(userId = "user-123") {
  const client = (await resolveLLMClient(userId)) as unknown as { resolved: unknown };
  return client.resolved;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);
});

describe("resolveLLMClient", () => {
  it.each([
    ["no provider", userRow({})],
    ["anthropic without a key", userRow({ llm_provider: "anthropic" })],
    ["xai without a key", userRow({ llm_provider: "xai" })],
    ["an unknown provider", userRow({ llm_provider: "mistral", llm_api_key_encrypted: "enc" })],
    ["a missing user", { data: null }],
  ])("uses the server default for %s", async (_label, row) => {
    mockSingle.mockResolvedValue(row);
    vi.mocked(decrypt).mockReturnValue("key");

    expect(await resolvedFor()).toEqual({ source: "server-default" });
  });

  it("uses the server default when the saved key cannot be decrypted", async () => {
    mockSingle.mockResolvedValue(userRow({ llm_provider: "anthropic", llm_api_key_encrypted: "corrupted" }));
    vi.mocked(decrypt).mockImplementation(() => {
      throw new Error("Decryption failed");
    });

    expect(await resolvedFor()).toEqual({ source: "server-default" });
  });

  it.each([
    [
      "anthropic with a key",
      userRow({ llm_provider: "anthropic", llm_api_key_encrypted: "enc" }),
      { provider: "anthropic", apiKey: "decrypted", baseURL: undefined, model: undefined },
    ],
    [
      "xai with a key and model",
      userRow({ llm_provider: "xai", llm_api_key_encrypted: "enc", llm_model: "grok-4.5" }),
      { provider: "xai", apiKey: "decrypted", baseURL: undefined, model: "grok-4.5" },
    ],
    [
      "a keyless OpenAI-compatible endpoint",
      userRow({ llm_provider: "openai", llm_base_url: "http://localhost:11434/v1", llm_model: "llama3.1" }),
      { provider: "openai", apiKey: undefined, baseURL: "http://localhost:11434/v1", model: "llama3.1" },
    ],
  ])("builds a BYOK model for %s", async (_label, row, expectedInput) => {
    mockSingle.mockResolvedValue(row);
    vi.mocked(decrypt).mockReturnValue("decrypted");

    expect(await resolvedFor()).toEqual({ source: "byok", input: expectedInput });
  });

  it("queries the settings columns for the given user", async () => {
    mockSingle.mockResolvedValue(userRow({}));

    await resolveLLMClient("abc-def-123");

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model");
    expect(mockEq).toHaveBeenCalledWith("id", "abc-def-123");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/llm-resolver.test.ts`
Expected: FAIL. The current resolver constructs `LLMClient`/`OpenAILLMClient`, so `resolved` is `undefined` (for example `expected undefined to deeply equal { source: 'server-default' }`).

- [ ] **Step 3: Rewrite the resolver**

Replace the whole of `src/lib/llm-resolver.ts` with:

```ts
/**
 * LLM Client Resolver
 *
 * Resolves the LLM client for a user from their BYOK settings, falling back
 * to the server default (AI Gateway when SPOOL_DEFAULT_MODEL is set,
 * otherwise Anthropic with LLM_API_KEY).
 */

import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { AiSdkLLMClient } from "@/lib/ai-sdk-llm-client";
import { createByokModel, resolveServerDefaultModel } from "@/lib/llm-models";
import type { ILLMClient, LLMProvider } from "@/lib/llm-provider";

const BYOK_PROVIDERS = new Set<string>(["anthropic", "openai", "xai"]);
const KEY_REQUIRED = new Set<string>(["anthropic", "xai"]);

function serverDefaultClient(): ILLMClient {
  return new AiSdkLLMClient(resolveServerDefaultModel());
}

/**
 * Resolve the LLM client for a given user.
 *
 * 1. Looks up the user's llm_provider, llm_api_key_encrypted, llm_base_url, and llm_model.
 * 2. If configured, decrypts the key and returns a client for that provider.
 * 3. Otherwise (or if the key can't be decrypted), returns the server default.
 */
export async function resolveLLMClient(userId: string): Promise<ILLMClient> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model")
    .eq("id", userId)
    .single();

  if (!user?.llm_provider || !BYOK_PROVIDERS.has(user.llm_provider)) {
    return serverDefaultClient();
  }

  const provider = user.llm_provider as LLMProvider;

  // Decrypt API key if present (may be null for keyless services like Ollama)
  let apiKey: string | undefined;
  if (user.llm_api_key_encrypted) {
    try {
      apiKey = decrypt(user.llm_api_key_encrypted);
    } catch {
      // If decryption fails (corrupted data, key rotation), fall back to the server default
      return serverDefaultClient();
    }
  }

  if (KEY_REQUIRED.has(provider) && !apiKey) {
    return serverDefaultClient();
  }

  return new AiSdkLLMClient(
    createByokModel({
      provider,
      apiKey,
      baseURL: user.llm_base_url ?? undefined,
      model: user.llm_model ?? undefined,
    }),
  );
}
```

- [ ] **Step 4: Run the resolver tests and the full suite**

Run: `npx vitest run src/lib/__tests__/llm-resolver.test.ts && npx vitest run 2>&1 | tail -4`
Expected: resolver tests PASS, and the full suite passes. Feature tests mock `resolveLLMClient` or `ILLMClient`, so they are unaffected.

- [ ] **Step 5: Build**

Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npm run build 2>&1 | tail -5`
Expected: no `tsc` output, and the build succeeds. This is the first build in which every AI route bundles AI SDK 7. An ESM or bundling problem shows up here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm-resolver.ts src/lib/__tests__/llm-resolver.test.ts
git commit -F - <<'EOF'
feat: resolve LLM clients through the AI SDK adapter

resolveLLMClient keeps its branch semantics (server default for no
provider, a missing required key, an unknown provider, or a key that
fails to decrypt) and now returns AiSdkLLMClient over the server-default
or BYOK model. xAI joins Anthropic as a provider that requires a key.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: xAI in the database and the settings form

**Files:**
- Create: `supabase/migrations/20261011000001_llm_provider_xai.sql`
- Modify: `src/components/dashboard/settings-form.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Test: `src/app/dashboard/__tests__/settings-provider.source.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `PROVIDER_DEFAULTS` (Task 1).
- Produces: a DB constraint that allows `xai`, and a settings form that offers it.

- [ ] **Step 1: Prove the constraint rejects `xai` today**

Run:
```bash
docker exec "$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_spool$')" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; update users set llm_provider = 'xai' where id = (select id from users limit 1); rollback;"
```
Expected: `ERROR: new row for relation "users" violates check constraint "users_llm_provider_check"`.

- [ ] **Step 2: Write the migration and apply it locally**

Create `supabase/migrations/20261011000001_llm_provider_xai.sql`:

```sql
-- Allow xAI as a bring-your-own-key provider alongside Anthropic and
-- OpenAI-compatible endpoints.

ALTER TABLE users DROP CONSTRAINT users_llm_provider_check;

ALTER TABLE users ADD CONSTRAINT users_llm_provider_check
  CHECK (llm_provider IN ('anthropic', 'openai', 'xai'));
```

Run:
```bash
supabase migration up --local
docker exec "$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_spool$')" psql -U postgres -v ON_ERROR_STOP=1 -c "begin; update users set llm_provider = 'xai' where id = (select id from users limit 1); rollback;"
docker exec "$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_spool$')" psql -U postgres -c "begin; update users set llm_provider = 'mistral' where id = (select id from users limit 1); rollback;" 2>&1 | grep -c "violates check constraint"
npm run db:types && git diff --stat -- src/lib/supabase/database.types.ts
```
Expected: the `xai` update succeeds (`UPDATE 1`, then `ROLLBACK`), the `mistral` count prints `1`, and `db:types` produces no diff. A CHECK constraint does not change generated types.

- [ ] **Step 3: Write the failing source test for the form**

Create `src/app/dashboard/__tests__/settings-provider.source.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("settings provider choices source", () => {
  it("offers xAI as a bring-your-own-key provider", async () => {
    const form = await readFile(
      new URL("../../../components/dashboard/settings-form.tsx", import.meta.url),
      "utf8",
    );

    expect(form).toContain('value: "xai"');
    expect(form).toContain('label: "xAI (Grok)"');
    expect(form).toContain("PROVIDER_DEFAULTS");
  });

  it("passes the saved provider through the shared LLMProvider type", async () => {
    const page = await readFile(new URL("../settings/page.tsx", import.meta.url), "utf8");

    expect(page).toContain("LLMProvider");
  });
});
```

Run: `npx vitest run src/app/dashboard/__tests__/settings-provider.source.test.ts`
Expected: FAIL. The form has no `value: "xai"`.

- [ ] **Step 4: Add xAI to the settings form**

In `src/components/dashboard/settings-form.tsx`:

1. Below the existing imports, add:

```ts
import { PROVIDER_DEFAULTS, type LLMProvider } from "@/lib/llm-provider";
```

2. Replace `type Provider = "anthropic" | "openai" | null;` with:

```ts
type Provider = LLMProvider | null;
```

3. In `PROVIDER_OPTIONS`, after the `"openai"` entry, add:

```ts
  {
    value: "xai" as Provider,
    label: "xAI (Grok)",
    description: `Grok (${PROVIDER_DEFAULTS.xai})`,
  },
```

4. Directly below `PROVIDER_OPTIONS`, add the per-provider copy:

```ts
const PROVIDER_COPY: Record<
  LLMProvider,
  {
    keyOptional: boolean;
    keyPlaceholder: string;
    keyHelp: string;
    baseUrlPlaceholder: string;
    baseUrlHelp: string;
    modelExamples: string;
  }
> = {
  anthropic: {
    keyOptional: false,
    keyPlaceholder: "sk-ant-...",
    keyHelp: "Get your key from console.anthropic.com/settings/keys",
    baseUrlPlaceholder: "https://api.anthropic.com",
    baseUrlHelp: "Leave blank for Anthropic's default API endpoint.",
    modelExamples: "claude-sonnet-4-6, claude-sonnet-5-5, claude-haiku-5-5",
  },
  openai: {
    keyOptional: true,
    keyPlaceholder: "sk-...",
    keyHelp: "Your API key from OpenAI or your provider",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    baseUrlHelp:
      "Leave blank for OpenAI. Set for Ollama (http://localhost:11434/v1), LM Studio, Together AI, etc.",
    modelExamples: "gpt-6.1-sol, gpt-6-luna, llama3.1, mistral",
  },
  xai: {
    keyOptional: false,
    keyPlaceholder: "xai-...",
    keyHelp: "Get your key from console.x.ai",
    baseUrlPlaceholder: "https://api.x.ai/v1",
    baseUrlHelp: "Leave blank for xAI's default API endpoint.",
    modelExamples: "grok-4.7, grok-4.5, grok-4.3",
  },
};
```

5. Directly after `const needsKey = provider !== null;`, add:

```ts
  const copy = provider ? PROVIDER_COPY[provider] : null;
```

6. Replace the provider ternaries in the three field sections with the copy record:
   - API key label: `{provider === "openai" && (` → `{copy?.keyOptional && (`
   - Key placeholder: `provider === "openai" ? "sk-..." : "sk-ant-..."` → `copy?.keyPlaceholder`
   - Key help text: the `provider === "openai" ? "Your API key…" : "Get your key from console.anthropic.com…"` expression → `{copy?.keyHelp}`
   - Base URL placeholder ternary → `copy?.baseUrlPlaceholder`
   - Base URL help ternary → `{copy?.baseUrlHelp}`
   - Model placeholder ternary (`"gpt-4o"` / `"claude-sonnet-4-6"`) → `provider ? PROVIDER_DEFAULTS[provider] : undefined`
   - Model examples ternary → `{copy?.modelExamples}`

   After the edit, `grep -n 'provider === "openai"' src/components/dashboard/settings-form.tsx` should print nothing.

7. In `src/app/dashboard/settings/page.tsx`, add `import type { LLMProvider } from "@/lib/llm-provider";` and replace the `initialProvider` prop with:

```tsx
        initialProvider={(user?.llm_provider as LLMProvider | null) ?? null}
```

- [ ] **Step 5: Run the tests, type check, and lint**

Run: `npx vitest run src/app/dashboard/__tests__/settings-provider.source.test.ts && npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npx eslint src/components/dashboard/settings-form.tsx src/app/dashboard/settings/page.tsx`
Expected: source tests PASS, no `tsc` output, and ESLint exits 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261011000001_llm_provider_xai.sql src/components/dashboard/settings-form.tsx src/app/dashboard/settings/page.tsx src/app/dashboard/__tests__/settings-provider.source.test.ts
git commit -F - <<'EOF'
feat: offer xAI as a BYOK provider in settings

The users.llm_provider check constraint now allows 'xai'. The settings
form adds an "xAI (Grok)" card and moves each provider's key, base URL,
and model copy into one record instead of two-way ternaries. Model
placeholders come from PROVIDER_DEFAULTS. Verified locally: the
constraint accepts 'xai', still rejects unknown values, and the
generated types are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Settings API routes accept xAI and validate keys through the adapter

**Files:**
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/settings/test/route.ts`
- Test: `src/app/api/settings/route.test.ts` (new)
- Test: `src/app/api/settings/test/route.test.ts` (new)

**Interfaces:**
- Consumes: `createByokModel` (Task 4), `AiSdkLLMClient` (Tasks 2–3), `LLMProvider`.
- Produces: `PUT /api/settings` and `POST /api/settings/test` accept `provider: "xai"`.

- [ ] **Step 1: Write the failing PUT tests**

Create `src/app/api/settings/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { LLMAuthError } from "@/lib/llm-client";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createByokModel: vi.fn((input: unknown) => ({ input })),
  generate: vi.fn(),
  updates: [] as unknown[],
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/crypto", () => ({ encrypt: (value: string) => `enc(${value})` }));
vi.mock("@/lib/llm-models", () => ({ createByokModel: mocks.createByokModel }));
vi.mock("@/lib/ai-sdk-llm-client", () => ({
  AiSdkLLMClient: class {
    generate = mocks.generate;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (payload: unknown) => {
        mocks.updates.push(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

import { PUT } from "./route";

function put(body: unknown) {
  return PUT(
    new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("PUT /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updates.length = 0;
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.generate.mockResolvedValue("OK");
  });

  it("validates and saves an xAI key", async () => {
    const response = await put({ provider: "xai", apiKey: " xai-key ", model: "grok-4.5" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, provider: "xai" });
    expect(mocks.createByokModel).toHaveBeenCalledWith({ provider: "xai", apiKey: "xai-key", model: "grok-4.5" });
    expect(mocks.updates).toEqual([
      { llm_provider: "xai", llm_api_key_encrypted: "enc(xai-key)", llm_base_url: null, llm_model: "grok-4.5" },
    ]);
  });

  it("requires a key for xAI", async () => {
    const response = await put({ provider: "xai", apiKey: "" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "API key is required for xAI" });
    expect(mocks.updates).toHaveLength(0);
  });

  it("does not save a key the provider rejects", async () => {
    mocks.generate.mockRejectedValue(new LLMAuthError("bad key"));

    const response = await put({ provider: "xai", apiKey: "xai-bad" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: "invalid_key" });
    expect(mocks.updates).toHaveLength(0);
  });

  it("rejects unknown providers", async () => {
    const response = await put({ provider: "mistral", apiKey: "k" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid provider. Must be 'anthropic', 'openai', 'xai', or null.",
    });
  });
});
```

- [ ] **Step 2: Write the failing connection-test tests**

Create `src/app/api/settings/test/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { LLMRateLimitError } from "@/lib/llm-client";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createByokModel: vi.fn((input: unknown) => ({ input })),
  generate: vi.fn(),
  savedKey: null as string | null,
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/crypto", () => ({ decrypt: (value: string) => `dec(${value})` }));
vi.mock("@/lib/llm-models", () => ({ createByokModel: mocks.createByokModel }));
vi.mock("@/lib/ai-sdk-llm-client", () => ({
  AiSdkLLMClient: class {
    generate = mocks.generate;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { llm_api_key_encrypted: mocks.savedKey } }),
        }),
      }),
    }),
  }),
}));

import { POST } from "./route";

function postConnectionTest(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/settings/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.savedKey = null;
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.generate.mockResolvedValue(" OK ");
  });

  it("tests an xAI key typed into the form", async () => {
    const response = await postConnectionTest({ provider: "xai", apiKey: "xai-key" });

    await expect(response.json()).resolves.toEqual({ ok: true, response: "OK", model: null });
    expect(mocks.createByokModel).toHaveBeenCalledWith({
      provider: "xai",
      apiKey: "xai-key",
      baseURL: undefined,
      model: undefined,
    });
  });

  it("falls back to the saved key", async () => {
    mocks.savedKey = "stored";

    await postConnectionTest({ provider: "xai" });

    expect(mocks.createByokModel).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "xai", apiKey: "dec(stored)" }),
    );
  });

  it("asks for a key when xAI has none", async () => {
    const response = await postConnectionTest({ provider: "xai" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errorType: "config",
      error: "xAI requires an API key.",
    });
  });

  it("classifies provider rate limits", async () => {
    mocks.generate.mockRejectedValue(new LLMRateLimitError("slow down"));

    const response = await postConnectionTest({ provider: "xai", apiKey: "xai-key" });

    await expect(response.json()).resolves.toEqual({ ok: false, errorType: "rate_limit", error: "slow down" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/settings`
Expected: FAIL. Both routes reject `provider: "xai"` with 400 config errors, so the xAI expectations fail.

- [ ] **Step 4: Update `PUT /api/settings`**

In `src/app/api/settings/route.ts`:

1. Replace the imports of `LLMClient`/`OpenAILLMClient` with:

```ts
import { LLMAuthError } from "@/lib/llm-client";
import { AiSdkLLMClient } from "@/lib/ai-sdk-llm-client";
import { createByokModel } from "@/lib/llm-models";
import type { LLMProvider } from "@/lib/llm-provider";
```

2. Replace the provider constants with:

```ts
const VALID_PROVIDERS = new Set<string>(["anthropic", "openai", "xai"]);
const KEY_REQUIRED: Partial<Record<LLMProvider, string>> = {
  anthropic: "Anthropic",
  xai: "xAI",
};
```

3. Change the invalid-provider message to `"Invalid provider. Must be 'anthropic', 'openai', 'xai', or null."`.

4. Replace the Anthropic-only key check with:

```ts
  // Anthropic and xAI always require an API key. OpenAI-compatible may not (e.g. Ollama).
  const keyRequiredFor = KEY_REQUIRED[provider as LLMProvider];
  if (keyRequiredFor && !apiKey) {
    return NextResponse.json(
      { error: `API key is required for ${keyRequiredFor}` },
      { status: 400 },
    );
  }
```

5. Replace the test-client construction inside `if (apiKey && !baseUrl) { try { ... } }` with:

```ts
      const testClient = new AiSdkLLMClient(
        createByokModel({
          provider: provider as LLMProvider,
          apiKey,
          model: model ?? undefined,
        }),
      );
```

   Keep the `generate({ messages: [{ role: "user", content: "Say OK" }], maxTokens: 5, timeout: 15_000 })` call and the catch block as they are.

- [ ] **Step 5: Update `POST /api/settings/test`**

In `src/app/api/settings/test/route.ts`:

1. Replace the `LLMClient`/`OpenAILLMClient` imports. Keep the error-class imports:

```ts
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  LLMError,
} from "@/lib/llm-client";
import { AiSdkLLMClient } from "@/lib/ai-sdk-llm-client";
import { createByokModel } from "@/lib/llm-models";
import type { LLMProvider } from "@/lib/llm-provider";
```

2. `const VALID_PROVIDERS = new Set<string>(["anthropic", "openai", "xai"]);`

3. Replace the Anthropic-only key check with:

```ts
  if ((typedProvider === "anthropic" || typedProvider === "xai") && !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "config",
        error: `${typedProvider === "xai" ? "xAI" : "Anthropic"} requires an API key.`,
      },
      { status: 400 },
    );
  }
```

4. Delete the `clientOpts` block. Inside the `try`, replace the client construction with:

```ts
    const client = new AiSdkLLMClient(
      createByokModel({ provider: typedProvider, apiKey, baseURL: baseUrl, model }),
    );
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/settings && npx vitest run 2>&1 | tail -4`
Expected: settings route tests PASS, and the full suite passes.

- [ ] **Step 7: Type check, lint, and commit**

Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "threads-api.test\|today-hub-freshness.test" ; npx eslint src/app/api/settings`
Expected: no `tsc` output, and ESLint exits 0.

```bash
git add src/app/api/settings/route.ts src/app/api/settings/route.test.ts src/app/api/settings/test/route.ts src/app/api/settings/test/route.test.ts
git commit -F - <<'EOF'
feat: accept xAI keys in the settings API

PUT /api/settings and POST /api/settings/test accept provider "xai",
require a key for it as they do for Anthropic, and validate keys
through AiSdkLLMClient built by createByokModel. Adds the first route
tests for both endpoints.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Remove the replaced clients and SDKs

**Files:**
- Delete: `src/lib/openai-client.ts`, `src/lib/__tests__/openai-client.test.ts`
- Modify: `src/lib/llm-client.ts` (types and errors only)
- Modify: `src/lib/llm-provider.ts` (`openai` default and header)
- Modify: `package.json`, `package-lock.json` (uninstall)

**Interfaces:**
- Consumes: nothing new.
- Produces: `@/lib/llm-client` still exports `LLMMessage`, `SystemBlock`, `LLMGenerateOptions`, `LLMStreamOptions`, `flattenSystemBlocks`, `LLMError`, `LLMRateLimitError`, `LLMAuthError`, `LLMServerError`, and `LLMTimeoutError`. The options types no longer have `model`. `PROVIDER_DEFAULTS.openai === "gpt-6.1-sol"`.

- [ ] **Step 1: Confirm nothing imports the old clients any more**

Run: `grep -rn "OpenAILLMClient\|openai-client\|new LLMClient\|from \"openai\"\|@anthropic-ai/sdk" src --include='*.ts' --include='*.tsx'`
Expected: matches only in `src/lib/openai-client.ts`, `src/lib/__tests__/openai-client.test.ts`, and `src/lib/llm-client.ts`.

- [ ] **Step 2: Delete the OpenAI client and slim `llm-client.ts`**

Run: `git rm src/lib/openai-client.ts src/lib/__tests__/openai-client.test.ts`

Replace the whole of `src/lib/llm-client.ts` with the following. It is the same types (minus `model`), `flattenSystemBlocks`, and error classes as before, without the Anthropic SDK client.

```ts
/**
 * LLM client types and errors
 *
 * Request types and the error hierarchy shared by every ILLMClient
 * implementation. The implementation lives in ai-sdk-llm-client.ts.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A segment of the system prompt. When an array is passed as `systemPrompt`,
 * Anthropic-family models receive one system message per block with a
 * `cacheControl: { type: "ephemeral" }` breakpoint on any block marked
 * `cacheable: true`. Other providers receive the blocks joined into one string.
 */
export interface SystemBlock {
  text: string;
  cacheable?: boolean;
}

export interface LLMGenerateOptions {
  /** System prompt — plain string, or structured blocks for cache breakpoints */
  systemPrompt?: string | SystemBlock[];
  /** Conversation messages */
  messages: LLMMessage[];
  /** Maximum visible output tokens (default: 1024) */
  maxTokens?: number;
  /** Reasoning effort, forwarded only to models that reason */
  reasoningEffort?: "low" | "medium" | "high";
  /** Request timeout in milliseconds (default: 30s) */
  timeout?: number;
}

export interface LLMStreamOptions {
  /** System prompt — plain string, or structured blocks for cache breakpoints */
  systemPrompt?: string | SystemBlock[];
  /** Conversation messages */
  messages: LLMMessage[];
  /** Maximum visible output tokens (default: 1024) */
  maxTokens?: number;
  /** Reasoning effort, forwarded only to models that reason */
  reasoningEffort?: "low" | "medium" | "high";
  /** Request timeout in milliseconds (default: 60s) */
  timeout?: number;
}

/**
 * Flatten a SystemBlock[] into a single joined string for providers that
 * don't support structured system content.
 */
export function flattenSystemBlocks(blocks: SystemBlock[]): string {
  return blocks.map((b) => b.text).join("\n\n");
}

// ── Error Classes ────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message, 429);
    this.name = "LLMRateLimitError";
  }
}

export class LLMAuthError extends LLMError {
  constructor(message: string) {
    super(message, 401);
    this.name = "LLMAuthError";
  }
}

export class LLMServerError extends LLMError {
  constructor(message: string, status?: number) {
    super(message, status ?? 500);
    this.name = "LLMServerError";
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message, 408);
    this.name = "LLMTimeoutError";
  }
}
```

- [ ] **Step 3: Update the OpenAI default and the provider header**

In `src/lib/llm-provider.ts`, set `openai: "gpt-6.1-sol",` in `PROVIDER_DEFAULTS` and change the header comment's second line to:

```ts
 * Shared interface for all LLM providers (Anthropic, OpenAI, xAI).
```

- [ ] **Step 4: Uninstall the replaced SDKs**

Run: `npm uninstall @anthropic-ai/sdk openai`
Expected: both packages are removed from `package.json` dependencies.

- [ ] **Step 5: Full verification**

Run:
```bash
grep -rn "OpenAILLMClient\|openai-client\|new LLMClient\|from \"openai\"\|@anthropic-ai/sdk" src --include='*.ts' --include='*.tsx' ; echo "grep exit $?"
npx vitest run 2>&1 | tail -4
npm run lint
npx tsc --noEmit -p . 2>&1 | grep "error TS"
npm run build 2>&1 | tail -6
```
Expected: the grep prints nothing (`grep exit 1`), all tests pass, lint exits 0, `tsc` lists exactly the 3 pre-existing errors, and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A src/lib/llm-client.ts src/lib/llm-provider.ts src/lib/openai-client.ts src/lib/__tests__/openai-client.test.ts package.json package-lock.json
git commit -F - <<'EOF'
refactor: remove the hand-written Anthropic and OpenAI clients

Every caller now goes through AiSdkLLMClient, so the Anthropic-SDK
LLMClient class, OpenAILLMClient, and their SDK dependencies are
removed. llm-client.ts keeps the shared request types and error
classes. The unused per-call `model` override is dropped, since no
caller passed it. The OpenAI BYOK default moves from gpt-4o to
gpt-6.1-sol.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Live verification

**Files:**
- Create: `src/lib/__tests__/llm-live.smoke.test.ts`
- Modify: this plan's **Completion notes** section

**Interfaces:**
- Consumes: `AiSdkLLMClient`, `resolveServerDefaultModel`, `createByokModel`.
- Produces: an opt-in live check that is skipped unless `SPOOL_LIVE_LLM=1`.

- [ ] **Step 1: Add the opt-in live smoke test**

Create `src/lib/__tests__/llm-live.smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { AiSdkLLMClient } from "../ai-sdk-llm-client";
import { createByokModel, resolveServerDefaultModel, type ResolvedModel } from "../llm-models";

// Opt-in: SPOOL_LIVE_LLM=1 plus the credentials for each target you want to hit.
const live = process.env.SPOOL_LIVE_LLM === "1";

const targets: Array<{ name: string; enabled: boolean; build: () => ResolvedModel }> = [
  {
    name: "server default",
    enabled: live && Boolean(process.env.SPOOL_DEFAULT_MODEL?.trim() || process.env.LLM_API_KEY),
    build: () => resolveServerDefaultModel(),
  },
  {
    name: "BYOK anthropic",
    enabled: live && Boolean(process.env.SPOOL_LIVE_ANTHROPIC_KEY),
    build: () => createByokModel({ provider: "anthropic", apiKey: process.env.SPOOL_LIVE_ANTHROPIC_KEY }),
  },
  {
    name: "BYOK openai",
    enabled: live && Boolean(process.env.SPOOL_LIVE_OPENAI_KEY),
    build: () => createByokModel({ provider: "openai", apiKey: process.env.SPOOL_LIVE_OPENAI_KEY }),
  },
  {
    name: "BYOK xai",
    enabled: live && Boolean(process.env.SPOOL_LIVE_XAI_KEY),
    build: () => createByokModel({ provider: "xai", apiKey: process.env.SPOOL_LIVE_XAI_KEY }),
  },
];

describe.each(targets)("live LLM: $name", ({ enabled, build }) => {
  it.skipIf(!enabled)("generates text", async () => {
    const text = await new AiSdkLLMClient(build()).generate({
      systemPrompt: [{ text: "Reply with exactly one word.", cacheable: true }],
      messages: [{ role: "user", content: "Say OK." }],
      maxTokens: 20,
    });

    expect(text.trim().length).toBeGreaterThan(0);
  }, 60_000);

  it.skipIf(!enabled)("streams text", async () => {
    let text = "";
    for await (const chunk of new AiSdkLLMClient(build()).generateStreamIterator({
      messages: [{ role: "user", content: "Count from 1 to 5, separated by spaces." }],
      maxTokens: 50,
    })) {
      text += chunk;
    }

    expect(text).toMatch(/1\D+2\D+3/);
  }, 60_000);
});
```

Run: `npx vitest run src/lib/__tests__/llm-live.smoke.test.ts`
Expected: 8 tests skipped and none failed.

- [ ] **Step 2: Run the live check with real credentials**

`.env.local` is a named pipe, so pass credentials inline. The human partner supplies the keys; never print or commit them. Run each target you have keys for:

```bash
SPOOL_LIVE_LLM=1 SPOOL_DEFAULT_MODEL=anthropic/claude-sonnet-4.6 AI_GATEWAY_API_KEY=<gateway-key> \
  npx vitest run src/lib/__tests__/llm-live.smoke.test.ts
SPOOL_LIVE_LLM=1 LLM_API_KEY=<anthropic-key> npx vitest run src/lib/__tests__/llm-live.smoke.test.ts
SPOOL_LIVE_LLM=1 SPOOL_LIVE_OPENAI_KEY=<openai-key> SPOOL_LIVE_XAI_KEY=<xai-key> \
  npx vitest run src/lib/__tests__/llm-live.smoke.test.ts
```
Expected: every enabled target passes both tests. For the Anthropic targets, the console shows `[llm-client:generate] cache_creation=… cache_read=…` lines.

- [ ] **Step 3: Check the settings page in a browser**

Start the dev server with the local Supabase env inline (see the `local-dev-env` memory). Set the `spool_session` cookie for the seed user and open `/dashboard/settings`. Confirm:
- The xAI (Grok) card shows the `xai-...` key placeholder and the `grok-4.7` model placeholder.
- Switching cards updates the help text.
- If an xAI key is available, **Test connection** returns OK, and saving persists the provider.

Then open one AI feature (for example Compose) and confirm it streams.

- [ ] **Step 4: Record results and commit**

Fill in **Completion notes** below with which targets ran, pass/fail, and anything skipped for lack of a key. Then:

```bash
git add src/lib/__tests__/llm-live.smoke.test.ts docs/superpowers/plans/2026-10-11-ai-sdk-provider-layer.md
git commit -F - <<'EOF'
test: add opt-in live smoke test for LLM providers

SPOOL_LIVE_LLM=1 runs one generate and one streamed call against the
server default and each BYOK provider whose key is supplied. It is
skipped otherwise. The plan's completion notes record the live results.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## After merge (operations, not code)

These follow the spec's rollout section and are done by the human partner:

1. Apply the pending migrations to the hosted Supabase project: `20260707000000_user_replies`, `20261011000000_post_replies_rls`, and `20261011000001_llm_provider_xai`.
2. Deploy with `SPOOL_DEFAULT_MODEL` unset. The server default keeps calling Anthropic directly with `LLM_API_KEY`.
3. Enable AI Gateway for the Vercel project (OIDC), and set a Gateway budget.
4. Set `SPOOL_DEFAULT_MODEL=anthropic/claude-sonnet-4.6` to move the server default onto the Gateway with the same model. Compare feature outputs before choosing a different model.

## Completion notes

Recorded 2026-10-11, branch `feat/ai-sdk-provider-layer`.

**Verified live, through the running app** (dev server, local Supabase, seed user's saved BYOK: OpenAI-compatible at DashScope, model `deepseek-v4-pro`):
- Settings → **Test Connection**: `POST /api/settings/test` 200, UI shows "Connection OK". This exercises `AiSdkLLMClient.generate` → `createOpenAICompatible` with the user's saved key. Log: `[llm-client:generate] cache_creation=0 cache_read=0 input=11 output=10`.
- Compose → **Generate Drafts**: `POST /api/compose` 200 in 22.4s. Three drafts streamed, scored, and rendered. This exercises `generateStreamIterator` against the same endpoint.
- Settings form: the xAI (Grok) card renders with `Grok (grok-4.7)`. Selecting it switches the base URL placeholder (`https://api.x.ai/v1`), help text, model placeholder (`grok-4.7`), and examples. Nothing was saved.

**Opt-in smoke test:** `npx vitest run src/lib/__tests__/llm-live.smoke.test.ts` → 8 skipped by default.

**Not verified live** (needs keys the human partner supplies; commands in Task 9 Step 2):
- AI Gateway server default (`SPOOL_DEFAULT_MODEL` + `AI_GATEWAY_API_KEY`). No Gateway key exists yet.
- Direct Anthropic (`LLM_API_KEY`), including real cache-breakpoint hits.
- BYOK OpenAI Responses API and BYOK xAI, including the settings Test Connection with an xAI key.

**After the final-review fix pass** (commits fc14cdc..e0d4196), re-checked live against the same DashScope BYOK: Test Connection OK (`POST /api/settings/test` 200 in 1.8s), and Compose streamed three drafts (`POST /api/compose` 200 in 23.2s). Both requests now go through `timeoutFetch`.

**Observation for review:** OpenAI-compatible streams log `[llm-client:stream] … input=0 output=0`, because those servers omit usage in streams unless asked. The replaced OpenAI client logged no usage at all.
