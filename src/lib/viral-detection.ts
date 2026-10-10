/**
 * Viral Detection
 *
 * Pure functions that detect viral posts and compute recovery state.
 * A post is "viral" when its views exceed 5x the user's median views.
 * Recovery state tracks a 7-day window after a viral post to help
 * creators time their next post for optimal distribution.
 *
 * All functions are pure: they accept typed arrays and return computed
 * results. No database calls, no side effects, no Date.now() dependency.
 * Time-dependent calculations receive a `now` parameter.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VIRAL_VIEW_MULTIPLIER = 5;
export const VIRAL_FOLLOWER_SPIKE_THRESHOLD = 100;
export const RECOVERY_WINDOW_DAYS = 7;
export const MIN_POST_WAIT_HOURS = 24;
export const RECOMMENDED_POST_WAIT_HOURS = 48;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ViralDetectionPost {
  id: string;
  text_preview: string | null;
  permalink: string | null;
  published_at: string; // ISO 8601
  views: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  followers_count: number | null;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ViralPostInfo {
  post: ViralDetectionPost;
  medianViews: number;
  viewMultiplier: number;
}

export interface FollowerSpikeInfo {
  postId: string;
  publishDate: string;
  followersOnPublish: number;
  followersAfter48h: number;
  spikeMagnitude: number;
}

export interface ViralRecoveryState {
  viralPost: ViralDetectionPost;
  viewMultiplier: number;
  followerSpikeMagnitude: number | null; // null if no daily_stats data
  recoveryWindowEnd: string; // ISO 8601
  isRecoveryActive: boolean;
  safeToPostMinimum: string; // 24h after viral post
  safeToPostRecommended: string; // 48h after viral post
  hoursUntilSafeMinimum: number; // 0 if already past
  hoursUntilSafeRecommended: number; // 0 if already past
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toDateString(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Compute the median view count across all posts.
 * Returns 0 for an empty array.
 */
export function computeMedianViews(posts: ViralDetectionPost[]): number {
  if (posts.length === 0) return 0;

  const sorted = posts.map((p) => p.views).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Identify posts whose views exceed 5x the user's median.
 * Returns results sorted by viewMultiplier descending.
 */
export function detectViralPosts(
  posts: ViralDetectionPost[],
): ViralPostInfo[] {
  const median = computeMedianViews(posts);
  if (median <= 0) return [];

  const threshold = VIRAL_VIEW_MULTIPLIER * median;

  return posts
    .filter((p) => p.views > threshold)
    .map((post) => ({
      post,
      medianViews: median,
      viewMultiplier: post.views / median,
    }))
    .sort((a, b) => b.viewMultiplier - a.viewMultiplier);
}

/**
 * Check whether daily_stats shows a follower spike (≥100 new followers)
 * within 48 hours of a post's publish date.
 * Returns null if data is missing or spike is below threshold.
 */
export function detectFollowerSpike(
  postId: string,
  postPublishedAt: string,
  dailyStats: DailyStat[],
): FollowerSpikeInfo | null {
  const publishDate = toDateString(postPublishedAt);
  const targetDate = addDays(publishDate, 2);

  const publishEntry = dailyStats.find((s) => s.date === publishDate);
  const targetEntry = dailyStats.find((s) => s.date === targetDate);

  if (!publishEntry || publishEntry.followers_count === null) return null;
  if (!targetEntry || targetEntry.followers_count === null) return null;

  const magnitude = targetEntry.followers_count - publishEntry.followers_count;
  if (magnitude < VIRAL_FOLLOWER_SPIKE_THRESHOLD) return null;

  return {
    postId,
    publishDate,
    followersOnPublish: publishEntry.followers_count,
    followersAfter48h: targetEntry.followers_count,
    spikeMagnitude: magnitude,
  };
}

/**
 * Combine viral detection + follower spike into a recovery state.
 * Picks the highest-multiplier viral post with an active recovery window.
 * Returns null if no active viral recovery exists.
 */
export function getViralRecoveryState(
  posts: ViralDetectionPost[],
  dailyStats: DailyStat[],
  now: string,
): ViralRecoveryState | null {
  const viralPosts = detectViralPosts(posts);
  if (viralPosts.length === 0) return null;

  const nowMs = new Date(now).getTime();

  // Find the highest-multiplier viral post with an active recovery window
  for (const vp of viralPosts) {
    const recoveryEnd = addHours(
      vp.post.published_at,
      RECOVERY_WINDOW_DAYS * 24,
    );
    const recoveryEndMs = new Date(recoveryEnd).getTime();

    if (nowMs >= recoveryEndMs) continue; // recovery expired

    const spike = detectFollowerSpike(vp.post.id, vp.post.published_at, dailyStats);

    const safeMin = addHours(vp.post.published_at, MIN_POST_WAIT_HOURS);
    const safeRec = addHours(vp.post.published_at, RECOMMENDED_POST_WAIT_HOURS);
    const safeMinMs = new Date(safeMin).getTime();
    const safeRecMs = new Date(safeRec).getTime();

    return {
      viralPost: vp.post,
      viewMultiplier: vp.viewMultiplier,
      followerSpikeMagnitude: spike ? spike.spikeMagnitude : null,
      recoveryWindowEnd: recoveryEnd,
      isRecoveryActive: true,
      safeToPostMinimum: safeMin,
      safeToPostRecommended: safeRec,
      hoursUntilSafeMinimum: Math.max(0, (safeMinMs - nowMs) / (1000 * 60 * 60)),
      hoursUntilSafeRecommended: Math.max(
        0,
        (safeRecMs - nowMs) / (1000 * 60 * 60),
      ),
    };
  }

  return null;
}
