import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runBackfill } from "../backfill";
import { ThreadsAPIError } from "../threads";

const calls: {
  table: string;
  op: string;
  args: unknown[];
}[] = [];

function trackCall(table: string, op: string, ...args: unknown[]) {
  calls.push({ table, op, args });
}

let mockUserResult: { data: unknown; error: unknown } = {
  data: { threads_user_id: "threads-123", access_token: "encrypted" },
  error: null,
};
let mockPostUpsertData: { id: string } | null = { id: "post-uuid-1" };
let mockPostUpsertError: unknown = null;
let mockExistingPostsData: Array<{ id: string; threads_media_id: string }> = [];
let mockExistingMetricsData: Array<{ post_id: string }> = [];
let mockPostMetricsSelectBatches: Array<Array<{ post_id: string }>> | null = null;
const mockLinkPredictionToPost = vi.hoisted(() => vi.fn());

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
      select: (...args: unknown[]) => {
        trackCall(table, "select", ...args);
        return {
          eq: () =>
            Promise.resolve({ data: mockExistingPostsData, error: null }),
        };
      },
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: mockPostUpsertData,
                error: mockPostUpsertError,
              }),
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

  if (table === "backfill_job_events") {
    return {
      insert: (...args: unknown[]) => {
        trackCall(table, "insert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  if (table === "post_metrics") {
    return {
      select: (...args: unknown[]) => {
        trackCall(table, "select", ...args);
        return {
          in: (...inArgs: unknown[]) => {
            trackCall(table, "in", ...inArgs);

            const batchIndex = calls.filter(
              (call) => call.table === "post_metrics" && call.op === "in",
            ).length;
            const data =
              mockPostMetricsSelectBatches?.[batchIndex - 1] ??
              mockExistingMetricsData;

            return Promise.resolve({ data, error: null });
          },
        };
      },
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

vi.mock("@/lib/post-review", () => ({
  linkPredictionToPost: mockLinkPredictionToPost,
}));

vi.mock("@/lib/topic-classification", () => ({
  extractTopics: vi.fn().mockReturnValue([]),
  classifyPostTopic: vi.fn().mockReturnValue(null),
}));

function getUpdateCalls() {
  return calls
    .filter((call) => call.table === "backfill_jobs" && call.op === "update")
    .map((call) => call.args[0] as Record<string, unknown>);
}

function getEventInsertCalls() {
  return calls
    .filter(
      (call) => call.table === "backfill_job_events" && call.op === "insert",
    )
    .map((call) => call.args[0] as Record<string, unknown>);
}

function getPostUpsertCalls() {
  return calls
    .filter((call) => call.table === "posts" && call.op === "upsert")
    .map((call) => call.args[0] as Record<string, unknown>);
}

function getPostMetricsInsertCalls() {
  return calls
    .filter((call) => call.table === "post_metrics" && call.op === "insert")
    .map((call) => call.args[0] as Record<string, unknown>);
}

function getPostMetricsCoverageInCalls() {
  return calls
    .filter((call) => call.table === "post_metrics" && call.op === "in")
    .map((call) => call.args[1] as string[]);
}

function getDemographicsUpsertCalls() {
  return calls
    .filter((call) => call.table === "demographics" && call.op === "upsert")
    .map((call) => call.args[0] as Record<string, unknown>);
}

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
    mockPostUpsertError = null;
    mockExistingPostsData = [];
    mockExistingMetricsData = [];
    mockPostMetricsSelectBatches = null;
    mockLinkPredictionToPost.mockResolvedValue(null);

    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-1",
        media_type: "TEXT_POST",
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

  it("records checkpoints and events for a successful backfill", async () => {
    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();
    const postUpserts = getPostUpsertCalls();

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "running",
          stage: "marking_job_running",
          last_heartbeat_at: expect.any(String),
        }),
        expect.objectContaining({
          total_posts: 1,
          stage: "saving_total_posts",
          processed_posts: 0,
        }),
        expect.objectContaining({
          processed_posts: 1,
          stage: "updating_progress",
          current_post_id: null,
        }),
        expect.objectContaining({
          status: "complete",
          stage: "complete",
          completed_at: expect.any(String),
        }),
      ]),
    );

    expect(postUpserts).toEqual([
      expect.objectContaining({
        media_type: "TEXT",
      }),
    ]);
    expect(mockLinkPredictionToPost).toHaveBeenCalledWith({
      userId: "user-uuid",
      postId: "post-uuid-1",
      postText: "Hello world",
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "fetching_posts",
          message: "Requesting Threads post list",
          level: "info",
        }),
        expect.objectContaining({
          stage: "fetching_post_insights",
          message: "Requesting Threads post insights",
          details: expect.objectContaining({
            postId: "media-1",
            processedPosts: 0,
          }),
        }),
        expect.objectContaining({
          stage: "complete",
          message: "Backfill completed",
          details: expect.objectContaining({
            totalPosts: 1,
            followersCount: 500,
          }),
        }),
        expect.objectContaining({
          stage: "saving_total_posts",
          message: "Existing post coverage analyzed",
          details: expect.objectContaining({
            coveredPosts: 0,
            missingPosts: 1,
            partialPosts: 0,
            totalPosts: 1,
          }),
        }),
      ]),
    );

    expect(mockGetFollowerDemographics).toHaveBeenCalledTimes(3);
  });

  it("skips prediction linkback when the post already exists", async () => {
    mockExistingPostsData = [{ id: "existing-post-uuid", threads_media_id: "media-1" }];
    mockExistingMetricsData = [];

    await runBackfill("user-uuid", "job-uuid");

    expect(mockLinkPredictionToPost).not.toHaveBeenCalled();
  });

  it("records failing post context and structured error details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetPostInsights.mockRejectedValue(
      new ThreadsAPIError("Threads API error: 429", 429, {
        error: { message: "Rate limited" },
      }),
    );

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();

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

    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({
        status: "failed",
        stage: "fetching_post_insights",
        current_post_id: "media-1",
        last_error_message: "Threads API error: 429",
        last_error_status: 429,
        last_error_payload: { error: { message: "Rate limited" } },
      }),
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          stage: "fetching_post_insights",
          message: "Backfill failed",
          details: expect.objectContaining({
            postId: "media-1",
            error: expect.objectContaining({
              message: "Threads API error: 429",
              status: 429,
            }),
          }),
        }),
      ]),
    );

    consoleSpy.mockRestore();
  });

  it("records PostgREST-style save errors with their real message", async () => {
    mockPostUpsertData = null;
    mockPostUpsertError = {
      code: "23514",
      hint: null,
      details: "Failing row contains (..., TEXT_POST, ...)",
      message:
        'new row for relation "posts" violates check constraint "posts_media_type_check"',
    };

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();

    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({
        status: "failed",
        stage: "saving_post",
        current_post_id: "media-1",
        last_error_message:
          'new row for relation "posts" violates check constraint "posts_media_type_check"',
        last_error_status: null,
        last_error_payload: expect.objectContaining({
          code: "23514",
          message:
            'new row for relation "posts" violates check constraint "posts_media_type_check"',
        }),
      }),
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          stage: "saving_post",
          message: "Backfill failed",
          details: expect.objectContaining({
            postId: "media-1",
            error: expect.objectContaining({
              name: "23514",
              message:
                'new row for relation "posts" violates check constraint "posts_media_type_check"',
            }),
          }),
        }),
      ]),
    );
  });

  it("continues on demographics failure and records a warning event", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetFollowerDemographics.mockRejectedValue(
      new Error("Threads insights temporarily unavailable"),
    );

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();

    expect(warnSpy).toHaveBeenCalled();
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ status: "complete", stage: "complete" }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warn",
          stage: "fetching_demographics_country",
          message: "Demographics fetch failed",
        }),
      ]),
    );

    warnSpy.mockRestore();
  });

  it("handles zero posts without leaving the job mid-progress", async () => {
    mockGetUserPosts.mockResolvedValue([]);
    mockGetFollowersCount.mockResolvedValue(0);

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ total_posts: 0, stage: "saving_total_posts" }),
        expect.objectContaining({ status: "complete", stage: "complete" }),
      ]),
    );

    expect(mockGetPostInsights).not.toHaveBeenCalled();
    expect(mockGetFollowerDemographics).not.toHaveBeenCalled();
    expect(getDemographicsUpsertCalls()).toHaveLength(0);
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

  it("resumes from existing coverage, repairs partial posts, and skips covered ones", async () => {
    mockExistingPostsData = [
      { id: "covered-post-uuid", threads_media_id: "media-covered" },
      { id: "partial-post-uuid", threads_media_id: "media-partial" },
    ];
    mockExistingMetricsData = [{ post_id: "covered-post-uuid" }];
    mockGetFollowersCount.mockResolvedValue(0);
    mockPostUpsertData = { id: "missing-post-uuid" };
    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-covered",
        media_type: "TEXT_POST",
        text: "Already imported",
        timestamp: "2024-12-03T10:00:00Z",
        permalink: "https://threads.net/@user/covered",
        shortcode: "covered",
      },
      {
        id: "media-partial",
        media_type: "IMAGE",
        text: "Needs metrics",
        timestamp: "2024-12-02T10:00:00Z",
        permalink: "https://threads.net/@user/partial",
        shortcode: "partial",
      },
      {
        id: "media-missing",
        media_type: "VIDEO",
        text: "Missing entirely",
        timestamp: "2024-12-01T10:00:00Z",
        permalink: "https://threads.net/@user/missing",
        shortcode: "missing",
      },
    ]);

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();
    const postUpserts = getPostUpsertCalls();
    const postMetricsInserts = getPostMetricsInsertCalls();

    expect(mockGetPostInsights.mock.calls.map((call) => call[0])).toEqual([
      "media-partial",
      "media-missing",
    ]);

    expect(postUpserts).toHaveLength(1);
    expect(postUpserts[0]).toEqual(
      expect.objectContaining({
        threads_media_id: "media-missing",
      }),
    );

    expect(postMetricsInserts).toEqual([
      expect.objectContaining({ post_id: "partial-post-uuid" }),
      expect.objectContaining({ post_id: "missing-post-uuid" }),
    ]);

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "saving_total_posts",
          total_posts: 3,
          processed_posts: 1,
        }),
        expect.objectContaining({
          stage: "updating_progress",
          processed_posts: 2,
        }),
        expect.objectContaining({
          stage: "updating_progress",
          processed_posts: 3,
        }),
      ]),
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "saving_total_posts",
          message: "Existing post coverage analyzed",
          details: expect.objectContaining({
            coveredPosts: 1,
            partialPosts: 1,
            missingPosts: 1,
            totalPosts: 3,
          }),
        }),
      ]),
    );

    expect(mockGetFollowerDemographics).not.toHaveBeenCalled();
  });

  it("completes cleanly when every discovered post is already covered", async () => {
    mockExistingPostsData = [
      { id: "covered-post-1", threads_media_id: "media-covered-1" },
      { id: "covered-post-2", threads_media_id: "media-covered-2" },
    ];
    mockExistingMetricsData = [
      { post_id: "covered-post-1" },
      { post_id: "covered-post-2" },
    ];
    mockGetFollowersCount.mockResolvedValue(0);
    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-covered-1",
        media_type: "TEXT_POST",
        text: "Already imported 1",
        timestamp: "2024-12-03T10:00:00Z",
        permalink: "https://threads.net/@user/covered-1",
        shortcode: "covered-1",
      },
      {
        id: "media-covered-2",
        media_type: "IMAGE",
        text: "Already imported 2",
        timestamp: "2024-12-02T10:00:00Z",
        permalink: "https://threads.net/@user/covered-2",
        shortcode: "covered-2",
      },
    ]);

    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();

    expect(getPostUpsertCalls()).toHaveLength(0);
    expect(getPostMetricsInsertCalls()).toHaveLength(0);
    expect(mockGetPostInsights).not.toHaveBeenCalled();
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "saving_total_posts",
          total_posts: 2,
          processed_posts: 2,
        }),
        expect.objectContaining({
          status: "complete",
          stage: "complete",
        }),
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "saving_total_posts",
          message: "No missing post coverage detected",
          details: expect.objectContaining({
            coveredPosts: 2,
            totalPosts: 2,
          }),
        }),
      ]),
    );
  });

  it("batches coverage lookup for large fully covered accounts", async () => {
    const existingPosts = Array.from({ length: 205 }, (_, index) => ({
      id: `post-id-${index + 1}`,
      threads_media_id: `media-${index + 1}`,
    }));

    mockExistingPostsData = existingPosts;
    mockPostMetricsSelectBatches = [
      existingPosts.slice(0, 100).map((post) => ({ post_id: post.id })),
      existingPosts.slice(100, 200).map((post) => ({ post_id: post.id })),
      existingPosts.slice(200).map((post) => ({ post_id: post.id })),
    ];
    mockGetFollowersCount.mockResolvedValue(0);
    mockGetUserPosts.mockResolvedValue(
      existingPosts.map((post) => ({
        id: post.threads_media_id,
        media_type: "TEXT_POST" as const,
        text: `Post ${post.threads_media_id}`,
        timestamp: "2024-12-01T10:00:00Z",
        permalink: `https://threads.net/@user/${post.threads_media_id}`,
        shortcode: post.threads_media_id,
      })),
    );

    await runBackfill("user-uuid", "job-uuid");

    const coverageInCalls = getPostMetricsCoverageInCalls();
    const updates = getUpdateCalls();

    expect(coverageInCalls).toHaveLength(3);
    expect(coverageInCalls.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(getPostUpsertCalls()).toHaveLength(0);
    expect(getPostMetricsInsertCalls()).toHaveLength(0);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "saving_total_posts",
          total_posts: 205,
          processed_posts: 205,
        }),
        expect.objectContaining({
          status: "complete",
          stage: "complete",
        }),
      ]),
    );
  });
});
