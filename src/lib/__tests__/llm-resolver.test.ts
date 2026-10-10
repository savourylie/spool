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
