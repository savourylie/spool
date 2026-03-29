/**
 * LLM Client Resolver
 *
 * Factory function that resolves the correct LLM client for a user
 * based on their BYOK settings. Falls back to the server-side
 * Anthropic key when no user key is configured.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { LLMClient } from "@/lib/llm-client";
import { OpenAILLMClient } from "@/lib/openai-client";
import type { ILLMClient, LLMProvider } from "@/lib/llm-provider";

/**
 * Resolve the LLM client for a given user.
 *
 * 1. Looks up the user's llm_provider, llm_api_key_encrypted, llm_base_url, and llm_model.
 * 2. If configured, decrypts the key and returns the matching client.
 * 3. Otherwise, returns a default LLMClient using the server's LLM_API_KEY.
 */
export async function resolveLLMClient(
  userId: string,
): Promise<ILLMClient> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("llm_provider, llm_api_key_encrypted, llm_base_url, llm_model")
    .eq("id", userId)
    .single();

  if (!user?.llm_provider) {
    return new LLMClient();
  }

  const provider = user.llm_provider as LLMProvider;

  // Decrypt API key if present (may be null for keyless services like Ollama)
  let apiKey: string | undefined;
  if (user.llm_api_key_encrypted) {
    try {
      apiKey = decrypt(user.llm_api_key_encrypted);
    } catch {
      // If decryption fails (corrupted data, key rotation), fall back to server key
      return new LLMClient();
    }
  }

  // Anthropic always needs a key
  if (provider === "anthropic" && !apiKey) {
    return new LLMClient();
  }

  const clientOptions = {
    ...(user.llm_base_url ? { baseURL: user.llm_base_url } : {}),
    ...(user.llm_model ? { defaultModel: user.llm_model } : {}),
  };

  switch (provider) {
    case "anthropic":
      return new LLMClient(apiKey, clientOptions);
    case "openai":
      return new OpenAILLMClient(apiKey, clientOptions);
    default:
      return new LLMClient();
  }
}
