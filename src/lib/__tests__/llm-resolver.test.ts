import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(),
}));

vi.mock("@/lib/llm-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/llm-client")>();
  return {
    ...original,
    LLMClient: class MockLLMClient {
      _type = "anthropic";
      _apiKey: string;
      constructor(apiKey?: string) {
        this._apiKey = apiKey ?? "server-key";
      }
    },
  };
});

vi.mock("@/lib/openai-client", () => ({
  OpenAILLMClient: class MockOpenAILLMClient {
    _type = "openai";
    _apiKey: string;
    constructor(apiKey: string) {
      this._apiKey = apiKey;
    }
  },
}));

import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { resolveLLMClient } from "../llm-resolver";

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue({
    from: mockFrom,
  } as never);
});

describe("resolveLLMClient", () => {
  it("returns default LLMClient when user has no provider set", async () => {
    mockSingle.mockResolvedValue({
      data: { llm_provider: null, llm_api_key_encrypted: null, llm_base_url: null, llm_model: null },
    });

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
    };
    expect(client._type).toBe("anthropic");
  });

  it("returns default LLMClient when user has no encrypted key", async () => {
    mockSingle.mockResolvedValue({
      data: { llm_provider: "anthropic", llm_api_key_encrypted: null, llm_base_url: null, llm_model: null },
    });

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
    };
    expect(client._type).toBe("anthropic");
  });

  it("returns LLMClient with decrypted key for anthropic provider", async () => {
    mockSingle.mockResolvedValue({
      data: {
        llm_provider: "anthropic",
        llm_api_key_encrypted: "encrypted-value",
        llm_base_url: null,
        llm_model: null,
      },
    });
    vi.mocked(decrypt).mockReturnValue("sk-ant-user-key");

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
      _apiKey: string;
    };
    expect(client._type).toBe("anthropic");
    expect(client._apiKey).toBe("sk-ant-user-key");
    expect(decrypt).toHaveBeenCalledWith("encrypted-value");
  });

  it("returns OpenAILLMClient for openai provider", async () => {
    mockSingle.mockResolvedValue({
      data: {
        llm_provider: "openai",
        llm_api_key_encrypted: "encrypted-value",
        llm_base_url: null,
        llm_model: null,
      },
    });
    vi.mocked(decrypt).mockReturnValue("sk-openai-key");

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
      _apiKey: string;
    };
    expect(client._type).toBe("openai");
    expect(client._apiKey).toBe("sk-openai-key");
  });

  it("returns OpenAILLMClient without key for keyless providers (Ollama)", async () => {
    mockSingle.mockResolvedValue({
      data: {
        llm_provider: "openai",
        llm_api_key_encrypted: null,
        llm_base_url: "http://localhost:11434/v1",
        llm_model: "llama3.1",
      },
    });

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
    };
    expect(client._type).toBe("openai");
  });

  it("falls back to default LLMClient when decryption fails", async () => {
    mockSingle.mockResolvedValue({
      data: {
        llm_provider: "anthropic",
        llm_api_key_encrypted: "corrupted-data",
        llm_base_url: null,
        llm_model: null,
      },
    });
    vi.mocked(decrypt).mockImplementation(() => {
      throw new Error("Decryption failed");
    });

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
    };
    expect(client._type).toBe("anthropic");
  });

  it("falls back to default LLMClient when user not found", async () => {
    mockSingle.mockResolvedValue({ data: null });

    const client = (await resolveLLMClient("user-123")) as unknown as {
      _type: string;
    };
    expect(client._type).toBe("anthropic");
  });

  it("queries the correct user ID", async () => {
    mockSingle.mockResolvedValue({
      data: { llm_provider: null, llm_api_key_encrypted: null, llm_base_url: null, llm_model: null },
    });

    await resolveLLMClient("abc-def-123");
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith(
      "llm_provider, llm_api_key_encrypted, llm_base_url, llm_model",
    );
    expect(mockEq).toHaveBeenCalledWith("id", "abc-def-123");
  });
});
