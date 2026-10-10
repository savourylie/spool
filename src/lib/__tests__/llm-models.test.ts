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
