/**
 * LLM Provider Abstraction
 *
 * Shared interface for all LLM providers (Anthropic, OpenAI).
 * Enables BYOK (Bring Your Own Key) multi-provider support.
 */

import type { LLMGenerateOptions, LLMStreamOptions } from "@/lib/llm-client";

// ── Types ────────────────────────────────────────────────────────────

export type LLMProvider = "anthropic" | "openai";

export const PROVIDER_DEFAULTS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};

// ── Interface ────────────────────────────────────────────────────────

export interface ILLMClient {
  /** Generate a full completion. Awaits the entire response before returning. */
  generate(options: LLMGenerateOptions): Promise<string>;

  /** Generate a streaming completion as an SSE-formatted ReadableStream. */
  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array>;

  /**
   * Generate a streaming completion as an async iterable of raw text chunks.
   * Use this when you need custom SSE framing (e.g. the compose route).
   */
  generateStreamIterator(options: LLMStreamOptions): AsyncIterable<string>;
}
