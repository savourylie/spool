import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";
import {
  classifyReplies,
  computeDiscussionQualityScore,
  SHORT_REPLY_THRESHOLD,
  type ReplyRow,
} from "@/lib/reply-analysis";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await params;

  const supabase = createAdminClient();

  // Verify this post belongs to the authenticated user
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, threads_media_id")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Fetch replies from DB
  let { data: replies, error } = await supabase
    .from("post_replies")
    .select("text, word_count")
    .eq("post_id", postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // On-demand fetch: if no replies in DB, fetch from Threads API and store
  if ((!replies || replies.length === 0) && post.threads_media_id) {
    try {
      const { data: user } = await supabase
        .from("users")
        .select("access_token, threads_user_id, token_expires_at")
        .eq("id", userId)
        .single();

      if (user && new Date(user.token_expires_at) > new Date()) {
        const accessToken = decrypt(user.access_token);
        const api = new ThreadsAPI(accessToken, user.threads_user_id);
        const threadReplies = await api.getPostReplies(
          post.threads_media_id
        );

        for (const reply of threadReplies) {
          await supabase.from("post_replies").upsert(
            {
              post_id: postId,
              threads_reply_id: reply.id,
              text: reply.text ?? null,
              word_count: countWords(reply.text),
              replied_at: reply.timestamp,
            },
            { onConflict: "threads_reply_id" }
          );
        }

        // Re-query after storing
        const { data: freshReplies } = await supabase
          .from("post_replies")
          .select("text, word_count")
          .eq("post_id", postId);

        replies = freshReplies;
      }
    } catch (err) {
      console.error(`On-demand reply fetch failed for post ${postId}:`, err);
      // Fall through with empty replies — don't break the endpoint
    }
  }

  const rows: ReplyRow[] = replies ?? [];
  const classified = classifyReplies(rows);
  const discussionQualityScore = Math.round(
    computeDiscussionQualityScore(rows)
  );
  const meaningfulCount =
    classified.medium.length + classified.long.length;

  return NextResponse.json({
    total: rows.length,
    short: classified.short.length,
    medium: classified.medium.length,
    long: classified.long.length,
    meaningfulCount,
    meaningfulThreshold: SHORT_REPLY_THRESHOLD,
    discussionQualityScore,
  });
}
