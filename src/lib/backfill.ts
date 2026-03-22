import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";
import { ThreadsAPIError } from "@/lib/threads";

export async function runBackfill(userId: string, jobId: string) {
  const supabase = createAdminClient();
  let stage = "initializing";
  let currentPostId: string | null = null;

  try {
    console.log("Backfill started", { userId, jobId });

    // 1. Update job to running
    stage = "marking_job_running";
    const { error: startError } = await supabase
      .from("backfill_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);

    if (startError) throw startError;

    // 2. Get user and decrypt token
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("threads_user_id, access_token")
      .eq("id", userId)
      .single();

    if (userError || !user) throw userError ?? new Error("User not found");

    stage = "decrypting_access_token";
    const accessToken = decrypt(user.access_token);
    const api = new ThreadsAPI(accessToken, user.threads_user_id);

    // 3. Fetch all posts (paginated, from April 2024 onward, repost facades excluded)
    stage = "fetching_posts";
    const posts = await api.getUserPosts();
    console.log("Backfill fetched posts", {
      userId,
      jobId,
      totalPosts: posts.length,
    });

    // 4. Set total_posts
    stage = "saving_total_posts";
    await supabase
      .from("backfill_jobs")
      .update({ total_posts: posts.length })
      .eq("id", jobId);

    // 5. Process each post sequentially to avoid rate limits
    let processed = 0;

    for (const post of posts) {
      currentPostId = post.id;
      console.log("Backfill fetching post insights", {
        userId,
        jobId,
        postId: currentPostId,
        processed,
        totalPosts: posts.length,
      });

      stage = "fetching_post_insights";
      const insights = await api.getPostInsights(post.id);

      // Upsert post (idempotent on threads_media_id)
      stage = "saving_post";
      const { data: insertedPost } = await supabase
        .from("posts")
        .upsert(
          {
            user_id: userId,
            threads_media_id: post.id,
            media_type: post.media_type,
            text_preview: post.text?.substring(0, 280) ?? null,
            permalink: post.permalink,
            published_at: post.timestamp,
          },
          { onConflict: "threads_media_id" },
        )
        .select("id")
        .single();

      // Insert initial metrics snapshot
      if (insertedPost) {
        await supabase.from("post_metrics").insert({
          post_id: insertedPost.id,
          views: insights.views,
          likes: insights.likes,
          replies: insights.replies,
          reposts: insights.reposts,
          quotes: insights.quotes,
          shares: insights.shares,
        });
      }

      // Update progress
      processed++;
      stage = "updating_progress";
      await supabase
        .from("backfill_jobs")
        .update({ processed_posts: processed })
        .eq("id", jobId);

      currentPostId = null;
    }

    // 6. Fetch followers count and create initial daily_stats
    stage = "fetching_followers_count";
    const followersCount = await api.getFollowersCount();

    stage = "saving_daily_stats";
    await supabase.from("daily_stats").upsert(
      {
        user_id: userId,
        date: new Date().toISOString().split("T")[0],
        followers_count: followersCount,
      },
      { onConflict: "user_id,date" },
    );

    // 7. Fetch demographics only when the account meets Threads eligibility.
    if (followersCount >= 100) {
      for (const dimension of ["country", "city", "gender"] as const) {
        try {
          stage = `fetching_demographics_${dimension}`;
          console.log("Backfill fetching demographics", {
            userId,
            jobId,
            dimension,
          });
          const demo = await api.getFollowerDemographics(dimension);

          stage = `saving_demographics_${dimension}`;
          for (const { key, value } of demo.values) {
            await supabase.from("demographics").upsert(
              {
                user_id: userId,
                dimension,
                key,
                value,
              },
              { onConflict: "user_id,dimension,key" },
            );
          }
        } catch (err) {
          console.warn(`Failed to fetch ${dimension} demographics:`, err);
        }
      }
    }

    // 8. Mark complete
    stage = "marking_job_complete";
    await supabase
      .from("backfill_jobs")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log("Backfill completed", { userId, jobId });
  } catch (error) {
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
    const { error: failError } = await supabase
      .from("backfill_jobs")
      .update({ status: "failed" })
      .eq("id", jobId);

    if (failError) {
      console.error("Failed to update backfill status:", failError);
    }
  }
}
