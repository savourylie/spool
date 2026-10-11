/**
 * Model resolution for the AI SDK provider layer.
 *
 * Describes what each model needs from the adapter: whether Anthropic cache
 * breakpoints apply, whether thinking is always on (and so consumes output
 * tokens), and whether a caller's reasoning effort may be forwarded.
 */

import { createGateway, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";

import { LLMAuthError } from "@/lib/llm-client";
import { timeoutFetch } from "@/lib/llm-fetch";
import { PROVIDER_DEFAULTS, type LLMProvider } from "@/lib/llm-provider";

export type ModelFamily =
  | "anthropic"
  | "openai"
  | "xai"
  | "openai-compatible"
  | "other";

export interface ModelCapabilities {
  family: ModelFamily;
  /** Thinking cannot be switched off and counts toward maxOutputTokens. */
  alwaysReasons: boolean;
  /** Whether a caller-supplied reasoningEffort is forwarded to the model. */
  acceptsReasoningEffort: boolean;
}

export interface ResolvedModel extends ModelCapabilities {
  model: LanguageModel;
}

// Matches both direct IDs (claude-sonnet-5-5) and Gateway IDs (claude-sonnet-5.5).
const ANTHROPIC_ALWAYS_REASONS = /^claude-(?:(?:opus|sonnet|haiku)-5|fable)/;
const OPENAI_ALWAYS_REASONS = /^(?:gpt-5|gpt-6|o\d)/;
const XAI_ALWAYS_REASONS = /^grok-(?:[4-9]|3-mini)/;

function alwaysReasons(family: ModelFamily, modelId: string): boolean {
  switch (family) {
    case "anthropic":
      return ANTHROPIC_ALWAYS_REASONS.test(modelId);
    case "openai":
      return OPENAI_ALWAYS_REASONS.test(modelId);
    case "xai":
      return (
        XAI_ALWAYS_REASONS.test(modelId) && !modelId.includes("non-reasoning")
      );
    default:
      return false;
  }
}

export function describeModel(
  family: ModelFamily,
  modelId: string,
  baseURL?: string,
): ModelCapabilities {
  const reasons = alwaysReasons(family, modelId);
  const acceptsReasoningEffort =
    family === "openai-compatible"
      ? (baseURL ?? "").toLowerCase().includes("inceptionlabs.ai") ||
        modelId.toLowerCase().startsWith("mercury")
      : reasons;

  return { family, alwaysReasons: reasons, acceptsReasoningEffort };
}

const GATEWAY_FAMILIES: Record<string, ModelFamily> = {
  anthropic: "anthropic",
  openai: "openai",
  spacexai: "xai",
  xai: "xai",
};

/**
 * Server default, for users without their own key.
 *
 * SPOOL_DEFAULT_MODEL routes it through AI Gateway (auth via AI_GATEWAY_API_KEY,
 * or Vercel OIDC on deployments). Otherwise LLM_PROVIDER, LLM_API_KEY,
 * LLM_BASE_URL and LLM_MODEL describe it exactly like a BYOK setting:
 * `openai` plus a base URL is an OpenAI-compatible server such as DashScope or
 * Ollama. With only LLM_API_KEY set, it calls Anthropic, as before.
 */
export function resolveServerDefaultModel(
  env: Record<string, string | undefined> = process.env,
): ResolvedModel {
  const gatewayModel = env.SPOOL_DEFAULT_MODEL?.trim();
  if (gatewayModel) {
    const slash = gatewayModel.indexOf("/");
    const prefix = slash > 0 ? gatewayModel.slice(0, slash) : "";
    const modelId = slash > 0 ? gatewayModel.slice(slash + 1) : gatewayModel;
    return {
      model: createGateway({ fetch: timeoutFetch })(gatewayModel),
      ...describeModel(GATEWAY_FAMILIES[prefix] ?? "other", modelId),
    };
  }

  const provider = env.LLM_PROVIDER?.trim().toLowerCase() || "anthropic";
  if (!isLLMProvider(provider)) {
    throw new LLMAuthError(
      `LLM_PROVIDER must be anthropic, openai, or xai (got "${env.LLM_PROVIDER}").`,
    );
  }

  const apiKey = env.LLM_API_KEY?.trim() || undefined;
  const baseURL = env.LLM_BASE_URL?.trim() || undefined;
  const model = env.LLM_MODEL?.trim() || undefined;
  const compatibleServer =
    provider === "openai" && baseURL !== undefined && !isOfficialOpenAIURL(baseURL);

  // Keyless servers (Ollama, LM Studio) only make sense behind a custom base URL.
  if (!apiKey && !compatibleServer) {
    throw new LLMAuthError(
      "LLM_API_KEY is not set. Set it (plus LLM_PROVIDER, LLM_BASE_URL and LLM_MODEL as needed), or set SPOOL_DEFAULT_MODEL to route the server default through AI Gateway.",
    );
  }
  if (compatibleServer && !model) {
    throw new LLMAuthError(
      "LLM_MODEL is required when LLM_BASE_URL points at an OpenAI-compatible server.",
    );
  }

  return createByokModel({ provider, apiKey, baseURL, model });
}

// A Set, not `in`, so inherited names like "constructor" are not providers.
const LLM_PROVIDERS = new Set<string>(Object.keys(PROVIDER_DEFAULTS));

function isLLMProvider(value: string): value is LLMProvider {
  return LLM_PROVIDERS.has(value);
}

export interface ByokModelInput {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

/**
 * Saved Anthropic base URLs predate the AI SDK: the old SDK posted to
 * `${baseURL}/v1/messages`, while @ai-sdk/anthropic posts to `${baseURL}/messages`.
 */
function anthropicBaseURL(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

/** The settings form shows OpenAI's own URL as the base URL placeholder. */
function isOfficialOpenAIURL(baseURL: string): boolean {
  try {
    return new URL(baseURL).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

/** A user's bring-your-own-key model, called directly at the provider. */
export function createByokModel({
  provider,
  apiKey,
  baseURL,
  model,
}: ByokModelInput): ResolvedModel {
  const modelId = model ?? PROVIDER_DEFAULTS[provider];
  // An undefined key makes the provider read the server's own env key
  // (ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY). An empty one gets a 401.
  const userKey = apiKey ?? "";

  switch (provider) {
    case "anthropic":
      return {
        model: createAnthropic({
          apiKey: userKey,
          fetch: timeoutFetch,
          ...(baseURL ? { baseURL: anthropicBaseURL(baseURL) } : {}),
        })(modelId),
        ...describeModel("anthropic", modelId),
      };
    case "xai":
      return {
        model: createXai({
          apiKey: userKey,
          fetch: timeoutFetch,
          ...(baseURL ? { baseURL } : {}),
        })(modelId),
        ...describeModel("xai", modelId),
      };
    case "openai":
      if (baseURL && !isOfficialOpenAIURL(baseURL)) {
        return {
          model: createOpenAICompatible({
            name: "openai-compatible",
            baseURL,
            fetch: timeoutFetch,
            ...(apiKey ? { apiKey } : {}),
          }).chatModel(modelId),
          ...describeModel("openai-compatible", modelId, baseURL),
        };
      }
      return {
        model: createOpenAI({ apiKey: userKey, fetch: timeoutFetch })(modelId),
        ...describeModel("openai", modelId),
      };
  }
}
