/**
 * Velocity Scoring
 *
 * Server-side utility that computes Launch Score classifications for a batch
 * of posts. Fetches post_metrics snapshots, computes velocity ratios via the
 * pure functions in velocity-check.ts, and returns a map keyed by post ID.
 *
 * Used by the posts page to pass pre-computed velocity data to the client.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  type LaunchScore,
  type VelocitySnapshot,
  computeVelocityScore,
  classifyLaunchScore,
  getHistoricalVelocityAverage,
} from "@/lib/velocity-check";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Posts published within this many days show a velocity badge. */
export const VELOCITY_DISPLAY_WINDOW_DAYS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VelocityResult {
  score: LaunchScore;
  velocity: number;
  average: number;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compute Launch Score classifications for posts published within the display
 * window (last 3 days). Returns a map keyed by post ID.
 *
 * Posts outside the window or without sufficient snapshot data are omitted.
 */
export async function getVelocityMapForRecentPosts(
  userId: string,
  posts: Array<{ id: string; published_at: string }>,
  now: string,
): Promise<Record<string, VelocityResult>> {
  const nowMs = new Date(now).getTime();
  const cutoffMs = nowMs - VELOCITY_DISPLAY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // 1. Filter to posts within the display window
  const recentPosts = posts.filter(
    (p) => new Date(p.published_at).getTime() >= cutoffMs,
  );

  if (recentPosts.length === 0) return {};

  const recentIds = recentPosts.map((p) => p.id);

  // 2. Fetch historical baseline (single call)
  const average = await getHistoricalVelocityAverage(userId, now);

  // 3. Batch-fetch all post_metrics snapshots for qualifying posts
  const supabase = createAdminClient();
  const { data: metrics, error } = await supabase
    .from("post_metrics")
    .select("post_id, fetched_at, views, likes, replies, reposts, quotes, shares")
    .in("post_id", recentIds)
    .order("fetched_at", { ascending: true });

  if (error || !metrics) return {};

  // 4. Group snapshots by post_id
  const snapshotsByPost = new Map<string, VelocitySnapshot[]>();
  for (const row of metrics) {
    const existing = snapshotsByPost.get(row.post_id);
    const snapshot: VelocitySnapshot = {
      fetched_at: row.fetched_at ?? new Date().toISOString(),
      views: row.views ?? 0,
      likes: row.likes ?? 0,
      replies: row.replies ?? 0,
      reposts: row.reposts ?? 0,
      quotes: row.quotes ?? 0,
      shares: row.shares ?? 0,
    };
    if (existing) {
      existing.push(snapshot);
    } else {
      snapshotsByPost.set(row.post_id, [snapshot]);
    }
  }

  // 5. Build a lookup for published_at
  const publishedAtMap = new Map(recentPosts.map((p) => [p.id, p.published_at]));

  // 6. Compute velocity and classify for each post
  const result: Record<string, VelocityResult> = {};

  for (const postId of recentIds) {
    const snapshots = snapshotsByPost.get(postId);
    if (!snapshots || snapshots.length < 2) continue;

    const publishedAt = publishedAtMap.get(postId);
    if (!publishedAt) continue;

    const velocity = computeVelocityScore(snapshots, publishedAt, now);
    if (velocity === null) continue;

    const score = classifyLaunchScore(velocity, average);
    result[postId] = { score, velocity, average };
  }

  return result;
}
