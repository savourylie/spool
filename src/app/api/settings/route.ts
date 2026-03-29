import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { LLMClient, LLMAuthError } from "@/lib/llm-client";
import { OpenAILLMClient } from "@/lib/openai-client";
import type { LLMProvider } from "@/lib/llm-provider";

const VALID_PROVIDERS = new Set<string>(["anthropic", "openai"]);

// ── GET — retrieve current settings ──────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    provider: user.llm_provider ?? null,
    hasKey: !!user.llm_api_key_encrypted,
    baseUrl: user.llm_base_url ?? null,
    model: user.llm_model ?? null,
  });
}

// ── PUT — update provider and/or API key ─────────────────────────────

export async function PUT(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: string | null; apiKey?: string; baseUrl?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider ?? null;

  // Validate provider value
  if (provider !== null && !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Must be 'anthropic', 'openai', or null." },
      { status: 400 },
    );
  }

  // If clearing BYOK config
  if (provider === null) {
    const supabase = createAdminClient();
    await supabase
      .from("users")
      .update({ llm_provider: null, llm_api_key_encrypted: null, llm_base_url: null, llm_model: null })
      .eq("id", userId);

    return NextResponse.json({ success: true, provider: null });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() || null : null;
  const model = typeof body.model === "string" ? body.model.trim() || null : null;

  // Anthropic always requires an API key. OpenAI-compatible may not (e.g. Ollama).
  if (provider === "anthropic" && !apiKey) {
    return NextResponse.json(
      { error: "API key is required for Anthropic" },
      { status: 400 },
    );
  }

  // Validate key with a test call — only for hosted providers (no custom base URL).
  // Custom endpoints (Ollama, LM Studio) may not respond like OpenAI/Anthropic,
  // so we skip the test call and trust the user's configuration.
  if (apiKey && !baseUrl) {
    try {
      const clientOpts = model ? { defaultModel: model } : undefined;
      const testClient =
        provider === "openai"
          ? new OpenAILLMClient(apiKey, clientOpts)
          : new LLMClient(apiKey, clientOpts);

      await testClient.generate({
        messages: [{ role: "user", content: "Say OK" }],
        maxTokens: 5,
        timeout: 15_000,
      });
    } catch (error) {
      if (error instanceof LLMAuthError) {
        return NextResponse.json(
          { success: false, error: "invalid_key" },
          { status: 400 },
        );
      }
      // Rate limit means the key is valid, just throttled — proceed.
      // Any other error (server error, timeout) — also proceed,
      // as the key format may be valid but the service is temporarily down.
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name: string }).name === "LLMRateLimitError"
      ) {
        // valid, continue
      }
      // For non-auth, non-rate-limit errors: still save. The key might be fine,
      // but the service could be temporarily unavailable or returning unexpected errors.
    }
  }

  // Encrypt and save (store null if key is empty — e.g. Ollama without auth)
  const encryptedKey = apiKey ? encrypt(apiKey) : null;
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("users")
    .update({
      llm_provider: provider as LLMProvider,
      llm_api_key_encrypted: encryptedKey,
      llm_base_url: baseUrl,
      llm_model: model,
    })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, provider });
}
