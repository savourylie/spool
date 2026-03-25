/**
 * Engagement Prediction
 *
 * Statistical model that predicts expected engagement range (views) for a post
 * based on the user's historical performance data. Groups historical posts by
 * matching characteristics and computes percentiles from similar posts' views.
 *
 * Optionally refined by an LLM layer that adjusts predictions based on content
 * quality analysis.
 *
 * Depends on: llm-client (TICKET-037) for refinement prompt building.
 */

// ── Constants ────────────────────────────────────────────────────────

export const MIN_POSTS_FOR_PREDICTION = 10;
export const MIN_MATCHED_POSTS = 5;
export const HOUR_BUCKET_TOLERANCE = 2;
export const LLM_MULTIPLIER_MIN = 0.5;
export const LLM_MULTIPLIER_MAX = 2.0;

const TEXT_LENGTH_BOUNDARIES = {
  short: { min: 0, max: 50 },
  medium: { min: 51, max: 150 },
  long: { min: 151, max: Infinity },
} as const;

// ── Types ────────────────────────────────────────────────────────────

export type TextLengthBucket = "short" | "medium" | "long";

export interface PostCharacteristics {
  mediaType: string;
  textLength: number;
  dayOfWeek: number; // 0 (Sunday) – 6 (Saturday)
  hourOfDay: number; // 0–23
  topicTag?: string | null;
  timeSinceLastPost?: number | null; // hours
}

export interface HistoricalPost {
  views: number;
  media_type: string;
  text_length: number;
  published_at: string; // ISO 8601
  topic_tag: string | null;
}

export interface PredictionRange {
  p25: number;
  p50: number;
  p75: number;
  matchedCount: number;
  confidence: "high" | "medium" | "low";
}

export interface LLMRefinement {
  adjustedP25: number;
  adjustedP50: number;
  adjustedP75: number;
  reasoning: string;
}

export type PredictionResult =
  | { status: "ok"; range: PredictionRange }
  | { status: "insufficient_data"; totalPosts: number; required: number };

// ── Helpers ──────────────────────────────────────────────────────────

export function getTextLengthBucket(length: number): TextLengthBucket {
  if (length <= TEXT_LENGTH_BOUNDARIES.short.max) return "short";
  if (length <= TEXT_LENGTH_BOUNDARIES.medium.max) return "medium";
  return "long";
}

export function isInHourBucket(
  postHour: number,
  targetHour: number,
  tolerance: number,
): boolean {
  const diff = Math.abs(postHour - targetHour);
  return Math.min(diff, 24 - diff) <= tolerance;
}

export function computePercentile(
  sorted: number[],
  percentile: number,
): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const rank = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sorted[lower];
  return sorted[lower] + (rank - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Format a number for compact display (1.2K, 3.5M).
 * Shared utility — also used by post-table.tsx.
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Core Prediction ──────────────────────────────────────────────────

type MatchTier = {
  filter: (post: HistoricalPost, chars: PostCharacteristics) => boolean;
  confidence: PredictionRange["confidence"];
};

const MATCH_TIERS: MatchTier[] = [
  {
    // Tier 1: media type + day + hour + text length bucket
    filter: (post, chars) => {
      const postDate = new Date(post.published_at);
      return (
        post.media_type === chars.mediaType &&
        postDate.getUTCDay() === chars.dayOfWeek &&
        isInHourBucket(postDate.getUTCHours(), chars.hourOfDay, HOUR_BUCKET_TOLERANCE) &&
        getTextLengthBucket(post.text_length) === getTextLengthBucket(chars.textLength)
      );
    },
    confidence: "high",
  },
  {
    // Tier 2: media type + day + text length bucket
    filter: (post, chars) => {
      const postDate = new Date(post.published_at);
      return (
        post.media_type === chars.mediaType &&
        postDate.getUTCDay() === chars.dayOfWeek &&
        getTextLengthBucket(post.text_length) === getTextLengthBucket(chars.textLength)
      );
    },
    confidence: "high",
  },
  {
    // Tier 3: media type + text length bucket
    filter: (post, chars) =>
      post.media_type === chars.mediaType &&
      getTextLengthBucket(post.text_length) === getTextLengthBucket(chars.textLength),
    confidence: "medium",
  },
  {
    // Tier 4: media type only
    filter: (post, chars) => post.media_type === chars.mediaType,
    confidence: "low",
  },
  {
    // Tier 5: global fallback (all posts)
    filter: () => true,
    confidence: "low",
  },
];

/**
 * Predict engagement range for a post based on historical performance.
 * Returns p25/p50/p75 views from matching historical posts, with
 * progressive widening if too few matches are found.
 */
export function predictEngagement(
  posts: HistoricalPost[],
  characteristics: PostCharacteristics,
): PredictionResult {
  if (posts.length < MIN_POSTS_FOR_PREDICTION) {
    return {
      status: "insufficient_data",
      totalPosts: posts.length,
      required: MIN_POSTS_FOR_PREDICTION,
    };
  }

  for (const tier of MATCH_TIERS) {
    const matched = posts.filter((p) => tier.filter(p, characteristics));
    if (matched.length >= MIN_MATCHED_POSTS) {
      const sortedViews = matched.map((p) => p.views).sort((a, b) => a - b);
      return {
        status: "ok",
        range: {
          p25: Math.round(computePercentile(sortedViews, 25)),
          p50: Math.round(computePercentile(sortedViews, 50)),
          p75: Math.round(computePercentile(sortedViews, 75)),
          matchedCount: matched.length,
          confidence: tier.confidence,
        },
      };
    }
  }

  // Should never reach here since tier 5 matches all posts and
  // we require MIN_POSTS_FOR_PREDICTION >= MIN_MATCHED_POSTS
  const sortedViews = posts.map((p) => p.views).sort((a, b) => a - b);
  return {
    status: "ok",
    range: {
      p25: Math.round(computePercentile(sortedViews, 25)),
      p50: Math.round(computePercentile(sortedViews, 50)),
      p75: Math.round(computePercentile(sortedViews, 75)),
      matchedCount: posts.length,
      confidence: "low",
    },
  };
}

// ── LLM Refinement ───────────────────────────────────────────────────

const REFINEMENT_SYSTEM_PROMPT = `You are a social media performance analyst. Given a draft post and a statistical prediction of its expected view range, evaluate the content quality and return a multiplier to adjust the prediction.

Consider:
- Hook strength (does the first line grab attention?)
- Shareability (would someone DM this to a friend?)
- Clarity and conciseness
- Emotional resonance or practical value

Return ONLY a valid JSON object — no markdown fences, no explanation:

{
  "multiplier": <number between 0.5 and 2.0>,
  "reasoning": "<1-2 sentences explaining the adjustment>"
}

A multiplier of 1.0 means the statistical prediction is accurate as-is.
Above 1.0 means the content quality suggests better-than-average performance.
Below 1.0 means quality issues suggest underperformance.`;

export function buildPredictionRefinementPrompt(
  text: string,
  range: PredictionRange,
  followerCount: number,
): { systemPrompt: string; userMessage: string } {
  const userMessage = `Draft post:
${text}

Statistical prediction (based on ${range.matchedCount} similar posts):
- Low (25th percentile): ${formatNumber(range.p25)} views
- Expected (50th percentile): ${formatNumber(range.p50)} views
- High (75th percentile): ${formatNumber(range.p75)} views

Creator's follower count: ${formatNumber(followerCount)}

Evaluate this draft's quality relative to the statistical prediction and return a multiplier adjustment.`;

  return { systemPrompt: REFINEMENT_SYSTEM_PROMPT, userMessage };
}

/**
 * Parse the raw LLM response into a multiplier and reasoning.
 * Clamps the multiplier to [0.5, 2.0] for safety.
 */
export function parsePredictionRefinement(
  raw: string,
): { multiplier: number; reasoning: string } {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned);
  const rawMultiplier = Number(parsed.multiplier);

  if (!Number.isFinite(rawMultiplier)) {
    throw new Error("Invalid multiplier in LLM response");
  }

  const multiplier = Math.max(
    LLM_MULTIPLIER_MIN,
    Math.min(LLM_MULTIPLIER_MAX, rawMultiplier),
  );
  const reasoning =
    typeof parsed.reasoning === "string" ? parsed.reasoning : "";

  return { multiplier, reasoning };
}

/**
 * Apply a multiplier from LLM refinement to the statistical prediction range.
 */
export function applyLLMRefinement(
  range: PredictionRange,
  multiplier: number,
  reasoning: string,
): LLMRefinement {
  const clamped = Math.max(
    LLM_MULTIPLIER_MIN,
    Math.min(LLM_MULTIPLIER_MAX, multiplier),
  );

  return {
    adjustedP25: Math.round(range.p25 * clamped),
    adjustedP50: Math.round(range.p50 * clamped),
    adjustedP75: Math.round(range.p75 * clamped),
    reasoning,
  };
}
