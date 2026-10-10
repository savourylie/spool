/**
 * Audience Fit Analysis
 *
 * Pure functions for detecting audience-content mismatch (the "follower paradox").
 * The algorithm suppresses reach when followers don't match content.
 * This module compares pre-viral vs post-viral engagement rates and detects
 * demographic composition shifts over time.
 *
 * No DB access — all inputs are plain data arrays.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Flag a demographic key if it changed by more than this many percentage points */
export const SHIFT_THRESHOLD_PERCENT = 10;

/** Minimum number of snapshots in each window to run analysis */
export const MIN_SNAPSHOTS_FOR_ANALYSIS = 2;

/** Engagement drop >30% = severe mismatch */
export const ENGAGEMENT_DROP_SEVERE = 30;

/** Engagement drop >15% = moderate mismatch */
export const ENGAGEMENT_DROP_MODERATE = 15;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemographicSnapshot {
  dimension: string; // "country" | "city" | "gender"
  key: string; // e.g. "US", "NYC", "male"
  value: number; // percentage value from API
  fetched_at: string; // ISO 8601
}

export interface EngagementWindow {
  periodLabel: string;
  totalViews: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  totalShares: number;
  postCount: number;
}

export interface AlignmentScore {
  score: number; // 0-100, higher = better fit
  preViralEngagementRate: number;
  postViralEngagementRate: number;
  engagementDropPercent: number; // positive = drop, negative = improvement
  severity: "good" | "moderate" | "severe";
}

export interface DemographicShift {
  dimension: string;
  key: string;
  preValue: number;
  postValue: number;
  changePercent: number; // absolute change in percentage points
  direction: "increased" | "decreased";
}

export interface ShiftAnalysis {
  shifts: DemographicShift[];
  hasSignificantShift: boolean;
  summary: string;
}

export interface AudienceFitRecommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeEngagementRate(w: EngagementWindow): number {
  if (w.totalViews <= 0) return 0;
  const total =
    w.totalLikes +
    w.totalReplies +
    w.totalReposts +
    w.totalQuotes +
    w.totalShares;
  return (total / w.totalViews) * 100;
}

/**
 * Average the `value` for each unique key within a set of snapshots
 * for a single dimension.
 */
function averageByKey(snapshots: DemographicSnapshot[]): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();

  for (const s of snapshots) {
    const entry = sums.get(s.key) ?? { total: 0, count: 0 };
    entry.total += s.value;
    entry.count += 1;
    sums.set(s.key, entry);
  }

  const result = new Map<string, number>();
  for (const [key, { total, count }] of sums) {
    result.set(key, total / count);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Compare pre-viral vs post-viral engagement rates.
 * Returns a 0-100 alignment score — higher means better audience-content fit.
 */
export function computeAudienceAlignmentScore(
  preViral: EngagementWindow,
  postViral: EngagementWindow,
): AlignmentScore {
  const preRate = computeEngagementRate(preViral);
  const postRate = computeEngagementRate(postViral);

  // Not enough data — assume good alignment
  if (
    preViral.postCount === 0 ||
    preViral.totalViews === 0 ||
    postViral.postCount === 0 ||
    postViral.totalViews === 0
  ) {
    return {
      score: 100,
      preViralEngagementRate: preRate,
      postViralEngagementRate: postRate,
      engagementDropPercent: 0,
      severity: "good",
    };
  }

  // Positive = engagement dropped, negative = improved
  const engagementDropPercent = ((preRate - postRate) / preRate) * 100;

  // Ratio-based: postRate/preRate * 100, clamped to [0, 100]
  const score = Math.max(0, Math.min(100, Math.round((postRate / preRate) * 100)));

  let severity: "good" | "moderate" | "severe" = "good";
  if (engagementDropPercent > ENGAGEMENT_DROP_SEVERE) {
    severity = "severe";
  } else if (engagementDropPercent > ENGAGEMENT_DROP_MODERATE) {
    severity = "moderate";
  }

  return {
    score,
    preViralEngagementRate: preRate,
    postViralEngagementRate: postRate,
    engagementDropPercent,
    severity,
  };
}

/**
 * Compare demographic snapshots from two time windows.
 * Flags keys where composition changed by more than SHIFT_THRESHOLD_PERCENT.
 */
export function detectDemographicShift(
  preSnapshots: DemographicSnapshot[],
  postSnapshots: DemographicSnapshot[],
): ShiftAnalysis {
  if (preSnapshots.length === 0 || postSnapshots.length === 0) {
    return {
      shifts: [],
      hasSignificantShift: false,
      summary: "Not enough demographic data to analyze shifts.",
    };
  }

  const shifts: DemographicShift[] = [];

  // Get unique dimensions across both windows
  const dimensions = new Set([
    ...preSnapshots.map((s) => s.dimension),
    ...postSnapshots.map((s) => s.dimension),
  ]);

  for (const dimension of dimensions) {
    const preDim = preSnapshots.filter((s) => s.dimension === dimension);
    const postDim = postSnapshots.filter((s) => s.dimension === dimension);

    const preAvg = averageByKey(preDim);
    const postAvg = averageByKey(postDim);

    // Union of all keys in this dimension
    const allKeys = new Set([...preAvg.keys(), ...postAvg.keys()]);

    for (const key of allKeys) {
      const preValue = preAvg.get(key) ?? 0;
      const postValue = postAvg.get(key) ?? 0;
      const changePercent = postValue - preValue;

      if (Math.abs(changePercent) > SHIFT_THRESHOLD_PERCENT) {
        shifts.push({
          dimension,
          key,
          preValue,
          postValue,
          changePercent,
          direction: changePercent > 0 ? "increased" : "decreased",
        });
      }
    }
  }

  // Sort by magnitude descending
  shifts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const hasSignificantShift = shifts.length > 0;

  let summary: string;
  if (!hasSignificantShift) {
    summary = "Your audience composition is stable.";
  } else if (shifts.length === 1) {
    const s = shifts[0];
    const verb = s.direction === "increased" ? "grew" : "dropped";
    summary = `Your ${s.dimension} "${s.key}" audience ${verb} by ${Math.abs(Math.round(s.changePercent))} points.`;
  } else {
    const top = shifts.slice(0, 2);
    const parts = top.map((s) => {
      const verb = s.direction === "increased" ? "grew" : "dropped";
      return `${s.dimension} "${s.key}" ${verb} by ${Math.abs(Math.round(s.changePercent))} points`;
    });
    summary = `Notable shifts: ${parts.join(", ")}.`;
  }

  return { shifts, hasSignificantShift, summary };
}

/**
 * Generate actionable recommendations based on alignment score and
 * demographic shifts.
 */
export function getAudienceFitRecommendations(
  alignment: AlignmentScore,
  shiftAnalysis: ShiftAnalysis,
): AudienceFitRecommendation[] {
  const recommendations: AudienceFitRecommendation[] = [];

  if (alignment.severity === "severe") {
    recommendations.push({
      title: "Significant audience mismatch detected",
      description:
        "Your engagement rate dropped significantly after a follower influx. " +
        "Consider doubling down on your core topics to re-attract aligned followers, " +
        "or pivot your content strategy to serve your new audience.",
      priority: "high",
    });
  } else if (alignment.severity === "moderate") {
    recommendations.push({
      title: "Engagement dip after audience growth",
      description:
        "Your engagement rate has dipped moderately since gaining new followers. " +
        "Experiment with content that bridges your existing style and your new audience's interests.",
      priority: "medium",
    });
  }

  if (shiftAnalysis.hasSignificantShift) {
    recommendations.push({
      title: "Audience composition shift",
      description:
        `${shiftAnalysis.summary} ` +
        "Review which content attracted this new segment and decide whether to lean in or course-correct.",
      priority: "medium",
    });
  }

  if (
    alignment.severity === "good" &&
    !shiftAnalysis.hasSignificantShift
  ) {
    recommendations.push({
      title: "Audience-content alignment is strong",
      description:
        "Your followers match your content well. Keep doing what you're doing — " +
        "your engagement rate is holding steady relative to your audience growth.",
      priority: "low",
    });
  }

  return recommendations;
}
