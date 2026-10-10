/**
 * Scanner Neighbor Posts (TICKET-077)
 *
 * Pure helper that picks up to 3 of the user's own top-performing posts
 * on the same topic as the Scanner draft. The Scanner cites these as
 * "top-performing posts on this topic" in its Style Match axis — they
 * are reference material, not rewrites.
 *
 * No embeddings infrastructure exists in the project; semantic adjacency
 * is approximated by TF-IDF topic-cluster membership (see
 * `topic-classification.ts`). The frame in the prompt is honest: these
 * are the best-performing posts that share the draft's topic cluster,
 * not cosine-similarity nearest neighbors.
 */

import { computeWES, computeNormalizedWES } from "@/lib/weighted-engagement";
import {
  classifyPostTopic,
  extractTopics,
  type TopicCluster,
} from "@/lib/topic-classification";
import type { NeighborPost } from "@/lib/quality-scanner-shared";

// ── Constants ────────────────────────────────────────────────────────

export const NEIGHBOR_COUNT = 3;
export const MIN_POSTS_FOR_NEIGHBORS = 10;
export const TEXT_PREVIEW_MAX = 200;

// ── Types ────────────────────────────────────────────────────────────

export interface ScannerNeighborPost {
  id: string;
  text: string;
  publishedAt: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  /** External Threads URL. Nullable because some older posts may not have
   *  a stored permalink. */
  permalink?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function truncatePreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TEXT_PREVIEW_MAX) return collapsed;
  return collapsed.slice(0, TEXT_PREVIEW_MAX - 1).trimEnd() + "…";
}

function toNeighborPost(post: ScannerNeighborPost): NeighborPost {
  return {
    id: post.id,
    textPreview: truncatePreview(post.text),
    wes: computeWES(post),
    wesNormalized: computeNormalizedWES(post),
    publishedAt: post.publishedAt,
    permalink: post.permalink ?? null,
  };
}

function topByWes(
  posts: ScannerNeighborPost[],
  limit: number,
): ScannerNeighborPost[] {
  return [...posts]
    .sort((a, b) => computeWES(b) - computeWES(a))
    .slice(0, limit);
}

/** Filter posts whose text classifies to the same topic as the draft. */
function filterByTopic(
  posts: ScannerNeighborPost[],
  clusters: TopicCluster[],
  draftTopic: string,
): ScannerNeighborPost[] {
  return posts.filter((post) => {
    const classification = classifyPostTopic(post.text, clusters);
    return classification?.topic === draftTopic;
  });
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Return up to `NEIGHBOR_COUNT` of the user's own posts that share the
 * draft's topic cluster, sorted by raw WES descending. Falls back to
 * global top-WES when the draft does not classify into any cluster.
 * Returns an empty array for accounts with fewer than
 * `MIN_POSTS_FOR_NEIGHBORS` posts.
 */
export function computeNeighborPosts(
  draftText: string,
  posts: ScannerNeighborPost[],
): NeighborPost[] {
  if (posts.length < MIN_POSTS_FOR_NEIGHBORS) return [];

  const trimmed = draftText.trim();
  if (trimmed.length === 0) {
    return topByWes(posts, NEIGHBOR_COUNT).map(toNeighborPost);
  }

  const clusters = extractTopics(
    posts.map((p) => ({ text: p.text })),
  );

  const classification = clusters.length > 0
    ? classifyPostTopic(trimmed, clusters)
    : null;

  const pool = classification
    ? filterByTopic(posts, clusters, classification.topic)
    : [];

  const ranked = pool.length > 0
    ? topByWes(pool, NEIGHBOR_COUNT)
    : topByWes(posts, NEIGHBOR_COUNT);

  return ranked.map(toNeighborPost);
}
