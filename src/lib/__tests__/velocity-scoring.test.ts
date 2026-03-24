import { describe, expect, it, vi, beforeEach } from "vitest";
import { VELOCITY_DISPLAY_WINDOW_DAYS } from "@/lib/velocity-scoring";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          in: (...inArgs: unknown[]) => {
            mockIn(...inArgs);
            return {
              order: (...orderArgs: unknown[]) => {
                mockOrder(...orderArgs);
                return { data: mockMetrics, error: null };
              },
            };
          },
        };
      },
    }),
  }),
}));

let mockHistoricalAverage = 2.0;
vi.mock("@/lib/velocity-check", async () => {
  const actual = await vi.importActual<typeof import("@/lib/velocity-check")>(
    "@/lib/velocity-check",
  );
  return {
    ...actual,
    getHistoricalVelocityAverage: vi.fn(() =>
      Promise.resolve(mockHistoricalAverage),
    ),
  };
});

let mockMetrics: Array<{
  post_id: string;
  fetched_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}> = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-03-24T14:00:00.000Z";
const NOW_MS = new Date(NOW).getTime();

function hoursAgo(h: number): string {
  return new Date(NOW_MS - h * 60 * 60 * 1000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(NOW_MS - d * 24 * 60 * 60 * 1000).toISOString();
}

function makeMetricRow(
  postId: string,
  publishedAt: string,
  offsetMinutes: number,
  engagement: { likes: number; replies: number },
) {
  return {
    post_id: postId,
    fetched_at: new Date(
      new Date(publishedAt).getTime() + offsetMinutes * 60 * 1000,
    ).toISOString(),
    views: 100,
    likes: engagement.likes,
    replies: engagement.replies,
    reposts: 0,
    quotes: 0,
    shares: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("velocity-scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMetrics = [];
    mockHistoricalAverage = 2.0;
  });

  it("exports VELOCITY_DISPLAY_WINDOW_DAYS as 3", () => {
    expect(VELOCITY_DISPLAY_WINDOW_DAYS).toBe(3);
  });

  describe("getVelocityMapForRecentPosts", () => {
    // We need to import dynamically after mocks are set up
    async function callGetVelocityMap(
      userId: string,
      posts: Array<{ id: string; published_at: string }>,
      now: string,
    ) {
      const { getVelocityMapForRecentPosts } = await import(
        "@/lib/velocity-scoring"
      );
      return getVelocityMapForRecentPosts(userId, posts, now);
    }

    it("returns empty map when no posts are within display window", async () => {
      const posts = [
        { id: "old-1", published_at: daysAgo(5) },
        { id: "old-2", published_at: daysAgo(10) },
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      expect(result).toEqual({});
    });

    it("returns empty map for empty posts array", async () => {
      const result = await callGetVelocityMap("user-1", [], NOW);
      expect(result).toEqual({});
    });

    it("filters posts to only those within 3-day window", async () => {
      const recentPublished = hoursAgo(6);
      const posts = [
        { id: "recent", published_at: recentPublished },
        { id: "old", published_at: daysAgo(5) },
      ];

      // Provide valid snapshots for early (30min) and late (3h) windows
      mockMetrics = [
        makeMetricRow("recent", recentPublished, 30, { likes: 5, replies: 2 }),
        makeMetricRow("recent", recentPublished, 180, { likes: 15, replies: 6 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);

      // Should only process "recent", not "old"
      expect(result).toHaveProperty("recent");
      expect(result).not.toHaveProperty("old");
    });

    it("skips posts with fewer than 2 snapshots", async () => {
      const published = hoursAgo(6);
      const posts = [{ id: "p1", published_at: published }];

      // Only one snapshot
      mockMetrics = [
        makeMetricRow("p1", published, 30, { likes: 5, replies: 2 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      expect(result).toEqual({});
    });

    it("classifies a post with velocity above average as green", async () => {
      mockHistoricalAverage = 2.0;
      const published = hoursAgo(6);
      const posts = [{ id: "p1", published_at: published }];

      // Early: 5+2=7 engagement, Late: 25+10=35 engagement → ratio = 5.0 > 2.0
      mockMetrics = [
        makeMetricRow("p1", published, 30, { likes: 5, replies: 2 }),
        makeMetricRow("p1", published, 180, { likes: 25, replies: 10 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      expect(result.p1).toBeDefined();
      expect(result.p1.score).toBe("green");
      expect(result.p1.velocity).toBe(5);
      expect(result.p1.average).toBe(2.0);
    });

    it("classifies a post within 20% of average as yellow", async () => {
      mockHistoricalAverage = 3.0;
      const published = hoursAgo(6);
      const posts = [{ id: "p1", published_at: published }];

      // Early: 10 engagement, Late: 25 engagement → ratio = 2.5
      // 2.5 >= 3.0 * 0.8 (2.4) → yellow
      mockMetrics = [
        makeMetricRow("p1", published, 30, { likes: 10, replies: 0 }),
        makeMetricRow("p1", published, 180, { likes: 25, replies: 0 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      expect(result.p1.score).toBe("yellow");
    });

    it("classifies a post well below average as red", async () => {
      mockHistoricalAverage = 5.0;
      const published = hoursAgo(6);
      const posts = [{ id: "p1", published_at: published }];

      // Early: 10 engagement, Late: 15 engagement → ratio = 1.5
      // 1.5 < 5.0 * 0.8 (4.0) → red
      mockMetrics = [
        makeMetricRow("p1", published, 30, { likes: 10, replies: 0 }),
        makeMetricRow("p1", published, 180, { likes: 15, replies: 0 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      expect(result.p1.score).toBe("red");
    });

    it("handles zero historical average gracefully", async () => {
      mockHistoricalAverage = 0;
      const published = hoursAgo(6);
      const posts = [{ id: "p1", published_at: published }];

      mockMetrics = [
        makeMetricRow("p1", published, 30, { likes: 5, replies: 0 }),
        makeMetricRow("p1", published, 180, { likes: 15, replies: 0 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      // Any positive velocity with 0 average → green
      expect(result.p1.score).toBe("green");
    });

    it("includes posts at exactly the 3-day boundary", async () => {
      const exactlyThreeDays = daysAgo(3);
      const posts = [{ id: "boundary", published_at: exactlyThreeDays }];

      mockMetrics = [
        makeMetricRow("boundary", exactlyThreeDays, 30, { likes: 5, replies: 0 }),
        makeMetricRow("boundary", exactlyThreeDays, 180, { likes: 15, replies: 0 }),
      ];

      const result = await callGetVelocityMap("user-1", posts, NOW);
      // Exactly at boundary (>= cutoff) should be included
      expect(result).toHaveProperty("boundary");
    });
  });
});
