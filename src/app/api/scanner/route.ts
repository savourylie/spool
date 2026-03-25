import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import { analyzeWithLLMStream, type UserContext } from "@/lib/quality-llm";

const MAX_TEXT_LENGTH = 2000;

export async function POST(request: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse & validate body ──────────────────────────────────────
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  // ── Fetch user context ─────────────────────────────────────────
  const supabase = createAdminClient();
  const [postsResult, tagsResult] = await Promise.all([
    supabase
      .from("posts")
      .select("text_full, published_at")
      .eq("user_id", userId)
      .not("text_full", "is", null)
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("posts")
      .select("topic_tag")
      .eq("user_id", userId)
      .not("topic_tag", "is", null),
  ]);

  const userContext: UserContext = {
    recentPosts: (postsResult.data ?? []).map((p) => ({
      text: p.text_full!,
      publishedAt: p.published_at,
    })),
    topicTags: [
      ...new Set(
        (tagsResult.data ?? [])
          .map((p) => p.topic_tag)
          .filter((t): t is string => t != null),
      ),
    ],
  };

  // ── Stream LLM analysis ────────────────────────────────────────
  try {
    const stream = analyzeWithLLMStream(text, userContext);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }
    console.error("Scanner analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 },
    );
  }
}
