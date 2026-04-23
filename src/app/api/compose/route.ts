import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveLLMClient } from "@/lib/llm-resolver";
import {
  buildComposerPrompt,
  parseComposerResponse,
  type ComposerUserContext,
  type ComposerTopPost,
} from "@/lib/composer-prompt";
import { getActiveVoiceProfile } from "@/lib/brand-voice";
import { computeNormalizedWES } from "@/lib/weighted-engagement";

const MAX_TOPIC_LENGTH = 500;
const MAX_TOKENS = 2048;
const STREAM_TIMEOUT_MS = 60_000;

export async function POST(request: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse & validate body ──────────────────────────────────────
  let body: { topic?: string; style?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json(
      { error: "Topic is required" },
      { status: 400 },
    );
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json(
      { error: `Topic exceeds maximum length of ${MAX_TOPIC_LENGTH} characters` },
      { status: 400 },
    );
  }

  const style =
    typeof body.style === "string" ? body.style.trim() || undefined : undefined;

  // ── Fetch user context ─────────────────────────────────────────
  const supabase = createAdminClient();

  const [
    metricsResult,
    postsResult,
    demographicsResult,
    tagsResult,
    statsResult,
    brandVoice,
  ] = await Promise.all([
    // Top posts with metrics (for WES ranking)
    supabase.rpc("get_posts_with_metrics", {
      p_user_id: userId,
      p_sort_column: "views",
      p_sort_order: "desc",
      p_limit: 50,
      p_offset: 0,
    }),
    // Full text for top posts (RPC only returns text_preview)
    supabase
      .from("posts")
      .select("id, text_full")
      .eq("user_id", userId)
      .not("text_full", "is", null),
    // Audience demographics
    supabase
      .from("demographics")
      .select("dimension, key, value")
      .eq("user_id", userId),
    // Recent topic tags
    supabase
      .from("posts")
      .select("topic_tag")
      .eq("user_id", userId)
      .not("topic_tag", "is", null)
      .order("published_at", { ascending: false })
      .limit(30),
    // Latest follower count + last post timestamp
    supabase
      .from("daily_stats")
      .select("followers_count")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1),
    // Brand voice profile (TICKET-070 — driver when usable+)
    getActiveVoiceProfile(userId),
  ]);

  // Build text lookup for full post text
  const textLookup = new Map(
    (postsResult.data ?? [])
      .filter((p) => p.text_full)
      .map((p) => [p.id, p.text_full!]),
  );

  // Rank posts by WES, take top 10
  const metricsRows = metricsResult.data ?? [];
  const rankedPosts: (typeof metricsRows[number] & { wes: number })[] =
    metricsRows.map((row) => ({
      ...row,
      wes: computeNormalizedWES({
        views: Number(row.views),
        likes: Number(row.likes),
        replies: Number(row.replies),
        reposts: Number(row.reposts),
        quotes: Number(row.quotes),
        shares: Number(row.shares),
      }),
    }));
  rankedPosts.sort((a, b) => b.wes - a.wes);

  const topPosts: ComposerTopPost[] = rankedPosts.slice(0, 10).map((row) => ({
    text: textLookup.get(row.id) ?? row.text_preview ?? "",
    views: Number(row.views),
    likes: Number(row.likes),
    replies: Number(row.replies),
    reposts: Number(row.reposts),
    quotes: Number(row.quotes),
    shares: Number(row.shares),
    wes: row.wes,
  }));

  // Deduplicate topic tags
  const topicTags = [
    ...new Set(
      (tagsResult.data ?? [])
        .map((p) => p.topic_tag)
        .filter((t): t is string => t != null),
    ),
  ];

  // Compute cadence from last post
  const lastPostRow = rankedPosts.length > 0
    ? metricsRows.reduce((latest, row) =>
        new Date(row.published_at) > new Date(latest.published_at)
          ? row
          : latest,
      )
    : null;

  // Simple average gap from recent posts (sorted by date)
  const sortedByDate = [...metricsRows].sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
  let avgGapHours = 24; // default
  if (sortedByDate.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(sortedByDate.length - 1, 30); i++) {
      const gap =
        (new Date(sortedByDate[i].published_at).getTime() -
          new Date(sortedByDate[i + 1].published_at).getTime()) /
        (1000 * 60 * 60);
      gaps.push(gap);
    }
    avgGapHours = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  }

  const userContext: ComposerUserContext = {
    topPosts,
    demographics: (demographicsResult.data ?? []).map((d) => ({
      dimension: d.dimension,
      key: d.key,
      value: d.value,
    })),
    topicTags,
    cadence: {
      lastPostAt: lastPostRow?.published_at ?? null,
      avgGapHours,
      recommendedWaitHours: Math.max(18, avgGapHours),
    },
    followerCount:
      (statsResult.data ?? [])[0]?.followers_count ?? 0,
    brandVoice,
  };

  // ── Build prompt ───────────────────────────────────────────────
  const { systemPrompt, userMessage } = buildComposerPrompt({
    topic,
    style,
    userContext,
  });

  // ── Stream LLM response with custom SSE events ─────────────────
  const llm = await resolveLLMClient(userId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emitSSE(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const textStream = llm.generateStreamIterator({
          systemPrompt,
          messages: [{ role: "user", content: userMessage }],
          maxTokens: MAX_TOKENS,
          timeout: STREAM_TIMEOUT_MS,
        });

        let accumulated = "";
        let currentDraft = -1;
        let delimiterCount = 0;

        for await (const text of textStream) {
          accumulated += text;

          // Detect new draft sections by counting --- delimiters
          const newDelimiterCount = (
            accumulated.match(/\n---\n/g) || []
          ).length;

          // First draft: emit draft_start when we have content
          if (currentDraft === -1 && accumulated.trim().length > 0) {
            currentDraft = 0;
            const triggerMatch = accumulated.match(
              /\[TRIGGER:\s*([^\]]+)\]/,
            );
            emitSSE("draft_start", {
              index: 0,
              shareTrigger: triggerMatch ? triggerMatch[1].trim() : null,
            });
          }

          // New delimiter found — new draft starting
          if (newDelimiterCount > delimiterCount) {
            delimiterCount = newDelimiterCount;
            currentDraft = delimiterCount;

            // Try to extract trigger for new section
            const sections = accumulated.split(/\n---\n/);
            const lastSection = sections[sections.length - 1];
            const triggerMatch = lastSection.match(
              /\[TRIGGER:\s*([^\]]+)\]/,
            );
            emitSSE("draft_start", {
              index: currentDraft,
              shareTrigger: triggerMatch ? triggerMatch[1].trim() : null,
            });
          }

          // Forward text chunk
          if (currentDraft >= 0) {
            emitSSE("draft_text", { index: currentDraft, text });
          }
        }

        // ── Stream complete — parse and save to DB ───────────────
        const drafts = parseComposerResponse(accumulated);

        if (drafts.length > 0) {
          const insertRows = drafts.map((draft) => ({
            user_id: userId,
            topic,
            content: draft.content,
            share_trigger: draft.shareTrigger,
          }));

          const { data: savedDrafts, error: saveError } = await supabase
            .from("drafts")
            .insert(insertRows)
            .select("id");

          if (saveError) {
            console.error("Failed to save drafts:", saveError);
            emitSSE("error", { message: "Failed to save drafts" });
          } else {
            const savedIds = (savedDrafts ?? []).map((d) => d.id);
            for (let i = 0; i < drafts.length; i++) {
              emitSSE("draft_end", {
                index: i,
                draftId: savedIds[i] ?? null,
                shareTrigger: drafts[i].shareTrigger,
                content: drafts[i].content,
              });
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Composition failed";
        console.error("Compose stream failed:", error);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
