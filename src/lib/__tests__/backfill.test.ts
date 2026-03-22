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

  it("records checkpoints and events for a successful backfill", async () => {
    await runBackfill("user-uuid", "job-uuid");

    const updates = getUpdateCalls();
    const events = getEventInsertCalls();

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
      ]),
    );

    expect(mockGetFollowerDemographics).toHaveBeenCalledTimes(3);
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
});
