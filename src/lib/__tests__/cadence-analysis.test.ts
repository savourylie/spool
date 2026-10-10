import { describe, expect, it } from "vitest";
import {
  CADENCE_THRESHOLDS,
  type CadencePost,
  type CadenceScatterPoint,
  computeCadenceScatterData,
  computeCadenceStats,
  detectSameDayCollisions,
  getCadenceRecommendation,
  ceilToNiceNumber,
  computeAxisThresholds,
  clampAndSplitScatterData,
} from "../cadence-analysis";

function makePost(isoDate: string, views: number): CadencePost {
  return { published_at: isoDate, views };
}

// ---------------------------------------------------------------------------
// CADENCE_THRESHOLDS
// ---------------------------------------------------------------------------

describe("CADENCE_THRESHOLDS", () => {
  it("has minGapHours of 18", () => {
    expect(CADENCE_THRESHOLDS.minGapHours).toBe(18);
  });

  it("has recentWindowDays of 30", () => {
    expect(CADENCE_THRESHOLDS.recentWindowDays).toBe(30);
  });

  it("has minPostsForRecommendation of 3", () => {
    expect(CADENCE_THRESHOLDS.minPostsForRecommendation).toBe(3);
  });

  it("has outlierPercentile of 95", () => {
    expect(CADENCE_THRESHOLDS.outlierPercentile).toBe(95);
  });
});

// ---------------------------------------------------------------------------
// computeCadenceStats
// ---------------------------------------------------------------------------

describe("computeCadenceStats", () => {
  it("returns all zeros for empty array", () => {
    expect(computeCadenceStats([])).toEqual({
      avgPostsPerDay: 0,
      avgGapHours: 0,
      longestGapHours: 0,
      shortestGapHours: 0,
      postCount: 0,
    });
  });

  it("returns postCount 1 and zero gaps for a single post", () => {
    const result = computeCadenceStats([
      makePost("2025-03-15T12:00:00Z", 100),
    ]);
    expect(result.postCount).toBe(1);
    expect(result.avgPostsPerDay).toBeCloseTo(1 / 30);
    expect(result.avgGapHours).toBe(0);
    expect(result.longestGapHours).toBe(0);
    expect(result.shortestGapHours).toBe(0);
  });

  it("computes stats for two posts 24h apart", () => {
    const result = computeCadenceStats([
      makePost("2025-03-14T12:00:00Z", 200),
      makePost("2025-03-15T12:00:00Z", 300),
    ]);
    expect(result.postCount).toBe(2);
    expect(result.avgPostsPerDay).toBeCloseTo(2 / 30);
    expect(result.avgGapHours).toBe(24);
    expect(result.longestGapHours).toBe(24);
    expect(result.shortestGapHours).toBe(24);
  });

  it("only counts posts within the 30-day window from most recent post", () => {
    const result = computeCadenceStats([
      makePost("2025-01-01T12:00:00Z", 50), // 73 days before most recent → outside window
      makePost("2025-03-01T12:00:00Z", 100), // 14 days before → inside window
      makePost("2025-03-15T12:00:00Z", 200), // most recent
    ]);
    expect(result.postCount).toBe(2);
    expect(result.avgGapHours).toBe(14 * 24); // gap between Mar 1 and Mar 15
  });

  it("handles all posts on the same day", () => {
    const result = computeCadenceStats([
      makePost("2025-03-15T08:00:00Z", 100),
      makePost("2025-03-15T10:00:00Z", 200),
      makePost("2025-03-15T14:00:00Z", 300),
    ]);
    expect(result.postCount).toBe(3);
    expect(result.avgPostsPerDay).toBeCloseTo(3 / 30);
    expect(result.avgGapHours).toBe(3); // (2 + 4) / 2
    expect(result.longestGapHours).toBe(4);
    expect(result.shortestGapHours).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeCadenceScatterData
// ---------------------------------------------------------------------------

describe("computeCadenceScatterData", () => {
  it("returns empty array for no posts", () => {
    expect(computeCadenceScatterData([])).toEqual([]);
  });

  it("returns empty array for a single post", () => {
    expect(
      computeCadenceScatterData([makePost("2025-03-15T12:00:00Z", 100)]),
    ).toEqual([]);
  });

  it("computes scatter points for three posts with known gaps", () => {
    const posts = [
      makePost("2025-03-15T00:00:00Z", 100),
      makePost("2025-03-15T12:00:00Z", 200),
      makePost("2025-03-16T12:00:00Z", 400),
    ];
    const result = computeCadenceScatterData(posts);
    expect(result).toEqual([
      { hoursSincePrevious: 12, views: 200 },
      { hoursSincePrevious: 24, views: 400 },
    ]);
  });

  it("handles unsorted input correctly", () => {
    const posts = [
      makePost("2025-03-16T12:00:00Z", 400),
      makePost("2025-03-15T00:00:00Z", 100),
      makePost("2025-03-15T12:00:00Z", 200),
    ];
    const result = computeCadenceScatterData(posts);
    expect(result).toEqual([
      { hoursSincePrevious: 12, views: 200 },
      { hoursSincePrevious: 24, views: 400 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// detectSameDayCollisions
// ---------------------------------------------------------------------------

describe("detectSameDayCollisions", () => {
  it("returns empty array for no posts", () => {
    expect(detectSameDayCollisions([], "UTC")).toEqual([]);
  });

  it("returns empty array when no collisions exist", () => {
    const posts = [
      makePost("2025-03-14T12:00:00Z", 100),
      makePost("2025-03-15T12:00:00Z", 200),
      makePost("2025-03-16T12:00:00Z", 300),
    ];
    expect(detectSameDayCollisions(posts, "UTC")).toEqual([]);
  });

  it("detects two posts on the same day", () => {
    const posts = [
      makePost("2025-03-15T08:00:00Z", 100),
      makePost("2025-03-15T16:00:00Z", 200),
    ];
    const result = detectSameDayCollisions(posts, "UTC");
    expect(result).toEqual([{ date: "2025-03-15", postViews: [100, 200] }]);
  });

  it("detects all posts on the same day", () => {
    const posts = [
      makePost("2025-03-15T08:00:00Z", 100),
      makePost("2025-03-15T12:00:00Z", 200),
      makePost("2025-03-15T18:00:00Z", 300),
    ];
    const result = detectSameDayCollisions(posts, "UTC");
    expect(result).toEqual([
      { date: "2025-03-15", postViews: [100, 200, 300] },
    ]);
  });

  it("respects timezone for date grouping", () => {
    // 23:00 UTC on Mar 15 = 18:00 EST (still Mar 15)
    // 01:00 UTC on Mar 16 = 20:00 EST on Mar 15 (same day in EST!)
    const posts = [
      makePost("2025-03-15T23:00:00Z", 100),
      makePost("2025-03-16T01:00:00Z", 200),
    ];

    // In UTC these are on different days → no collision
    expect(detectSameDayCollisions(posts, "UTC")).toEqual([]);

    // In America/New_York (UTC-4 in March / EDT) these are both Mar 15
    const estResult = detectSameDayCollisions(posts, "America/New_York");
    expect(estResult).toHaveLength(1);
    expect(estResult[0].postViews).toEqual([100, 200]);
  });

  it("sorts multiple collision dates descending", () => {
    const posts = [
      makePost("2025-03-14T08:00:00Z", 50),
      makePost("2025-03-14T16:00:00Z", 60),
      makePost("2025-03-16T08:00:00Z", 100),
      makePost("2025-03-16T16:00:00Z", 200),
    ];
    const result = detectSameDayCollisions(posts, "UTC");
    expect(result).toEqual([
      { date: "2025-03-16", postViews: [100, 200] },
      { date: "2025-03-14", postViews: [50, 60] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// getCadenceRecommendation
// ---------------------------------------------------------------------------

describe("getCadenceRecommendation", () => {
  it("returns null for empty array", () => {
    expect(getCadenceRecommendation([])).toBeNull();
  });

  it("returns null for a single post", () => {
    expect(
      getCadenceRecommendation([makePost("2025-03-15T12:00:00Z", 100)]),
    ).toBeNull();
  });

  it("returns null for two posts (below minPostsForRecommendation)", () => {
    expect(
      getCadenceRecommendation([
        makePost("2025-03-14T12:00:00Z", 100),
        makePost("2025-03-15T12:00:00Z", 200),
      ]),
    ).toBeNull();
  });

  it("returns null when all gaps are above threshold (no below-bucket)", () => {
    const posts = [
      makePost("2025-03-10T12:00:00Z", 100),
      makePost("2025-03-11T12:00:00Z", 200), // 24h gap
      makePost("2025-03-12T12:00:00Z", 300), // 24h gap
      makePost("2025-03-13T12:00:00Z", 400), // 24h gap
    ];
    expect(getCadenceRecommendation(posts)).toBeNull();
  });

  it("returns null when all gaps are below threshold (no above-bucket)", () => {
    const posts = [
      makePost("2025-03-15T00:00:00Z", 100),
      makePost("2025-03-15T06:00:00Z", 200), // 6h gap
      makePost("2025-03-15T12:00:00Z", 300), // 6h gap
      makePost("2025-03-15T18:00:00Z", 400), // 6h gap
    ];
    expect(getCadenceRecommendation(posts)).toBeNull();
  });

  it("returns triggered recommendation for mixed gaps with avg < 18h", () => {
    // 5 posts: gaps are 6h, 6h, 24h, 24h → avg gap = 15h (< 18h)
    // Below-threshold (< 18h) posts: views 200, 300 → avg 250
    // Above-threshold (>= 18h) posts: views 400, 500 → avg 450
    // Improvement: ((450 - 250) / 250) * 100 = 80%
    const posts = [
      makePost("2025-03-15T00:00:00Z", 100),
      makePost("2025-03-15T06:00:00Z", 200), // 6h gap
      makePost("2025-03-15T12:00:00Z", 300), // 6h gap
      makePost("2025-03-16T12:00:00Z", 400), // 24h gap
      makePost("2025-03-17T12:00:00Z", 500), // 24h gap
    ];
    const result = getCadenceRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.currentAvgGapHours).toBe(15);
    expect(result!.avgViewsBelowThreshold).toBe(250);
    expect(result!.avgViewsAboveThreshold).toBe(450);
    expect(result!.percentageImprovement).toBe(80);
  });

  it("returns non-triggered recommendation when avg gap >= 18h", () => {
    // 5 posts: gaps are 8h, 24h, 24h, 24h → avg gap = 20h (>= 18h)
    const posts = [
      makePost("2025-03-14T00:00:00Z", 100),
      makePost("2025-03-14T08:00:00Z", 150), // 8h gap
      makePost("2025-03-15T08:00:00Z", 300), // 24h gap
      makePost("2025-03-16T08:00:00Z", 400), // 24h gap
      makePost("2025-03-17T08:00:00Z", 500), // 24h gap
    ];
    const result = getCadenceRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(false);
    expect(result!.currentAvgGapHours).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// ceilToNiceNumber
// ---------------------------------------------------------------------------

describe("ceilToNiceNumber", () => {
  it("returns 0 for 0", () => {
    expect(ceilToNiceNumber(0)).toBe(0);
  });

  it("returns 0 for negative values", () => {
    expect(ceilToNiceNumber(-5)).toBe(0);
  });

  it("rounds up to next multiple of 10 for values < 100", () => {
    expect(ceilToNiceNumber(1)).toBe(10);
    expect(ceilToNiceNumber(47)).toBe(50);
    expect(ceilToNiceNumber(91)).toBe(100);
  });

  it("keeps exact multiples of 10 for values < 100", () => {
    expect(ceilToNiceNumber(50)).toBe(50);
  });

  it("rounds up to next multiple of 50 for values 100–999", () => {
    expect(ceilToNiceNumber(101)).toBe(150);
    expect(ceilToNiceNumber(870)).toBe(900);
  });

  it("rounds up to next multiple of 500 for values 1000–9999", () => {
    expect(ceilToNiceNumber(1001)).toBe(1500);
    expect(ceilToNiceNumber(4200)).toBe(4500);
  });

  it("rounds up to next multiple of 5000 for values 10000–99999", () => {
    expect(ceilToNiceNumber(10001)).toBe(15000);
    expect(ceilToNiceNumber(45000)).toBe(45000);
    expect(ceilToNiceNumber(46000)).toBe(50000);
  });

  it("rounds up to next multiple of 50000 for values >= 100000", () => {
    expect(ceilToNiceNumber(100001)).toBe(150000);
    expect(ceilToNiceNumber(230000)).toBe(250000);
  });
});

// ---------------------------------------------------------------------------
// computeAxisThresholds
// ---------------------------------------------------------------------------

function makePoint(hours: number, views: number): CadenceScatterPoint {
  return { hoursSincePrevious: hours, views };
}

describe("computeAxisThresholds", () => {
  it("returns { x: 0, y: 0 } for empty array", () => {
    expect(computeAxisThresholds([])).toEqual({ x: 0, y: 0 });
  });

  it("returns nice-rounded values for a single point", () => {
    const result = computeAxisThresholds([makePoint(47, 3200)]);
    expect(result.x).toBe(50);   // 47 → ceil to nice → 50
    expect(result.y).toBe(3500); // 3200 → ceil to nice → 3500
  });

  it("computes 95th percentile and rounds up for a 20-point dataset", () => {
    // 20 points with hours 5,10,...,100 and views 1000,2000,...,20000
    const points = Array.from({ length: 20 }, (_, i) =>
      makePoint((i + 1) * 5, (i + 1) * 1000),
    );
    // 95th percentile of hours [5..100]: rank = 0.95 * 19 = 18.05
    //   sorted[18] = 95, sorted[19] = 100 → 95 + 0.05 * 5 = 95.25 → nice → 100
    // 95th percentile of views [1000..20000]: rank = 18.05
    //   sorted[18] = 19000, sorted[19] = 20000 → 19000 + 0.05 * 1000 = 19050 → nice → 20000
    const result = computeAxisThresholds(points);
    expect(result.x).toBe(100);
    expect(result.y).toBe(20000);
  });

  it("respects custom percentile parameter", () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      makePoint((i + 1) * 5, (i + 1) * 1000),
    );
    const result = computeAxisThresholds(points, 50);
    // 50th percentile: rank = 0.5 * 19 = 9.5
    //   hours: sorted[9] = 50, sorted[10] = 55 → 50 + 0.5 * 5 = 52.5 → nice → 60
    //   views: sorted[9] = 10000, sorted[10] = 11000 → 10000 + 0.5 * 1000 = 10500 → nice → 15000
    expect(result.x).toBe(60);
    expect(result.y).toBe(15000);
  });

  it("handles all-identical values", () => {
    const points = [makePoint(24, 5000), makePoint(24, 5000), makePoint(24, 5000)];
    const result = computeAxisThresholds(points);
    expect(result.x).toBe(30);   // 24 → nice → 30
    expect(result.y).toBe(5000); // 5000 → nice → 5000
  });
});

// ---------------------------------------------------------------------------
// clampAndSplitScatterData
// ---------------------------------------------------------------------------

describe("clampAndSplitScatterData", () => {
  const thresholds = { x: 150, y: 45000 };

  it("returns empty arrays for empty input", () => {
    const result = clampAndSplitScatterData([], thresholds);
    expect(result.normalPoints).toEqual([]);
    expect(result.outlierPoints).toEqual([]);
    expect(result.outlierCount).toBe(0);
  });

  it("classifies all points as normal when none exceed thresholds", () => {
    const points = [makePoint(24, 1000), makePoint(48, 30000)];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.normalPoints).toHaveLength(2);
    expect(result.outlierPoints).toHaveLength(0);
    expect(result.outlierCount).toBe(0);
  });

  it("classifies X-axis outlier and clamps hours", () => {
    const points = [makePoint(200, 1000)];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.outlierPoints).toHaveLength(1);
    expect(result.outlierPoints[0].hoursSincePrevious).toBe(150); // clamped
    expect(result.outlierPoints[0].originalHoursSincePrevious).toBe(200);
    expect(result.outlierPoints[0].isOutlier).toBe(true);
  });

  it("classifies Y-axis outlier and clamps views", () => {
    const points = [makePoint(24, 80000)];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.outlierPoints).toHaveLength(1);
    expect(result.outlierPoints[0].views).toBe(45000); // clamped
    expect(result.outlierPoints[0].originalViews).toBe(80000);
  });

  it("classifies dual-axis outlier and clamps both", () => {
    const points = [makePoint(200, 80000)];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.outlierPoints).toHaveLength(1);
    expect(result.outlierPoints[0].hoursSincePrevious).toBe(150);
    expect(result.outlierPoints[0].views).toBe(45000);
  });

  it("treats point exactly at threshold as normal (> not >=)", () => {
    const points = [makePoint(150, 45000)];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.normalPoints).toHaveLength(1);
    expect(result.outlierPoints).toHaveLength(0);
  });

  it("preserves original values on normal points", () => {
    const points = [makePoint(24, 5000)];
    const result = clampAndSplitScatterData(points, thresholds);
    const p = result.normalPoints[0];
    expect(p.originalHoursSincePrevious).toBe(24);
    expect(p.originalViews).toBe(5000);
    expect(p.isOutlier).toBe(false);
  });

  it("outlierCount matches outlierPoints length", () => {
    const points = [
      makePoint(24, 1000),   // normal
      makePoint(200, 1000),  // X outlier
      makePoint(24, 80000),  // Y outlier
    ];
    const result = clampAndSplitScatterData(points, thresholds);
    expect(result.outlierCount).toBe(2);
    expect(result.outlierPoints).toHaveLength(2);
    expect(result.normalPoints).toHaveLength(1);
  });
});
