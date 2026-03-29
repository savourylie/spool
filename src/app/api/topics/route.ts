import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import { resolveLLMClient } from "@/lib/llm-resolver";
import {
  generateTopicSuggestions,
  MIN_POSTS_FOR_SUGGESTIONS,
} from "@/lib/topic-suggestions";

export async function POST(request: NextRequest): Promise<Response> {
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
    return NextResponse.json({
      suggestions: [],
      coreTopics: [],
      insufficient: true,
      required: MIN_POSTS_FOR_SUGGESTIONS,
      available: posts.length,
    });
  }

  // ── Generate suggestions via LLM ──────────────────────────────
  try {
    const llm = await resolveLLMClient(userId);
    const result = await generateTopicSuggestions(posts, llm);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }
    console.error("Topic suggestion generation failed:", error);
    return NextResponse.json(
      { error: "Topic suggestion generation failed" },
      { status: 500 },
    );
  }
}
