import { describe, it, expect } from "vitest";
import {
  computeAudienceAlignmentScore,
  detectDemographicShift,
  getAudienceFitRecommendations,
  SHIFT_THRESHOLD_PERCENT,
  type EngagementWindow,
  type DemographicSnapshot,
  type AlignmentScore,
  type ShiftAnalysis,
} from "../audience-fit";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeWindow(
  overrides?: Partial<EngagementWindow>,
): EngagementWindow {
  return {
    periodLabel: "test",
    totalViews: 10000,
    totalLikes: 200,
    totalReplies: 50,
    totalReposts: 30,
    totalQuotes: 10,
    totalShares: 10,
    postCount: 20,
    ...overrides,
  };
}

function makeSnapshot(
  dimension: string,
  key: string,
  value: number,
  daysAgo: number = 0,
): DemographicSnapshot {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { dimension, key, value, fetched_at: d.toISOString() };
}

// ---------------------------------------------------------------------------
// computeAudienceAlignmentScore
// ---------------------------------------------------------------------------

describe("computeAudienceAlignmentScore", () => {
  it("returns score 100 when pre-viral has 0 posts", () => {
    const result = computeAudienceAlignmentScore(
      makeWindow({ postCount: 0 }),
      makeWindow(),
    );
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
  });

  it("returns score 100 when pre-viral has 0 views", () => {
    const result = computeAudienceAlignmentScore(
      makeWindow({ totalViews: 0 }),
      makeWindow(),
    );
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
  });

  it("returns score 100 when post-viral has 0 posts", () => {
    const result = computeAudienceAlignmentScore(
      makeWindow(),
      makeWindow({ postCount: 0 }),
    );
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
  });

  it("returns score 100 when post-viral has 0 views", () => {
    const result = computeAudienceAlignmentScore(
      makeWindow(),
      makeWindow({ totalViews: 0 }),
    );
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
  });

  it("returns score 100 when engagement rates are equal", () => {
    const w = makeWindow();
    const result = computeAudienceAlignmentScore(w, w);
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
    expect(result.engagementDropPercent).toBe(0);
  });

  it("detects moderate engagement drop (~20%)", () => {
    // Pre: (200+50+30+10+10)/10000 = 3%
    // Post: reduce likes to get ~2.4% → (140+50+30+10+10)/10000 = 2.4%
    const pre = makeWindow();
    const post = makeWindow({ totalLikes: 140 });

    const result = computeAudienceAlignmentScore(pre, post);
    expect(result.score).toBe(80);
    expect(result.severity).toBe("moderate");
    expect(result.engagementDropPercent).toBeGreaterThan(15);
  });

  it("detects severe engagement drop (~50%)", () => {
    // Pre: 3%, Post: ~1.5% → (50+50+30+10+10)/10000 = 1.5%
    const pre = makeWindow();
    const post = makeWindow({ totalLikes: 50 });

    const result = computeAudienceAlignmentScore(pre, post);
    expect(result.score).toBe(50);
    expect(result.severity).toBe("severe");
    expect(result.engagementDropPercent).toBeGreaterThan(30);
  });

  it("clamps score at 100 when engagement improves", () => {
    const pre = makeWindow();
    const post = makeWindow({ totalLikes: 400 }); // higher engagement

    const result = computeAudienceAlignmentScore(pre, post);
    expect(result.score).toBe(100);
    expect(result.severity).toBe("good");
    expect(result.engagementDropPercent).toBeLessThan(0);
  });

  it("returns score 0 on complete engagement collapse", () => {
    const pre = makeWindow();
    const post = makeWindow({
      totalLikes: 0,
      totalReplies: 0,
      totalReposts: 0,
      totalQuotes: 0,
      totalShares: 0,
    });

    const result = computeAudienceAlignmentScore(pre, post);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("severe");
    expect(result.engagementDropPercent).toBe(100);
  });

  it("computes correct engagement rates", () => {
    // Pre: (200+50+30+10+10)/10000 = 3.0%
    const pre = makeWindow();
    const result = computeAudienceAlignmentScore(pre, pre);
    expect(result.preViralEngagementRate).toBeCloseTo(3.0);
    expect(result.postViralEngagementRate).toBeCloseTo(3.0);
  });
});

// ---------------------------------------------------------------------------
// detectDemographicShift
// ---------------------------------------------------------------------------

describe("detectDemographicShift", () => {
  it("returns no shifts when pre-snapshots are empty", () => {
    const result = detectDemographicShift([], [
      makeSnapshot("country", "US", 50),
    ]);
    expect(result.hasSignificantShift).toBe(false);
    expect(result.shifts).toHaveLength(0);
    expect(result.summary).toContain("Not enough");
  });

  it("returns no shifts when post-snapshots are empty", () => {
    const result = detectDemographicShift(
      [makeSnapshot("country", "US", 50)],
      [],
    );
    expect(result.hasSignificantShift).toBe(false);
    expect(result.shifts).toHaveLength(0);
  });

  it("returns no shifts when change is below threshold", () => {
    const pre = [makeSnapshot("country", "US", 50, 30)];
    const post = [makeSnapshot("country", "US", 48, 0)];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(false);
    expect(result.shifts).toHaveLength(0);
    expect(result.summary).toBe("Your audience composition is stable.");
  });

  it("does not flag change at exactly the threshold", () => {
    const pre = [makeSnapshot("country", "US", 50, 30)];
    const post = [
      makeSnapshot("country", "US", 50 - SHIFT_THRESHOLD_PERCENT, 0),
    ];

    const result = detectDemographicShift(pre, post);
    // Exactly 10 points = at threshold, not exceeding (> not >=)
    expect(result.hasSignificantShift).toBe(false);
  });

  it("flags change just over the threshold", () => {
    const pre = [makeSnapshot("country", "US", 50, 30)];
    const post = [
      makeSnapshot("country", "US", 50 - SHIFT_THRESHOLD_PERCENT - 0.1, 0),
    ];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0].direction).toBe("decreased");
  });

  it("detects a single large shift", () => {
    const pre = [makeSnapshot("country", "US", 50, 30)];
    const post = [makeSnapshot("country", "US", 35, 0)];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0]).toEqual(
      expect.objectContaining({
        dimension: "country",
        key: "US",
        preValue: 50,
        postValue: 35,
        changePercent: -15,
        direction: "decreased",
      }),
    );
    expect(result.summary).toContain("US");
    expect(result.summary).toContain("dropped");
  });

  it("detects shifts across multiple dimensions", () => {
    const pre = [
      makeSnapshot("country", "US", 50, 30),
      makeSnapshot("gender", "male", 60, 30),
    ];
    const post = [
      makeSnapshot("country", "US", 35, 0),
      makeSnapshot("gender", "male", 45, 0),
    ];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    expect(result.shifts).toHaveLength(2);
    // Should be sorted by magnitude descending (both 15pp)
    expect(result.summary).toContain("Notable shifts:");
  });

  it("detects a new key appearing in post-window", () => {
    const pre = [makeSnapshot("country", "US", 80, 30)];
    const post = [
      makeSnapshot("country", "US", 65, 0),
      makeSnapshot("country", "UK", 15, 0),
    ];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    const ukShift = result.shifts.find((s) => s.key === "UK");
    expect(ukShift).toBeDefined();
    expect(ukShift!.preValue).toBe(0);
    expect(ukShift!.postValue).toBe(15);
    expect(ukShift!.direction).toBe("increased");
  });

  it("detects a key disappearing from post-window", () => {
    const pre = [
      makeSnapshot("country", "US", 65, 30),
      makeSnapshot("country", "UK", 15, 30),
    ];
    const post = [makeSnapshot("country", "US", 80, 0)];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    const ukShift = result.shifts.find((s) => s.key === "UK");
    expect(ukShift).toBeDefined();
    expect(ukShift!.postValue).toBe(0);
    expect(ukShift!.direction).toBe("decreased");
  });

  it("averages values across multiple snapshots per window", () => {
    // Pre: US at 50 and 52 → avg 51
    // Post: US at 35 and 37 → avg 36
    // Shift: 36 - 51 = -15 points
    const pre = [
      makeSnapshot("country", "US", 50, 10),
      makeSnapshot("country", "US", 52, 9),
    ];
    const post = [
      makeSnapshot("country", "US", 35, 1),
      makeSnapshot("country", "US", 37, 0),
    ];

    const result = detectDemographicShift(pre, post);
    expect(result.hasSignificantShift).toBe(true);
    expect(result.shifts[0].preValue).toBe(51);
    expect(result.shifts[0].postValue).toBe(36);
    expect(result.shifts[0].changePercent).toBe(-15);
  });
});

// ---------------------------------------------------------------------------
// getAudienceFitRecommendations
// ---------------------------------------------------------------------------

describe("getAudienceFitRecommendations", () => {
  const goodAlignment: AlignmentScore = {
    score: 95,
    preViralEngagementRate: 3.0,
    postViralEngagementRate: 2.85,
    engagementDropPercent: 5,
    severity: "good",
  };

  const moderateAlignment: AlignmentScore = {
    score: 75,
    preViralEngagementRate: 3.0,
    postViralEngagementRate: 2.25,
    engagementDropPercent: 25,
    severity: "moderate",
  };

  const severeAlignment: AlignmentScore = {
    score: 40,
    preViralEngagementRate: 3.0,
    postViralEngagementRate: 1.2,
    engagementDropPercent: 60,
    severity: "severe",
  };

  const noShift: ShiftAnalysis = {
    shifts: [],
    hasSignificantShift: false,
    summary: "Your audience composition is stable.",
  };

  const hasShift: ShiftAnalysis = {
    shifts: [
      {
        dimension: "country",
        key: "US",
        preValue: 50,
        postValue: 35,
        changePercent: -15,
        direction: "decreased",
      },
    ],
    hasSignificantShift: true,
    summary: 'Your country "US" audience dropped by 15 points.',
  };

  it("returns low-priority all-clear when alignment is good and no shift", () => {
    const recs = getAudienceFitRecommendations(goodAlignment, noShift);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe("low");
    expect(recs[0].title).toContain("strong");
  });

  it("returns high-priority recommendation for severe alignment", () => {
    const recs = getAudienceFitRecommendations(severeAlignment, noShift);
    expect(recs.some((r) => r.priority === "high")).toBe(true);
    expect(recs.some((r) => r.title.includes("mismatch"))).toBe(true);
  });

  it("returns medium-priority recommendation for moderate alignment", () => {
    const recs = getAudienceFitRecommendations(moderateAlignment, noShift);
    expect(recs.some((r) => r.priority === "medium")).toBe(true);
    expect(recs.some((r) => r.title.includes("dip"))).toBe(true);
  });

  it("returns demographic shift recommendation when shift detected", () => {
    const recs = getAudienceFitRecommendations(goodAlignment, hasShift);
    expect(recs.some((r) => r.title.includes("shift"))).toBe(true);
    // No "all clear" when there's a shift
    expect(recs.some((r) => r.priority === "low")).toBe(false);
  });

  it("returns both alignment and shift recommendations when both present", () => {
    const recs = getAudienceFitRecommendations(moderateAlignment, hasShift);
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.priority === "medium")).toBe(true);
  });
});
