import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@/lib/llm-resolver", () => ({
  resolveLLMClient: async () => ({
    generate: mockGenerate,
    generateStream: () => {
      throw new Error("not used");
    },
    generateStreamIterator: async function* () {},
  }),
}));

// Pass unstable_cache through (no cache in tests).
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  reframeTopicAngle,
  REFRAME_MAX_OUTPUT_LENGTH,
  __testOnly,
} from "../freshness-reframe";

const USER = "user-abc";

beforeEach(() => {
  mockGenerate.mockReset();
});

describe("reframeTopicAngle", () => {
  it("returns trimmed angle on success", async () => {
    mockGenerate.mockResolvedValue("  Agents for solo devs, not teams  ");
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBe("Agents for solo devs, not teams");
  });

  it("strips wrapping quotes", async () => {
    mockGenerate.mockResolvedValue('"Agents for designers, not engineers"');
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBe("Agents for designers, not engineers");
  });

  it("strips single quotes and backticks", async () => {
    mockGenerate.mockResolvedValue("`foo angle`");
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBe("foo angle");
  });

  it("returns null on LLM error", async () => {
    mockGenerate.mockRejectedValue(new Error("boom"));
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBeNull();
  });

  it("returns null on empty response", async () => {
    mockGenerate.mockResolvedValue("   ");
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBeNull();
  });

  it("returns null when response exceeds max length", async () => {
    mockGenerate.mockResolvedValue("x".repeat(REFRAME_MAX_OUTPUT_LENGTH + 1));
    const out = await reframeTopicAngle("AI agents", USER);
    expect(out).toBeNull();
  });

  it("system prompt stays well under 500 tokens (character-count proxy)", () => {
    // ~4 chars per token for Claude; 1500 chars → ~375 tokens, comfortably
    // below the 500-token guardrail for this helper.
    expect(__testOnly.SYSTEM_PROMPT.length).toBeLessThan(1500);
  });
});
