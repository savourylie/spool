import { afterEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";

import { createByokModel, describeModel, resolveServerDefaultModel, type ResolvedModel } from "../llm-models";
import { LLMAuthError } from "../llm-client";
import { PROVIDER_DEFAULTS } from "../llm-provider";

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

describe("resolveServerDefaultModel from LLM_* settings", () => {
  const DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

  it.each([
    [
      "an OpenAI-compatible server",
      { LLM_PROVIDER: "openai", LLM_BASE_URL: DASHSCOPE, LLM_MODEL: "deepseek-v4-pro", LLM_API_KEY: "sk-dash" },
      { provider: "openai-compatible.chat", modelId: "deepseek-v4-pro", family: "openai-compatible", alwaysReasons: false },
    ],
    [
      "OpenAI itself",
      { LLM_PROVIDER: "openai", LLM_API_KEY: "sk-openai" },
      { provider: "openai.responses", modelId: PROVIDER_DEFAULTS.openai, family: "openai", alwaysReasons: true },
    ],
    [
      "xAI",
      { LLM_PROVIDER: "xai", LLM_API_KEY: "xai-key", LLM_MODEL: "grok-4.5" },
      { provider: "xai.responses", modelId: "grok-4.5", family: "xai", alwaysReasons: true },
    ],
    [
      "Anthropic with a chosen model",
      { LLM_PROVIDER: "anthropic", LLM_API_KEY: "sk-ant", LLM_MODEL: "claude-sonnet-5-5" },
      { provider: "anthropic.messages", modelId: "claude-sonnet-5-5", family: "anthropic", alwaysReasons: true },
    ],
    [
      "a keyless local OpenAI-compatible server",
      { LLM_PROVIDER: "openai", LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL: "llama3.1" },
      { provider: "openai-compatible.chat", modelId: "llama3.1", family: "openai-compatible", alwaysReasons: false },
    ],
  ])("builds the server default for %s", (_label, env, expected) => {
    expect(info(resolveServerDefaultModel(env))).toEqual(expected);
  });

  it("accepts LLM_PROVIDER in any case and with surrounding spaces", () => {
    expect(info(resolveServerDefaultModel({ LLM_PROVIDER: " OpenAI ", LLM_API_KEY: "sk-openai" })).provider).toBe(
      "openai.responses",
    );
  });

  it("still prefers AI Gateway when SPOOL_DEFAULT_MODEL is set", () => {
    expect(
      info(
        resolveServerDefaultModel({
          SPOOL_DEFAULT_MODEL: "anthropic/claude-sonnet-4.6",
          LLM_PROVIDER: "openai",
          LLM_BASE_URL: DASHSCOPE,
          LLM_MODEL: "deepseek-v4-pro",
          LLM_API_KEY: "sk-dash",
        }),
      ).provider,
    ).toBe("gateway");
  });

  it.each([["mistral"], ["constructor"], ["__proto__"]])("rejects the unknown LLM_PROVIDER %s", (provider) => {
    expect(() => resolveServerDefaultModel({ LLM_PROVIDER: provider, LLM_API_KEY: "k" })).toThrow(
      /LLM_PROVIDER/,
    );
  });

  it.each([["openai"], ["xai"], ["anthropic"]])(
    "requires LLM_API_KEY for %s unless it is an OpenAI-compatible server",
    (provider) => {
      expect(() => resolveServerDefaultModel({ LLM_PROVIDER: provider })).toThrow(LLMAuthError);
    },
  );

  it("requires LLM_MODEL for an OpenAI-compatible server instead of sending it OpenAI's default", () => {
    expect(() =>
      resolveServerDefaultModel({ LLM_PROVIDER: "openai", LLM_BASE_URL: DASHSCOPE, LLM_API_KEY: "sk-dash" }),
    ).toThrow(/LLM_MODEL/);
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

  it.each(["https://api.openai.com/v1", "https://api.openai.com/v1/"])(
    "treats the official OpenAI URL %s as OpenAI, not an OpenAI-compatible server",
    (baseURL) => {
      expect(info(createByokModel({ provider: "openai", apiKey: "sk-openai", baseURL }))).toEqual({
        provider: "openai.responses",
        modelId: PROVIDER_DEFAULTS.openai,
        family: "openai",
        alwaysReasons: true,
      });
    },
  );

  it("builds a direct xAI model", () => {
    expect(info(createByokModel({ provider: "xai", apiKey: "xai-key", model: "grok-4.7" }))).toEqual({
      provider: "xai.responses",
      modelId: "grok-4.7",
      family: "xai",
      alwaysReasons: true,
    });
  });
});

function unauthorized() {
  return new Response(JSON.stringify({ error: { message: "bad key" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

describe("createByokModel requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ["anthropic", "ANTHROPIC_API_KEY", "x-api-key"],
    ["openai", "OPENAI_API_KEY", "authorization"],
    ["xai", "XAI_API_KEY", "authorization"],
  ] as const)("never sends the server's own key for a %s user without one (%s)", async (provider, envName, header) => {
    vi.stubEnv(envName, "server-secret");
    const sent: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      sent.push(new Headers(init?.headers).get(header) ?? "");
      return unauthorized();
    });

    await generateText({ model: createByokModel({ provider }).model, prompt: "Hi", maxRetries: 0 }).catch(() => {});

    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toContain("server-secret");
  });

  it.each([
    "https://proxy.example.test",
    "https://proxy.example.test/",
    "https://proxy.example.test/v1",
  ])("sends Anthropic requests for the saved base URL %s to its /v1/messages path", async (baseURL) => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      return unauthorized();
    });

    await generateText({
      model: createByokModel({ provider: "anthropic", apiKey: "sk-ant", baseURL }).model,
      prompt: "Hi",
      maxRetries: 0,
    }).catch(() => {});

    expect(urls).toEqual(["https://proxy.example.test/v1/messages"]);
  });
});
