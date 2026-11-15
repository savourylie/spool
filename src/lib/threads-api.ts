import { ThreadsAPIError } from "@/lib/threads";
import type {
  ThreadsUserProfile,
  ThreadsPost,
  ThreadsPostInsights,
  ThreadsReply,
  ThreadsUserReply,
  ThreadsUserInsightValue,
  ThreadsDemographicBreakdown,
  ThreadsTokenRefreshResult,
  ThreadsPaginatedResponse,
  ThreadsDeleteQuota,
} from "@/lib/threads-api.types";

const BASE_URL = "https://graph.threads.net/v1.0";
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

export const THREADS_API_LAUNCH = new Date("2024-04-13T00:00:00Z");

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (
    "cause" in error &&
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause &&
    typeof error.cause.code === "string"
  ) {
    return error.cause.code;
  }

  return null;
}

function getErrorCauseMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return null;
  }

  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("message" in cause)) {
    return null;
  }

  return typeof cause.message === "string" ? cause.message : null;
}

/**
 * Replaces the value of every `access_token` query parameter, so a request URL
 * can be stored on an error or written to a log without leaking the token.
 */
export function redactAccessToken(url: string): string {
  return url.replace(/([?&]access_token=)[^&#]*/gi, "$1REDACTED");
}

const DELETE_UNCONFIRMED_MESSAGE =
  "Couldn't confirm whether Threads deleted this post.";
const DELETE_FAILED_MESSAGE = "Threads couldn't delete this post.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * User-facing reason a delete failed. A timeout or network error means the
 * outcome is unknown (the post may be gone), so that is checked before the
 * message in the Threads error body.
 */
export function getThreadsErrorMessage(error: unknown): string {
  if (!(error instanceof ThreadsAPIError)) {
    return DELETE_FAILED_MESSAGE;
  }

  const body = isRecord(error.body) ? error.body : null;

  if (error.status === 408 || body?.reason === "network_error") {
    return DELETE_UNCONFIRMED_MESSAGE;
  }

  const message = isRecord(body?.error) ? body.error.message : undefined;
  return typeof message === "string" && message.trim()
    ? message
    : DELETE_FAILED_MESSAGE;
}

function createNetworkRequestError(url: string, error: unknown) {
  if (error instanceof ThreadsAPIError) {
    return error;
  }

  const baseMessage =
    error instanceof Error ? error.message : "Network request failed";
  const code = getErrorCode(error);
  const causeMessage = getErrorCauseMessage(error);
  const detail = code
    ? causeMessage
      ? `${code}: ${causeMessage}`
      : code
    : causeMessage;

  return new ThreadsAPIError(
    detail
      ? `Threads API network request failed: ${baseMessage} (${detail})`
      : `Threads API network request failed: ${baseMessage}`,
    undefined,
    {
      reason: "network_error",
      url: redactAccessToken(url),
      code,
      causeMessage,
    },
  );
}

function isRetryableFetchError(error: unknown) {
  return error instanceof TypeError;
}

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
    options: { method?: "GET" | "DELETE"; retryNetworkErrors?: boolean } = {},
  ): Promise<T> {
    const { method = "GET", retryNetworkErrors = true } = options;
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

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url.toString(), method);
      } catch (error) {
        const requestError = createNetworkRequestError(url.toString(), error);

        // The request may have reached Threads before the connection failed,
        // so a caller that cannot safely repeat it opts out of this retry.
        if (
          attempt === MAX_RETRIES ||
          !retryNetworkErrors ||
          !isRetryableFetchError(error)
        ) {
          throw requestError;
        }

        lastError = requestError;
        continue;
      }

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

  private async fetchWithTimeout(
    url: string,
    method: "GET" | "DELETE",
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, { method, signal: controller.signal });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || controller.signal.aborted)
      ) {
        throw new ThreadsAPIError(
          `Threads API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          408,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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

  async getPostReplies(mediaId: string): Promise<ThreadsReply[]> {
    const allReplies: ThreadsReply[] = [];
    let cursor: string | undefined;

    const fields = "id,text,timestamp";

    for (;;) {
      const params: Record<string, string> = { fields };
      if (cursor) params.after = cursor;

      const page = await this.request<ThreadsPaginatedResponse<ThreadsReply>>(
        `/${mediaId}/replies`,
        params,
      );

      for (const reply of page.data) {
        allReplies.push(reply);
      }

      if (!page.paging?.cursors?.after) break;
      cursor = page.paging.cursors.after;
    }

    return allReplies;
  }

  async getUserReplies(since?: Date): Promise<ThreadsUserReply[]> {
    const allReplies: ThreadsUserReply[] = [];
    let cursor: string | undefined;

    const fields = [
      "id",
      "text",
      "timestamp",
      "permalink",
      "shortcode",
      "media_type",
      "root_post",
      "replied_to",
      "is_reply",
      "is_reply_owned_by_me",
    ].join(",");

    const lowerBound = since && since > THREADS_API_LAUNCH
      ? since
      : THREADS_API_LAUNCH;

    for (;;) {
      const params: Record<string, string> = { fields };
      if (cursor) params.after = cursor;
      if (since) {
        params.since = String(Math.floor(since.getTime() / 1000));
      }

      const page = await this.request<ThreadsPaginatedResponse<ThreadsUserReply>>(
        `/${this.userId}/replies`,
        params,
      );

      let shouldStop = false;

      for (const reply of page.data) {
        // Filter out repost facades (CLAUDE.md #4)
        if (reply.media_type === "REPOST_FACADE") continue;

        const repliedAt = new Date(reply.timestamp);

        if (repliedAt < lowerBound) {
          shouldStop = true;
          break;
        }

        if (reply.is_reply_owned_by_me === false) {
          continue;
        }

        allReplies.push(reply);
      }

      if (shouldStop || !page.paging?.cursors?.after) break;
      cursor = page.paging.cursors.after;
    }

    return allReplies;
  }

  /**
   * Deletes a post from Threads. A delete is not idempotent, so it is never
   * retried after a network error or timeout (the post may already be gone);
   * a 429 is still retried because the request was not executed.
   */
  async deletePost(mediaId: string): Promise<void> {
    const body = await this.request<{ success?: boolean }>(
      `/${mediaId}`,
      undefined,
      { method: "DELETE", retryNetworkErrors: false },
    );

    if (body?.success !== true) {
      throw new ThreadsAPIError(
        "Threads did not confirm the delete",
        200,
        body,
      );
    }
  }

  /**
   * The delete quota call doubles as the permission check: delete counts as
   * permitted only when the response carries `delete_config`. Any error, or a
   * response without it, means "not permitted".
   */
  async getDeleteQuota(): Promise<ThreadsDeleteQuota> {
    try {
      const response = await this.request<{
        data?: {
          delete_quota_usage?: number;
          delete_config?: { quota_total?: number; quota_duration?: number };
        }[];
      }>(`/${this.userId}/threads_publishing_limit`, {
        fields: "delete_quota_usage,delete_config",
      });

      const entry = response.data?.[0];
      const total = entry?.delete_config?.quota_total;
      if (typeof total !== "number") {
        return { permitted: false };
      }

      const usage = entry?.delete_quota_usage;
      const used = typeof usage === "number" ? usage : 0;

      return {
        permitted: true,
        used,
        total,
        remaining: Math.max(0, total - used),
      };
    } catch {
      return { permitted: false };
    }
  }

  static async refreshToken(
    token: string,
  ): Promise<ThreadsTokenRefreshResult> {
    const url = new URL(
      "https://graph.threads.net/refresh_access_token",
    );
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", token);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(url.toString(), { signal: controller.signal });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || controller.signal.aborted)
      ) {
        throw new ThreadsAPIError(
          `Threads API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          408,
        );
      }

      throw createNetworkRequestError(url.toString(), error);
    } finally {
      clearTimeout(timeoutId);
    }

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
