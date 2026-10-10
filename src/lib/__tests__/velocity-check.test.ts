import { describe, expect, it } from "vitest";
import {
  computeEngagement,
  computeVelocityScore,
  classifyLaunchScore,
  VELOCITY_WINDOW_MINUTES_EARLY,
  VELOCITY_WINDOW_HOURS_LATE,
  VELOCITY_YELLOW_THRESHOLD,
  type VelocitySnapshot,
} from "@/lib/velocity-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  offsetMs: number,
  publishedAt: string,
  engagement: Partial<VelocitySnapshot> = {},
): VelocitySnapshot {
  const fetched_at = new Date(
    new Date(publishedAt).getTime() + offsetMs,
  ).toISOString();
  return {
    fetched_at,
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    shares: 0,
    ...engagement,
  };
}

const PUBLISHED = "2026-03-24T10:00:00.000Z";
const NOW = "2026-03-24T14:00:00.000Z"; // 4h after publish — both windows passed

const EARLY_MS = VELOCITY_WINDOW_MINUTES_EARLY * 60 * 1000; // 30 min
const LATE_MS = VELOCITY_WINDOW_HOURS_LATE * 60 * 60 * 1000; // 3 h

// ---------------------------------------------------------------------------
// computeEngagement
// ---------------------------------------------------------------------------

describe("computeEngagement", () => {
  it("sums likes + replies + reposts + quotes + shares (excludes views)", () => {
    const snap: VelocitySnapshot = {
      fetched_at: NOW,
      views: 1000,
      likes: 10,
      replies: 5,
      reposts: 3,
      quotes: 2,
      shares: 1,
    };
    expect(computeEngagement(snap)).toBe(21);
  });

  it("returns 0 when all engagement fields are zero", () => {
    const snap: VelocitySnapshot = {
      fetched_at: NOW,
      views: 500,
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    };
    expect(computeEngagement(snap)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeVelocityScore
// ---------------------------------------------------------------------------

describe("computeVelocityScore", () => {
  it("returns null for an empty snapshot array", () => {
    expect(computeVelocityScore([], PUBLISHED, NOW)).toBeNull();
  });

  it("returns null for a single snapshot", () => {
    const snaps = [makeSnapshot(EARLY_MS, PUBLISHED, { likes: 5 })];
    expect(computeVelocityScore(snaps, PUBLISHED, NOW)).toBeNull();
  });

  it("returns null when early engagement is zero (avoid divide-by-zero)", () => {
    const snaps = [
      makeSnapshot(EARLY_MS, PUBLISHED, { likes: 0 }),
      makeSnapshot(LATE_MS, PUBLISHED, { likes: 20 }),
    ];
    expect(computeVelocityScore(snaps, PUBLISHED, NOW)).toBeNull();
  });

  it("computes ratio = late engagement / early engagement", () => {
    const snaps = [
      makeSnapshot(EARLY_MS, PUBLISHED, { likes: 10 }),
      makeSnapshot(LATE_MS, PUBLISHED, { likes: 50 }),
    ];
    const ratio = computeVelocityScore(snaps, PUBLISHED, NOW);
    expect(ratio).toBeCloseTo(5.0);
  });

  it("picks snapshots closest to the target windows", () => {
    // Early snap is 25 min after publish (closer to 30-min target than the 40-min one)
    // Late snap is 3h5min (closer to 3h target)
    const snaps = [
      makeSnapshot(25 * 60 * 1000, PUBLISHED, { likes: 8 }),
      makeSnapshot(40 * 60 * 1000, PUBLISHED, { likes: 12 }),
      makeSnapshot(LATE_MS + 5 * 60 * 1000, PUBLISHED, { likes: 40 }),
    ];
    // early = 8 (25 min is closer to 30 min), late = 40
    const ratio = computeVelocityScore(snaps, PUBLISHED, NOW);
    expect(ratio).toBeCloseTo(40 / 8);
  });

  it("ignores snapshots captured after `now`", () => {
    const future = new Date(
      new Date(NOW).getTime() + 60 * 60 * 1000,
    ).toISOString();
    const snaps = [
      makeSnapshot(EARLY_MS, PUBLISHED, { likes: 10 }),
      { ...makeSnapshot(LATE_MS, PUBLISHED, { likes: 50 }), fetched_at: future },
    ];
    // Only one captured snapshot — should return null
    expect(computeVelocityScore(snaps, PUBLISHED, NOW)).toBeNull();
  });

  it("returns a ratio when closest snapshots resolve to different rows", () => {
    // Only one snapshot at 90 min — it's closest to both 30 min and 3 h targets
    const snaps = [
      makeSnapshot(90 * 60 * 1000, PUBLISHED, { likes: 15 }),
      makeSnapshot(91 * 60 * 1000, PUBLISHED, { likes: 16 }),
    ];
    // 90-min snap is closest to 30-min target; 91-min snap is closest to 3h target
    // They are different rows, so a ratio is possible
    const ratio = computeVelocityScore(snaps, PUBLISHED, NOW);
    expect(ratio).toBeCloseTo(16 / 15);
  });
});

// ---------------------------------------------------------------------------
// classifyLaunchScore
// ---------------------------------------------------------------------------

describe("classifyLaunchScore", () => {
  it("returns green when velocityRatio > historicalAverage", () => {
    expect(classifyLaunchScore(6, 5)).toBe("green");
  });

  it("returns yellow when velocityRatio is within 20% below average", () => {
    const avg = 5;
    const yellowFloor = avg * VELOCITY_YELLOW_THRESHOLD; // 4.0
    expect(classifyLaunchScore(yellowFloor, avg)).toBe("yellow");
    expect(classifyLaunchScore(4.5, avg)).toBe("yellow");
  });

  it("returns red when velocityRatio is below 80% of average", () => {
    const avg = 5;
    expect(classifyLaunchScore(3.9, avg)).toBe("red");
    expect(classifyLaunchScore(0, avg)).toBe("red");
  });

  it("returns green for any positive ratio when historicalAverage is 0", () => {
    expect(classifyLaunchScore(1, 0)).toBe("green");
  });

  it("returns yellow for a zero ratio when historicalAverage is 0", () => {
    expect(classifyLaunchScore(0, 0)).toBe("yellow");
  });

  it("returns yellow when ratio exactly equals average", () => {
    // velocityRatio > historicalAverage is false, but ≥ average * 1.0 is true (yellow)
    // Exact equality: ratio === avg → NOT > avg → check yellow threshold
    expect(classifyLaunchScore(5, 5)).toBe("yellow");
  });
});
