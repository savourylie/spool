/**
 * Velocity Check
 *
 * Infrastructure for first-3-hour engagement velocity tracking.
 * The Threads algorithm disproportionately weights early engagement signals,
 * so capturing frequent metric snapshots for recently-published posts lets us
 * classify a post's "Launch Score" relative to the user's historical baseline.
 *
 * Pure computation functions accept typed arrays and a `now` ISO string.
 * DB-access service functions use createAdminClient() internally.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VELOCITY_WINDOW_MINUTES_EARLY = 30; // early snapshot window (minutes)
export const VELOCITY_WINDOW_HOURS_LATE = 3; // late snapshot window (hours)
export const VELOCITY_YELLOW_THRESHOLD = 0.8; // ≥80% of average = yellow, <80% = red
export const VELOCITY_RECENT_POST_HOURS = 3; // posts published within N hours are "recent"

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface VelocitySnapshot {
  fetched_at: string; // ISO 8601
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface VelocityPost {
  id: string; // internal UUID
  threads_media_id: string;
  published_at: string; // ISO 8601
}

export type LaunchScore = "green" | "yellow" | "red";

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

/**
 * Total non-view engagement for a snapshot.
 */
export function computeEngagement(snapshot: VelocitySnapshot): number {
  return (
    snapshot.likes +
    snapshot.replies +
    snapshot.reposts +
    snapshot.quotes +
    snapshot.shares
  );
}

// ---------------------------------------------------------------------------
// Pure computation functions
// ---------------------------------------------------------------------------

/**
 * Compute the velocity ratio for a single post given its metric snapshots.
 *
 * Finds the snapshot closest to `VELOCITY_WINDOW_MINUTES_EARLY` minutes after
 * publish (early signal) and the snapshot closest to `VELOCITY_WINDOW_HOURS_LATE`
 * hours after publish (late signal), then returns late / early.
 *
 * Returns null when there are fewer than two snapshots or when the early
 * engagement is zero (division by zero would be meaningless).
 */
export function computeVelocityScore(
  snapshots: VelocitySnapshot[],
  publishedAt: string,
  now: string,
): number | null {
  if (snapshots.length < 2) return null;

  const publishMs = new Date(publishedAt).getTime();
  const nowMs = new Date(now).getTime();

  const earlyTargetMs = publishMs + VELOCITY_WINDOW_MINUTES_EARLY * 60 * 1000;
  const lateTargetMs = publishMs + VELOCITY_WINDOW_HOURS_LATE * 60 * 60 * 1000;

  // Only use snapshots that have actually been captured (not in the future)
  const captured = snapshots.filter(
    (s) => new Date(s.fetched_at).getTime() <= nowMs,
  );
  if (captured.length < 2) return null;

  function closest(targetMs: number): VelocitySnapshot | null {
    let best: VelocitySnapshot | null = null;
    let bestDiff = Infinity;
    for (const s of captured) {
      const diff = Math.abs(new Date(s.fetched_at).getTime() - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = s;
      }
    }
    return best;
  }

  const earlySnap = closest(earlyTargetMs);
  const lateSnap = closest(lateTargetMs);

  if (!earlySnap || !lateSnap || earlySnap === lateSnap) return null;

  const earlyEngagement = computeEngagement(earlySnap);
  if (earlyEngagement === 0) return null;

  return computeEngagement(lateSnap) / earlyEngagement;
}

/**
 * Classify a Launch Score from a velocity ratio and the user's historical average.
 *
 * - green  → velocityRatio > historicalAverage
 * - yellow → velocityRatio ≥ historicalAverage * VELOCITY_YELLOW_THRESHOLD (within 20%)
 * - red    → below yellow threshold
 */
export function classifyLaunchScore(
  velocityRatio: number,
  historicalAverage: number,
): LaunchScore {
  if (historicalAverage <= 0) {
    // No baseline yet — treat any positive velocity as green
    return velocityRatio > 0 ? "green" : "yellow";
  }

  if (velocityRatio > historicalAverage) return "green";
  if (velocityRatio >= historicalAverage * VELOCITY_YELLOW_THRESHOLD)
    return "yellow";
  return "red";
}

// ---------------------------------------------------------------------------
// DB-access service functions
// ---------------------------------------------------------------------------

/**
 * Find posts for `userId` published within the last `VELOCITY_RECENT_POST_HOURS` hours.
 */
export async function getRecentPosts(
  userId: string,
  now: string,
): Promise<VelocityPost[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(
    new Date(now).getTime() - VELOCITY_RECENT_POST_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .select("id, threads_media_id, published_at")
    .eq("user_id", userId)
    .gte("published_at", cutoff);

  if (error) throw error;
  return data ?? [];
}

/**
 * Compute the user's average velocity ratio across historical posts
 * (posts published more than `VELOCITY_WINDOW_HOURS_LATE` hours ago that
 * have at least two metric snapshots to compare).
 *
 * Returns 0 when no historical data is available.
 */
export async function getHistoricalVelocityAverage(
  userId: string,
  now: string,
): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(
    new Date(now).getTime() - VELOCITY_WINDOW_HOURS_LATE * 60 * 60 * 1000,
  ).toISOString();

  // Fetch historical posts (published before the late-window cutoff)
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, published_at")
    .eq("user_id", userId)
    .lt("published_at", cutoff);

  if (postsError) throw postsError;
  if (!posts || posts.length === 0) return 0;

  const ratios: number[] = [];

  for (const post of posts) {
    const { data: snapshots, error: snapError } = await supabase
      .from("post_metrics")
      .select("fetched_at, views, likes, replies, reposts, quotes, shares")
      .eq("post_id", post.id)
      .order("fetched_at", { ascending: true });

    if (snapError || !snapshots || snapshots.length < 2) continue;

    const ratio = computeVelocityScore(snapshots, post.published_at, now);
    if (ratio !== null) ratios.push(ratio);
  }

  if (ratios.length === 0) return 0;
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

/**
 * Fetch fresh metrics for all posts published in the last 3 hours for `userId`
 * and insert new `post_metrics` rows.
 */
export async function refreshVelocityForUser(userId: string): Promise<{
  postsProcessed: number;
  metricsInserted: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Get user and validate token
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("threads_user_id, access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !user) throw userError ?? new Error("User not found");

  if (new Date(user.token_expires_at) <= new Date()) {
    console.warn(`Skipping velocity refresh for user ${userId}: token expired`);
    return { postsProcessed: 0, metricsInserted: 0 };
  }

  const accessToken = decrypt(user.access_token);
  const api = new ThreadsAPI(accessToken, user.threads_user_id);

  const recentPosts = await getRecentPosts(userId, now);
  let metricsInserted = 0;

  for (const post of recentPosts) {
    const insights = await api.getPostInsights(post.threads_media_id);
    await supabase.from("post_metrics").insert({
      post_id: post.id,
      views: insights.views,
      likes: insights.likes,
      replies: insights.replies,
      reposts: insights.reposts,
      quotes: insights.quotes,
      shares: insights.shares,
    });
    metricsInserted++;
  }

  return { postsProcessed: recentPosts.length, metricsInserted };
}

/**
 * Run velocity refresh for all users. Returns aggregate processed/error counts.
 * Mirrors the `refreshAllUsers` pattern from `metrics-refresh.ts`.
 */
export async function refreshAllUsersVelocity(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase.from("users").select("id");
  if (error) throw error;

  let processed = 0;
  let errors = 0;

  for (const user of users ?? []) {
    try {
      const result = await refreshVelocityForUser(user.id);
      console.log(
        `Velocity refresh for user ${user.id}: ${result.postsProcessed} posts, ${result.metricsInserted} metrics inserted`,
      );
      processed++;
    } catch (err) {
      console.error(
        `Failed to refresh velocity for user ${user.id}:`,
        err,
      );
      errors++;
    }
  }

  console.log(
    `Velocity refresh complete: ${processed} users processed, ${errors} errors`,
  );
  return { processed, errors };
}
