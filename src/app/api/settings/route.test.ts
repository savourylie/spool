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
