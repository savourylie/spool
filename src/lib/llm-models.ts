/**
 * Model resolution for the AI SDK provider layer.
 *
 * Describes what each model needs from the adapter: whether Anthropic cache
 * breakpoints apply, whether thinking is always on (and so consumes output
 * tokens), and whether a caller's reasoning effort may be forwarded.
 */

import { gateway, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";

import { LLMAuthError } from "@/lib/llm-client";
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
 * Server default. SPOOL_DEFAULT_MODEL switches it onto AI Gateway (auth via
 * AI_GATEWAY_API_KEY, or Vercel OIDC on deployments). Without it, Spool calls
 * Anthropic directly with LLM_API_KEY, as before.
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
      model: gateway(gatewayModel),
      ...describeModel(GATEWAY_FAMILIES[prefix] ?? "other", modelId),
    };
  }

  const apiKey = env.LLM_API_KEY;
  if (!apiKey) {
    throw new LLMAuthError(
      "LLM_API_KEY is not set. Set it, or set SPOOL_DEFAULT_MODEL to route the server default through AI Gateway.",
    );
  }

  const modelId = PROVIDER_DEFAULTS.anthropic;
  return {
    model: createAnthropic({ apiKey })(modelId),
    ...describeModel("anthropic", modelId),
  };
}

export interface ByokModelInput {
  provider: LLMProvider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
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
        model: createAnthropic({ apiKey: userKey, ...(baseURL ? { baseURL } : {}) })(modelId),
        ...describeModel("anthropic", modelId),
      };
    case "xai":
      return {
        model: createXai({ apiKey: userKey, ...(baseURL ? { baseURL } : {}) })(modelId),
        ...describeModel("xai", modelId),
      };
    case "openai":
      if (baseURL) {
        return {
          model: createOpenAICompatible({
            name: "openai-compatible",
            baseURL,
            ...(apiKey ? { apiKey } : {}),
          }).chatModel(modelId),
          ...describeModel("openai-compatible", modelId, baseURL),
        };
      }
      return {
        model: createOpenAI({ apiKey: userKey })(modelId),
        ...describeModel("openai", modelId),
      };
  }
}
