/**
 * OpenAI LLM Client
 *
 * ILLMClient implementation backed by the OpenAI API.
 * Used when a user has configured OpenAI as their BYOK provider.
 */

import OpenAI from "openai";
import type { APIError } from "openai";

import type { ILLMClient } from "@/lib/llm-provider";
import { PROVIDER_DEFAULTS } from "@/lib/llm-provider";
import type { LLMGenerateOptions, LLMStreamOptions } from "@/lib/llm-client";
import {
  LLMError,
  LLMAuthError,
  LLMRateLimitError,
  LLMServerError,
  LLMTimeoutError,
} from "@/lib/llm-client";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_MODEL = PROVIDER_DEFAULTS.openai;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_GENERATE_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;

// ── Error Mapping ────────────────────────────────────────────────────

function mapOpenAIError(error: unknown): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as APIError).status === "number"
  ) {
    const apiError = error as APIError;
    const message =
      apiError.message ?? `OpenAI API error (status ${apiError.status})`;

    const status = apiError.status;
    if (status === 401) {
      return new LLMAuthError(message);
    }
    if (status === 429) {
      return new LLMRateLimitError(message);
    }
    if (status !== undefined && status >= 500) {
      return new LLMServerError(message, status);
    }
    return new LLMError(message, status);
  }

  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.message.includes("timed out") ||
      error.message.includes("timeout")
    ) {
      return new LLMTimeoutError(
        `OpenAI request timed out: ${error.message}`,
      );
    }
    return new LLMError(error.message);
  }

  return new LLMError(String(error));
}

// ── Client ───────────────────────────────────────────────────────────

export class OpenAILLMClient implements ILLMClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey?: string, options?: { baseURL?: string; defaultModel?: string }) {
    this.client = new OpenAI({
      apiKey: apiKey || "ollama",
      ...(options?.baseURL ? { baseURL: options.baseURL } : {}),
    });
    this.defaultModel = options?.defaultModel || DEFAULT_MODEL;
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const {
      systemPrompt,
      messages,
      model = this.defaultModel,
      maxTokens = DEFAULT_MAX_TOKENS,
      timeout = DEFAULT_GENERATE_TIMEOUT_MS,
    } = options;

    try {
      const response = await this.client.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          messages: [
            ...(systemPrompt
              ? [{ role: "system" as const, content: systemPrompt }]
              : []),
            ...messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        },
        { timeout },
      );

      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  async *generateStreamIterator(
    options: LLMStreamOptions,
  ): AsyncIterable<string> {
    const {
      systemPrompt,
      messages,
      model = this.defaultModel,
      maxTokens = DEFAULT_MAX_TOKENS,
      timeout = DEFAULT_STREAM_TIMEOUT_MS,
    } = options;

    try {
      const stream = await this.client.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          stream: true,
          messages: [
            ...(systemPrompt
              ? [{ role: "system" as const, content: systemPrompt }]
              : []),
            ...messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        },
        { timeout },
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  generateStream(options: LLMStreamOptions): ReadableStream<Uint8Array> {
    const iterator = this.generateStreamIterator(options);
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const text of iterator) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(text)}\n\n`),
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const mapped =
            error instanceof LLMError ? error : mapOpenAIError(error);
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
