import { afterEach, describe, expect, it, vi } from "vitest";
import { APICallError, LoadAPIKeyError, RetryError, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { GatewayAuthenticationError } from "@ai-sdk/gateway";

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
  vi.unstubAllEnvs();
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

  it.each(["production", "development"])(
    "reports an AI Gateway authentication failure as LLMAuthError (NODE_ENV=%s)",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      const model = new MockLanguageModelV4({
        doGenerate: async () => {
          throw new GatewayAuthenticationError({ message: "Invalid API key", statusCode: 401 });
        },
      });

      const error = await new AiSdkLLMClient(resolved(model, "anthropic", "claude-sonnet-4-6"))
        .generate({ messages: HI })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(LLMAuthError);
      expect((error as Error).message).not.toContain(String.fromCharCode(27));
    },
  );

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

  it("maps a streamed AI Gateway authentication error by its statusCode", () => {
    const gatewayAuth = new GatewayAuthenticationError({ message: "Invalid API key", statusCode: 401 });
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
