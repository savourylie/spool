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
