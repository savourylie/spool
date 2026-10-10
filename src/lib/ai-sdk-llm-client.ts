/**
 * AI SDK LLM Client
 *
 * ILLMClient implementation over one AI SDK LanguageModel. Keeps the
 * behavior of the clients it replaced: SSE framing, Spool's LLMError
 * hierarchy, default timeouts, and the cache-usage log line.
 */

import {
  APICallError,
  LoadAPIKeyError,
  RetryError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";

import type { ILLMClient } from "@/lib/llm-provider";
import type { ModelFamily, ResolvedModel } from "@/lib/llm-models";
import {
  LLMAuthError,
  LLMError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
  flattenSystemBlocks,
  type LLMGenerateOptions,
  type LLMMessage,
  type LLMStreamOptions,
  type SystemBlock,
} from "@/lib/llm-client";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_GENERATE_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const DEFAULT_REASONING_EFFORT = "low";

/** Extra output budget for models whose thinking counts toward the limit. */
export const REASONING_TOKEN_ALLOWANCE = 4096;

// ── Error Mapping ────────────────────────────────────────────────────

function statusCodeOf(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (error && typeof error === "object" && "statusCode" in error) {
    const { statusCode } = error as { statusCode: unknown };
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return undefined;
}

function retryAfterOf(error: unknown): number | undefined {
  if (!APICallError.isInstance(error)) return undefined;
  const value = error.responseHeaders?.["retry-after"];
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function mapAiSdkError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (RetryError.isInstance(error)) return mapAiSdkError(error.lastError);

  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new LLMTimeoutError(`LLM request timed out: ${error.message}`);
  }

  const message = error instanceof Error ? error.message : String(error);
  const status = statusCodeOf(error);

  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message, retryAfterOf(error));
  if (status !== undefined && status >= 500) return new LLMServerError(message, status);
  if (status !== undefined) return new LLMError(message, status);
  if (LoadAPIKeyError.isInstance(error)) return new LLMAuthError(message);
  return new LLMError(message);
}

// ── Request Building ─────────────────────────────────────────────────

const ANTHROPIC_CACHE_BREAKPOINT = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

function toInstructions(
  systemPrompt: string | SystemBlock[] | undefined,
  family: ModelFamily,
): string | SystemModelMessage[] | undefined {
  if (systemPrompt === undefined) return undefined;
  if (typeof systemPrompt === "string") {
    return systemPrompt.length > 0 ? systemPrompt : undefined;
  }
  if (systemPrompt.length === 0) return undefined;
  if (family !== "anthropic") return flattenSystemBlocks(systemPrompt);

  return systemPrompt.map((block) => ({
    role: "system" as const,
    content: block.text,
    ...(block.cacheable ? { providerOptions: ANTHROPIC_CACHE_BREAKPOINT } : {}),
  }));
}

function toModelMessage(message: LLMMessage): ModelMessage {
  return message.role === "user"
    ? { role: "user", content: message.content }
    : { role: "assistant", content: message.content };
}

interface CallSettings {
  model: LanguageModel;
  instructions?: string | SystemModelMessage[];
  messages: ModelMessage[];
  maxOutputTokens: number;
  reasoning?: "low" | "medium" | "high";
  timeout: number;
  maxRetries: number;
}

function logUsage(kind: "generate" | "stream", usage: LanguageModelUsage | undefined): void {
  if (!usage) return;
  const details = usage.inputTokenDetails;
  console.log(
    `[llm-client:${kind}] cache_creation=${details?.cacheWriteTokens ?? 0} cache_read=${details?.cacheReadTokens ?? 0} input=${details?.noCacheTokens ?? usage.inputTokens ?? 0} output=${usage.outputTokens ?? 0}`,
  );
}

// ── Client ───────────────────────────────────────────────────────────

export class AiSdkLLMClient implements ILLMClient {
  constructor(private readonly resolved: ResolvedModel) {}

  private callSettings(
    options: LLMGenerateOptions | LLMStreamOptions,
    defaultTimeout: number,
  ): CallSettings {
    const {
      systemPrompt,
      messages,
      maxTokens = DEFAULT_MAX_TOKENS,
      reasoningEffort,
      timeout = defaultTimeout,
    } = options;
    const { model, family, alwaysReasons, acceptsReasoningEffort } = this.resolved;

    const instructions = toInstructions(systemPrompt, family);
    const reasoning = alwaysReasons
      ? (reasoningEffort ?? DEFAULT_REASONING_EFFORT)
      : acceptsReasoningEffort
        ? reasoningEffort
        : undefined;

    return {
      model,
      ...(instructions !== undefined ? { instructions } : {}),
      messages: messages.map(toModelMessage),
      maxOutputTokens: maxTokens + (alwaysReasons ? REASONING_TOKEN_ALLOWANCE : 0),
      ...(reasoning ? { reasoning } : {}),
      timeout,
      maxRetries: MAX_RETRIES,
    };
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    try {
      const result = await generateText(
        this.callSettings(options, DEFAULT_GENERATE_TIMEOUT_MS),
      );
      logUsage("generate", result.usage);
      return result.text;
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }

  // Implemented in Task 3. Plain methods (not generators) so lint's
  // require-yield rule passes while they only throw.
  generateStreamIterator(options: LLMStreamOptions): AsyncIterable<string> {
    throw new LLMError(`streaming not implemented (${options.messages.length})`);
  }

  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    throw new LLMError(`streaming not implemented (${options.messages.length})`);
  }
}
