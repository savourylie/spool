import type { Json } from "@/lib/supabase/database.types";

export interface MediaBreakdownEntry {
  mediaType: string;
  posts: number;
  views: number;
  avgViews: number;
  engagementRate: number;
}

export interface OverviewTopPost {
  id: string;
  textPreview: string | null;
  mediaType: string;
  views: number;
  permalink: string | null;
  publishedAt: string;
}

export interface PostsOverview {
  totalPosts: number;
  totalViews: number;
  totalInteractions: number;
  engagementRate: number;
  mediaBreakdown: MediaBreakdownEntry[];
  topPost: OverviewTopPost | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseOverview(
  row:
    | {
        total_posts: number;
        total_views: number;
        total_interactions: number;
        engagement_rate: number;
        media_breakdown: Json;
        top_post: Json;
      }
    | null
    | undefined,
): PostsOverview | null {
  if (!row) return null;

  const breakdown: MediaBreakdownEntry[] = [];
  if (Array.isArray(row.media_breakdown)) {
    for (const entry of row.media_breakdown) {
      if (!isRecord(entry)) continue;
      breakdown.push({
        mediaType: toStringOrNull(entry.media_type) ?? "TEXT",
        posts: toNumber(entry.posts),
        views: toNumber(entry.views),
        avgViews: toNumber(entry.avg_views),
        engagementRate: toNumber(entry.engagement_rate),
      });
    }
  }

  const top = isRecord(row.top_post)
    ? {
        id: toStringOrNull(row.top_post.id) ?? "",
        textPreview: toStringOrNull(row.top_post.text_preview),
        mediaType: toStringOrNull(row.top_post.media_type) ?? "TEXT",
        views: toNumber(row.top_post.views),
        permalink: toStringOrNull(row.top_post.permalink),
        publishedAt: toStringOrNull(row.top_post.published_at) ?? "",
      }
    : null;

  return {
    totalPosts: toNumber(row.total_posts),
    totalViews: toNumber(row.total_views),
    totalInteractions: toNumber(row.total_interactions),
    engagementRate: toNumber(row.engagement_rate),
    mediaBreakdown: breakdown,
    topPost: top,
  };
}
