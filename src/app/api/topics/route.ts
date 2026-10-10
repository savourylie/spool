import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import { resolveLLMClient } from "@/lib/llm-resolver";
import {
  buildFallbackTopicSuggestions,
  generateTopicSuggestions,
  MIN_POSTS_FOR_SUGGESTIONS,
  streamTopicSuggestions,
} from "@/lib/topic-suggestions";

const SSE_PADDING = " ".repeat(2048);

interface TopicInsufficientResult {
  suggestions: [];
  coreTopics: [];
  insufficient: true;
  required: number;
  available: number;
}

function buildInsufficientResult(available: number): TopicInsufficientResult {
  return {
    suggestions: [],
    coreTopics: [],
    insufficient: true,
    required: MIN_POSTS_FOR_SUGGESTIONS,
    available,
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const wantsStream = request.nextUrl.searchParams.get("stream") === "1";

  // ── Auth ────────────────────────────────────────────────────────
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch posts with text ──────────────────────────────────────
  const supabase = createAdminClient();
  const { data: rows, error: dbError } = await supabase
    .from("posts")
    .select("text_full")
    .eq("user_id", userId)
    .not("text_full", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (dbError) {
    console.error("Failed to fetch posts for topic suggestions:", dbError);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 },
    );
  }

  const posts = (rows ?? [])
    .filter((r) => r.text_full != null)
    .map((r) => ({ text: r.text_full as string }));

  if (posts.length < MIN_POSTS_FOR_SUGGESTIONS) {
    const insufficient = buildInsufficientResult(posts.length);

    if (!wantsStream) {
      return NextResponse.json(insufficient);
    }

    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: result\ndata: ${JSON.stringify(insufficient)}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      },
    );
  }

  const fallback = buildFallbackTopicSuggestions(posts);
  const fallbackResult = {
    ...fallback,
    fallback: true,
  };

  if (wantsStream) {
    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          function emitSSE(event: string, data: unknown) {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode(`: ${SSE_PADDING}\n\n`));
          }

          controller.enqueue(encoder.encode(`: ${SSE_PADDING}\n\n`));
          emitSSE("ready", { ok: true });

          try {
            const llm = await resolveLLMClient(userId);
            const result = await streamTopicSuggestions(
              posts,
              llm,
              ({ generatedTokens }) => {
                emitSSE("progress", { generatedTokens });
              },
            );

            emitSSE("result", result);
          } catch (error) {
            if (error instanceof LLMAuthError) {
              console.warn(
                "Topic suggestions falling back because the configured LLM is unavailable:",
                error,
              );
            } else {
              console.warn(
                "Topic suggestions falling back after LLM generation failed:",
                error,
              );
            }

            emitSSE("result", fallbackResult);
          } finally {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      },
    );
  }

  // ── Generate suggestions via LLM ──────────────────────────────
  try {
    const llm = await resolveLLMClient(userId);
    const result = await generateTopicSuggestions(posts, llm);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      console.warn(
        "Topic suggestions falling back because the configured LLM is unavailable:",
        error,
      );
      return NextResponse.json(fallbackResult);
    }
    console.warn(
      "Topic suggestions falling back after LLM generation failed:",
      error,
    );
    return NextResponse.json(fallbackResult);
  }
}
