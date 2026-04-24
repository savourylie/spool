import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import { resolveLLMClient } from "@/lib/llm-resolver";
import {
  analyzeWithLLMStream,
  analyzeWithLLMStreamV2,
  type UserContext,
} from "@/lib/quality-llm";
import { getActiveVoiceProfile } from "@/lib/brand-voice";
import {
  computeNeighborPosts,
  type ScannerNeighborPost,
} from "@/lib/scanner-neighbors";
import type { NeighborPost } from "@/lib/quality-scanner-shared";

const MAX_TEXT_LENGTH = 2000;
const NEIGHBOR_CANDIDATE_LIMIT = 200;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

function isV2Enabled(): boolean {
  return process.env.SCANNER_V2_ENABLED === "true";
}

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

  const v2Enabled = isV2Enabled();

  // ── Fetch user context ─────────────────────────────────────────
  const supabase = createAdminClient();
  const [postsResult, tagsResult, brandVoice, neighborPostsResult] =
    await Promise.all([
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
      // Brand voice profile (TICKET-070 — observer, any tier)
      getActiveVoiceProfile(userId),
      // Neighbor post candidates (TICKET-077 v2 only)
      v2Enabled
        ? supabase.rpc("get_posts_with_metrics", {
            p_user_id: userId,
            p_limit: NEIGHBOR_CANDIDATE_LIMIT,
            p_offset: 0,
            p_sort_column: "published_at",
            p_sort_order: "desc",
          })
        : Promise.resolve(null),
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
    brandVoice,
  };

  let neighborCandidates: NeighborPost[] = [];
  if (v2Enabled && neighborPostsResult) {
    try {
      const scannerPosts: ScannerNeighborPost[] = (
        neighborPostsResult.data ?? []
      ).map((p) => ({
        id: p.id,
        text: p.text_preview ?? "",
        publishedAt: p.published_at,
        views: p.views,
        likes: p.likes,
        replies: p.replies,
        reposts: p.reposts,
        quotes: p.quotes,
        shares: p.shares,
        permalink: p.permalink ?? null,
      }));
      neighborCandidates = computeNeighborPosts(text, scannerPosts);
    } catch (error) {
      console.error("Scanner neighbor computation failed:", error);
      neighborCandidates = [];
    }
  }

  // ── Stream LLM analysis ────────────────────────────────────────
  try {
    const llm = await resolveLLMClient(userId);
    const stream = v2Enabled
      ? analyzeWithLLMStreamV2(text, userContext, neighborCandidates, llm)
      : analyzeWithLLMStream(text, userContext, llm);
    return new Response(stream, {
      headers: SSE_HEADERS,
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
