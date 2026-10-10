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
