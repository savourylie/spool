import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ThreadsAPI,
  THREADS_API_LAUNCH,
  getThreadsErrorMessage,
  redactAccessToken,
} from "../threads-api";
import { ThreadsAPIError, getAuthorizationUrl } from "../threads";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("ThreadsAPI", () => {
  let api: ThreadsAPI;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api = new ThreadsAPI("test-token", "user-123");
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUserProfile", () => {
    it("returns typed profile", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: "user-123", username: "testuser" }),
      );

      const profile = await api.getUserProfile();
      expect(profile).toEqual({ id: "user-123", username: "testuser" });

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1.0/me");
      expect(url.searchParams.get("fields")).toBe("id,username");
    });
  });

  describe("getUserPosts", () => {
    it("concatenates multiple pages", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: "1",
                media_type: "TEXT",
                text: "post 1",
                timestamp: "2024-12-01T00:00:00Z",
                permalink: "https://threads.net/@user/1",
                shortcode: "abc",
              },
            ],
            paging: { cursors: { after: "cursor-1" } },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: "2",
                media_type: "IMAGE",
                text: "post 2",
                timestamp: "2024-11-01T00:00:00Z",
                permalink: "https://threads.net/@user/2",
                shortcode: "def",
              },
            ],
          }),
        );

      const posts = await api.getUserPosts();
      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe("1");
      expect(posts[1].id).toBe("2");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("filters out REPOST_FACADE posts", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "1",
              media_type: "TEXT",
              text: "keep",
              timestamp: "2024-12-01T00:00:00Z",
              permalink: "https://threads.net/@user/1",
              shortcode: "abc",
            },
            {
              id: "2",
              media_type: "REPOST_FACADE",
              text: "repost",
              timestamp: "2024-12-01T00:00:00Z",
              permalink: "https://threads.net/@user/2",
              shortcode: "def",
            },
          ],
        }),
      );

      const posts = await api.getUserPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe("1");
    });

    it("filters out pre-April 2024 posts and stops pagination early", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "1",
              media_type: "TEXT",
              text: "new",
              timestamp: "2024-06-01T00:00:00Z",
              permalink: "https://threads.net/@user/1",
              shortcode: "abc",
            },
            {
              id: "2",
              media_type: "TEXT",
              text: "old",
              timestamp: "2024-03-01T00:00:00Z",
              permalink: "https://threads.net/@user/2",
              shortcode: "def",
            },
          ],
          paging: { cursors: { after: "cursor-1" } },
        }),
      );

      const posts = await api.getUserPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe("1");
      // Should not fetch next page since we hit a pre-launch post
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("filters posts older than since param", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "1",
              media_type: "TEXT",
              text: "recent",
              timestamp: "2024-12-01T00:00:00Z",
              permalink: "https://threads.net/@user/1",
              shortcode: "abc",
            },
            {
              id: "2",
              media_type: "TEXT",
              text: "older",
              timestamp: "2024-08-01T00:00:00Z",
              permalink: "https://threads.net/@user/2",
              shortcode: "def",
            },
          ],
          paging: { cursors: { after: "cursor-1" } },
        }),
      );

      const posts = await api.getUserPosts(new Date("2024-10-01T00:00:00Z"));
      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe("1");
      // Early termination — no second page fetch
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserReplies", () => {
    it("retrieves authored replies from the user replies endpoint with pagination", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: "reply-1",
                text: "First reply",
                timestamp: "2025-01-01T00:00:00Z",
                permalink: "https://threads.net/@user/reply1",
                shortcode: "r1",
                media_type: "TEXT_POST",
                root_post: { id: "root-1" },
                replied_to: { id: "parent-1" },
                is_reply: true,
                is_reply_owned_by_me: true,
              },
            ],
            paging: { cursors: { after: "cursor-1" } },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: "reply-2",
                text: "Second reply",
                timestamp: "2024-12-01T00:00:00Z",
                permalink: "https://threads.net/@user/reply2",
                shortcode: "r2",
                media_type: "TEXT_POST",
                root_post: { id: "root-2" },
                replied_to: { id: "parent-2" },
                is_reply: true,
                is_reply_owned_by_me: true,
              },
            ],
          }),
        );

      const replies = await api.getUserReplies();

      expect(replies.map((reply) => reply.id)).toEqual(["reply-1", "reply-2"]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const firstUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(firstUrl.pathname).toBe("/v1.0/user-123/replies");
      expect(firstUrl.searchParams.get("fields")).toContain("root_post");
      expect(firstUrl.searchParams.get("fields")).toContain("replied_to");
      expect(firstUrl.searchParams.get("fields")).toContain("is_reply_owned_by_me");

      const secondUrl = new URL(fetchSpy.mock.calls[1][0] as string);
      expect(secondUrl.searchParams.get("after")).toBe("cursor-1");
    });

    it("sends a since timestamp and stops when replies are older than the lower bound", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "reply-new",
              text: "new",
              timestamp: "2024-12-10T00:00:00Z",
              media_type: "TEXT_POST",
              is_reply: true,
              is_reply_owned_by_me: true,
            },
            {
              id: "reply-old",
              text: "old",
              timestamp: "2024-11-01T00:00:00Z",
              media_type: "TEXT_POST",
              is_reply: true,
              is_reply_owned_by_me: true,
            },
          ],
          paging: { cursors: { after: "cursor-older" } },
        }),
      );

      const replies = await api.getUserReplies(new Date("2024-12-01T00:00:00Z"));

      expect(replies.map((reply) => reply.id)).toEqual(["reply-new"]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get("since")).toBe("1733011200");
    });

    it("skips repost facades returned by the replies endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "repost-1",
              timestamp: "2025-01-02T00:00:00Z",
              permalink: "https://threads.net/@user/repost1",
              shortcode: "rp1",
              media_type: "REPOST_FACADE",
              is_reply: false,
              is_reply_owned_by_me: true,
            },
            {
              id: "reply-1",
              text: "Real reply",
              timestamp: "2025-01-01T00:00:00Z",
              permalink: "https://threads.net/@user/reply1",
              shortcode: "r1",
              media_type: "TEXT_POST",
              root_post: { id: "root-1" },
              replied_to: { id: "parent-1" },
              is_reply: true,
              is_reply_owned_by_me: true,
            },
          ],
        }),
      );

      const replies = await api.getUserReplies();

      expect(replies.map((reply) => reply.id)).toEqual(["reply-1"]);
    });
  });

  describe("getPostInsights", () => {
    it("transforms nested response to flat object with defaults for missing metrics", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            { name: "views", values: [{ value: 100 }] },
            { name: "likes", values: [{ value: 10 }] },
            // replies, reposts, quotes, shares missing
          ],
        }),
      );

      const insights = await api.getPostInsights("media-1");
      expect(insights).toEqual({
        views: 100,
        likes: 10,
        replies: 0,
        reposts: 0,
        quotes: 0,
        shares: 0,
      });
    });
  });

  describe("getFollowersCount", () => {
    it("extracts number from total_value insights response", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              name: "followers_count",
              total_value: { value: 5432 },
            },
          ],
        }),
      );

      const count = await api.getFollowersCount();
      expect(count).toBe(5432);
    });

    it("falls back to the legacy values array shape", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              name: "followers_count",
              values: [{ value: 1234 }],
            },
          ],
        }),
      );

      const count = await api.getFollowersCount();
      expect(count).toBe(1234);
    });
  });

  describe("getFollowerDemographics", () => {
    it("transforms total_value breakdowns to array format and sends the breakdown param", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              name: "follower_demographics",
              total_value: {
                breakdowns: [
                  {
                    dimension_keys: ["country"],
                    results: [
                      { dimension_values: ["US"], value: 45 },
                      { dimension_values: ["GB"], value: 12 },
                      { dimension_values: ["JP"], value: 8 },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      );

      const result = await api.getFollowerDemographics("country");
      expect(result.dimension).toBe("country");
      expect(result.values).toEqual([
        { key: "US", value: 45 },
        { key: "GB", value: 12 },
        { key: "JP", value: 8 },
      ]);

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1.0/user-123/threads_insights");
      expect(url.searchParams.get("metric")).toBe("follower_demographics");
      expect(url.searchParams.get("breakdown")).toBe("country");
    });

    it("falls back to the legacy values object shape", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              name: "follower_demographics",
              values: [{ value: { US: 45, GB: 12 } }],
            },
          ],
        }),
      );

      const result = await api.getFollowerDemographics("country");
      expect(result.values).toEqual([
        { key: "US", value: 45 },
        { key: "GB", value: 12 },
      ]);
    });
  });

  describe("deletePost", () => {
    beforeEach(() => {
      // A destructive request must never reach the real network, even if the
      // client sends more calls than a test expects.
      fetchSpy.mockImplementation(() =>
        Promise.reject(new Error("unexpected fetch call")),
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("sends a DELETE with the access token and resolves on success", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ success: true, deleted_id: "media-1" }),
      );

      await expect(api.deletePost("media-1")).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1.0/media-1");
      expect(url.searchParams.get("access_token")).toBe("test-token");
      expect(fetchSpy.mock.calls[0][1]?.method).toBe("DELETE");
    });

    it("rejects when Threads does not confirm the delete", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ success: false }));

      const error = await api.deletePost("media-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).body).toEqual({ success: false });
    });

    it("rejects with the Threads error body on a 400", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { error: { message: "Unsupported delete request" } },
          { status: 400 },
        ),
      );

      const error = await api.deletePost("media-1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).status).toBe(400);
      expect((error as ThreadsAPIError).body).toEqual({
        error: { message: "Unsupported delete request" },
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does not retry after a network failure and keeps the token out of the error", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

      const error = await api.deletePost("media-1").catch((e: unknown) => e);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).body).toMatchObject({
        reason: "network_error",
      });
      expect(JSON.stringify((error as ThreadsAPIError).body)).not.toContain(
        "test-token",
      );
      expect((error as Error).message).not.toContain("test-token");
      expect(getThreadsErrorMessage(error)).toBe(
        "Couldn't confirm whether Threads deleted this post.",
      );
    });

    it("does not retry after a timeout", async () => {
      vi.useFakeTimers();

      fetchSpy.mockImplementationOnce((_url: unknown, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("Aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        });
      });

      const promise = api.deletePost("media-1").catch((e: unknown) => e);
      // 30s to time out, then well past the first retry backoff (1-1.5s).
      await vi.advanceTimersByTimeAsync(40_000);

      const error = await promise;
      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).status).toBe(408);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries after a 429 and resolves when the second response succeeds", async () => {
      vi.useFakeTimers();

      fetchSpy
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { "Retry-After": "0" },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ success: true, deleted_id: "media-1" }),
        );

      const promise = api.deletePost("media-1");
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(promise).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][1]?.method).toBe("DELETE");
    });
  });

  describe("getDeleteQuota", () => {
    it("requests only the delete fields and maps the response", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              delete_quota_usage: 3,
              delete_config: { quota_total: 100, quota_duration: 86400 },
            },
          ],
        }),
      );

      await expect(api.getDeleteQuota()).resolves.toEqual({
        permitted: true,
        used: 3,
        total: 100,
        remaining: 97,
      });

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1.0/user-123/threads_publishing_limit");
      expect(url.searchParams.get("fields")).toBe(
        "delete_quota_usage,delete_config",
      );
      expect(fetchSpy.mock.calls[0][1]?.method).toBe("GET");
    });

    it("reads the limit from Threads instead of assuming 100", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              delete_quota_usage: 10,
              delete_config: { quota_total: 250, quota_duration: 86400 },
            },
          ],
        }),
      );

      await expect(api.getDeleteQuota()).resolves.toEqual({
        permitted: true,
        used: 10,
        total: 250,
        remaining: 240,
      });
    });

    it("never reports fewer than zero deletions remaining", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              delete_quota_usage: 120,
              delete_config: { quota_total: 100, quota_duration: 86400 },
            },
          ],
        }),
      );

      await expect(api.getDeleteQuota()).resolves.toEqual({
        permitted: true,
        used: 120,
        total: 100,
        remaining: 0,
      });
    });

    it("counts a missing usage value as zero", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [{ delete_config: { quota_total: 100, quota_duration: 86400 } }],
        }),
      );

      await expect(api.getDeleteQuota()).resolves.toEqual({
        permitted: true,
        used: 0,
        total: 100,
        remaining: 100,
      });
    });

    it("is not permitted when delete_config is missing", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ data: [{ delete_quota_usage: 3 }] }))
        .mockResolvedValueOnce(jsonResponse({ data: [{ delete_config: {} }] }))
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      await expect(api.getDeleteQuota()).resolves.toEqual({ permitted: false });
      await expect(api.getDeleteQuota()).resolves.toEqual({ permitted: false });
      await expect(api.getDeleteQuota()).resolves.toEqual({ permitted: false });
    });

    it("is not permitted when Threads returns an error", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: { message: "forbidden" } }, { status: 403 }),
      );

      await expect(api.getDeleteQuota()).resolves.toEqual({ permitted: false });
    });
  });

  describe("refreshToken", () => {
    it("returns new token data", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-token",
          token_type: "bearer",
          expires_in: 5184000,
        }),
      );

      const result = await ThreadsAPI.refreshToken("old-token");
      expect(result.access_token).toBe("new-token");
      expect(result.expires_in).toBe(5184000);

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/refresh_access_token");
      expect(url.searchParams.get("grant_type")).toBe("th_refresh_token");
    });

    it("throws on expired token", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: { message: "token expired" } }, { status: 400 }),
      );

      await expect(ThreadsAPI.refreshToken("expired")).rejects.toThrow(
        ThreadsAPIError,
      );
    });

    it("keeps the token out of network errors", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

      const error = await ThreadsAPI.refreshToken("old-token").catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).body).toMatchObject({
        reason: "network_error",
        url: expect.stringContaining("access_token=REDACTED"),
      });
      expect(JSON.stringify((error as ThreadsAPIError).body)).not.toContain(
        "old-token",
      );
    });
  });

  describe("rate limiting and errors", () => {
    it("times out hung requests instead of hanging forever", async () => {
      vi.useFakeTimers();

      fetchSpy.mockImplementationOnce((_, init) => {
        const signal = init?.signal as AbortSignal | undefined;

        return new Promise<Response>((_, reject) => {
          signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

      const promise = api.getUserProfile().catch((error: Error) => error);
      await vi.advanceTimersByTimeAsync(30_000);

      const error = await promise;
      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as ThreadsAPIError).status).toBe(408);
      expect((error as Error).message).toContain("timed out");

      vi.useRealTimers();
    });

    it("retries on 429 and succeeds", async () => {
      vi.useFakeTimers();

      fetchSpy
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { "Retry-After": "0" },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ id: "user-123", username: "testuser" }),
        );

      const promise = api.getUserProfile();
      await vi.advanceTimersByTimeAsync(10_000);

      const profile = await promise;
      expect(profile.username).toBe("testuser");
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("throws after MAX_RETRIES on persistent 429", async () => {
      vi.useFakeTimers();

      const response429 = () =>
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "0" },
        });

      fetchSpy
        .mockResolvedValueOnce(response429())
        .mockResolvedValueOnce(response429())
        .mockResolvedValueOnce(response429())
        .mockResolvedValueOnce(response429());

      const promise = api.getUserProfile().catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(30_000);

      const error = await promise;
      expect(error).toBeInstanceOf(ThreadsAPIError);
      expect((error as Error).message).toBe(
        "Rate limited: max retries exceeded",
      );

      vi.useRealTimers();
    });

    it("retries transient network failures and succeeds", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);

      const error = new TypeError("fetch failed");
      Object.assign(error, {
        cause: {
          code: "ECONNRESET",
          message: "socket hang up",
        },
      });

      fetchSpy
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(
          jsonResponse({ id: "user-123", username: "testuser" }),
        );

      const promise = api.getUserProfile();
      await vi.advanceTimersByTimeAsync(1_000);

      const profile = await promise;
      expect(profile).toEqual({ id: "user-123", username: "testuser" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("surfaces persistent network failures with cause details", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);

      const error = new TypeError("fetch failed");
      Object.assign(error, {
        cause: {
          code: "ECONNRESET",
          message: "socket hang up",
        },
      });

      fetchSpy.mockRejectedValue(error);

      const promise = api.getUserProfile().catch((err: Error) => err);
      await vi.advanceTimersByTimeAsync(10_000);

      const result = await promise;
      expect(result).toBeInstanceOf(ThreadsAPIError);
      expect((result as Error).message).toBe(
        "Threads API network request failed: fetch failed (ECONNRESET: socket hang up)",
      );
      expect((result as ThreadsAPIError).body).toEqual({
        reason: "network_error",
        url: "https://graph.threads.net/v1.0/me?fields=id%2Cusername&access_token=REDACTED",
        code: "ECONNRESET",
        causeMessage: "socket hang up",
      });
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it("logs warning when x-app-usage exceeds 80%", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-123", username: "test" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-app-usage": JSON.stringify({
              call_count: 85,
              total_cputime: 10,
              total_time: 10,
            }),
          },
        }),
      );

      await api.getUserProfile();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("85%"),
        expect.any(Object),
      );
    });

    it("throws immediately on non-429 errors without retry", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ error: "forbidden" }, { status: 403 }),
      );

      await expect(api.getUserProfile()).rejects.toThrow(ThreadsAPIError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("THREADS_API_LAUNCH", () => {
    it("is April 13, 2024", () => {
      expect(THREADS_API_LAUNCH.toISOString()).toBe("2024-04-13T00:00:00.000Z");
    });
  });
});

describe("redactAccessToken", () => {
  it("replaces the token and leaves other parameters intact", () => {
    const redacted = redactAccessToken(
      "https://graph.threads.net/v1.0/me?fields=id&access_token=abc",
    );

    const url = new URL(redacted);
    expect(url.searchParams.get("access_token")).toBe("REDACTED");
    expect(url.searchParams.get("fields")).toBe("id");
    expect(redacted).not.toContain("abc");
  });

  it("handles a leading token and leaves token-free URLs unchanged", () => {
    expect(
      redactAccessToken(
        "https://graph.threads.net/v1.0/me?access_token=abc&fields=id",
      ),
    ).toBe("https://graph.threads.net/v1.0/me?access_token=REDACTED&fields=id");

    expect(redactAccessToken("https://graph.threads.net/v1.0/me?fields=id")).toBe(
      "https://graph.threads.net/v1.0/me?fields=id",
    );
  });
});

describe("getThreadsErrorMessage", () => {
  const unconfirmed = "Couldn't confirm whether Threads deleted this post.";
  const generic = "Threads couldn't delete this post.";

  it("uses the message from the Threads error body", () => {
    expect(
      getThreadsErrorMessage(
        new ThreadsAPIError("x", 400, { error: { message: "Boom" } }),
      ),
    ).toBe("Boom");
  });

  it("says the outcome is unknown after a timeout or a network error", () => {
    expect(getThreadsErrorMessage(new ThreadsAPIError("x", 408))).toBe(
      unconfirmed,
    );
    expect(
      getThreadsErrorMessage(
        new ThreadsAPIError("x", undefined, { reason: "network_error" }),
      ),
    ).toBe(unconfirmed);
  });

  it("checks for an unknown outcome before reading the body message", () => {
    expect(
      getThreadsErrorMessage(
        new ThreadsAPIError("x", 408, { error: { message: "Boom" } }),
      ),
    ).toBe(unconfirmed);
    expect(
      getThreadsErrorMessage(
        new ThreadsAPIError("x", 500, {
          reason: "network_error",
          error: { message: "Boom" },
        }),
      ),
    ).toBe(unconfirmed);
  });

  it("falls back to a generic message", () => {
    expect(getThreadsErrorMessage(new ThreadsAPIError("x", 500))).toBe(generic);
    expect(getThreadsErrorMessage(new ThreadsAPIError("x", 200, null))).toBe(
      generic,
    );
    expect(
      getThreadsErrorMessage(new ThreadsAPIError("x", 200, { success: false })),
    ).toBe(generic);
    expect(
      getThreadsErrorMessage(
        new ThreadsAPIError("x", 400, { error: { message: "" } }),
      ),
    ).toBe(generic);
    expect(getThreadsErrorMessage(new Error("boom"))).toBe(generic);
    expect(getThreadsErrorMessage("boom")).toBe(generic);
    expect(getThreadsErrorMessage(undefined)).toBe(generic);
  });
});

describe("getAuthorizationUrl", () => {
  it("requests the delete permission along with the existing scopes", () => {
    const url = new URL(getAuthorizationUrl("state-1"));

    expect(url.searchParams.get("scope")).toBe(
      "threads_basic,threads_manage_insights,threads_read_replies,threads_delete",
    );
  });
});
