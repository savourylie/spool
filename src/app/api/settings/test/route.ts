import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  LLMClient,
  LLMAuthError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  LLMError,
} from "@/lib/llm-client";
import { OpenAILLMClient } from "@/lib/openai-client";
import type { LLMProvider } from "@/lib/llm-provider";

const VALID_PROVIDERS = new Set<string>(["anthropic", "openai"]);
const TEST_TIMEOUT_MS = 15_000;

type ErrorType =
  | "auth"
  | "rate_limit"
  | "server"
  | "timeout"
  | "config"
  | "unknown";

function classifyError(error: unknown): { type: ErrorType; message: string } {
  if (error instanceof LLMAuthError) {
    return { type: "auth", message: error.message };
  }
  if (error instanceof LLMRateLimitError) {
    return { type: "rate_limit", message: error.message };
  }
  if (error instanceof LLMServerError) {
    return { type: "server", message: error.message };
  }
  if (error instanceof LLMTimeoutError) {
    return { type: "timeout", message: error.message };
  }
  if (error instanceof LLMError) {
    return { type: "unknown", message: error.message };
  }
  if (error instanceof Error) {
    return { type: "unknown", message: error.message };
  }
  return { type: "unknown", message: String(error) };
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider;
  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "config",
        error: "Pick a provider before testing.",
      },
      { status: 400 },
    );
  }

  const typedProvider = provider as LLMProvider;
  const baseUrl =
    typeof body.baseUrl === "string" ? body.baseUrl.trim() || undefined : undefined;
  const model =
    typeof body.model === "string" ? body.model.trim() || undefined : undefined;

  // Prefer the key typed in the form; fall back to the saved (encrypted) key.
  let apiKey =
    typeof body.apiKey === "string" ? body.apiKey.trim() : undefined;

  if (!apiKey) {
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from("users")
      .select("llm_api_key_encrypted")
      .eq("id", userId)
      .single();
    if (user?.llm_api_key_encrypted) {
      try {
        apiKey = decrypt(user.llm_api_key_encrypted);
      } catch {
        return NextResponse.json(
          {
            ok: false,
            errorType: "config",
            error:
              "Saved API key could not be decrypted. Enter a new key and try again.",
          },
          { status: 400 },
        );
      }
    }
  }

  if (typedProvider === "anthropic" && !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        errorType: "config",
        error: "Anthropic requires an API key.",
      },
      { status: 400 },
    );
  }

  const clientOpts = {
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    ...(model ? { defaultModel: model } : {}),
  };

  try {
    const client =
      typedProvider === "openai"
        ? new OpenAILLMClient(apiKey, clientOpts)
        : new LLMClient(apiKey, clientOpts);

    const response = await client.generate({
      messages: [{ role: "user", content: "Reply with the single word: OK" }],
      maxTokens: 10,
      timeout: TEST_TIMEOUT_MS,
    });

    return NextResponse.json({
      ok: true,
      response: response.trim().slice(0, 200),
      model: model ?? null,
    });
  } catch (error) {
    const { type, message } = classifyError(error);
    return NextResponse.json(
      { ok: false, errorType: type, error: message },
      { status: 200 },
    );
  }
}
