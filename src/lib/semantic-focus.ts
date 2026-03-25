import {
  computeFocusScore,
  extractTopics,
  type TopicCluster,
} from "@/lib/topic-classification";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_POSTS_FOR_FOCUS = 10;
export const ROLLING_WINDOW_DAYS = 30;
export const LOW_SCORE_THRESHOLD = 50;
export const MEDIUM_SCORE_THRESHOLD = 70;

const MIN_POSTS_PER_WINDOW = 3;
const TOP_CLUSTER_COUNT = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticFocusPost {
  topic_tag: string | null;
  text_full: string | null;
  published_at: string;
}

export interface RollingScorePoint {
  date: string;
  dateLabel: string;
  score: number;
}

export interface SemanticFocusData {
  currentScore: number;
  trend: RollingScorePoint[];
  topClusters: TopicCluster[];
  postCount: number;
}

// ---------------------------------------------------------------------------
// Score Level
// ---------------------------------------------------------------------------

export type ScoreLevel = "high" | "medium" | "low";

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= MEDIUM_SCORE_THRESHOLD) return "high";
  if (score >= LOW_SCORE_THRESHOLD) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Rolling Scores
// ---------------------------------------------------------------------------

export function computeRollingScores(
  posts: SemanticFocusPost[],
): RollingScorePoint[] {
  if (posts.length === 0) return [];

  const now = new Date();
  const points: RollingScorePoint[] = [];

  for (let i = ROLLING_WINDOW_DAYS - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const windowStart = new Date(day);
    windowStart.setDate(windowStart.getDate() - ROLLING_WINDOW_DAYS);

    const windowPosts = posts.filter((p) => {
      const t = new Date(p.published_at).getTime();
      return t >= windowStart.getTime() && t <= dayEnd.getTime();
    });

    if (windowPosts.length < MIN_POSTS_PER_WINDOW) continue;

    const score = computeFocusScore(windowPosts);

    points.push({
      date: day.toISOString().slice(0, 10),
      dateLabel: day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: Math.round(score),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function computeSemanticFocusData(
  posts: SemanticFocusPost[],
): SemanticFocusData {
  const postCount = posts.filter((p) => p.text_full != null).length;

  if (postCount < MIN_POSTS_FOR_FOCUS) {
    return { currentScore: 0, trend: [], topClusters: [], postCount };
  }

  const currentScore = computeFocusScore(posts);
  const topClusters = extractTopics(
    posts.map((p) => ({ text: p.text_full })),
    TOP_CLUSTER_COUNT,
  );
  const trend = computeRollingScores(posts);

  return { currentScore, trend, topClusters, postCount };
}
