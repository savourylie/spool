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
  streamText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";

import type { ILLMClient } from "@/lib/llm-provider";
import { REQUEST_TIMEOUT_HEADER } from "@/lib/llm-fetch";
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

// generateText rewraps AI Gateway auth failures without a status code: an
// Error named "GatewayAuthenticationError" (with ANSI-colored text) outside
// production, an AISDKError named "GatewayError" in production.
const GATEWAY_AUTH_ERROR_NAMES = new Set(["GatewayAuthenticationError", "GatewayError"]);
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function mapAiSdkError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (RetryError.isInstance(error)) return mapAiSdkError(error.lastError);

  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new LLMTimeoutError(`LLM request timed out: ${error.message}`);
  }

  if (error instanceof Error && GATEWAY_AUTH_ERROR_NAMES.has(error.name)) {
    return new LLMAuthError(error.message.replace(ANSI_ESCAPE, "").trim());
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

// @ai-sdk/openai asks for a "detailed" reasoning summary whenever an effort is
// set. Spool only reads the answer text, so don't pay for (or need
// verification for) summaries.
const OPENAI_NO_REASONING_SUMMARY = { openai: { reasoningSummary: null } };

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
  providerOptions?: typeof OPENAI_NO_REASONING_SUMMARY;
  /** Carries the per-attempt timeout to timeoutFetch (see llm-fetch.ts). */
  headers: Record<string, string>;
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
    const { model, family, alwaysReasons, acceptsReasoningEffort, reservesReasoningTokens } =
      this.resolved;

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
      maxOutputTokens: maxTokens + (reservesReasoningTokens ? REASONING_TOKEN_ALLOWANCE : 0),
      ...(reasoning ? { reasoning } : {}),
      ...(family === "openai" ? { providerOptions: OPENAI_NO_REASONING_SUMMARY } : {}),
      // Not AI SDK's `timeout`, which caps the whole call (streaming and retries
      // included). The old SDKs bounded each attempt until its response started.
      headers: { [REQUEST_TIMEOUT_HEADER]: String(timeout) },
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

  /**
   * Streams raw text chunks. Reads the full event stream because
   * `textStream` swallows provider errors (it ends empty or partial).
   */
  async *generateStreamIterator(options: LLMStreamOptions): AsyncIterable<string> {
    try {
      const result = streamText({
        ...this.callSettings(options, DEFAULT_STREAM_TIMEOUT_MS),
        onError: () => {},
      });

      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          yield part.text;
        } else if (part.type === "error") {
          throw mapAiSdkError(part.error);
        } else if (part.type === "abort") {
          throw new LLMTimeoutError(
            `LLM request timed out: ${String(part.reason ?? "stream aborted")}`,
          );
        } else if (part.type === "finish") {
          logUsage("stream", part.totalUsage);
        }
      }
    } catch (error) {
      throw mapAiSdkError(error);
    }
  }

  /**
   * Streams SSE frames: one JSON-encoded text chunk per frame, then [DONE],
   * or a final {"error": message} frame on failure.
   */
  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    const iterator = this.generateStreamIterator(options);
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const text of iterator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const mapped = mapAiSdkError(error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: mapped.message })}\n\n`),
          );
          controller.close();
        }
      },
    });
  }
}
