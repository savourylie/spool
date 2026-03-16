import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshMetrics, refreshAllUsers } from "../metrics-refresh";

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
  data: {
    threads_user_id: "threads-123",
    access_token: "encrypted",
    token_expires_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  },
  error: null,
};

let mockUsersListResult: { data: unknown; error: unknown } = {
  data: [{ id: "user-uuid" }],
  error: null,
};

let mockLatestPostResult: { data: unknown; error: unknown } = {
  data: { published_at: "2024-12-01T00:00:00Z" },
  error: null,
};

let mockRecentPostsResult: { data: unknown; error: unknown } = {
  data: [{ id: "existing-post-uuid", threads_media_id: "existing-media-1" }],
  error: null,
};

let mockPostUpsertData: { id: string } | null = { id: "post-uuid-1" };

// --- Supabase mock ---

function createMockFrom(table: string) {
  if (table === "users") {
    return {
      select: (fields: string) => {
        if (fields === "id") {
          // refreshAllUsers query
          return Promise.resolve(mockUsersListResult);
        }
        // refreshMetrics user query
        return {
          eq: () => ({
            single: () => Promise.resolve(mockUserResult),
          }),
        };
      },
    };
  }

  if (table === "posts") {
    return {
      select: (...args: unknown[]) => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              single: () => Promise.resolve(mockLatestPostResult),
            }),
          }),
          gte: () => Promise.resolve(mockRecentPostsResult),
        }),
      }),
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

  if (table === "post_metrics") {
    return {
      insert: (...args: unknown[]) => {
        trackCall(table, "insert", ...args);
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

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: vi.fn().mockImplementation(function () {
    return {
      getUserPosts: mockGetUserPosts,
      getPostInsights: mockGetPostInsights,
    };
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
}));

// --- Helpers ---

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

// --- Tests ---

describe("refreshMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    mockLatestPostResult = {
      data: { published_at: "2024-12-01T00:00:00Z" },
      error: null,
    };

    mockRecentPostsResult = {
      data: [
        { id: "existing-post-uuid", threads_media_id: "existing-media-1" },
      ],
      error: null,
    };

    mockPostUpsertData = { id: "post-uuid-1" };

    mockUsersListResult = {
      data: [{ id: "user-uuid" }],
      error: null,
    };

    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-new-1",
        media_type: "TEXT",
        text: "New post",
        timestamp: "2024-12-15T10:00:00Z",
        permalink: "https://threads.net/@user/new1",
        shortcode: "xyz",
      },
    ]);

    mockGetPostInsights.mockResolvedValue({
      views: 200,
      likes: 20,
      replies: 10,
      reposts: 4,
      quotes: 2,
      shares: 6,
    });
  });

  it("upserts new posts and appends metrics for them", async () => {
    const result = await refreshMetrics("user-uuid");

    expect(result.newPosts).toBe(1);

    const postUpserts = getPostUpsertCalls();
    expect(postUpserts).toHaveLength(1);
    expect(postUpserts[0]).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        threads_media_id: "media-new-1",
        media_type: "TEXT",
        text_preview: "New post",
      }),
    );

    const metricsInserts = getMetricsInsertCalls();
    // 1 for new post + 1 for existing recent post
    expect(metricsInserts).toHaveLength(2);
    expect(metricsInserts[0]).toEqual(
      expect.objectContaining({
        post_id: "post-uuid-1",
        views: 200,
        likes: 20,
      }),
    );
  });

  it("only updates metrics for recent posts when no new posts exist", async () => {
    mockGetUserPosts.mockResolvedValue([]);

    const result = await refreshMetrics("user-uuid");

    expect(result.newPosts).toBe(0);
    expect(result.updatedMetrics).toBe(1);

    const postUpserts = getPostUpsertCalls();
    expect(postUpserts).toHaveLength(0);

    const metricsInserts = getMetricsInsertCalls();
    expect(metricsInserts).toHaveLength(1);
    expect(metricsInserts[0]).toEqual(
      expect.objectContaining({
        post_id: "existing-post-uuid",
        views: 200,
      }),
    );
  });

  it("skips users with expired tokens", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      },
      error: null,
    };

    const result = await refreshMetrics("user-uuid");

    expect(result).toEqual({ newPosts: 0, updatedMetrics: 0 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("token expired"),
    );
    expect(mockGetUserPosts).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("appends post_metrics with insert, never upsert", async () => {
    await refreshMetrics("user-uuid");

    const metricsInserts = getMetricsInsertCalls();
    expect(metricsInserts.length).toBeGreaterThan(0);

    // Verify all metrics operations are inserts, not upserts
    const metricsUpserts = calls.filter(
      (c) => c.table === "post_metrics" && c.op === "upsert",
    );
    expect(metricsUpserts).toHaveLength(0);
  });

  it("only fetches metrics for posts within the last 7 days", async () => {
    mockGetUserPosts.mockResolvedValue([]);
    mockRecentPostsResult = {
      data: [
        { id: "recent-1", threads_media_id: "media-recent-1" },
        { id: "recent-2", threads_media_id: "media-recent-2" },
      ],
      error: null,
    };

    const result = await refreshMetrics("user-uuid");

    expect(result.updatedMetrics).toBe(2);
    expect(mockGetPostInsights).toHaveBeenCalledTimes(2);
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-recent-1");
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-recent-2");
  });

  it("skips metric refresh for posts that were just fetched as new", async () => {
    // The new post has the same media ID as a "recent" post
    mockGetUserPosts.mockResolvedValue([
      {
        id: "media-new-1",
        media_type: "TEXT",
        text: "New post",
        timestamp: "2024-12-15T10:00:00Z",
        permalink: "https://threads.net/@user/new1",
        shortcode: "xyz",
      },
    ]);

    mockRecentPostsResult = {
      data: [
        { id: "post-uuid-1", threads_media_id: "media-new-1" },
        { id: "other-post", threads_media_id: "other-media" },
      ],
      error: null,
    };

    const result = await refreshMetrics("user-uuid");

    // 1 new post insight + 1 recent post (the other one, not the duplicate)
    expect(result.newPosts).toBe(1);
    expect(result.updatedMetrics).toBe(1);
  });
});

describe("refreshAllUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    mockLatestPostResult = {
      data: { published_at: "2024-12-01T00:00:00Z" },
      error: null,
    };

    mockRecentPostsResult = {
      data: [],
      error: null,
    };

    mockPostUpsertData = { id: "post-uuid-1" };

    mockUsersListResult = {
      data: [{ id: "user-uuid" }],
      error: null,
    };

    mockGetUserPosts.mockResolvedValue([]);
    mockGetPostInsights.mockResolvedValue({
      views: 100,
      likes: 10,
      replies: 5,
      reposts: 2,
      quotes: 1,
      shares: 3,
    });
  });

  it("handles API errors gracefully and continues to next user", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockUsersListResult = {
      data: [{ id: "user-1" }, { id: "user-2" }],
      error: null,
    };

    // Make the first user fail by returning an error for the user query
    let callCount = 0;
    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    mockGetUserPosts
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockResolvedValueOnce([]);

    const result = await refreshAllUsers();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to refresh metrics"),
      expect.any(Error),
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
