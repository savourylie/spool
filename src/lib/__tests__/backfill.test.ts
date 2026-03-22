import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runBackfill } from "../backfill";
import { ThreadsAPIError } from "../threads";

// --- Mock tracking ---

const calls: {
  table: string;
  op: string;
  args: unknown[];
}[] = [];

function trackCall(table: string, op: string, ...args: unknown[]) {
  calls.push({ table, op, args });
}

// --- Configurable mock state ---

let mockUserResult: { data: unknown; error: unknown } = {
  data: { threads_user_id: "threads-123", access_token: "encrypted" },
  error: null,
};
let mockPostUpsertData: { id: string } | null = { id: "post-uuid-1" };

// --- Supabase mock ---

function createMockFrom(table: string) {
  if (table === "users") {
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(mockUserResult),
        }),
      }),
    };
  }

  if (table === "posts") {
    return {
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: mockPostUpsertData, error: null }),
          }),
        };
      },
    };
  }

  if (table === "backfill_jobs") {
    return {
      update: (...args: unknown[]) => {
        trackCall(table, "update", ...args);
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    };
  }

  if (table === "post_metrics") {
    return {
      insert: (...args: unknown[]) => {
        trackCall(table, "insert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  if (table === "daily_stats") {
    return {
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  if (table === "demographics") {
    return {
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  return {
    insert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

// --- ThreadsAPI mock ---

const mockGetUserPosts = vi.fn();
const mockGetPostInsights = vi.fn();
const mockGetFollowersCount = vi.fn();
const mockGetFollowerDemographics = vi.fn();

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: vi.fn().mockImplementation(function () {
    return {
      getUserPosts: mockGetUserPosts,
      getPostInsights: mockGetPostInsights,
      getFollowersCount: mockGetFollowersCount,
      getFollowerDemographics: mockGetFollowerDemographics,
    };
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
}));

// --- Helpers ---

function getUpdateCalls() {
  return calls
    .filter((c) => c.table === "backfill_jobs" && c.op === "update")
    .map((c) => c.args[0]);
}

function getPostUpsertCalls() {
  return calls
    .filter((c) => c.table === "posts" && c.op === "upsert")
    .map((c) => c.args[0]);
}

function getMetricsInsertCalls() {
  return calls
    .filter((c) => c.table === "post_metrics" && c.op === "insert")
    .map((c) => c.args[0]);
}

function getDailyStatsUpsertCalls() {
  return calls
    .filter((c) => c.table === "daily_stats" && c.op === "upsert")
    .map((c) => c.args[0]);
}

function getDemographicsUpsertCalls() {
  return calls
    .filter((c) => c.table === "demographics" && c.op === "upsert")
    .map((c) => c.args[0]);
}

// --- Tests ---

describe("runBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockUserResult = {
      data: { threads_user_id: "threads-123", access_token: "encrypted" },
      error: null,
    };
    mockPostUpsertData = { id: "post-uuid-1" };

    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-1",
        media_type: "TEXT",
        text: "Hello world",
        timestamp: "2024-12-01T10:00:00Z",
        permalink: "https://threads.net/@user/1",
        shortcode: "abc",
      },
    ]);

    mockGetPostInsights.mockResolvedValue({
      views: 100,
      likes: 10,
      replies: 5,
      reposts: 2,
      quotes: 1,
      shares: 3,
    });

    mockGetFollowersCount.mockResolvedValue(500);

    mockGetFollowerDemographics.mockResolvedValue({
      dimension: "country",
      values: [
        { key: "US", value: 45 },
        { key: "GB", value: 12 },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes full backfill: posts, metrics, daily_stats, demographics", async () => {
    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();

    // Job status transitions: running → total_posts → processed_posts → complete
    expect(updates[0]).toEqual(
      expect.objectContaining({ status: "running" }),
    );
    expect(updates[1]).toEqual(
      expect.objectContaining({ total_posts: 1 }),
    );
    expect(updates[2]).toEqual(
      expect.objectContaining({ processed_posts: 1 }),
    );
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "complete" }),
    );

    // Post upserted with correct data
    const postUpserts = getPostUpsertCalls();
    expect(postUpserts).toHaveLength(1);
    expect(postUpserts[0]).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        threads_media_id: "media-1",
        media_type: "TEXT",
        text_preview: "Hello world",
      }),
    );

    // Metrics inserted
    const metricsInserts = getMetricsInsertCalls();
    expect(metricsInserts).toHaveLength(1);
    expect(metricsInserts[0]).toEqual(
      expect.objectContaining({
        post_id: "post-uuid-1",
        views: 100,
        likes: 10,
        shares: 3,
      }),
    );

    // Daily stats upserted
    const dailyStats = getDailyStatsUpsertCalls();
    expect(dailyStats).toHaveLength(1);
    expect(dailyStats[0]).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        followers_count: 500,
      }),
    );

    // Demographics fetched for 3 dimensions
    expect(mockGetFollowerDemographics).toHaveBeenCalledTimes(3);
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("country");
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("city");
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("gender");

    // Demographics upserted (3 dimensions × 2 values)
    const demoUpserts = getDemographicsUpsertCalls();
    expect(demoUpserts).toHaveLength(6);
  });

  it("processes multiple posts sequentially with incremental progress", async () => {
    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-1",
        media_type: "TEXT",
        text: "Post 1",
        timestamp: "2024-12-01T10:00:00Z",
        permalink: "https://threads.net/@user/1",
        shortcode: "abc",
      },
      {
        id: "media-2",
        media_type: "IMAGE",
        text: "Post 2",
        timestamp: "2024-11-15T10:00:00Z",
        permalink: "https://threads.net/@user/2",
        shortcode: "def",
      },
    ]);

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ total_posts: 2 }),
        expect.objectContaining({ processed_posts: 1 }),
        expect.objectContaining({ processed_posts: 2 }),
        expect.objectContaining({ status: "complete" }),
      ]),
    );

    expect(mockGetPostInsights).toHaveBeenCalledTimes(2);
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-1");
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-2");
  });

  it("marks job as failed on API error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUserPosts.mockRejectedValue(new Error("Rate limited"));

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "failed" }),
    );

    consoleSpy.mockRestore();
  });

  it("logs the failing post id and Threads API details when post insights fail", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetPostInsights.mockRejectedValue(
      new ThreadsAPIError("Threads API error: 429", 429, {
        error: { message: "Rate limited" },
      }),
    );

    await runBackfill("user-uuid", "job-uuid");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Backfill failed",
      expect.objectContaining({
        userId: "user-uuid",
        jobId: "job-uuid",
        stage: "fetching_post_insights",
        postId: "media-1",
        error: expect.objectContaining({
          name: "ThreadsAPIError",
          message: "Threads API error: 429",
          status: 429,
          body: { error: { message: "Rate limited" } },
        }),
      }),
    );

    const updates = getUpdateCalls();
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("marks job as failed when user not found", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUserResult = { data: null, error: { message: "Not found" } };

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "failed" }),
    );

    consoleSpy.mockRestore();
  });

  it("continues on demographics failure (non-fatal)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetFollowerDemographics.mockRejectedValue(
      new Error("Threads insights temporarily unavailable"),
    );

    await runBackfill("user-uuid", "job-uuid");

    expect(warnSpy).toHaveBeenCalled();

    const updates = getUpdateCalls();
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "complete" }),
    );

    warnSpy.mockRestore();
  });

  it("handles zero posts and zero followers without warnings", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetUserPosts.mockResolvedValue([]);
    mockGetFollowersCount.mockResolvedValue(0);

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ total_posts: 0 }),
        expect.objectContaining({ status: "complete" }),
      ]),
    );

    expect(mockGetPostInsights).not.toHaveBeenCalled();
    expect(mockGetFollowersCount).toHaveBeenCalledTimes(1);
    expect(mockGetFollowerDemographics).not.toHaveBeenCalled();
    expect(getDemographicsUpsertCalls()).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("skips demographics for accounts below 100 followers while still importing posts", async () => {
    mockGetFollowersCount.mockResolvedValue(42);

    await runBackfill("user-uuid", "job-uuid");

    expect(mockGetPostInsights).toHaveBeenCalledTimes(1);
    expect(mockGetFollowerDemographics).not.toHaveBeenCalled();
    expect(getDemographicsUpsertCalls()).toHaveLength(0);
  });

  it("upserts demographics so reruns stay idempotent", async () => {
    await runBackfill("user-uuid", "job-uuid");
    await runBackfill("user-uuid", "job-uuid");

    expect(mockGetFollowerDemographics).toHaveBeenCalledTimes(6);
    expect(getDemographicsUpsertCalls()).toHaveLength(12);
  });

  it("truncates text_preview to 280 characters", async () => {
    const longText = "a".repeat(500);
    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-1",
        media_type: "TEXT",
        text: longText,
        timestamp: "2024-12-01T10:00:00Z",
        permalink: "https://threads.net/@user/1",
        shortcode: "abc",
      },
    ]);

    await runBackfill("user-uuid", "job-uuid");

    const postUpserts = getPostUpsertCalls();
    expect(postUpserts[0]).toEqual(
      expect.objectContaining({
        text_preview: "a".repeat(280),
      }),
    );
  });
});
