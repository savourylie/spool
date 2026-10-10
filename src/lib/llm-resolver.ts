/**
 * LLM Client Resolver
 *
 * Resolves the LLM client for a user from their BYOK settings, falling back
 * to the server default (AI Gateway when SPOOL_DEFAULT_MODEL is set,
 * otherwise Anthropic with LLM_API_KEY).
 */

import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { AiSdkLLMClient } from "@/lib/ai-sdk-llm-client";
import { createByokModel, resolveServerDefaultModel } from "@/lib/llm-models";
import type { ILLMClient, LLMProvider } from "@/lib/llm-provider";

const BYOK_PROVIDERS = new Set<string>(["anthropic", "openai", "xai"]);
const KEY_REQUIRED = new Set<string>(["anthropic", "xai"]);

function serverDefaultClient(): ILLMClient {
  return new AiSdkLLMClient(resolveServerDefaultModel());
}

/**
 * Resolve the LLM client for a given user.
 *
 * 1. Looks up the user's llm_provider, llm_api_key_encrypted, llm_base_url, and llm_model.
 * 2. If configured, decrypts the key and returns a client for that provider.
 * 3. Otherwise (or if the key can't be decrypted), returns the server default.
 */
export async function resolveLLMClient(userId: string): Promise<ILLMClient> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model")
    .eq("id", userId)
    .single();

  if (!user?.llm_provider || !BYOK_PROVIDERS.has(user.llm_provider)) {
    return serverDefaultClient();
  }

  const provider = user.llm_provider as LLMProvider;

  // Decrypt API key if present (may be null for keyless services like Ollama)
  let apiKey: string | undefined;
  if (user.llm_api_key_encrypted) {
    try {
      apiKey = decrypt(user.llm_api_key_encrypted);
    } catch {
      // If decryption fails (corrupted data, key rotation), fall back to the server default
      return serverDefaultClient();
    }
  }

  if (KEY_REQUIRED.has(provider) && !apiKey) {
    return serverDefaultClient();
  }

  return new AiSdkLLMClient(
    createByokModel({
      provider,
      apiKey,
      baseURL: user.llm_base_url ?? undefined,
      model: user.llm_model ?? undefined,
    }),
  );
}
