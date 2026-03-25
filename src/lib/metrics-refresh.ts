import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";
import { normalizeThreadsMediaType } from "@/lib/post-media-type";
import { extractTopics, classifyPostTopic } from "@/lib/topic-classification";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function refreshMetrics(
  userId: string,
): Promise<{ newPosts: number; updatedMetrics: number; repliesStored: number }> {
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
    return { newPosts: 0, updatedMetrics: 0, repliesStored: 0 };
  }

  const accessToken = decrypt(user.access_token);
  const api = new ThreadsAPI(accessToken, user.threads_user_id);

  // 2. Fetch new posts since the most recent one we have
  const { data: latestPost, error: latestPostError } = await supabase
    .from("posts")
    .select("published_at")
    .eq("user_id", userId)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPostError) throw latestPostError;

  const since = latestPost ? new Date(latestPost.published_at) : undefined;
  const newPostsData = await api.getUserPosts(since);

  let newPosts = 0;
  const newPostIds: string[] = [];
  for (const post of newPostsData) {
    const { data: insertedPost } = await supabase
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

    if (insertedPost) {
      newPostIds.push(insertedPost.id);
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

  // 2b. Classify topics for newly inserted posts
  if (newPostIds.length > 0) {
    const { data: allPosts } = await supabase
      .from("posts")
      .select("id, text_full")
      .eq("user_id", userId);

    if (allPosts && allPosts.length > 0) {
      const topicClusters = extractTopics(
        allPosts.map((p) => ({ text: p.text_full })),
      );
      const newPostIdSet = new Set(newPostIds);

      for (const post of allPosts.filter((p) => newPostIdSet.has(p.id))) {
        const result = classifyPostTopic(post.text_full, topicClusters);
        if (result) {
          await supabase
            .from("posts")
            .update({ topic_tag: result.topic })
            .eq("id", post.id);
        }
      }
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

  // 4. Fetch and store replies for recent posts
  let repliesStored = 0;
  for (const post of recentPosts ?? []) {
    try {
      const replies = await api.getPostReplies(post.threads_media_id);
      for (const reply of replies) {
        const wordCount = countWords(reply.text);
        await supabase
          .from("post_replies")
          .upsert(
            {
              post_id: post.id,
              threads_reply_id: reply.id,
              text: reply.text ?? null,
              word_count: wordCount,
              replied_at: reply.timestamp,
            },
            { onConflict: "threads_reply_id" },
          );
        repliesStored++;
      }
    } catch (err) {
      console.error(
        `Failed to fetch replies for post ${post.threads_media_id}:`,
        err,
      );
    }
  }

  return { newPosts, updatedMetrics, repliesStored };
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
        `Refreshed user ${user.id}: ${result.newPosts} new posts, ${result.updatedMetrics} updated metrics, ${result.repliesStored} replies stored`,
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
