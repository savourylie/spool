/**
 * Cadence Analysis
 *
 * Analyzes posting frequency and spacing patterns to help creators
 * optimize their Threads posting cadence. The Threads diversity filter
 * suppresses consecutive posts from the same creator — posts spaced
 * 18–24+ hours apart avoid this penalty and receive better distribution.
 *
 * All functions are pure: they accept post arrays and return computed
 * results. No database calls, no side effects, no Date.now() dependency.
 * The 30-day stats window is anchored to the most recent post in the
 * input data, ensuring deterministic output for identical input.
 */

import { computePercentile } from "@/lib/engagement-prediction";

export const CADENCE_THRESHOLDS = {
  /** Average gap (hours) below which a spacing recommendation triggers */
  minGapHours: 18,
  /** Number of days for the "recent" stats window */
  recentWindowDays: 30,
  /** Minimum scatter data points needed to produce a recommendation */
  minPostsForRecommendation: 3,
  /** Percentile above which points are treated as outliers */
  outlierPercentile: 95,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CadencePost {
  published_at: string;
  views: number;
}

export interface CadenceStats {
  /** Average posts per day over the last 30 days */
  avgPostsPerDay: number;
  /** Average gap between consecutive posts in hours */
  avgGapHours: number;
  /** Longest gap between consecutive posts in hours */
  longestGapHours: number;
  /** Shortest gap between consecutive posts in hours */
  shortestGapHours: number;
  /** Number of posts in the 30-day window */
  postCount: number;
}

export interface CadenceScatterPoint {
  /** Hours since the previous post */
  hoursSincePrevious: number;
  /** View count of this post */
  views: number;
}

export interface SameDayCollision {
  /** Date string in YYYY-MM-DD format (in user timezone) */
  date: string;
  /** View counts of each individual post on that date */
  postViews: number[];
}

export interface CadenceRecommendation {
  /** Whether the recommendation is active (avg gap < threshold) */
  triggered: boolean;
  /** Current average gap in hours */
  currentAvgGapHours: number;
  /** Average views for posts with gap < 18h */
  avgViewsBelowThreshold: number;
  /** Average views for posts with gap >= 18h */
  avgViewsAboveThreshold: number;
  /** Percentage improvement: ((above - below) / below) * 100 */
  percentageImprovement: number;
}

export interface AxisThresholds {
  /** Clamped X-axis maximum (hours since previous) */
  x: number;
  /** Clamped Y-axis maximum (views) */
  y: number;
}

export interface ClampedScatterPoint extends CadenceScatterPoint {
  /** Original hours value before clamping */
  originalHoursSincePrevious: number;
  /** Original views value before clamping */
  originalViews: number;
  /** Whether this point was clamped on at least one axis */
  isOutlier: boolean;
}

export interface ClampedScatterResult {
  normalPoints: ClampedScatterPoint[];
  outlierPoints: ClampedScatterPoint[];
  thresholds: AxisThresholds;
  outlierCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sortByPublishedAt(posts: CadencePost[]): CadencePost[] {
  return [...posts].sort(
    (a, b) =>
      new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );
}

function computeGapsHours(sorted: CadencePost[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].published_at).getTime();
    const curr = new Date(sorted[i].published_at).getTime();
    gaps.push((curr - prev) / (1000 * 60 * 60));
  }
  return gaps;
}

function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/** Compute posting cadence statistics for the last 30 days. */
export function computeCadenceStats(posts: CadencePost[]): CadenceStats {
  if (posts.length === 0) {
    return {
      avgPostsPerDay: 0,
      avgGapHours: 0,
      longestGapHours: 0,
      shortestGapHours: 0,
      postCount: 0,
    };
  }

  const sorted = sortByPublishedAt(posts);
  const mostRecent = new Date(
    sorted[sorted.length - 1].published_at,
  ).getTime();
  const windowStart =
    mostRecent - CADENCE_THRESHOLDS.recentWindowDays * 24 * 60 * 60 * 1000;

  const windowPosts = sorted.filter(
    (p) => new Date(p.published_at).getTime() >= windowStart,
  );

  const gaps = computeGapsHours(windowPosts);

  return {
    avgPostsPerDay:
      windowPosts.length / CADENCE_THRESHOLDS.recentWindowDays,
    avgGapHours:
      gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    longestGapHours: gaps.length > 0 ? Math.max(...gaps) : 0,
    shortestGapHours: gaps.length > 0 ? Math.min(...gaps) : 0,
    postCount: windowPosts.length,
  };
}

/** Generate scatter chart data pairing gap-to-previous-post with views. */
export function computeCadenceScatterData(
  posts: CadencePost[],
): CadenceScatterPoint[] {
  if (posts.length <= 1) return [];

  const sorted = sortByPublishedAt(posts);
  const points: CadenceScatterPoint[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].published_at).getTime();
    const curr = new Date(sorted[i].published_at).getTime();
    points.push({
      hoursSincePrevious: (curr - prev) / (1000 * 60 * 60),
      views: sorted[i].views,
    });
  }

  return points;
}

/** Find dates where 2+ posts were published (reach dilution risk). */
export function detectSameDayCollisions(
  posts: CadencePost[],
  timezone: string,
): SameDayCollision[] {
  if (posts.length === 0) return [];

  const sorted = sortByPublishedAt(posts);
  const groups = new Map<string, number[]>();

  for (const post of sorted) {
    const dateKey = formatDateInTimezone(
      new Date(post.published_at),
      timezone,
    );
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(post.views);
    } else {
      groups.set(dateKey, [post.views]);
    }
  }

  const collisions: SameDayCollision[] = [];
  for (const [date, postViews] of groups) {
    if (postViews.length >= 2) {
      collisions.push({ date, postViews });
    }
  }

  return collisions.sort((a, b) => b.date.localeCompare(a.date));
}

/** Get a spacing recommendation when posts are too close together. */
export function getCadenceRecommendation(
  posts: CadencePost[],
): CadenceRecommendation | null {
  const scatterData = computeCadenceScatterData(posts);

  if (scatterData.length < CADENCE_THRESHOLDS.minPostsForRecommendation) {
    return null;
  }

  const below = scatterData.filter(
    (p) => p.hoursSincePrevious < CADENCE_THRESHOLDS.minGapHours,
  );
  const above = scatterData.filter(
    (p) => p.hoursSincePrevious >= CADENCE_THRESHOLDS.minGapHours,
  );

  if (below.length === 0 || above.length === 0) return null;

  const avgViewsBelow =
    below.reduce((sum, p) => sum + p.views, 0) / below.length;
  const avgViewsAbove =
    above.reduce((sum, p) => sum + p.views, 0) / above.length;

  const currentAvgGapHours =
    scatterData.reduce((sum, p) => sum + p.hoursSincePrevious, 0) /
    scatterData.length;

  const percentageImprovement =
    avgViewsBelow > 0
      ? ((avgViewsAbove - avgViewsBelow) / avgViewsBelow) * 100
      : 0;

  return {
    triggered: currentAvgGapHours < CADENCE_THRESHOLDS.minGapHours,
    currentAvgGapHours,
    avgViewsBelowThreshold: avgViewsBelow,
    avgViewsAboveThreshold: avgViewsAbove,
    percentageImprovement,
  };
}

// ---------------------------------------------------------------------------
// Outlier clamping
// ---------------------------------------------------------------------------

/** Round a value up to a human-friendly axis tick number. */
export function ceilToNiceNumber(value: number): number {
  if (value <= 0) return 0;
  let step: number;
  if (value < 100) step = 10;
  else if (value < 1_000) step = 50;
  else if (value < 10_000) step = 500;
  else if (value < 100_000) step = 5_000;
  else step = 50_000;
  return Math.ceil(value / step) * step;
}

/** Compute axis thresholds by taking the percentile and rounding to a nice number. */
export function computeAxisThresholds(
  points: CadenceScatterPoint[],
  percentile: number = CADENCE_THRESHOLDS.outlierPercentile,
): AxisThresholds {
  if (points.length === 0) return { x: 0, y: 0 };

  const sortedHours = [...points.map((p) => p.hoursSincePrevious)].sort(
    (a, b) => a - b,
  );
  const sortedViews = [...points.map((p) => p.views)].sort((a, b) => a - b);

  return {
    x: ceilToNiceNumber(computePercentile(sortedHours, percentile)),
    y: ceilToNiceNumber(computePercentile(sortedViews, percentile)),
  };
}

/** Clamp scatter points to thresholds and split into normal/outlier sets. */
export function clampAndSplitScatterData(
  points: CadenceScatterPoint[],
  thresholds: AxisThresholds,
): ClampedScatterResult {
  const normalPoints: ClampedScatterPoint[] = [];
  const outlierPoints: ClampedScatterPoint[] = [];

  for (const point of points) {
    const isOutlier =
      point.hoursSincePrevious > thresholds.x || point.views > thresholds.y;

    const clamped: ClampedScatterPoint = {
      hoursSincePrevious: Math.min(point.hoursSincePrevious, thresholds.x),
      views: Math.min(point.views, thresholds.y),
      originalHoursSincePrevious: point.hoursSincePrevious,
      originalViews: point.views,
      isOutlier,
    };

    if (isOutlier) {
      outlierPoints.push(clamped);
    } else {
      normalPoints.push(clamped);
    }
  }

  return {
    normalPoints,
    outlierPoints,
    thresholds,
    outlierCount: outlierPoints.length,
  };
}
