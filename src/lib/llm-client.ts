/**
 * LLM Client Infrastructure
 *
 * Shared Claude API abstraction for all Phase 3 AI features.
 * Provides typed generate() and generateStream() methods with
 * structured error handling for rate limits, auth, server, and timeout errors.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { APIError } from "@anthropic-ai/sdk";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_GENERATE_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;

// ── Types ────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMGenerateOptions {
  /** System prompt providing context and instructions */
  systemPrompt?: string;
  /** Conversation messages */
  messages: LLMMessage[];
  /** Model override (default: claude-sonnet-4-6) */
  model?: string;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 30s) */
  timeout?: number;
}

export interface LLMStreamOptions {
  /** System prompt providing context and instructions */
  systemPrompt?: string;
  /** Conversation messages */
  messages: LLMMessage[];
  /** Model override (default: claude-sonnet-4-6) */
  model?: string;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60s) */
  timeout?: number;
}

// ── Error Classes ────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message, 429);
    this.name = "LLMRateLimitError";
  }
}

export class LLMAuthError extends LLMError {
  constructor(message: string) {
    super(message, 401);
    this.name = "LLMAuthError";
  }
}

export class LLMServerError extends LLMError {
  constructor(message: string, status?: number) {
    super(message, status ?? 500);
    this.name = "LLMServerError";
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message, 408);
    this.name = "LLMTimeoutError";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapSDKError(error: unknown): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  // Handle Anthropic SDK APIError
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as APIError).status === "number"
  ) {
    const apiError = error as APIError;
    const message =
      apiError.message ?? `LLM API error (status ${apiError.status})`;

    const status = apiError.status;
    if (status === 401) {
      return new LLMAuthError(message);
    }
    if (status === 429) {
      const retryAfter = parseRetryAfter(apiError);
      return new LLMRateLimitError(message, retryAfter);
    }
    if (status !== undefined && status >= 500) {
      return new LLMServerError(message, status);
    }
    return new LLMError(message, status);
  }

  // Handle abort/timeout
  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.message.includes("timed out") ||
      error.message.includes("timeout")
    ) {
      return new LLMTimeoutError(
        `LLM request timed out: ${error.message}`,
      );
    }
    return new LLMError(error.message);
  }

  return new LLMError(String(error));
}

function parseRetryAfter(error: APIError): number | undefined {
  const headers = error.headers;
  if (!headers) return undefined;
  const value =
    typeof headers.get === "function" ? headers.get("retry-after") : null;
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

// ── Client ───────────────────────────────────────────────────────────

export class LLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.LLM_API_KEY;
    if (!key) {
      throw new LLMAuthError(
        "LLM_API_KEY is not set. Provide it via environment variable or constructor argument.",
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  /**
   * Generate a full completion. Awaits the entire response before returning.
   */
  async generate(options: LLMGenerateOptions): Promise<string> {
    const {
      systemPrompt,
      messages,
      model = DEFAULT_MODEL,
      maxTokens = DEFAULT_MAX_TOKENS,
      timeout = DEFAULT_GENERATE_TIMEOUT_MS,
    } = options;

    try {
      const response = await this.client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        { timeout },
      );

      const textBlock = response.content.find(
        (block) => block.type === "text",
      );
      return textBlock?.text ?? "";
    } catch (error) {
      throw mapSDKError(error);
    }
  }

  /**
   * Generate a streaming completion. Returns a ReadableStream of text chunks
   * suitable for SSE delivery to the client via `new Response(stream)`.
   */
  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    const {
      systemPrompt,
      messages,
      model = DEFAULT_MODEL,
      maxTokens = DEFAULT_MAX_TOKENS,
      timeout = DEFAULT_STREAM_TIMEOUT_MS,
    } = options;

    const client = this.client;
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const stream = client.messages.stream(
            {
              model,
              max_tokens: maxTokens,
              ...(systemPrompt ? { system: systemPrompt } : {}),
              messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
            { timeout },
          );

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event.delta.text)}\n\n`),
              );
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const mapped = mapSDKError(error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: mapped.message })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });
  }
}
