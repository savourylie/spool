/**
 * Reselection Detection
 *
 * Detects old posts (>7 days) that are gaining renewed traction by comparing
 * their two most recent post_metrics snapshots. Returns posts exceeding
 * view or engagement increase thresholds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const RESELECTION_MIN_AGE_DAYS = 7;
export const RESELECTION_VIEW_INCREASE_THRESHOLD = 0.2; // 20%
export const RESELECTION_ENGAGEMENT_INCREASE_THRESHOLD = 0.5; // 50%

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReselectedPost {
  postId: string;
  textPreview: string | null;
  permalink: string | null;
  publishedAt: string;
  viewDeltaPercent: number;
  engagementDeltaPercent: number;
  /** Human-readable delta summary, e.g. "+240 views, +12 likes" */
  deltaSummary: string;
}

type MetricRow = Database["public"]["Tables"]["post_metrics"]["Row"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function totalEngagement(row: MetricRow): number {
  return (
    (row.likes ?? 0) +
    (row.replies ?? 0) +
    (row.reposts ?? 0) +
    (row.quotes ?? 0) +
    (row.shares ?? 0)
  );
}

function percentChange(previous: number, latest: number): number {
  if (previous <= 0) return 0;
  return (latest - previous) / previous;
}

function buildDeltaSummary(prev: MetricRow, latest: MetricRow): string {
  const parts: string[] = [];

  const viewDiff = (latest.views ?? 0) - (prev.views ?? 0);
  if (viewDiff > 0) parts.push(`+${viewDiff.toLocaleString()} views`);

  const likesDiff = (latest.likes ?? 0) - (prev.likes ?? 0);
  if (likesDiff > 0) parts.push(`+${likesDiff.toLocaleString()} likes`);

  const repliesDiff = (latest.replies ?? 0) - (prev.replies ?? 0);
  if (repliesDiff > 0) parts.push(`+${repliesDiff.toLocaleString()} replies`);

  const repostsDiff = (latest.reposts ?? 0) - (prev.reposts ?? 0);
  if (repostsDiff > 0) parts.push(`+${repostsDiff.toLocaleString()} reposts`);

  const quotesDiff = (latest.quotes ?? 0) - (prev.quotes ?? 0);
  if (quotesDiff > 0) parts.push(`+${quotesDiff.toLocaleString()} quotes`);

  const sharesDiff = (latest.shares ?? 0) - (prev.shares ?? 0);
  if (sharesDiff > 0) parts.push(`+${sharesDiff.toLocaleString()} shares`);

  return parts.length > 0 ? parts.join(", ") : "Metrics increased";
}

/* ------------------------------------------------------------------ */
/*  detectReselectedPosts                                              */
/* ------------------------------------------------------------------ */

export async function detectReselectedPosts(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ReselectedPost[]> {
  try {
    const cutoff = new Date(
      Date.now() - RESELECTION_MIN_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 1. Get all posts older than the minimum age
    const { data: oldPosts, error: postsError } = await supabase
      .from("posts")
      .select("id, text_preview, permalink, published_at")
      .eq("user_id", userId)
      .lt("published_at", cutoff);

    if (postsError || !oldPosts || oldPosts.length === 0) {
      return [];
    }

    const postIds = oldPosts.map((p) => p.id);

    // 2. Get all metric snapshots for those posts, newest first
    const { data: metrics, error: metricsError } = await supabase
      .from("post_metrics")
      .select("id, post_id, views, likes, replies, reposts, quotes, shares, fetched_at")
      .in("post_id", postIds)
      .order("fetched_at", { ascending: false });

    if (metricsError || !metrics) {
      return [];
    }

    // 3. Group by post_id, keep only 2 most recent snapshots per post
    const snapshotsByPost = new Map<string, MetricRow[]>();
    for (const row of metrics) {
      const existing = snapshotsByPost.get(row.post_id);
      if (!existing) {
        snapshotsByPost.set(row.post_id, [row]);
      } else if (existing.length < 2) {
        existing.push(row);
      }
    }

    // 4. Build a lookup for post metadata
    const postMap = new Map(oldPosts.map((p) => [p.id, p]));

    // 5. Check thresholds and build results
    const results: ReselectedPost[] = [];

    for (const [postId, snapshots] of snapshotsByPost) {
      if (snapshots.length < 2) continue;

      const latest = snapshots[0];
      const previous = snapshots[1];

      const viewDelta = percentChange(previous.views ?? 0, latest.views ?? 0);
      const engDelta = percentChange(
        totalEngagement(previous),
        totalEngagement(latest),
      );

      if (
        viewDelta >= RESELECTION_VIEW_INCREASE_THRESHOLD ||
        engDelta >= RESELECTION_ENGAGEMENT_INCREASE_THRESHOLD
      ) {
        const post = postMap.get(postId);
        if (!post) continue;

        results.push({
          postId,
          textPreview: post.text_preview,
          permalink: post.permalink,
          publishedAt: post.published_at,
          viewDeltaPercent: Math.round(viewDelta * 100),
          engagementDeltaPercent: Math.round(engDelta * 100),
          deltaSummary: buildDeltaSummary(previous, latest),
        });
      }
    }

    // 6. Sort by view delta descending (biggest spikes first)
    results.sort((a, b) => b.viewDeltaPercent - a.viewDeltaPercent);

    return results;
  } catch {
    // Non-critical feature — don't break the page
    return [];
  }
}
