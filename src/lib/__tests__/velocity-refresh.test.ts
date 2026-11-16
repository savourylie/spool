import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThreadsAPIError } from "@/lib/threads";
import { refreshVelocityForUser } from "../velocity-check";

// --- Mock tracking ---

const metricsInserts: unknown[] = [];

// --- Configurable mock state ---

let mockUserResult: { data: unknown; error: unknown } = {
  data: {
    threads_user_id: "threads-123",
    access_token: "encrypted",
    token_expires_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  },
  error: null,
};

let mockRecentPostsResult: { data: unknown; error: unknown } = {
  data: [],
  error: null,
};

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
    // getRecentPosts: select().eq().gte()
    return {
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve(mockRecentPostsResult),
        }),
      }),
    };
  }

  if (table === "post_metrics") {
    return {
      insert: (row: unknown) => {
        metricsInserts.push(row);
        return Promise.resolve({ error: null });
      },
    };
  }

  throw new Error(`Unexpected table in velocity refresh test: ${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

// --- ThreadsAPI mock ---

const mockGetPostInsights = vi.fn();

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: vi.fn().mockImplementation(function () {
    return {
      getPostInsights: mockGetPostInsights,
    };
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
}));

// --- Tests ---

describe("refreshVelocityForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metricsInserts.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    const publishedAt = new Date(Date.now() - 3600000).toISOString(); // 1h ago
    mockRecentPostsResult = {
      data: [
        {
          id: "recent-uuid-1",
          threads_media_id: "media-recent-1",
          published_at: publishedAt,
        },
        {
          id: "recent-uuid-2",
          threads_media_id: "media-recent-2",
          published_at: publishedAt,
        },
      ],
      error: null,
    };

    mockGetPostInsights.mockResolvedValue({
      views: 200,
      likes: 20,
      replies: 10,
      reposts: 4,
      quotes: 2,
      shares: 6,
    });
  });

  it("inserts a snapshot for every recent post when no insights call fails", async () => {
    const result = await refreshVelocityForUser("user-uuid");

    expect(result).toEqual({ postsProcessed: 2, metricsInserted: 2 });
    expect(metricsInserts).toEqual([
      expect.objectContaining({ post_id: "recent-uuid-1", views: 200 }),
      expect.objectContaining({ post_id: "recent-uuid-2", views: 200 }),
    ]);
  });

  it("continues past a post whose insights call fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // A post deleted on Threads can still sit in Spool, and Threads rejects its
    // insights call. The body holds a token-bearing URL on purpose: none of it
    // may reach the log.
    mockGetPostInsights.mockImplementation(async (mediaId: string) => {
      if (mediaId === "media-recent-1") {
        throw new ThreadsAPIError("Threads API error: 400", 400, {
          url: "https://graph.threads.net/v1.0/media-recent-1/insights?access_token=secret-token",
        });
      }
      return {
        views: 200,
        likes: 20,
        replies: 10,
        reposts: 4,
        quotes: 2,
        shares: 6,
      };
    });

    const result = await refreshVelocityForUser("user-uuid");

    // postsProcessed still counts every recent post; the skipped one is not
    // counted in metricsInserted.
    expect(result).toEqual({ postsProcessed: 2, metricsInserted: 1 });
    expect(mockGetPostInsights).toHaveBeenCalledTimes(2);
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-recent-1");
    expect(mockGetPostInsights).toHaveBeenCalledWith("media-recent-2");
    expect(metricsInserts).toEqual([
      expect.objectContaining({ post_id: "recent-uuid-2", views: 200 }),
    ]);

    // One line naming the skipped post and Threads' message, nothing else
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const loggedArgs = errorSpy.mock.calls[0];
    expect(loggedArgs).toHaveLength(1);
    const line = String(loggedArgs[0]);
    expect(line).toContain("recent-uuid-1");
    expect(line).toContain("media-recent-1");
    expect(line).toContain("Threads API error: 400");
    expect(line).not.toContain("access_token");

    errorSpy.mockRestore();
  });
});
