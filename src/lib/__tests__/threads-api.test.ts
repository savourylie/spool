import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThreadsAPI, THREADS_API_LAUNCH } from "../threads-api";
import { ThreadsAPIError } from "../threads";

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
