// Server-only freshness gate (TICKET-071).
//
// checkTopicFreshness() runs before the Composer LLM draft and combines:
//   1. External saturation — Grok trend search (see src/lib/grok-search.ts)
//      classified per the S14 rule from src/lib/prompts/algorithm.md.
//   2. Self-repetition — token-overlap match between the input topic and the
//      distinct topic_tag values on the user's posts from the last 30 days,
//      with severity bucketed by 7 / 14 / 30-day counts.
//
// The gate is advisory. It throws RateLimitError after MAX_CHECKS_PER_HOUR
// calls within 60 minutes so the caller can degrade gracefully; it never
// blocks draft generation.
//
// Every call writes a row to freshness_checks so downstream surfaces
// (TICKET-072 Today Hub filter, review sweep) can audit the signal.
//
// Server-only: uses createAdminClient (service-role) and the xAI API key.
// Never import from a client component.

import { randomUUID } from "node:crypto";

import { searchTrends, type TrendingTopic } from "@/lib/grok-search";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import {
  STOP_WORDS,
  MIN_TOKEN_LENGTH,
  tokenize,
} from "@/lib/topic-classification";
import {
  buildTopicModel,
  OTHER_CLUSTER_NAME,
  type TopicModelPost,
} from "@/lib/topic-model";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_CHECKS_PER_HOUR = 10;

// Grok relevanceScore thresholds. Heuristic — revisit after 50+ checks land
// in freshness_checks so we can tune against real distributions. S14 treats
// freshness as account-relative, not platform-wide, so ultimately this wants
// per-user calibration; the uniform thresholds here are a first pass.
export const EXTERNAL_SATURATION_RED = 70;
export const EXTERNAL_SATURATION_YELLOW = 40;

export const MAX_TOPIC_LENGTH = 500;

// Literal sentinel sent by the Composer "Generate ideas for me" button.
// Running the gate on this string would produce garbage, so we short-circuit.
export const SURPRISE_ME_SENTINEL = "Surprise me —";

const SELF_REPETITION_LOOKBACK_DAYS = 30;
const MAX_SELF_SOURCES = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FreshnessVerdict = "green" | "yellow" | "red";
export type ExternalSaturation = "green" | "yellow" | "red";
export type RepetitionSeverity = "none" | "low" | "medium" | "high";

export interface ExternalSignal {
  saturation: ExternalSaturation;
  topRelevance: number | null;
  trendCount: number;
  unavailable: boolean;
  reason?: string;
}

export interface SelfRepetitionRisk {
  severity: RepetitionSeverity;
  matchedCluster: string | null;
  matchedTag: string | null;
  counts: { d7: number; d14: number; d30: number };
}

export interface FreshnessSource {
  type: "external" | "self";
  label: string;
  url?: string;
  postId?: string;
}

export interface FreshnessResult {
  runId: string;
  verdict: FreshnessVerdict;
  externalSignal: ExternalSignal;
  selfRepetitionRisk: SelfRepetitionRisk;
  sources: FreshnessSource[];
}

export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Freshness check rate limit exceeded");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PostRow {
  id: string;
  topic_tag: string | null;
  text_preview: string | null;
  permalink: string | null;
  published_at: string;
}

function classifyExternalSaturation(
  trends: TrendingTopic[],
): { saturation: ExternalSaturation; topRelevance: number | null } {
  if (trends.length === 0) {
    return { saturation: "green", topRelevance: null };
  }
  const topRelevance = trends.reduce(
    (max, t) => Math.max(max, t.relevanceScore),
    0,
  );
  let saturation: ExternalSaturation = "green";
  if (topRelevance >= EXTERNAL_SATURATION_RED) {
    saturation = "red";
  } else if (topRelevance >= EXTERNAL_SATURATION_YELLOW) {
    saturation = "yellow";
  }
  return { saturation, topRelevance };
}

function severityToSaturation(severity: RepetitionSeverity): ExternalSaturation {
  switch (severity) {
    case "high":
      return "red";
    case "medium":
    case "low":
      return "yellow";
    case "none":
      return "green";
  }
}

function worstVerdict(a: ExternalSaturation, b: ExternalSaturation): FreshnessVerdict {
  if (a === "red" || b === "red") return "red";
  if (a === "yellow" || b === "yellow") return "yellow";
  return "green";
}

// Match an input topic string against the set of distinct topic_tag values
// present in the user's recent posts. Score each candidate tag by token
// overlap against the input; fall back to substring match so multi-word tags
// and compound input phrases still connect.
function matchTopicTag(
  inputTokens: Set<string>,
  inputLower: string,
  candidateTags: string[],
): string | null {
  let bestTag: string | null = null;
  let bestScore = 0;

  for (const tag of candidateTags) {
    const tagLower = tag.toLowerCase();
    const tagTokens = tokenize(tag);
    let score = 0;

    for (const tagToken of tagTokens) {
      if (inputTokens.has(tagToken)) {
        score += 2;
      }
    }
    // Substring fallback for single-word tags that get dropped by the
    // tokenizer (too short or stop-word).
    if (score === 0) {
      if (
        tagLower.length >= MIN_TOKEN_LENGTH &&
        !STOP_WORDS.has(tagLower) &&
        inputLower.includes(tagLower)
      ) {
        score = 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTag = tag;
    }
  }

  return bestTag;
}

function countPostsInWindow(
  posts: PostRow[],
  matchedTag: string,
  fromMs: number,
): number {
  let count = 0;
  for (const p of posts) {
    if (p.topic_tag !== matchedTag) continue;
    const publishedMs = Date.parse(p.published_at);
    if (!Number.isFinite(publishedMs)) continue;
    if (publishedMs >= fromMs) count += 1;
  }
  return count;
}

function bucketSeverity(d7: number, d14: number, d30: number): RepetitionSeverity {
  if (d7 >= 2) return "high";
  if (d14 >= 2) return "medium";
  if (d30 >= 2) return "low";
  return "none";
}

function toTopicModelPosts(posts: PostRow[]): TopicModelPost[] {
  // buildTopicModel consumes metrics for WES-ordering its topPosts. We only
  // want cluster membership + textual previews for source citations, so
  // passing zeros is fine — the ordering falls back to a stable pass-through.
  return posts.map((p) => ({
    topic_tag: p.topic_tag,
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    shares: 0,
    text_preview: p.text_preview,
    published_at: p.published_at,
  }));
}

function buildSelfSources(
  posts: PostRow[],
  matchedTag: string,
): FreshnessSource[] {
  const model = buildTopicModel(toTopicModelPosts(posts));
  const targetName = matchedTag.charAt(0).toUpperCase() + matchedTag.slice(1);
  const cluster = model.clusters.find(
    (c) => c.name === targetName && c.name !== OTHER_CLUSTER_NAME,
  );
  if (!cluster) {
    // Cluster may have been folded into "Other" (fewer than MIN_POSTS_PER_CLUSTER).
    // Fall back to the raw posts sharing the tag.
    return posts
      .filter((p) => p.topic_tag === matchedTag)
      .slice(0, MAX_SELF_SOURCES)
      .map((p) => ({
        type: "self" as const,
        label: (p.text_preview ?? "").slice(0, 140) || "Previous post",
        url: p.permalink ?? undefined,
        postId: p.id,
      }));
  }

  // Re-associate topPosts (text + date) back to concrete PostRow entries so
  // we can include postId and permalink in the source citation.
  const sources: FreshnessSource[] = [];
  for (const top of cluster.topPosts.slice(0, MAX_SELF_SOURCES)) {
    const match = posts.find(
      (p) =>
        p.topic_tag === matchedTag &&
        p.text_preview === top.text_preview &&
        p.published_at === top.published_at,
    );
    sources.push({
      type: "self",
      label: (top.text_preview ?? "").slice(0, 140) || "Previous post",
      url: match?.permalink ?? undefined,
      postId: match?.id,
    });
  }
  return sources;
}

function buildExternalSources(trends: TrendingTopic[]): FreshnessSource[] {
  return trends.slice(0, 5).map((t) => ({
    type: "external" as const,
    label: `${t.title} — ${t.postCount}`,
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkTopicFreshness(
  topic: string,
  userId: string,
  runId: string = randomUUID(),
): Promise<FreshnessResult> {
  // ---- Input validation ------------------------------------------------
  if (typeof topic !== "string") {
    throw new Error("topic must be a string");
  }
  const trimmed = topic.trim();
  if (trimmed.length === 0) {
    throw new Error("topic must not be empty");
  }
  if (trimmed.length > MAX_TOPIC_LENGTH) {
    throw new Error(`topic must be ≤ ${MAX_TOPIC_LENGTH} characters`);
  }
  if (!userId) {
    throw new Error("userId is required");
  }

  const supabase = createAdminClient();
  const nowMs = Date.now();
  const hourAgoIso = new Date(nowMs - 60 * 60 * 1000).toISOString();

  // ---- Rate limit -----------------------------------------------------
  const { count: recentCount, error: rateErr } = await supabase
    .from("freshness_checks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgoIso);
  if (rateErr) {
    throw new Error(`Rate-limit probe failed: ${rateErr.message}`);
  }
  if ((recentCount ?? 0) >= MAX_CHECKS_PER_HOUR) {
    // Estimate retry-after as the remainder of the current hour from now.
    throw new RateLimitError(60 * 60 * 1000);
  }

  // ---- Sentinel short-circuit -----------------------------------------
  if (trimmed.startsWith(SURPRISE_ME_SENTINEL)) {
    const externalSignal: ExternalSignal = {
      saturation: "green",
      topRelevance: null,
      trendCount: 0,
      unavailable: true,
      reason: "sentinel",
    };
    const selfRepetitionRisk: SelfRepetitionRisk = {
      severity: "none",
      matchedCluster: null,
      matchedTag: null,
      counts: { d7: 0, d14: 0, d30: 0 },
    };
    const sources: FreshnessSource[] = [];
    const verdict: FreshnessVerdict = "green";

    await supabase.from("freshness_checks").insert({
      run_id: runId,
      user_id: userId,
      topic: trimmed,
      verdict,
      external_signal: externalSignal as unknown as Json,
      self_repetition_risk: selfRepetitionRisk as unknown as Json,
      sources: sources as unknown as Json,
    });

    return { runId, verdict, externalSignal, selfRepetitionRisk, sources };
  }

  // ---- Parallel fetch: posts for self-check + Grok trends for external-check
  const sinceIso = new Date(
    nowMs - SELF_REPETITION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const postsPromise = supabase
    .from("posts")
    .select("id, topic_tag, text_preview, permalink, published_at")
    .eq("user_id", userId)
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(500);
  const grokPromise = searchTrends([trimmed]);

  const [postsResult, grokResult] = await Promise.all([
    postsPromise,
    grokPromise,
  ]);

  if (postsResult.error) {
    throw new Error(`Post fetch failed: ${postsResult.error.message}`);
  }
  const rawPosts = (postsResult.data ?? []) as PostRow[];
  // Only posts with a topic_tag contribute to self-repetition matching.
  const taggedPosts = rawPosts.filter(
    (p) => p.topic_tag != null && p.topic_tag.trim().length > 0,
  );

  // ---- Self-repetition classification ---------------------------------
  const inputTokens = new Set(tokenize(trimmed));
  const inputLower = trimmed.toLowerCase();
  const distinctTags = Array.from(
    new Set(taggedPosts.map((p) => p.topic_tag as string)),
  );

  const matchedTag = matchTopicTag(inputTokens, inputLower, distinctTags);

  const d7Ms = nowMs - 7 * 24 * 60 * 60 * 1000;
  const d14Ms = nowMs - 14 * 24 * 60 * 60 * 1000;
  const d30Ms = nowMs - 30 * 24 * 60 * 60 * 1000;

  let selfRepetitionRisk: SelfRepetitionRisk;
  let selfSources: FreshnessSource[] = [];
  if (matchedTag) {
    const d7 = countPostsInWindow(taggedPosts, matchedTag, d7Ms);
    const d14 = countPostsInWindow(taggedPosts, matchedTag, d14Ms);
    const d30 = countPostsInWindow(taggedPosts, matchedTag, d30Ms);
    selfRepetitionRisk = {
      severity: bucketSeverity(d7, d14, d30),
      matchedCluster:
        matchedTag.charAt(0).toUpperCase() + matchedTag.slice(1),
      matchedTag,
      counts: { d7, d14, d30 },
    };
    if (selfRepetitionRisk.severity !== "none") {
      selfSources = buildSelfSources(taggedPosts, matchedTag);
    }
  } else {
    selfRepetitionRisk = {
      severity: "none",
      matchedCluster: null,
      matchedTag: null,
      counts: { d7: 0, d14: 0, d30: 0 },
    };
  }

  // ---- External signal ------------------------------------------------
  const { saturation: externalSaturation, topRelevance } =
    classifyExternalSaturation(grokResult.trends);
  const externalSignal: ExternalSignal = {
    saturation: grokResult.unavailable ? "green" : externalSaturation,
    topRelevance: grokResult.unavailable ? null : topRelevance,
    trendCount: grokResult.trends.length,
    unavailable: grokResult.unavailable,
  };

  const externalSources = grokResult.unavailable
    ? []
    : buildExternalSources(grokResult.trends);
  const sources: FreshnessSource[] = [...externalSources, ...selfSources];

  // ---- Combined verdict ------------------------------------------------
  const selfMapped = severityToSaturation(selfRepetitionRisk.severity);
  const verdict: FreshnessVerdict = worstVerdict(
    externalSignal.saturation,
    selfMapped,
  );

  // ---- Audit insert ----------------------------------------------------
  const { error: insertErr } = await supabase.from("freshness_checks").insert({
    run_id: runId,
    user_id: userId,
    topic: trimmed,
    verdict,
    external_signal: externalSignal as unknown as Json,
    self_repetition_risk: selfRepetitionRisk as unknown as Json,
    sources: sources as unknown as Json,
  });
  if (insertErr) {
    throw new Error(`Audit insert failed: ${insertErr.message}`);
  }

  return { runId, verdict, externalSignal, selfRepetitionRisk, sources };
}
