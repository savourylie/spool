import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";

export async function refreshMetrics(
  userId: string,
): Promise<{ newPosts: number; updatedMetrics: number }> {
  const supabase = createAdminClient();

  // 1. Get user and check token
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("threads_user_id, access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !user) throw userError ?? new Error("User not found");

  if (new Date(user.token_expires_at) <= new Date()) {
    console.warn(`Skipping user ${userId}: token expired`);
    return { newPosts: 0, updatedMetrics: 0 };
  }

  const accessToken = decrypt(user.access_token);
  const api = new ThreadsAPI(accessToken, user.threads_user_id);

  // 2. Fetch new posts since the most recent one we have
  const { data: latestPost } = await supabase
    .from("posts")
    .select("published_at")
    .eq("user_id", userId)
    .order("published_at", { ascending: false })
    .limit(1)
    .single();

  const since = latestPost ? new Date(latestPost.published_at) : undefined;
  const newPostsData = await api.getUserPosts(since);

  let newPosts = 0;
  for (const post of newPostsData) {
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

    if (insertedPost) {
      const insights = await api.getPostInsights(post.id);
      await supabase.from("post_metrics").insert({
        post_id: insertedPost.id,
        views: insights.views,
        likes: insights.likes,
        replies: insights.replies,
        reposts: insights.reposts,
        quotes: insights.quotes,
        shares: insights.shares,
      });
      newPosts++;
    }
  }

  // 3. Fetch updated metrics for posts from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("id, threads_media_id")
    .eq("user_id", userId)
    .gte("published_at", sevenDaysAgo.toISOString());

  let updatedMetrics = 0;
  for (const post of recentPosts ?? []) {
    // Skip posts we just fetched metrics for above
    if (newPostsData.some((p) => p.id === post.threads_media_id)) continue;

    const insights = await api.getPostInsights(post.threads_media_id);
    await supabase.from("post_metrics").insert({
      post_id: post.id,
      views: insights.views,
      likes: insights.likes,
      replies: insights.replies,
      reposts: insights.reposts,
      quotes: insights.quotes,
      shares: insights.shares,
    });
    updatedMetrics++;
  }

  return { newPosts, updatedMetrics };
}

export async function refreshAllUsers(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase.from("users").select("id");

  if (error) throw error;

  let processed = 0;
  let errors = 0;

  for (const user of users ?? []) {
    try {
      const result = await refreshMetrics(user.id);
      console.log(
        `Refreshed user ${user.id}: ${result.newPosts} new posts, ${result.updatedMetrics} updated metrics`,
      );
      processed++;
    } catch (err) {
      console.error(`Failed to refresh metrics for user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(
    `Metrics refresh complete: ${processed} users processed, ${errors} errors`,
  );
  return { processed, errors };
}
