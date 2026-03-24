import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  classifyReplies,
  computeDiscussionQualityScore,
  SHORT_REPLY_THRESHOLD,
} from "@/lib/reply-analysis";

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
    .select("id")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Fetch all replies for this post
  const { data: replies, error } = await supabase
    .from("post_replies")
    .select("text, word_count")
    .eq("post_id", postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = replies ?? [];
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
