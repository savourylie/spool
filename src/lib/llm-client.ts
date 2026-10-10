/**
 * LLM client types and errors
 *
 * Request types and the error hierarchy shared by every ILLMClient
 * implementation. The implementation lives in ai-sdk-llm-client.ts.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A segment of the system prompt. When an array is passed as `systemPrompt`,
 * Anthropic-family models receive one system message per block with a
 * `cacheControl: { type: "ephemeral" }` breakpoint on any block marked
 * `cacheable: true`. Other providers receive the blocks joined into one string.
 */
export interface SystemBlock {
  text: string;
  cacheable?: boolean;
}

export interface LLMGenerateOptions {
  /** System prompt — plain string, or structured blocks for cache breakpoints */
  systemPrompt?: string | SystemBlock[];
  /** Conversation messages */
  messages: LLMMessage[];
  /** Maximum visible output tokens (default: 1024) */
  maxTokens?: number;
  /** Reasoning effort, forwarded only to models that reason */
  reasoningEffort?: "low" | "medium" | "high";
  /** Request timeout in milliseconds (default: 30s) */
  timeout?: number;
}

export interface LLMStreamOptions {
  /** System prompt — plain string, or structured blocks for cache breakpoints */
  systemPrompt?: string | SystemBlock[];
  /** Conversation messages */
  messages: LLMMessage[];
  /** Maximum visible output tokens (default: 1024) */
  maxTokens?: number;
  /** Reasoning effort, forwarded only to models that reason */
  reasoningEffort?: "low" | "medium" | "high";
  /** Request timeout in milliseconds (default: 60s) */
  timeout?: number;
}

/**
 * Flatten a SystemBlock[] into a single joined string for providers that
 * don't support structured system content.
 */
export function flattenSystemBlocks(blocks: SystemBlock[]): string {
  return blocks.map((b) => b.text).join("\n\n");
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
