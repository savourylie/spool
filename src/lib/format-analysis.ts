/**
 * Format Analysis
 *
 * Pure functions that break down engagement by media type and post length.
 * Shows which content formats perform best for the user's audience.
 */

import type { PostRow } from "@/components/dashboard/post-table";
import { computeNormalizedWES } from "@/lib/weighted-engagement";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const MIN_POSTS_FOR_ANALYSIS = 5;

export const TEXT_LENGTH_BUCKETS = [
  { bucket: "short" as const, label: "Short (0–50 chars)", min: 0, max: 50 },
  { bucket: "medium" as const, label: "Medium (51–150 chars)", min: 51, max: 150 },
  { bucket: "long" as const, label: "Long (151+ chars)", min: 151, max: 280 },
] as const;

const MEDIA_TYPE_ORDER = ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FormatBreakdown {
  mediaType: string;
  count: number;
  avgViews: number;
  avgWes: number;
}

export type TextLengthBucketName = "short" | "medium" | "long";

export interface TextLengthBucket {
  bucket: TextLengthBucketName;
  label: string;
  count: number;
  avgEngagementRate: number;
  avgViews: number;
}

export interface FormatRecommendation {
  formatComparison: string;
  lengthComparison: string | null;
}

/* ------------------------------------------------------------------ */
/*  computeFormatBreakdown                                             */
/* ------------------------------------------------------------------ */

export function computeFormatBreakdown(posts: PostRow[]): FormatBreakdown[] {
  const groups = new Map<string, PostRow[]>();

  for (const post of posts) {
    const type = post.media_type;
    const group = groups.get(type);
    if (group) {
      group.push(post);
    } else {
      groups.set(type, [post]);
    }
  }

  const result: FormatBreakdown[] = [];

  for (const mediaType of MEDIA_TYPE_ORDER) {
    const group = groups.get(mediaType);
    if (!group || group.length === 0) continue;

    const totalViews = group.reduce((sum, p) => sum + p.views, 0);
    const totalWes = group.reduce(
      (sum, p) =>
        sum +
        computeNormalizedWES({
          views: p.views,
          likes: p.likes,
          replies: p.replies,
          reposts: p.reposts,
          quotes: p.quotes,
          shares: p.shares,
        }),
      0,
    );

    result.push({
      mediaType,
      count: group.length,
      avgViews: totalViews / group.length,
      avgWes: totalWes / group.length,
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  computeTextLengthBuckets                                           */
/* ------------------------------------------------------------------ */

function getEngagementRate(p: PostRow): number {
  if (p.views <= 0) return 0;
  return ((p.likes + p.replies + p.reposts + p.quotes + p.shares) / p.views) * 100;
}

export function computeTextLengthBuckets(posts: PostRow[]): TextLengthBucket[] {
  const buckets: Map<TextLengthBucketName, PostRow[]> = new Map([
    ["short", []],
    ["medium", []],
    ["long", []],
  ]);

  for (const post of posts) {
    const len = post.text_preview?.length ?? 0;

    for (const config of TEXT_LENGTH_BUCKETS) {
      if (len >= config.min && len <= config.max) {
        buckets.get(config.bucket)!.push(post);
        break;
      }
    }
  }

  return TEXT_LENGTH_BUCKETS.map((config) => {
    const group = buckets.get(config.bucket)!;
    if (group.length === 0) {
      return {
        bucket: config.bucket,
        label: config.label,
        count: 0,
        avgEngagementRate: 0,
        avgViews: 0,
      };
    }

    const totalEngRate = group.reduce((sum, p) => sum + getEngagementRate(p), 0);
    const totalViews = group.reduce((sum, p) => sum + p.views, 0);

    return {
      bucket: config.bucket,
      label: config.label,
      count: group.length,
      avgEngagementRate: totalEngRate / group.length,
      avgViews: totalViews / group.length,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  generateFormatRecommendation                                       */
/* ------------------------------------------------------------------ */

export function generateFormatRecommendation(
  posts: PostRow[],
): FormatRecommendation | null {
  if (posts.length < MIN_POSTS_FOR_ANALYSIS) return null;

  const breakdown = computeFormatBreakdown(posts);
  if (breakdown.length < 2) return null;

  // Find best and worst by avg WES
  let best = breakdown[0];
  let worst = breakdown[0];
  for (const entry of breakdown) {
    if (entry.avgWes > best.avgWes) best = entry;
    if (entry.avgWes < worst.avgWes) worst = entry;
  }

  const wesDiff =
    worst.avgWes > 0
      ? Math.round(((best.avgWes - worst.avgWes) / worst.avgWes) * 100)
      : 0;

  const formatComparison =
    wesDiff > 0
      ? `Your ${best.mediaType} posts get ${wesDiff}% more engagement than ${worst.mediaType} posts.`
      : `Your ${best.mediaType} and ${worst.mediaType} posts perform similarly.`;

  // Text length comparison
  const buckets = computeTextLengthBuckets(posts);
  const nonEmpty = buckets.filter((b) => b.count > 0);
  let lengthComparison: string | null = null;

  if (nonEmpty.length >= 2) {
    let bestBucket = nonEmpty[0];
    let worstBucket = nonEmpty[0];
    for (const b of nonEmpty) {
      if (b.avgEngagementRate > bestBucket.avgEngagementRate) bestBucket = b;
      if (b.avgEngagementRate < worstBucket.avgEngagementRate) worstBucket = b;
    }

    const bucketDiff =
      worstBucket.avgEngagementRate > 0
        ? Math.round(
            ((bestBucket.avgEngagementRate - worstBucket.avgEngagementRate) /
              worstBucket.avgEngagementRate) *
              100,
          )
        : 0;

    if (bucketDiff > 0) {
      lengthComparison = `${capitalize(bestBucket.bucket)} posts outperform ${worstBucket.bucket} ones by ${bucketDiff}%.`;
    }
  }

  return { formatComparison, lengthComparison };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
