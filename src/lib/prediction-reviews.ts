/**
 * Reviews-page server helpers (TICKET-075).
 *
 * Pulls reviewed `post_predictions` rows plus aggregate stats to drive the
 * Reviews page under Understand. Band verdicts are populated by the sweep
 * job (see `src/lib/review-sweep.ts`); this module is read-only.
 *
 * Server-only: uses createAdminClient. Do not import from a client component.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  BAND_VERDICTS,
  classifyBand,
  type BandVerdict,
  type MetricSource,
  type PredictionRanges,
  type WindowedMetrics,
} from "@/lib/review-sweep";
import type {
  ExternalSignal,
  SelfRepetitionRisk,
} from "@/lib/freshness-gate";

// ── Types ────────────────────────────────────────────────────────────

export interface ReviewedPredictionPost {
  id: string | null;
  textPreview: string | null;
  permalink: string | null;
  publishedAt: string | null;
  topicTag: string | null;
}

export interface ReviewedPredictionActual extends WindowedMetrics {
  bandVerdict: BandVerdict;
}

export interface ReviewedPredictionRow {
  id: string;
  reviewedAt: string;
  predictedAt: string;
  ranges: PredictionRanges;
  actual: ReviewedPredictionActual;
  narrative: string | null;
  post: ReviewedPredictionPost | null;
}

export interface BandDistribution {
  counts: Record<BandVerdict, number>;
  total: number;
}

export interface BaselineTrend {
  last30Count: number;
  last30Baseline: number;
  last30Pct: number;
  prior30Count: number;
  prior30Baseline: number;
  prior30Pct: number;
  deltaPct: number;
  direction: "up" | "down" | "flat";
}

type PredictionWithPost =
  Database["public"]["Tables"]["post_predictions"]["Row"] & {
    posts:
      | {
          id: string;
          text_preview: string | null;
          permalink: string | null;
          published_at: string;
          topic_tag: string | null;
        }
      | null;
  };

const MIN_TREND_SAMPLE = 5;
const FLAT_THRESHOLD_PCT = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function zeroCounts(): Record<BandVerdict, number> {
  return {
    below_conservative: 0,
    conservative: 0,
    baseline: 0,
    optimistic: 0,
    above_optimistic: 0,
  };
}

function coerceBandVerdict(value: unknown): BandVerdict | null {
  if (typeof value !== "string") return null;
  return (BAND_VERDICTS as readonly string[]).includes(value)
    ? (value as BandVerdict)
    : null;
}

function coerceMetricSource(value: unknown): MetricSource {
  if (value === "windowed_24h" || value === "latest" || value === "none") {
    return value;
  }
  return "none";
}

export function coerceRanges(value: Json | null | undefined): PredictionRanges {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { p25: 0, p50: 0, p75: 0, matchedCount: 0, confidence: "low" };
  }
  const obj = value as Record<string, unknown>;
  const p25 = Number(obj.p25);
  const p50 = Number(obj.p50);
  const p75 = Number(obj.p75);
  const matched = Number(obj.matchedCount);
  const confidenceRaw =
    typeof obj.confidence === "string" ? obj.confidence : "low";
  const confidence: PredictionRanges["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low";
  return {
    p25: Number.isFinite(p25) ? p25 : 0,
    p50: Number.isFinite(p50) ? p50 : 0,
    p75: Number.isFinite(p75) ? p75 : 0,
    matchedCount: Number.isFinite(matched) ? matched : 0,
    confidence,
  };
}

/**
 * Parse the `actual_windowed_metrics` jsonb into a typed object with a
 * guaranteed band verdict. When the stored `band_verdict` is missing or
 * malformed, we re-classify using `classifyBand` so a stale row written
 * before band logic landed still renders.
 */
export function coerceActualMetrics(
  value: Json | null | undefined,
  ranges: PredictionRanges,
): ReviewedPredictionActual | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const views = Number(obj.views);
  if (!Number.isFinite(views)) return null;

  const actualBase: WindowedMetrics = {
    views,
    likes: Number(obj.likes) || 0,
    replies: Number(obj.replies) || 0,
    reposts: Number(obj.reposts) || 0,
    quotes: Number(obj.quotes) || 0,
    shares: Number(obj.shares) || 0,
    fetched_at: typeof obj.fetched_at === "string" ? obj.fetched_at : null,
    source: coerceMetricSource(obj.source),
  };

  const bandVerdict =
    coerceBandVerdict(obj.band_verdict) ?? classifyBand(views, ranges);

  return { ...actualBase, bandVerdict };
}

function normalizeRow(raw: PredictionWithPost): ReviewedPredictionRow | null {
  if (!raw.reviewed_at) return null;
  const ranges = coerceRanges(raw.ranges);
  const actual = coerceActualMetrics(raw.actual_windowed_metrics, ranges);
  if (!actual) return null;

  const post: ReviewedPredictionPost | null = raw.posts
    ? {
        id: raw.posts.id,
        textPreview: raw.posts.text_preview,
        permalink: raw.posts.permalink,
        publishedAt: raw.posts.published_at,
        topicTag: raw.posts.topic_tag,
      }
    : null;

  return {
    id: raw.id,
    reviewedAt: raw.reviewed_at,
    predictedAt: raw.predicted_at,
    ranges,
    actual,
    narrative: raw.narrative,
    post,
  };
}

// ── Fetch paginated reviewed predictions ─────────────────────────────

export async function fetchReviewedPredictionsPage(opts: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: ReviewedPredictionRow[]; totalCount: number }> {
  const { userId, page, pageSize } = opts;
  if (!userId || pageSize <= 0) {
    return { rows: [], totalCount: 0 };
  }
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const supabase = createAdminClient();

  const [pageResult, countResult] = await Promise.all([
    supabase
      .from("post_predictions")
      .select(
        "id, predicted_at, reviewed_at, ranges, actual_windowed_metrics, narrative, draft_text, draft_text_hash, driver_factors, post_id, review_state, user_id, posts:posts!post_predictions_post_id_fkey(id, text_preview, permalink, published_at, topic_tag)",
      )
      .eq("user_id", userId)
      .eq("review_state", "reviewed")
      .order("reviewed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
    supabase
      .from("post_predictions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("review_state", "reviewed"),
  ]);

  if (pageResult.error) throw pageResult.error;
  if (countResult.error) throw countResult.error;

  const raw = (pageResult.data ?? []) as unknown as PredictionWithPost[];
  const rows = raw
    .map(normalizeRow)
    .filter((r): r is ReviewedPredictionRow => r !== null);

  return { rows, totalCount: countResult.count ?? 0 };
}

// ── Aggregate stats ──────────────────────────────────────────────────

export async function computeBandDistribution(
  userId: string,
): Promise<BandDistribution> {
  if (!userId) {
    return { counts: zeroCounts(), total: 0 };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("post_predictions")
    .select("actual_windowed_metrics")
    .eq("user_id", userId)
    .eq("review_state", "reviewed");

  if (error || !data) {
    return { counts: zeroCounts(), total: 0 };
  }

  const counts = zeroCounts();
  let total = 0;
  for (const row of data) {
    const verdict = extractBandVerdict(row.actual_windowed_metrics);
    if (verdict) {
      counts[verdict] += 1;
      total += 1;
    }
  }
  return { counts, total };
}

function extractBandVerdict(value: Json | null): BandVerdict | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return coerceBandVerdict((value as Record<string, unknown>).band_verdict);
}

/**
 * Baseline hit-rate trend over the last 30 days vs. the prior 30 days.
 *
 * Returns `null` when either 30-day window has fewer than 5 reviews — a
 * baseline hit-rate computed on 1–4 reviews reads like noise and would
 * mislead the user more than it informs.
 */
export async function computeBaselineTrend(
  userId: string,
  now: Date = new Date(),
): Promise<BaselineTrend | null> {
  if (!userId) return null;

  const last30Start = new Date(now.getTime() - 30 * MS_PER_DAY);
  const prior30Start = new Date(now.getTime() - 60 * MS_PER_DAY);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("post_predictions")
    .select("reviewed_at, actual_windowed_metrics")
    .eq("user_id", userId)
    .eq("review_state", "reviewed")
    .gte("reviewed_at", prior30Start.toISOString());

  if (error || !data) return null;

  let last30Count = 0;
  let last30Baseline = 0;
  let prior30Count = 0;
  let prior30Baseline = 0;

  for (const row of data) {
    if (!row.reviewed_at) continue;
    const t = new Date(row.reviewed_at).getTime();
    const verdict = extractBandVerdict(row.actual_windowed_metrics);
    if (!verdict) continue;

    if (t >= last30Start.getTime()) {
      last30Count += 1;
      if (verdict === "baseline") last30Baseline += 1;
    } else if (t >= prior30Start.getTime()) {
      prior30Count += 1;
      if (verdict === "baseline") prior30Baseline += 1;
    }
  }

  if (last30Count < MIN_TREND_SAMPLE || prior30Count < MIN_TREND_SAMPLE) {
    return null;
  }

  const last30Pct = (last30Baseline / last30Count) * 100;
  const prior30Pct = (prior30Baseline / prior30Count) * 100;
  const deltaPct = last30Pct - prior30Pct;
  const direction: BaselineTrend["direction"] =
    Math.abs(deltaPct) < FLAT_THRESHOLD_PCT
      ? "flat"
      : deltaPct > 0
        ? "up"
        : "down";

  return {
    last30Count,
    last30Baseline,
    last30Pct,
    prior30Count,
    prior30Baseline,
    prior30Pct,
    deltaPct,
    direction,
  };
}

// ── Freshness reason synthesis ───────────────────────────────────────

/**
 * Synthesize a short reason string for a red freshness verdict from the
 * stored jsonb. Matches the ExternalSignal / SelfRepetitionRisk shapes in
 * `src/lib/freshness-gate.ts` but is defensive about missing fields.
 */
export function extractFreshnessReason(input: {
  external_signal: Json | null;
  self_repetition_risk: Json | null;
}): string {
  const external = parseExternalSignal(input.external_signal);
  const self = parseSelfRepetitionRisk(input.self_repetition_risk);

  const externalRed = external?.saturation === "red";
  const selfHigh = self?.severity === "high";

  if (externalRed && selfHigh) {
    return "External saturation + self-repetition";
  }
  if (externalRed) {
    return "External: saturated topic";
  }
  if (selfHigh) {
    const cluster = self?.matchedCluster ?? "similar topic";
    const d7 = self?.counts?.d7 ?? 0;
    return d7 > 0
      ? `Self: ${cluster} (${d7}× last 7d)`
      : `Self: ${cluster}`;
  }
  return "Flagged";
}

function parseExternalSignal(value: Json | null): ExternalSignal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const saturation = obj.saturation;
  if (saturation !== "green" && saturation !== "yellow" && saturation !== "red") {
    return null;
  }
  return {
    saturation,
    topRelevance:
      typeof obj.topRelevance === "number" ? obj.topRelevance : null,
    trendCount: Number(obj.trendCount) || 0,
    unavailable: Boolean(obj.unavailable),
    reason: typeof obj.reason === "string" ? obj.reason : undefined,
  };
}

function parseSelfRepetitionRisk(value: Json | null): SelfRepetitionRisk | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const sev = obj.severity;
  if (sev !== "none" && sev !== "low" && sev !== "medium" && sev !== "high") {
    return null;
  }
  const countsRaw =
    obj.counts && typeof obj.counts === "object" && !Array.isArray(obj.counts)
      ? (obj.counts as Record<string, unknown>)
      : {};
  return {
    severity: sev,
    matchedCluster:
      typeof obj.matchedCluster === "string" ? obj.matchedCluster : null,
    matchedTag: typeof obj.matchedTag === "string" ? obj.matchedTag : null,
    counts: {
      d7: Number(countsRaw.d7) || 0,
      d14: Number(countsRaw.d14) || 0,
      d30: Number(countsRaw.d30) || 0,
    },
  };
}
