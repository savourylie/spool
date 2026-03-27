/**
 * Topic Model Library
 *
 * Groups posts by their topic_tag, computes per-topic performance statistics,
 * and provides comparison/audience-fit utilities. Built on existing topic
 * classification pipeline (topic_tag column) and weighted engagement scoring.
 *
 * All functions are pure: they accept typed inputs and return computed
 * results. No database calls, no side effects.
 */

import { computeWES, computeNormalizedWES } from "@/lib/weighted-engagement";
import type { DemographicSnapshot } from "@/lib/audience-fit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_POSTS_PER_CLUSTER = 3;
export const TOP_POSTS_COUNT = 3;
export const OTHER_CLUSTER_NAME = "Other";

export const TOPIC_COLORS = [
  "#8B5CF6", // accent (violet)
  "#F472B6", // secondary (pink)
  "#FBBF24", // tertiary (amber)
  "#34D399", // quaternary (emerald)
  "#64748B", // muted-foreground (slate 500)
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicModelPost {
  topic_tag: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  text_preview?: string | null;
  published_at?: string | null;
}

export interface TopicModelTopPost {
  text_preview: string | null;
  views: number;
  wes: number;
  published_at: string | null;
}

export interface TopicModelCluster {
  name: string;
  postCount: number;
  avgEngagement: number;
  avgViews: number;
  avgReplies: number;
  avgWes: number;
  topPosts: TopicModelTopPost[];
  color: string;
}

export interface TopicModelData {
  clusters: TopicModelCluster[];
  totalPosts: number;
  uniqueTopics: number;
}

export interface TopicPerformanceBar {
  name: string;
  color: string;
  avgViews: number;
  avgEngagement: number;
  avgReplies: number;
  avgWes: number;
}

export interface AudienceTopicFitEntry {
  topicName: string;
  color: string;
  avgWes: number;
  relativePerformance: number;
  fitLabel: "strong" | "average" | "weak";
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function computePostEngagementRate(post: TopicModelPost): number {
  if (post.views <= 0) return 0;
  const interactions =
    post.likes + post.replies + post.reposts + post.quotes + post.shares;
  return (interactions / post.views) * 100;
}

function capitalizeTopicName(tag: string): string {
  if (tag.length === 0) return tag;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function buildCluster(
  name: string,
  posts: TopicModelPost[],
  color: string,
): TopicModelCluster {
  const postCount = posts.length;

  const avgViews =
    postCount > 0 ? posts.reduce((s, p) => s + p.views, 0) / postCount : 0;

  const avgReplies =
    postCount > 0 ? posts.reduce((s, p) => s + p.replies, 0) / postCount : 0;

  const avgEngagement =
    postCount > 0
      ? posts.reduce((s, p) => s + computePostEngagementRate(p), 0) / postCount
      : 0;

  const avgWes =
    postCount > 0
      ? posts.reduce((s, p) => s + computeNormalizedWES(p), 0) / postCount
      : 0;

  const topPosts = posts
    .map((p) => ({
      text_preview: p.text_preview ?? null,
      views: p.views,
      wes: computeWES(p),
      published_at: p.published_at ?? null,
    }))
    .sort((a, b) => b.wes - a.wes)
    .slice(0, TOP_POSTS_COUNT);

  return {
    name,
    postCount,
    avgEngagement,
    avgViews,
    avgReplies,
    avgWes,
    topPosts,
    color,
  };
}

// ---------------------------------------------------------------------------
// Public Functions
// ---------------------------------------------------------------------------

export function buildTopicModel(posts: TopicModelPost[]): TopicModelData {
  if (posts.length === 0) {
    return { clusters: [], totalPosts: 0, uniqueTopics: 0 };
  }

  // Group posts by topic_tag
  const groups = new Map<string, TopicModelPost[]>();
  const otherPosts: TopicModelPost[] = [];

  for (const post of posts) {
    const tag = post.topic_tag;
    if (tag == null || tag.trim().length === 0) {
      otherPosts.push(post);
    } else {
      const existing = groups.get(tag);
      if (existing) {
        existing.push(post);
      } else {
        groups.set(tag, [post]);
      }
    }
  }

  // Merge small groups into "Other"
  for (const [tag, tagPosts] of groups) {
    if (tagPosts.length < MIN_POSTS_PER_CLUSTER) {
      otherPosts.push(...tagPosts);
      groups.delete(tag);
    }
  }

  // Build clusters for real topics
  const realClusters: TopicModelCluster[] = [];
  for (const [tag, tagPosts] of groups) {
    realClusters.push(buildCluster(capitalizeTopicName(tag), tagPosts, ""));
  }

  // Sort real clusters by postCount descending
  realClusters.sort((a, b) => b.postCount - a.postCount);

  // Build "Other" cluster if there are untagged/small-group posts
  const allClusters: TopicModelCluster[] = [...realClusters];
  if (otherPosts.length > 0) {
    allClusters.push(buildCluster(OTHER_CLUSTER_NAME, otherPosts, ""));
  }

  // Assign colors after sort (most prominent topic gets primary brand color)
  for (let i = 0; i < allClusters.length; i++) {
    allClusters[i] = {
      ...allClusters[i],
      color: TOPIC_COLORS[i % TOPIC_COLORS.length],
    };
  }

  return {
    clusters: allClusters,
    totalPosts: posts.length,
    uniqueTopics: allClusters.length,
  };
}

export function getTopicPerformanceComparison(
  clusters: TopicModelCluster[],
): TopicPerformanceBar[] {
  return clusters
    .map((c) => ({
      name: c.name,
      color: c.color,
      avgViews: c.avgViews,
      avgEngagement: c.avgEngagement,
      avgReplies: c.avgReplies,
      avgWes: c.avgWes,
    }))
    .sort((a, b) => b.avgWes - a.avgWes);
}

export function getAudienceTopicFit(
  clusters: TopicModelCluster[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  demographics: DemographicSnapshot[],
): AudienceTopicFitEntry[] {
  if (clusters.length === 0) return [];

  // Compute global average WES weighted by postCount
  const totalPosts = clusters.reduce((s, c) => s + c.postCount, 0);
  const globalAvgWes =
    totalPosts > 0
      ? clusters.reduce((s, c) => s + c.avgWes * c.postCount, 0) / totalPosts
      : 0;

  return clusters
    .map((c) => {
      const relativePerformance =
        globalAvgWes > 0
          ? ((c.avgWes - globalAvgWes) / globalAvgWes) * 100
          : 0;

      let fitLabel: "strong" | "average" | "weak";
      if (relativePerformance > 10) {
        fitLabel = "strong";
      } else if (relativePerformance < -10) {
        fitLabel = "weak";
      } else {
        fitLabel = "average";
      }

      return {
        topicName: c.name,
        color: c.color,
        avgWes: c.avgWes,
        relativePerformance,
        fitLabel,
      };
    })
    .sort((a, b) => b.relativePerformance - a.relativePerformance);
}
