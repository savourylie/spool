/**
 * Weighted Engagement Score (WES)
 *
 * Reflects how the Threads algorithm actually values different interactions
 * based on Meta patent analysis and Mosseri 2025 statements.
 *
 * Signal weights:
 * - Shares (10x): proxies DM sends — highest algorithmic value per Mosseri
 * - Replies (8x): meaningful comments drive distribution; 8x (not 30x) since
 *   we can't distinguish 5+ word comments from short ones without reply data
 * - Quotes (5x): require creating new content — substantial user effort
 * - Reposts (3x): medium-effort amplification signal
 * - Likes (1x): baseline — lowest effort, lowest algorithmic weight
 */

export const WES_WEIGHTS = {
  likes: 1,
  replies: 8,
  reposts: 3,
  quotes: 5,
  shares: 10,
} as const;

export interface EngagementMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

/** Raw weighted engagement score (not normalized by views). */
export function computeWES(metrics: EngagementMetrics): number {
  return (
    metrics.likes * WES_WEIGHTS.likes +
    metrics.replies * WES_WEIGHTS.replies +
    metrics.reposts * WES_WEIGHTS.reposts +
    metrics.quotes * WES_WEIGHTS.quotes +
    metrics.shares * WES_WEIGHTS.shares
  );
}

/** Normalized WES as a percentage of views (comparable to engagement rate). */
export function computeNormalizedWES(metrics: EngagementMetrics): number {
  if (metrics.views <= 0) return 0;
  return (computeWES(metrics) / metrics.views) * 100;
}
