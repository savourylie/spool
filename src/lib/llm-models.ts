/**
 * Model resolution for the AI SDK provider layer.
 *
 * Describes what each model needs from the adapter: whether Anthropic cache
 * breakpoints apply, whether thinking is always on (and so consumes output
 * tokens), and whether a caller's reasoning effort may be forwarded.
 */

import type { LanguageModel } from "ai";

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
