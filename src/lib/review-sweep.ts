/**
 * Review Sweep + Narrative Generator (TICKET-074)
 *
 * Scheduled job that closes the prediction → actual feedback loop. For each
 * pending prediction whose post was published at least 24 hours ago, pulls
 * the post's 24-hour engagement snapshot from `post_metrics`, classifies the
 * actual view count into one of five bands against the stored prediction
 * range, and asks the per-user LLM for a short "thoughtful editor" narrative
 * explaining the result. Writes `narrative`, `actual_windowed_metrics`, and
 * `review_state='reviewed'` back to the row.
 *
 * Also discards predictions that never linked to a published post within
 * seven days and predictions whose linked post has since been deleted.
 *
 * The first sentence of the narrative is consumed verbatim by the Today Hub
 * "Latest Review" card (#076) as a one-line key learning — the prompt file
 * at `src/lib/prompts/review-narrative.md` enforces that contract.
 */

import { loadPrompt } from "@/lib/prompts/loader";
import { resolveLLMClient } from "@/lib/llm-resolver";
import type { SystemBlock } from "@/lib/llm-client";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

// ── Constants ────────────────────────────────────────────────────────

export const BAND_VERDICTS = [
  "below_conservative",
  "conservative",
  "baseline",
  "optimistic",
  "above_optimistic",
] as const;

export type BandVerdict = (typeof BAND_VERDICTS)[number];

export type MetricSource = "windowed_24h" | "latest" | "none";

/** Sweep batch size — matches ticket spec. */
export const DEFAULT_BATCH_SIZE = 50;

/** A prediction with `post_id IS NULL` older than this is auto-discarded. */
export const UNLINKED_STALE_DAYS = 7;

/** Only predictions older than this participate in the review pass. */
export const REVIEW_MIN_AGE_HOURS = 24;

/** First snapshot in [publishedAt + WINDOW_LOWER_HOURS, publishedAt + WINDOW_UPPER_HOURS] is the 24h sample. */
const WINDOW_LOWER_HOURS = 23;
const WINDOW_UPPER_HOURS = 48;

/** Abort the sweep after this many consecutive errors (LLM or DB). */
const CIRCUIT_BREAKER_CONSECUTIVE_ERRORS = 5;

/** Hard cap on narrative length — enforced alongside the prompt's soft cap. */
const NARRATIVE_MAX_TOKENS = 300;
const NARRATIVE_TIMEOUT_MS = 30_000;

// ── Types ────────────────────────────────────────────────────────────

export interface PredictionRanges {
  p25: number;
  p50: number;
  p75: number;
  matchedCount: number;
  confidence: "high" | "medium" | "low";
}

export interface WindowedMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  fetched_at: string | null;
  source: MetricSource;
}

export interface ReviewNarrativeInput {
  postText: string;
  permalink: string | null;
  topicTag: string | null;
  ranges: PredictionRanges;
  driverFactors: Json;
  actual: WindowedMetrics;
  verdict: BandVerdict;
}

export interface SweepSummary {
  reviewed: number;
  discarded: number;
  skipped: number;
  errors: number;
  avgLlmMs: number;
  durationMs: number;
  aborted?: "consecutive_errors";
}

type PostPredictionRow = Database["public"]["Tables"]["post_predictions"]["Row"];

interface JoinedPostRow {
  id: string;
  published_at: string;
  text_full: string | null;
  text_preview: string | null;
  permalink: string | null;
  topic_tag: string | null;
}

interface ReviewCandidate extends PostPredictionRow {
  posts: JoinedPostRow | null;
}

type DiscardReason =
  | "unlinked_stale"
  | "post_deleted"
  | "degenerate_range"
  | "no_metrics";

type ProcessResult =
  | { status: "reviewed"; llmMs: number }
  | { status: "discarded"; reason: DiscardReason }
  | { status: "skipped" };

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Classify actual views against the stored p25/p50/p75 range.
 *
 * Uses a narrow symmetric `baseline` window scaled to the IQR so small-view
 * posts still have a meaningful middle band. Every real number lands in
 * exactly one bucket.
 */
export function classifyBand(
  actualViews: number,
  ranges: Pick<PredictionRanges, "p25" | "p50" | "p75">,
): BandVerdict {
  const { p25, p50, p75 } = ranges;
  const iqr = Math.max(1, p75 - p25);
  const baselineEpsilon = Math.max(1, iqr * 0.05);

  if (actualViews < p25) return "below_conservative";
  if (actualViews < p50 - baselineEpsilon) return "conservative";
  if (actualViews <= p50 + baselineEpsilon) return "baseline";
  if (actualViews <= p75) return "optimistic";
  return "above_optimistic";
}

/** True when all three percentiles are equal — can't meaningfully classify. */
export function isDegenerateRange(
  ranges: Pick<PredictionRanges, "p25" | "p50" | "p75">,
): boolean {
  return ranges.p25 === ranges.p50 && ranges.p50 === ranges.p75;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : trimmed;
}
// firstSentence is unused here but re-exported for future UI code that pulls
// the key learning — keep it nearby so the contract stays discoverable.
export { firstSentence };

/**
 * Merge a discard reason into the existing `driver_factors` jsonb without
 * clobbering the snapshot-time reasoning.
 */
function withDiscardReason(
  existing: Json,
  reason: DiscardReason,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json | undefined>) }
      : {};
  base.discard_reason = reason;
  return base as Json;
}

function coerceRanges(value: Json): PredictionRanges | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const p25 = Number(obj.p25);
  const p50 = Number(obj.p50);
  const p75 = Number(obj.p75);
  if (!Number.isFinite(p25) || !Number.isFinite(p50) || !Number.isFinite(p75)) {
    return null;
  }
  const matched = Number(obj.matchedCount);
  const confidenceRaw = typeof obj.confidence === "string" ? obj.confidence : "low";
  const confidence: PredictionRanges["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "low";
  return {
    p25,
    p50,
    p75,
    matchedCount: Number.isFinite(matched) ? matched : 0,
    confidence,
  };
}

// ── Metric window ────────────────────────────────────────────────────

/**
 * Fetch the post's 24-hour engagement snapshot from `post_metrics`. Prefers
 * the first snapshot inside `[publishedAt + 23h, publishedAt + 48h]`. Falls
 * back to the latest snapshot (with `source: "latest"`) when none exists in
 * that window. Returns `source: "none"` when no snapshots exist at all.
 */
export async function fetchWindowedMetrics(
  postId: string,
  publishedAt: string,
): Promise<WindowedMetrics> {
  const publishedMs = new Date(publishedAt).getTime();
  const windowStart = new Date(publishedMs + WINDOW_LOWER_HOURS * 3_600_000).toISOString();
  const windowEnd = new Date(publishedMs + WINDOW_UPPER_HOURS * 3_600_000).toISOString();

  const supabase = createAdminClient();

  const { data: windowed, error: windowedError } = await supabase
    .from("post_metrics")
    .select("views, likes, replies, reposts, quotes, shares, fetched_at")
    .eq("post_id", postId)
    .gte("fetched_at", windowStart)
    .lte("fetched_at", windowEnd)
    .order("fetched_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (windowedError) throw windowedError;

  if (windowed) {
    return {
      views: windowed.views ?? 0,
      likes: windowed.likes ?? 0,
      replies: windowed.replies ?? 0,
      reposts: windowed.reposts ?? 0,
      quotes: windowed.quotes ?? 0,
      shares: windowed.shares ?? 0,
      fetched_at: windowed.fetched_at ?? null,
      source: "windowed_24h",
    };
  }

  const { data: latest, error: latestError } = await supabase
    .from("post_metrics")
    .select("views, likes, replies, reposts, quotes, shares, fetched_at")
    .eq("post_id", postId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  if (latest) {
    return {
      views: latest.views ?? 0,
      likes: latest.likes ?? 0,
      replies: latest.replies ?? 0,
      reposts: latest.reposts ?? 0,
      quotes: latest.quotes ?? 0,
      shares: latest.shares ?? 0,
      fetched_at: latest.fetched_at ?? null,
      source: "latest",
    };
  }

  return {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    shares: 0,
    fetched_at: null,
    source: "none",
  };
}

// ── Prompt ───────────────────────────────────────────────────────────

/**
 * Build the narrative prompt as cacheable knowledge blocks plus one
 * per-row user message. Mirrors the layout used by `composer-prompt.ts` so
 * the algorithm + psychology prefix rides in the Anthropic prompt cache
 * across every sweep invocation.
 */
export function buildReviewNarrativePrompt(input: ReviewNarrativeInput): {
  systemPrompt: SystemBlock[];
  userMessage: string;
} {
  const { postText, permalink, topicTag, ranges, driverFactors, actual, verdict } =
    input;

  const systemPrompt: SystemBlock[] = [
    { text: loadPrompt("algorithm"), cacheable: true },
    { text: loadPrompt("psychology"), cacheable: true },
    { text: loadPrompt("review-narrative"), cacheable: true },
  ];

  const userMessage = [
    "## Post text",
    postText.trim() || "(no post text available)",
    "",
    `## Permalink: ${permalink ?? "(none)"}`,
    `## Topic tag: ${topicTag ?? "(none)"}`,
    "",
    "## Predicted view range (snapshotted before publish)",
    `- p25 (conservative): ${ranges.p25}`,
    `- p50 (baseline): ${ranges.p50}`,
    `- p75 (optimistic): ${ranges.p75}`,
    `- matched on ${ranges.matchedCount} similar posts · confidence: ${ranges.confidence}`,
    "",
    "## Predicted driver factors (pre-publish hypothesis)",
    JSON.stringify(driverFactors ?? {}, null, 2),
    "",
    "## Actual 24h metrics",
    `- views: ${actual.views}`,
    `- likes: ${actual.likes}`,
    `- replies: ${actual.replies}`,
    `- reposts: ${actual.reposts}`,
    `- quotes: ${actual.quotes}`,
    `- shares: ${actual.shares}`,
    `- snapshot source: ${actual.source}${actual.fetched_at ? ` (fetched_at ${actual.fetched_at})` : ""}`,
    "",
    `## Band verdict: ${verdict}`,
    "",
    "Write the narrative now. Start with the key learning sentence.",
  ].join("\n");

  return { systemPrompt, userMessage };
}

// ── LLM call ─────────────────────────────────────────────────────────

/**
 * Call the user's LLM client with the review narrative prompt. Measures
 * wall time; trims whitespace from the response. Throws through on error
 * so the caller can count it toward the circuit breaker.
 */
export async function generateReviewNarrative(
  userId: string,
  input: ReviewNarrativeInput,
): Promise<{ narrative: string; llmMs: number }> {
  const { systemPrompt, userMessage } = buildReviewNarrativePrompt(input);
  const client = await resolveLLMClient(userId);

  const start = performance.now();
  const raw = await client.generate({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: NARRATIVE_MAX_TOKENS,
    timeout: NARRATIVE_TIMEOUT_MS,
  });
  const llmMs = Math.round(performance.now() - start);

  return { narrative: raw.trim(), llmMs };
}

// ── Discard helpers ──────────────────────────────────────────────────

/**
 * Mark a prediction discarded, guarded on `review_state='pending'` so an
 * overlapping sweep run becomes a no-op. Returns true when the UPDATE
 * actually matched a row — useful for accurate reporting from bulk callers.
 */
async function markDiscarded(
  predictionId: string,
  existingDriverFactors: Json,
  reason: DiscardReason,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("post_predictions")
    .update({
      review_state: "discarded",
      reviewed_at: new Date().toISOString(),
      driver_factors: withDiscardReason(existingDriverFactors, reason),
    })
    .eq("id", predictionId)
    .eq("review_state", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

// ── Per-row processing ───────────────────────────────────────────────

/**
 * Review a single prediction row. Delegates narrative generation to the LLM,
 * then writes the result back atomically with a conditional UPDATE so an
 * overlapping sweep run becomes a no-op for the same row.
 */
export async function processPrediction(
  row: ReviewCandidate,
): Promise<ProcessResult> {
  if (!row.posts) {
    await markDiscarded(row.id, row.driver_factors, "post_deleted");
    return { status: "discarded", reason: "post_deleted" };
  }

  const ranges = coerceRanges(row.ranges);
  if (!ranges || isDegenerateRange(ranges)) {
    await markDiscarded(row.id, row.driver_factors, "degenerate_range");
    return { status: "discarded", reason: "degenerate_range" };
  }

  const actual = await fetchWindowedMetrics(row.post_id!, row.posts.published_at);
  if (actual.source === "none") {
    await markDiscarded(row.id, row.driver_factors, "no_metrics");
    return { status: "discarded", reason: "no_metrics" };
  }

  const verdict = classifyBand(actual.views, ranges);

  const postText = row.posts.text_full ?? row.posts.text_preview ?? "";
  const { narrative, llmMs } = await generateReviewNarrative(row.user_id, {
    postText,
    permalink: row.posts.permalink,
    topicTag: row.posts.topic_tag,
    ranges,
    driverFactors: row.driver_factors,
    actual,
    verdict,
  });

  const actualPayload: Json = {
    views: actual.views,
    likes: actual.likes,
    replies: actual.replies,
    reposts: actual.reposts,
    quotes: actual.quotes,
    shares: actual.shares,
    source: actual.source,
    fetched_at: actual.fetched_at,
    band_verdict: verdict,
  };

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("post_predictions")
    .update({
      narrative,
      actual_windowed_metrics: actualPayload,
      review_state: "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("review_state", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!updated) return { status: "skipped" };

  console.log(
    `[review-sweep] prediction=${row.id} band=${verdict} actual_views=${actual.views} predicted_p50=${ranges.p50} llm_ms=${llmMs}`,
  );

  return { status: "reviewed", llmMs };
}

// ── Orchestration ────────────────────────────────────────────────────

async function bulkDiscardUnlinkedStale(now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - UNLINKED_STALE_DAYS);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("post_predictions")
    .select("id, driver_factors")
    .eq("review_state", "pending")
    .is("post_id", null)
    .lt("predicted_at", cutoff.toISOString());

  if (error) throw error;

  let count = 0;
  for (const row of data ?? []) {
    try {
      const discarded = await markDiscarded(
        row.id,
        row.driver_factors,
        "unlinked_stale",
      );
      if (discarded) count += 1;
    } catch (err) {
      console.error(`[review-sweep] failed to discard unlinked-stale id=${row.id}:`, err);
    }
  }
  return count;
}

async function fetchReviewCandidates(
  now: Date,
  batchSize: number,
): Promise<ReviewCandidate[]> {
  const cutoff = new Date(now.getTime() - REVIEW_MIN_AGE_HOURS * 3_600_000).toISOString();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("post_predictions")
    .select(
      "*, posts!post_predictions_post_id_fkey(id, published_at, text_full, text_preview, permalink, topic_tag)",
    )
    .eq("review_state", "pending")
    .not("post_id", "is", null)
    .lt("predicted_at", cutoff)
    .order("predicted_at", { ascending: true })
    .limit(batchSize);

  if (error) throw error;
  return (data ?? []) as unknown as ReviewCandidate[];
}

/**
 * Run one sweep invocation. Bulk-discards unlinked-stale rows, fetches up to
 * `batchSize` review candidates (predictions older than 24 hours with a
 * linked post), and processes each sequentially. Aborts early after 5
 * consecutive LLM failures to keep retry cost bounded.
 */
export async function runReviewSweep(opts?: {
  batchSize?: number;
  now?: Date;
}): Promise<SweepSummary> {
  const start = performance.now();
  const now = opts?.now ?? new Date();
  const batchSize = opts?.batchSize ?? DEFAULT_BATCH_SIZE;

  let reviewed = 0;
  let discarded = 0;
  let skipped = 0;
  let errors = 0;
  let totalLlmMs = 0;
  let llmCalls = 0;
  let consecutiveErrors = 0;
  let aborted: SweepSummary["aborted"];

  try {
    discarded += await bulkDiscardUnlinkedStale(now);
  } catch (err) {
    console.error("[review-sweep] unlinked-stale discard pass failed:", err);
    errors += 1;
  }

  let candidates: ReviewCandidate[] = [];
  try {
    candidates = await fetchReviewCandidates(now, batchSize);
  } catch (err) {
    console.error("[review-sweep] failed to fetch review candidates:", err);
    errors += 1;
  }

  for (const row of candidates) {
    try {
      const result = await processPrediction(row);
      switch (result.status) {
        case "reviewed":
          reviewed += 1;
          totalLlmMs += result.llmMs;
          llmCalls += 1;
          consecutiveErrors = 0;
          break;
        case "discarded":
          discarded += 1;
          consecutiveErrors = 0;
          break;
        case "skipped":
          skipped += 1;
          consecutiveErrors = 0;
          break;
      }
    } catch (err) {
      errors += 1;
      consecutiveErrors += 1;
      console.error(`[review-sweep] prediction=${row.id} failed:`, err);
    }

    if (consecutiveErrors >= CIRCUIT_BREAKER_CONSECUTIVE_ERRORS) {
      aborted = "consecutive_errors";
      console.warn(
        `[review-sweep] aborting after ${consecutiveErrors} consecutive errors`,
      );
      break;
    }
  }

  const durationMs = Math.round(performance.now() - start);
  const avgLlmMs = llmCalls > 0 ? Math.round(totalLlmMs / llmCalls) : 0;

  const summary: SweepSummary = {
    reviewed,
    discarded,
    skipped,
    errors,
    avgLlmMs,
    durationMs,
    ...(aborted ? { aborted } : {}),
  };

  console.log(
    `[review-sweep] reviewed=${reviewed} discarded=${discarded} skipped=${skipped} errors=${errors} avg_llm_ms=${avgLlmMs} duration_ms=${durationMs}${aborted ? ` aborted=${aborted}` : ""}`,
  );

  return summary;
}
