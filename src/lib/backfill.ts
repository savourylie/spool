import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { ThreadsAPI } from "@/lib/threads-api";
import type { ThreadsPost } from "@/lib/threads-api.types";
import { decrypt } from "@/lib/crypto";
import { linkPredictionToPost } from "@/lib/post-review";
import { extractConceptsForPost } from "@/lib/concept-library";
import { ThreadsAPIError } from "@/lib/threads";
import { normalizeThreadsMediaType } from "@/lib/post-media-type";
import { extractTopics, classifyPostTopic } from "@/lib/topic-classification";

type BackfillEventLevel = "info" | "warn" | "error";

const REDACTED_DETAIL_KEYS = [
  "access_token",
  "token",
  "authorization",
  "cookie",
  "text",
  "body",
  "headers",
  "secret",
];

function isSensitiveDebugKey(key: string) {
  return REDACTED_DETAIL_KEYS.some((candidate) =>
    key.toLowerCase().includes(candidate),
  );
}

function sanitizeDebugValue(value: unknown): Json {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeDebugValue(entry));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveDebugKey(key) ? "[redacted]" : sanitizeDebugValue(entry),
      ]),
    );
  }

  return String(value);
}

function serializeBackfillError(error: unknown) {
  if (error instanceof ThreadsAPIError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status ?? null,
      payload:
        typeof error.body === "undefined" ? null : sanitizeDebugValue(error.body),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: null,
      payload: { name: error.name } satisfies Json,
    };
  }

  if (error && typeof error === "object") {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : null;
    const status =
      "status" in error && typeof error.status === "number"
        ? error.status
        : null;
    const name =
      "code" in error && typeof error.code === "string"
        ? error.code
        : "UnknownError";

    if (message) {
      return {
        name,
        message,
        status,
        payload: sanitizeDebugValue(error),
      };
    }
  }

  return {
    name: "UnknownError",
    message: "Unknown error",
    status: null,
    payload: sanitizeDebugValue(error),
  };
}

type ExistingPostRow = {
  id: string;
  threads_media_id: string;
};

type ExistingMetricRow = {
  post_id: string;
};

type ExistingPostCoverage = {
  existingPostId: string;
  hasMetrics: boolean;
};

type QueuedBackfillPost = {
  post: ThreadsPost;
  existingPostId: string | null;
};

const POST_METRICS_COVERAGE_BATCH_SIZE = 100;

function getCoverageBatches<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

async function getExistingPostCoverage(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: existingPosts, error: existingPostsError } = await supabase
    .from("posts")
    .select("id, threads_media_id")
    .eq("user_id", userId);

  if (existingPostsError) {
    throw existingPostsError;
  }

  const typedExistingPosts = (existingPosts ?? []) as ExistingPostRow[];
  if (typedExistingPosts.length === 0) {
    return new Map<string, ExistingPostCoverage>();
  }

  const postIdsWithMetrics = new Set<string>();

  for (const postIdBatch of getCoverageBatches(
    typedExistingPosts.map((post) => post.id),
    POST_METRICS_COVERAGE_BATCH_SIZE,
  )) {
    const { data: existingMetrics, error: existingMetricsError } = await supabase
      .from("post_metrics")
      .select("post_id")
      .in("post_id", postIdBatch);

    if (existingMetricsError) {
      throw existingMetricsError;
    }

    for (const metric of (existingMetrics ?? []) as ExistingMetricRow[]) {
      postIdsWithMetrics.add(metric.post_id);
    }
  }

  return new Map(
    typedExistingPosts.map((post) => [
      post.threads_media_id,
      {
        existingPostId: post.id,
        hasMetrics: postIdsWithMetrics.has(post.id),
      },
    ]),
  );
}

export async function runBackfill(userId: string, jobId: string) {
  const supabase = createAdminClient();
  let stage = "initializing";
  let currentPostId: string | null = null;

  async function updateJob(
    patch: {
      status?: "running" | "complete" | "failed";
      processed_posts?: number;
      total_posts?: number;
      started_at?: string;
      completed_at?: string;
      stage?: string;
      current_post_id?: string | null;
      last_error_message?: string | null;
      last_error_status?: number | null;
      last_error_payload?: Json | null;
    },
    at = new Date().toISOString(),
  ) {
    const { error } = await supabase
      .from("backfill_jobs")
      .update({
        ...patch,
        stage: patch.stage ?? stage,
        current_post_id:
          typeof patch.current_post_id === "undefined"
            ? currentPostId
            : patch.current_post_id,
        last_heartbeat_at: at,
      })
      .eq("id", jobId);

    if (error) {
      throw error;
    }
  }

  async function appendEvent(
    level: BackfillEventLevel,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    const payload = {
      ...details,
      userId,
      jobId,
    };

    const { error } = await supabase.from("backfill_job_events").insert({
      job_id: jobId,
      level,
      stage,
      message,
      details: sanitizeDebugValue(payload),
    });

    if (error) {
      console.error("Failed to persist backfill event", {
        userId,
        jobId,
        stage,
        message,
        error,
      });
    }
  }

  async function checkpoint({
    nextStage,
    nextCurrentPostId,
    message,
    details,
    jobPatch,
    level = "info",
  }: {
    nextStage: string;
    nextCurrentPostId?: string | null;
    message: string;
    details?: Record<string, unknown>;
    jobPatch?: Parameters<typeof updateJob>[0];
    level?: BackfillEventLevel;
  }) {
    stage = nextStage;
    if (typeof nextCurrentPostId !== "undefined") {
      currentPostId = nextCurrentPostId;
    }

    await updateJob({
      ...jobPatch,
      stage,
      current_post_id: currentPostId,
    });
    await appendEvent(level, message, details);
  }

  try {
    console.log("Backfill started", { userId, jobId });

    await checkpoint({
      nextStage: "marking_job_running",
      nextCurrentPostId: null,
      message: "Backfill started",
      details: { processedPosts: 0 },
      jobPatch: {
        status: "running",
        started_at: new Date().toISOString(),
        processed_posts: 0,
        last_error_message: null,
        last_error_status: null,
        last_error_payload: null,
      },
    });

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("threads_user_id, access_token")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw userError ?? new Error("User not found");
    }

    await checkpoint({
      nextStage: "decrypting_access_token",
      message: "Loaded user record and decrypted access token",
      details: { threadsUserId: user.threads_user_id },
    });

    const accessToken = decrypt(user.access_token);
    const api = new ThreadsAPI(accessToken, user.threads_user_id);

    await checkpoint({
      nextStage: "fetching_posts",
      message: "Requesting Threads post list",
    });
    const posts = await api.getUserPosts();
    await appendEvent("info", "Threads post list received", {
      totalPosts: posts.length,
    });

    console.log("Backfill fetched posts", {
      userId,
      jobId,
      totalPosts: posts.length,
    });

    await checkpoint({
      nextStage: "analyzing_existing_coverage",
      message: "Checking which posts already have saved coverage",
    });

    const coverageByMediaId = await getExistingPostCoverage(supabase, userId);
    const postsToProcess: QueuedBackfillPost[] = [];
    let coveredPosts = 0;
    let partialPosts = 0;
    let missingPosts = 0;

    for (const post of posts) {
      const coverage = coverageByMediaId.get(post.id);

      if (!coverage) {
        missingPosts += 1;
        postsToProcess.push({ post, existingPostId: null });
        continue;
      }

      if (coverage.hasMetrics) {
        coveredPosts += 1;
        continue;
      }

      partialPosts += 1;
      postsToProcess.push({
        post,
        existingPostId: coverage.existingPostId,
      });
    }

    await checkpoint({
      nextStage: "saving_total_posts",
      message: "Stored total post count",
      details: {
        totalPosts: posts.length,
        coveredPosts,
        partialPosts,
        missingPosts,
      },
      jobPatch: {
        total_posts: posts.length,
        processed_posts: coveredPosts,
      },
    });
    await appendEvent("info", "Existing post coverage analyzed", {
      coveredPosts,
      missingPosts,
      partialPosts,
      totalPosts: posts.length,
    });

    if (postsToProcess.length === 0) {
      await appendEvent("info", "No missing post coverage detected", {
        coveredPosts,
        totalPosts: posts.length,
      });
    }

    let processed = coveredPosts;

    for (const { post, existingPostId } of postsToProcess) {
      currentPostId = post.id;

      console.log("Backfill fetching post insights", {
        userId,
        jobId,
        postId: currentPostId,
        processed,
        totalPosts: posts.length,
      });

      await checkpoint({
        nextStage: "fetching_post_insights",
        nextCurrentPostId: currentPostId,
        message: "Requesting Threads post insights",
        details: {
          postId: currentPostId,
          processedPosts: processed,
          totalPosts: posts.length,
        },
      });
      const insights = await api.getPostInsights(post.id);
      await appendEvent("info", "Threads post insights received", {
        postId: currentPostId,
        views: insights.views,
      });

      let postId = existingPostId;
      const shouldAttemptPredictionLink = !postId;

      if (!postId) {
        await checkpoint({
          nextStage: "saving_post",
          nextCurrentPostId: currentPostId,
          message: "Saving post metadata",
          details: { postId: currentPostId },
        });
        const { data: insertedPost, error: postError } = await supabase
          .from("posts")
          .upsert(
            {
              user_id: userId,
              threads_media_id: post.id,
              media_type: normalizeThreadsMediaType(post.media_type),
              text_preview: post.text?.substring(0, 280) ?? null,
              text_full: post.text ?? null,
              permalink: post.permalink,
              published_at: post.timestamp,
            },
            { onConflict: "threads_media_id" },
          )
          .select("id")
          .single();

        if (postError || !insertedPost) {
          throw postError ?? new Error("Failed to save post");
        }

        postId = insertedPost.id;
      }

      if (!postId) {
        throw new Error("Missing post id for metrics insert");
      }

      await checkpoint({
        nextStage: "saving_post_metrics",
        nextCurrentPostId: currentPostId,
        message: "Saving post metrics snapshot",
        details: { postId: currentPostId },
      });
      const { error: metricsError } = await supabase.from("post_metrics").insert({
        post_id: postId,
        views: insights.views,
        likes: insights.likes,
        replies: insights.replies,
        reposts: insights.reposts,
        quotes: insights.quotes,
        shares: insights.shares,
      });

      if (metricsError) {
        throw metricsError;
      }

      if (shouldAttemptPredictionLink && post.text?.trim()) {
        try {
          await linkPredictionToPost({
            userId,
            postId,
            postText: post.text,
          });
        } catch (predictionLinkError) {
          console.error("Failed to link post prediction during backfill:", {
            userId,
            postId,
            error: predictionLinkError,
          });
        }
      }

      if (post.text?.trim()) {
        try {
          await extractConceptsForPost(postId);
        } catch (conceptError) {
          console.error("Failed to extract concepts during backfill:", {
            userId,
            postId,
            error: conceptError,
          });
        }
      }

      processed += 1;
      currentPostId = null;

      await checkpoint({
        nextStage: "updating_progress",
        nextCurrentPostId: null,
        message: "Updated processed post count",
        details: {
          postId: post.id,
          processedPosts: processed,
          totalPosts: posts.length,
        },
        jobPatch: {
          processed_posts: processed,
        },
      });
    }

    // --- Topic classification (batch) ---
    await checkpoint({
      nextStage: "classifying_topics",
      nextCurrentPostId: null,
      message: "Classifying post topics",
    });

    const { data: allPosts } = await supabase
      .from("posts")
      .select("id, text_full")
      .eq("user_id", userId);

    if (allPosts && allPosts.length > 0) {
      const topicClusters = extractTopics(
        allPosts.map((p) => ({ text: p.text_full })),
      );
      let classified = 0;

      for (const post of allPosts) {
        const result = classifyPostTopic(post.text_full, topicClusters);
        if (result) {
          await supabase
            .from("posts")
            .update({ topic_tag: result.topic })
            .eq("id", post.id);
          classified++;
        }
      }

      await appendEvent("info", "Topic classification complete", {
        totalPosts: allPosts.length,
        classified,
        clusters: topicClusters.length,
      });
    }

    await checkpoint({
      nextStage: "fetching_followers_count",
      nextCurrentPostId: null,
      message: "Requesting follower count",
    });
    const followersCount = await api.getFollowersCount();
    await appendEvent("info", "Follower count received", { followersCount });

    await checkpoint({
      nextStage: "saving_daily_stats",
      nextCurrentPostId: null,
      message: "Saving daily follower snapshot",
      details: { followersCount },
    });
    const { error: dailyStatsError } = await supabase.from("daily_stats").upsert(
      {
        user_id: userId,
        date: new Date().toISOString().split("T")[0],
        followers_count: followersCount,
      },
      { onConflict: "user_id,date" },
    );

    if (dailyStatsError) {
      throw dailyStatsError;
    }

    if (followersCount >= 100) {
      for (const dimension of ["country", "city", "gender"] as const) {
        try {
          stage = `fetching_demographics_${dimension}`;
          currentPostId = null;
          await updateJob({ stage, current_post_id: null });
          await appendEvent("info", "Requesting demographics", { dimension });

          console.log("Backfill fetching demographics", {
            userId,
            jobId,
            dimension,
          });

          const demo = await api.getFollowerDemographics(dimension);
          await appendEvent("info", "Demographics received", {
            dimension,
            records: demo.values.length,
          });

          stage = `saving_demographics_${dimension}`;
          await updateJob({ stage, current_post_id: null });
          await appendEvent("info", "Saving demographics", {
            dimension,
            records: demo.values.length,
          });

          for (const { key, value } of demo.values) {
            const { error: demographicsError } = await supabase
              .from("demographics")
              .upsert(
                {
                  user_id: userId,
                  dimension,
                  key,
                  value,
                },
                { onConflict: "user_id,dimension,key" },
              );

            if (demographicsError) {
              throw demographicsError;
            }
          }
        } catch (error) {
          const serialized = serializeBackfillError(error);
          console.warn(`Failed to fetch ${dimension} demographics:`, error);
          await appendEvent("warn", "Demographics fetch failed", {
            dimension,
            error: serialized,
          });
        }
      }
    }

    stage = "complete";
    currentPostId = null;
    await updateJob({
      status: "complete",
      stage,
      current_post_id: null,
      completed_at: new Date().toISOString(),
    });
    await appendEvent("info", "Backfill completed", {
      processedPosts: processed,
      totalPosts: posts.length,
      followersCount,
    });

    console.log("Backfill completed", { userId, jobId });
  } catch (error) {
    const serialized = serializeBackfillError(error);

    console.error("Backfill failed", {
      userId,
      jobId,
      stage,
      postId: currentPostId,
      error:
        error instanceof ThreadsAPIError
          ? {
              name: error.name,
              message: error.message,
              status: error.status,
              body: error.body,
            }
          : error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : error,
    });

    await appendEvent("error", "Backfill failed", {
      postId: currentPostId,
      error: serialized,
    });

    const { error: failError } = await supabase
      .from("backfill_jobs")
      .update({
        status: "failed",
        stage,
        current_post_id: currentPostId,
        last_heartbeat_at: new Date().toISOString(),
        last_error_message: serialized.message,
        last_error_status: serialized.status,
        last_error_payload: serialized.payload,
      })
      .eq("id", jobId);

    if (failError) {
      console.error("Failed to update backfill status:", failError);
    }
  }
}
