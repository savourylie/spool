/**
 * Latest Review fetcher (TICKET-076)
 *
 * Reads the most recent reviewed `post_predictions` row for a user and
 * shapes it for the Today Hub "Latest Review" card — band verdict derived
 * from the stored actuals, post excerpt joined from `posts`, and the
 * key learning pulled from the first sentence of the narrative
 * (contract enforced by `src/lib/prompts/review-narrative.md`).
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  classifyBand,
  firstSentence,
  type BandVerdict,
  type PredictionRanges,
  type WindowedMetrics,
} from "@/lib/review-sweep";

export interface LatestReviewData {
  predictionId: string;
  postId: string | null;
  permalink: string | null;
  textPreview: string;
  mediaType: string | null;
  publishedAt: string | null;
  reviewedAt: string;
  verdict: BandVerdict;
  ranges: PredictionRanges;
  actual: WindowedMetrics;
  narrative: string;
  keyLearning: string;
  matchedCount: number;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function normalizeRanges(raw: unknown): PredictionRanges | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p25 = Number(r.p25);
  const p50 = Number(r.p50);
  const p75 = Number(r.p75);
  if (!Number.isFinite(p25) || !Number.isFinite(p50) || !Number.isFinite(p75)) {
    return null;
  }
  const matchedCount = Number(r.matchedCount);
  const confidenceRaw = typeof r.confidence === "string" ? r.confidence : "low";
  const confidence: PredictionRanges["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low";
  return {
    p25,
    p50,
    p75,
    matchedCount: Number.isFinite(matchedCount) ? matchedCount : 0,
    confidence,
  };
}

function normalizeActuals(raw: unknown): WindowedMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const views = Number(r.views);
  if (!Number.isFinite(views)) return null;
  const sourceRaw = typeof r.source === "string" ? r.source : "none";
  const source: WindowedMetrics["source"] =
    sourceRaw === "windowed_24h" || sourceRaw === "latest" ? sourceRaw : "none";
  return {
    views,
    likes: Number(r.likes) || 0,
    replies: Number(r.replies) || 0,
    reposts: Number(r.reposts) || 0,
    quotes: Number(r.quotes) || 0,
    shares: Number(r.shares) || 0,
    fetched_at: typeof r.fetched_at === "string" ? r.fetched_at : null,
    source,
  };
}

export async function getLatestReview(
  supabase: SupabaseAdmin,
  userId: string,
): Promise<LatestReviewData | null> {
  const { data, error } = await supabase
    .from("post_predictions")
    .select(
      "id, post_id, draft_text, ranges, actual_windowed_metrics, narrative, reviewed_at, posts!post_predictions_post_id_fkey(text_preview, permalink, media_type, published_at)",
    )
    .eq("user_id", userId)
    .eq("review_state", "reviewed")
    .not("narrative", "is", null)
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[latest-review] query failed:", error);
    return null;
  }
  if (!data) return null;

  const ranges = normalizeRanges(data.ranges);
  const actual = normalizeActuals(data.actual_windowed_metrics);
  if (!ranges || !actual || !data.narrative || !data.reviewed_at) {
    return null;
  }

  const joinedPost = (data.posts ?? null) as
    | { text_preview: string | null; permalink: string | null; media_type: string | null; published_at: string | null }
    | null;

  const textPreview =
    joinedPost?.text_preview?.trim() ||
    data.draft_text?.trim() ||
    "";

  return {
    predictionId: data.id,
    postId: data.post_id,
    permalink: joinedPost?.permalink ?? null,
    textPreview,
    mediaType: joinedPost?.media_type ?? null,
    publishedAt: joinedPost?.published_at ?? null,
    reviewedAt: data.reviewed_at,
    verdict: classifyBand(actual.views, ranges),
    ranges,
    actual,
    narrative: data.narrative,
    keyLearning: firstSentence(data.narrative),
    matchedCount: ranges.matchedCount,
  };
}
