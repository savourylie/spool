import { describe, expect, it } from "vitest";
import {
  VIRAL_VIEW_MULTIPLIER,
  VIRAL_FOLLOWER_SPIKE_THRESHOLD,
  RECOVERY_WINDOW_DAYS,
  MIN_POST_WAIT_HOURS,
  RECOMMENDED_POST_WAIT_HOURS,
  computeMedianViews,
  detectViralPosts,
  detectFollowerSpike,
  getViralRecoveryState,
  type ViralDetectionPost,
  type DailyStat,
} from "../viral-detection";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let postCounter = 0;

function makePost(
  published_at: string,
  views: number,
  overrides?: Partial<ViralDetectionPost>,
): ViralDetectionPost {
  postCounter++;
  return {
    id: `post-${postCounter}`,
    text_preview: "Test post",
    permalink: null,
    published_at,
    views,
    ...overrides,
  };
}

function makeStat(
  date: string,
  followers_count: number | null,
): DailyStat {
  return { date, followers_count };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("VIRAL_VIEW_MULTIPLIER is 5", () => {
    expect(VIRAL_VIEW_MULTIPLIER).toBe(5);
  });

  it("VIRAL_FOLLOWER_SPIKE_THRESHOLD is 100", () => {
    expect(VIRAL_FOLLOWER_SPIKE_THRESHOLD).toBe(100);
  });

  it("RECOVERY_WINDOW_DAYS is 7", () => {
    expect(RECOVERY_WINDOW_DAYS).toBe(7);
  });

  it("MIN_POST_WAIT_HOURS is 24", () => {
    expect(MIN_POST_WAIT_HOURS).toBe(24);
  });

  it("RECOMMENDED_POST_WAIT_HOURS is 48", () => {
    expect(RECOMMENDED_POST_WAIT_HOURS).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// computeMedianViews
// ---------------------------------------------------------------------------

describe("computeMedianViews", () => {
  it("returns 0 for empty array", () => {
    expect(computeMedianViews([])).toBe(0);
  });

  it("returns the views for a single post", () => {
    expect(computeMedianViews([makePost("2025-01-01T12:00:00Z", 500)])).toBe(
      500,
    );
  });

  it("returns middle value for odd-length array", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 300),
      makePost("2025-01-03T12:00:00Z", 200),
    ];
    expect(computeMedianViews(posts)).toBe(200);
  });

  it("returns average of two middle values for even-length array", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 200),
      makePost("2025-01-03T12:00:00Z", 300),
      makePost("2025-01-04T12:00:00Z", 400),
    ];
    expect(computeMedianViews(posts)).toBe(250);
  });

  it("handles all posts with 0 views", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 0),
      makePost("2025-01-02T12:00:00Z", 0),
    ];
    expect(computeMedianViews(posts)).toBe(0);
  });

  it("handles duplicate view counts", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 500),
      makePost("2025-01-02T12:00:00Z", 500),
      makePost("2025-01-03T12:00:00Z", 500),
    ];
    expect(computeMedianViews(posts)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// detectViralPosts
// ---------------------------------------------------------------------------

describe("detectViralPosts", () => {
  it("returns empty array for empty input", () => {
    expect(detectViralPosts([])).toEqual([]);
  });

  it("returns empty array for a single post", () => {
    // A single post has median = its own views, so views > 5 * views is false
    const posts = [makePost("2025-01-01T12:00:00Z", 1000)];
    expect(detectViralPosts(posts)).toEqual([]);
  });

  it("returns empty array when no post exceeds 5x median", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 200),
      makePost("2025-01-03T12:00:00Z", 300),
    ];
    // median = 200, threshold = 1000, max views = 300
    expect(detectViralPosts(posts)).toEqual([]);
  });

  it("detects a single viral post", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 100),
      makePost("2025-01-03T12:00:00Z", 100),
      makePost("2025-01-04T12:00:00Z", 100),
      makePost("2025-01-05T12:00:00Z", 10000),
    ];
    // median = 100, threshold = 500
    const result = detectViralPosts(posts);
    expect(result).toHaveLength(1);
    expect(result[0].post.views).toBe(10000);
    expect(result[0].medianViews).toBe(100);
    expect(result[0].viewMultiplier).toBe(100);
  });

  it("returns multiple viral posts sorted by viewMultiplier desc", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 100),
      makePost("2025-01-03T12:00:00Z", 100),
      makePost("2025-01-04T12:00:00Z", 1000), // 10x
      makePost("2025-01-05T12:00:00Z", 5000), // 50x
    ];
    // median = 100, threshold = 500
    const result = detectViralPosts(posts);
    expect(result).toHaveLength(2);
    expect(result[0].viewMultiplier).toBe(50); // 5000/100
    expect(result[1].viewMultiplier).toBe(10); // 1000/100
  });

  it("returns empty array when median is 0", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 0),
      makePost("2025-01-02T12:00:00Z", 0),
      makePost("2025-01-03T12:00:00Z", 1000),
    ];
    // median = 0, early return
    expect(detectViralPosts(posts)).toEqual([]);
  });

  it("does not trigger for exactly 5x median (strict >)", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 100),
      makePost("2025-01-03T12:00:00Z", 500), // exactly 5x
    ];
    // median = 100, threshold = 500, 500 > 500 is false
    expect(detectViralPosts(posts)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectFollowerSpike
// ---------------------------------------------------------------------------

describe("detectFollowerSpike", () => {
  it("returns null for empty dailyStats", () => {
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",[])).toBeNull();
  });

  it("returns null when publish date has no matching entry", () => {
    const stats = [makeStat("2025-01-16", 1000), makeStat("2025-01-17", 1200)];
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats)).toBeNull();
  });

  it("returns null when +2 day entry is missing", () => {
    const stats = [makeStat("2025-01-15", 1000)];
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats)).toBeNull();
  });

  it("returns null when followers_count is null on publish date", () => {
    const stats = [
      makeStat("2025-01-15", null),
      makeStat("2025-01-17", 1200),
    ];
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats)).toBeNull();
  });

  it("returns null when followers_count is null on +2 day", () => {
    const stats = [
      makeStat("2025-01-15", 1000),
      makeStat("2025-01-17", null),
    ];
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats)).toBeNull();
  });

  it("returns null when spike is below threshold", () => {
    const stats = [
      makeStat("2025-01-15", 1000),
      makeStat("2025-01-17", 1050), // +50 < 100
    ];
    expect(detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats)).toBeNull();
  });

  it("returns spike info when threshold is met", () => {
    const stats = [
      makeStat("2025-01-15", 1000),
      makeStat("2025-01-17", 1150), // +150 >= 100
    ];
    const result = detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats);
    expect(result).not.toBeNull();
    expect(result!.postId).toBe("test-post");
    expect(result!.publishDate).toBe("2025-01-15");
    expect(result!.followersOnPublish).toBe(1000);
    expect(result!.followersAfter48h).toBe(1150);
    expect(result!.spikeMagnitude).toBe(150);
  });

  it("triggers at exactly 100 new followers (boundary)", () => {
    const stats = [
      makeStat("2025-01-15", 1000),
      makeStat("2025-01-17", 1100), // exactly +100
    ];
    const result = detectFollowerSpike("test-post", "2025-01-15T12:00:00Z",stats);
    expect(result).not.toBeNull();
    expect(result!.spikeMagnitude).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getViralRecoveryState
// ---------------------------------------------------------------------------

describe("getViralRecoveryState", () => {
  const baseDate = "2025-01-15T12:00:00Z";

  function hoursAfter(iso: string, hours: number): string {
    return new Date(
      new Date(iso).getTime() + hours * 60 * 60 * 1000,
    ).toISOString();
  }

  it("returns null for empty posts", () => {
    expect(getViralRecoveryState([], [], baseDate)).toBeNull();
  });

  it("returns null when no viral posts detected", () => {
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 200),
      makePost("2025-01-12T12:00:00Z", 150),
    ];
    expect(getViralRecoveryState(posts, [], baseDate)).toBeNull();
  });

  it("returns null when recovery window has expired", () => {
    const posts = [
      makePost("2025-01-01T12:00:00Z", 100),
      makePost("2025-01-02T12:00:00Z", 100),
      makePost("2025-01-03T12:00:00Z", 10000), // viral
    ];
    // 8 days after viral post
    const now = hoursAfter("2025-01-03T12:00:00Z", 8 * 24);
    expect(getViralRecoveryState(posts, [], now)).toBeNull();
  });

  it("returns recovery state for active viral post", () => {
    const viralDate = "2025-01-15T12:00:00Z";
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost(viralDate, 10000, { id: "viral-1" }),
    ];
    const stats = [
      makeStat("2025-01-15", 1000),
      makeStat("2025-01-17", 1200), // +200 spike
    ];
    const now = hoursAfter(viralDate, 12);

    const result = getViralRecoveryState(posts, stats, now);
    expect(result).not.toBeNull();
    expect(result!.viralPost.id).toBe("viral-1");
    expect(result!.viewMultiplier).toBe(100); // 10000/100
    expect(result!.followerSpikeMagnitude).toBe(200);
    expect(result!.isRecoveryActive).toBe(true);
    expect(result!.hoursUntilSafeMinimum).toBeCloseTo(12, 1); // 24 - 12
    expect(result!.hoursUntilSafeRecommended).toBeCloseTo(36, 1); // 48 - 12
  });

  it("returns 0 for safe minimum when past 24h", () => {
    const viralDate = "2025-01-15T12:00:00Z";
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost(viralDate, 10000),
    ];
    const now = hoursAfter(viralDate, 30); // past 24h, before 48h

    const result = getViralRecoveryState(posts, [], now);
    expect(result).not.toBeNull();
    expect(result!.hoursUntilSafeMinimum).toBe(0);
    expect(result!.hoursUntilSafeRecommended).toBeCloseTo(18, 1); // 48 - 30
  });

  it("returns 0 for both countdowns when past 48h", () => {
    const viralDate = "2025-01-15T12:00:00Z";
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost(viralDate, 10000),
    ];
    const now = hoursAfter(viralDate, 50); // past both

    const result = getViralRecoveryState(posts, [], now);
    expect(result).not.toBeNull();
    expect(result!.hoursUntilSafeMinimum).toBe(0);
    expect(result!.hoursUntilSafeRecommended).toBe(0);
  });

  it("sets followerSpikeMagnitude to null when no daily stats", () => {
    const viralDate = "2025-01-15T12:00:00Z";
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost(viralDate, 10000),
    ];
    const now = hoursAfter(viralDate, 12);

    const result = getViralRecoveryState(posts, [], now);
    expect(result).not.toBeNull();
    expect(result!.followerSpikeMagnitude).toBeNull();
  });

  it("picks highest multiplier among active viral posts", () => {
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost("2025-01-14T12:00:00Z", 1000, { id: "viral-10x" }), // 10x
      makePost("2025-01-15T12:00:00Z", 5000, { id: "viral-50x" }), // 50x
    ];
    const now = hoursAfter("2025-01-15T12:00:00Z", 12);

    const result = getViralRecoveryState(posts, [], now);
    expect(result).not.toBeNull();
    expect(result!.viralPost.id).toBe("viral-50x");
  });

  it("returns null when now equals recovery window end (boundary)", () => {
    const viralDate = "2025-01-15T12:00:00Z";
    const posts = [
      makePost("2025-01-10T12:00:00Z", 100),
      makePost("2025-01-11T12:00:00Z", 100),
      makePost("2025-01-12T12:00:00Z", 100),
      makePost(viralDate, 10000),
    ];
    // Exactly 7 days = 168 hours
    const now = hoursAfter(viralDate, 7 * 24);

    expect(getViralRecoveryState(posts, [], now)).toBeNull();
  });
});
