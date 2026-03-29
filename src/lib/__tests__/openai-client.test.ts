import { describe, expect, it, vi, beforeEach } from "vitest";

// Store the mock create function so we can control it per-test
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

import { OpenAILLMClient } from "../openai-client";
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  LLMError,
} from "../llm-client";

beforeEach(() => {
  mockCreate.mockReset();
});

// ── generate ─────────────────────────────────────────────────────────

describe("OpenAILLMClient.generate", () => {
  it("returns the content from the first choice", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Hello world" } }],
    });

    const client = new OpenAILLMClient("sk-test");
    const result = await client.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result).toBe("Hello world");
  });

  it("includes system prompt as system message", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "OK" } }],
    });

    const client = new OpenAILLMClient("sk-test");
    await client.generate({
      systemPrompt: "You are helpful",
      messages: [{ role: "user", content: "Hi" }],
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0]).toEqual({
      role: "system",
      content: "You are helpful",
    });
    expect(callArgs.messages[1]).toEqual({
      role: "user",
      content: "Hi",
    });
  });

  it("defaults model to gpt-4o", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "OK" } }],
    });

    const client = new OpenAILLMClient("sk-test");
    await client.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(mockCreate.mock.calls[0][0].model).toBe("gpt-4o");
  });

  it("returns empty string when choices are empty", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });

    const client = new OpenAILLMClient("sk-test");
    const result = await client.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result).toBe("");
  });
});

// ── Error mapping ────────────────────────────────────────────────────

describe("OpenAILLMClient error mapping", () => {
  it("maps 401 to LLMAuthError", async () => {
    const apiError = Object.assign(new Error("Unauthorized"), { status: 401 });
    mockCreate.mockRejectedValueOnce(apiError);

    const client = new OpenAILLMClient("sk-test");
    await expect(
      client.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(LLMAuthError);
  });

  it("maps 429 to LLMRateLimitError", async () => {
    const apiError = Object.assign(new Error("Rate limited"), { status: 429 });
    mockCreate.mockRejectedValueOnce(apiError);

    const client = new OpenAILLMClient("sk-test");
    await expect(
      client.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(LLMRateLimitError);
  });

  it("maps 500 to LLMServerError", async () => {
    const apiError = Object.assign(new Error("Server error"), { status: 500 });
    mockCreate.mockRejectedValueOnce(apiError);

    const client = new OpenAILLMClient("sk-test");
    await expect(
      client.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(LLMServerError);
  });

  it("maps timeout errors to LLMTimeoutError", async () => {
    const timeoutError = new Error("Request timed out");
    timeoutError.name = "AbortError";
    mockCreate.mockRejectedValueOnce(timeoutError);

    const client = new OpenAILLMClient("sk-test");
    await expect(
      client.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(LLMTimeoutError);
  });

  it("maps generic errors to LLMError", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Something failed"));

    const client = new OpenAILLMClient("sk-test");
    await expect(
      client.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(LLMError);
  });
});

// ── generateStreamIterator ───────────────────────────────────────────

describe("OpenAILLMClient.generateStreamIterator", () => {
  it("yields text chunks from stream", async () => {
    const chunks = [
      { choices: [{ delta: { content: "Hello" } }] },
      { choices: [{ delta: { content: " world" } }] },
      { choices: [{ delta: { content: null } }] },
    ];

    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) yield chunk;
      },
    });

    const client = new OpenAILLMClient("sk-test");
    const texts: string[] = [];

    for await (const text of client.generateStreamIterator({
      messages: [{ role: "user", content: "Hi" }],
    })) {
      texts.push(text);
    }

    expect(texts).toEqual(["Hello", " world"]);
  });

  it("sets stream: true in request", async () => {
    mockCreate.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        // empty stream
      },
    });

    const client = new OpenAILLMClient("sk-test");
    for await (const _ of client.generateStreamIterator({
      messages: [{ role: "user", content: "Hi" }],
    })) {
      void _;
    }

    expect(mockCreate.mock.calls[0][0].stream).toBe(true);
  });
});
