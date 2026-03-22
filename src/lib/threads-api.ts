import { ThreadsAPIError } from "@/lib/threads";
import type {
  ThreadsUserProfile,
  ThreadsPost,
  ThreadsPostInsights,
  ThreadsUserInsightValue,
  ThreadsDemographicBreakdown,
  ThreadsTokenRefreshResult,
  ThreadsPaginatedResponse,
} from "@/lib/threads-api.types";

const BASE_URL = "https://graph.threads.net/v1.0";
const MAX_RETRIES = 3;

export const THREADS_API_LAUNCH = new Date("2024-04-13T00:00:00Z");

export class ThreadsAPI {
  constructor(
    private accessToken: string,
    private userId: string,
  ) {}

  private findInsightMetric(
    data: ThreadsUserInsightValue[],
    metric: string,
  ): ThreadsUserInsightValue | undefined {
    return data.find((entry) => entry.name === metric) ?? data[0];
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    url.searchParams.set("access_token", this.accessToken);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        const jitter = Math.random() * 500;
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay + jitter),
        );
      }

      const response = await fetch(url.toString());

      // Log rate limit warnings
      const appUsage = response.headers.get("x-app-usage");
      if (appUsage) {
        try {
          const usage = JSON.parse(appUsage);
          const maxUsage = Math.max(
            usage.call_count ?? 0,
            usage.total_cputime ?? 0,
            usage.total_time ?? 0,
          );
          if (maxUsage > 80) {
            console.warn(
              `Threads API rate limit warning: ${maxUsage}% usage`,
              usage,
            );
          }
        } catch {
          // Ignore malformed header
        }
      }

      if (response.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new ThreadsAPIError(
            "Rate limited: max retries exceeded",
            429,
          );
        }
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(retryAfter, 10) * 1000),
          );
        }
        lastError = new ThreadsAPIError("Rate limited", 429);
        continue;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ThreadsAPIError(
          `Threads API error: ${response.status}`,
          response.status,
          body,
        );
      }

      return response.json() as Promise<T>;
    }

    throw lastError ?? new ThreadsAPIError("Request failed");
  }

  async getUserProfile(): Promise<ThreadsUserProfile> {
    return this.request<ThreadsUserProfile>("/me", {
      fields: "id,username",
    });
  }

  async getUserPosts(since?: Date): Promise<ThreadsPost[]> {
    const allPosts: ThreadsPost[] = [];
    let cursor: string | undefined;

    const fields = "id,media_type,text,timestamp,permalink,shortcode";

    for (;;) {
      const params: Record<string, string> = { fields };
      if (cursor) params.after = cursor;

      const page = await this.request<ThreadsPaginatedResponse<ThreadsPost>>(
        `/${this.userId}/threads`,
        params,
      );

      let shouldStop = false;

      for (const post of page.data) {
        // Filter out repost facades (CLAUDE.md #4)
        if (post.media_type === "REPOST_FACADE") continue;

        const postDate = new Date(post.timestamp);

        // Stop pagination if we've gone before the API launch date (CLAUDE.md #3)
        if (postDate < THREADS_API_LAUNCH) {
          shouldStop = true;
          break;
        }

        // Client-side since filtering with early termination
        if (since && postDate < since) {
          shouldStop = true;
          break;
        }

        allPosts.push(post);
      }

      if (shouldStop || !page.paging?.cursors?.after) break;
      cursor = page.paging.cursors.after;
    }

    return allPosts;
  }

  async getPostInsights(mediaId: string): Promise<ThreadsPostInsights> {
    const response = await this.request<{
      data: { name: string; values: { value: number }[] }[];
    }>(`/${mediaId}/insights`, {
      metric: "views,likes,replies,reposts,quotes,shares",
    });

    const insights: ThreadsPostInsights = {
      views: 0,
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    };

    for (const metric of response.data) {
      if (metric.name in insights) {
        insights[metric.name as keyof ThreadsPostInsights] =
          metric.values[0]?.value ?? 0;
      }
    }

    return insights;
  }

  async getUserInsights(
    metric: string,
    since?: Date,
    until?: Date,
    extraParams?: Record<string, string>,
  ): Promise<ThreadsUserInsightValue[]> {
    const params: Record<string, string> = { metric, ...extraParams };
    if (since) params.since = String(Math.floor(since.getTime() / 1000));
    if (until) params.until = String(Math.floor(until.getTime() / 1000));

    const response = await this.request<{ data: ThreadsUserInsightValue[] }>(
      `/${this.userId}/threads_insights`,
      params,
    );

    return response.data;
  }

  async getFollowersCount(): Promise<number> {
    const data = await this.getUserInsights("followers_count");
    const metric = this.findInsightMetric(data, "followers_count");

    if (typeof metric?.total_value?.value === "number") {
      return metric.total_value.value;
    }

    return metric?.values?.[0]?.value ?? 0;
  }

  async getFollowerDemographics(
    dimension: string,
  ): Promise<ThreadsDemographicBreakdown> {
    const data = await this.getUserInsights(
      "follower_demographics",
      undefined,
      undefined,
      { breakdown: dimension },
    );
    const metric = this.findInsightMetric(data, "follower_demographics");

    const breakdownResults =
      metric?.total_value?.breakdowns?.flatMap(
        (breakdown) => breakdown.results ?? [],
      ) ?? [];

    if (breakdownResults.length > 0) {
      return {
        dimension,
        values: breakdownResults
          .map((result) => {
            const key = result.dimension_values?.[0];
            return typeof key === "string"
              ? { key, value: result.value }
              : null;
          })
          .filter((entry): entry is { key: string; value: number } => {
            return entry !== null;
          }),
      };
    }

    const legacyBreakdown = metric?.values?.[0]?.value as
      | Record<string, number>
      | undefined;

    return {
      dimension,
      values: Object.entries(legacyBreakdown ?? {}).map(([key, value]) => ({
        key,
        value,
      })),
    };
  }

  static async refreshToken(
    token: string,
  ): Promise<ThreadsTokenRefreshResult> {
    const url = new URL(
      "https://graph.threads.net/refresh_access_token",
    );
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ThreadsAPIError(
        "Failed to refresh token",
        response.status,
        body,
      );
    }

    return response.json() as Promise<ThreadsTokenRefreshResult>;
  }
}
