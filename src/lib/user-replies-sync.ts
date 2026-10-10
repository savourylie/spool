import { decrypt } from "@/lib/crypto";
import { resolveLLMClient } from "@/lib/llm-resolver";
import { analyzeReplyRisks, type ReplyRiskInput } from "@/lib/reply-risk-analysis";
import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import type { ThreadsUserReply } from "@/lib/threads-api.types";

const REPLY_ANALYSIS_LIMIT = 100;
const REPLY_ANALYSIS_BATCH_SIZE = 20;
const REPLY_UPSERT_BATCH_SIZE = 500;

export interface UserRepliesSyncResult {
  repliesStored: number;
  repliesAnalyzed: number;
  highRisk: number;
  mediumRisk: number;
  remainingUnanalyzed: number;
}

type ReplyIdRef = { id: string } | string | null | undefined;

function getReplyRefId(ref: ReplyIdRef): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return typeof ref.id === "string" ? ref.id : null;
}

function toStoredReply(userId: string, reply: ThreadsUserReply) {
  return {
    user_id: userId,
    threads_reply_id: reply.id,
    text: reply.text ?? null,
    permalink: reply.permalink ?? null,
    replied_at: reply.timestamp,
    root_post_id: getReplyRefId(reply.root_post),
    replied_to_id: getReplyRefId(reply.replied_to),
    media_type: reply.media_type ?? null,
    shortcode: reply.shortcode ?? null,
    fetched_at: new Date().toISOString(),
  };
}

function toRiskInput(row: {
  threads_reply_id: string;
  text: string | null;
}): ReplyRiskInput | null {
  const text = row.text?.trim();
  if (!text) return null;
  return {
    threadsReplyId: row.threads_reply_id,
    text,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function syncUserReplies(
  userId: string,
): Promise<UserRepliesSyncResult> {
  const supabase = createAdminClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("threads_user_id, access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !user) throw userError ?? new Error("User not found");

  const emptyResult: UserRepliesSyncResult = {
    repliesStored: 0,
    repliesAnalyzed: 0,
    highRisk: 0,
    mediumRisk: 0,
    remainingUnanalyzed: 0,
  };

  if (new Date(user.token_expires_at) <= new Date()) {
    console.warn(`Skipping replies sync for user ${userId}: token expired`);
    return emptyResult;
  }

  const { data: latestReply, error: latestReplyError } = await supabase
    .from("user_replies")
    .select("replied_at")
    .eq("user_id", userId)
    .order("replied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReplyError) throw latestReplyError;

  const accessToken = decrypt(user.access_token);
  const api = new ThreadsAPI(accessToken, user.threads_user_id);
  const since = latestReply?.replied_at ? new Date(latestReply.replied_at) : undefined;
  const replies = await api.getUserReplies(since);

  // Postgres rejects an upsert batch that touches the same row twice.
  const storedRows = [
    ...new Map(
      replies.map((reply) => [reply.id, toStoredReply(userId, reply)]),
    ).values(),
  ];
  for (const rows of chunk(storedRows, REPLY_UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("user_replies")
      .upsert(rows, { onConflict: "threads_reply_id" });
    if (error) throw error;
  }
  const repliesStored = storedRows.length;

  const { data: unanalyzedRows, count, error: unanalyzedError } = await supabase
    .from("user_replies")
    .select("threads_reply_id, text, replied_at, permalink", { count: "exact" })
    .eq("user_id", userId)
    .eq("risk_level", "unknown")
    .not("text", "is", null)
    .order("replied_at", { ascending: false })
    .limit(REPLY_ANALYSIS_LIMIT);

  if (unanalyzedError) throw unanalyzedError;

  const riskInputs = (unanalyzedRows ?? [])
    .map(toRiskInput)
    .filter((reply): reply is ReplyRiskInput => reply !== null);

  if (riskInputs.length === 0) {
    return {
      ...emptyResult,
      repliesStored,
      remainingUnanalyzed: Math.max((count ?? 0) - riskInputs.length, 0),
    };
  }

  const llm = await resolveLLMClient(userId);
  let repliesAnalyzed = 0;
  let highRisk = 0;
  let mediumRisk = 0;

  for (const batch of chunk(riskInputs, REPLY_ANALYSIS_BATCH_SIZE)) {
    const results = await analyzeReplyRisks(batch, llm);

    for (const result of results) {
      const { error } = await supabase
        .from("user_replies")
        .update({
          risk_level: result.riskLevel,
          risk_categories: result.riskCategories,
          risk_summary: result.riskSummary,
          risk_analyzed_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("threads_reply_id", result.threadsReplyId);

      if (error) throw error;
      repliesAnalyzed++;
      if (result.riskLevel === "high") highRisk++;
      if (result.riskLevel === "medium") mediumRisk++;
    }
  }

  return {
    repliesStored,
    repliesAnalyzed,
    highRisk,
    mediumRisk,
    remainingUnanalyzed: Math.max((count ?? riskInputs.length) - riskInputs.length, 0),
  };
}
