// Today Hub freshness orchestrator (TICKET-072).
//
// Generates topic suggestions (mirrors /api/topics behavior), gates the top N
// through checkTopicFreshness, and attaches reframed angles to surviving
// yellow candidates. Cached per-user via unstable_cache to keep the Today Hub
// hot-path within budget — cold hits run up to N Grok calls in parallel.
//
// Filtering rules:
//   verdict === "red"  → drop
//   verdict === "green" → keep with chip
//   verdict === "yellow":
//     - externalSignal.saturation === "yellow" AND counts.d30 === 0 (cold self)
//       → call reframeTopicAngle; keep + chip + reframe if non-null, drop otherwise
//     - any other yellow (self-repetition involved) → drop
//   RateLimitError → keep WITHOUT chip, mark bundle rateLimited
//
// Server-only.

import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";

import type { BackfillJob } from "@/lib/backfill-job";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import {
  checkTopicFreshness,
  RateLimitError,
  type FreshnessResult,
} from "@/lib/freshness-gate";
import { reframeTopicAngle } from "@/lib/freshness-reframe";
import { LLMAuthError } from "@/lib/llm-client";
import { resolveLLMClient } from "@/lib/llm-resolver";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildFallbackTopicSuggestions,
  generateTopicSuggestions,
  MIN_POSTS_FOR_SUGGESTIONS,
  type TopicSuggestion,
} from "@/lib/topic-suggestions";

export const TODAY_HUB_GATE_LIMIT = 3;
export const TODAY_HUB_CACHE_TTL_SECONDS = 60 * 60 * 6;
export const TODAY_HUB_CACHE_TAG_PREFIX = "today-hub-freshness";

export type FreshnessChipVerdict = "green" | "yellow";

export interface FreshnessChip {
  verdict: FreshnessChipVerdict;
  reasonShort: string;
}

export interface TodayHubTopicsBundle {
  /** True when the user has fewer than MIN_POSTS_FOR_SUGGESTIONS posts with text. */
  insufficient: boolean;
  /** Count of candidates we attempted to gate (<= TODAY_HUB_GATE_LIMIT). */
  allCount: number;
  /** Topics that survived the gate, in original order. */
  filteredTopics: TopicSuggestion[];
  /** Chip metadata keyed by topic.name. Missing entry = render without chip. */
  freshness: Record<string, FreshnessChip>;
  /** Reframed-angle text keyed by topic.name. */
  reframes: Record<string, string>;
  /** True if any gate call hit the per-user hourly rate limit. */
  rateLimited: boolean;
}

const EMPTY_BUNDLE: TodayHubTopicsBundle = {
  insufficient: false,
  allCount: 0,
  filteredTopics: [],
  freshness: {},
  reframes: {},
  rateLimited: false,
};

function reasonForVerdict(chipVerdict: FreshnessChipVerdict): string {
  return chipVerdict === "green"
    ? "Fresh — low saturation, no recent overlap."
    : "Related trend active — try a sharper angle.";
}

async function generateSuggestions(
  userId: string,
  posts: { text: string }[],
): Promise<TopicSuggestion[]> {
  try {
    const llm = await resolveLLMClient(userId);
    const result = await generateTopicSuggestions(posts, llm);
    if (result.suggestions.length > 0) return result.suggestions;
    return buildFallbackTopicSuggestions(posts).suggestions;
  } catch (error) {
    if (!(error instanceof LLMAuthError)) {
      console.warn(
        "Today Hub topic suggestions falling back after LLM generation failed:",
        error,
      );
    }
    return buildFallbackTopicSuggestions(posts).suggestions;
  }
}

interface GateOutcome {
  topic: TopicSuggestion;
  freshness?: FreshnessResult;
  rateLimited: boolean;
}

async function gateTopic(
  topic: TopicSuggestion,
  userId: string,
  runId: string,
): Promise<GateOutcome> {
  try {
    const result = await checkTopicFreshness(topic.name, userId, runId);
    return { topic, freshness: result, rateLimited: false };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { topic, rateLimited: true };
    }
    console.warn(
      `Today Hub freshness check failed for topic "${topic.name}":`,
      error,
    );
    // Treat unexpected errors as rate-limited-style degradation: keep the
    // topic visible without a chip so we never hide the surface entirely.
    return { topic, rateLimited: true };
  }
}

async function buildBundleUncached(
  userId: string,
): Promise<TodayHubTopicsBundle> {
  const supabase = createAdminClient();

  const { data: rows, error: postsErr } = await supabase
    .from("posts")
    .select("text_full")
    .eq("user_id", userId)
    .not("text_full", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (postsErr) {
    console.warn("Today Hub post fetch failed:", postsErr);
    return EMPTY_BUNDLE;
  }

  const posts = (rows ?? [])
    .filter((r) => r.text_full != null)
    .map((r) => ({ text: r.text_full as string }));

  if (posts.length < MIN_POSTS_FOR_SUGGESTIONS) {
    return { ...EMPTY_BUNDLE, insufficient: true };
  }

  const suggestions = await generateSuggestions(userId, posts);
  const topN = suggestions.slice(0, TODAY_HUB_GATE_LIMIT);
  if (topN.length === 0) {
    return EMPTY_BUNDLE;
  }

  const runId = randomUUID();
  const outcomes = await Promise.all(
    topN.map((t) => gateTopic(t, userId, runId)),
  );

  const filteredTopics: TopicSuggestion[] = [];
  const freshness: Record<string, FreshnessChip> = {};
  const reframes: Record<string, string> = {};
  let rateLimited = false;

  for (const outcome of outcomes) {
    if (outcome.rateLimited) {
      rateLimited = true;
      filteredTopics.push(outcome.topic);
      continue;
    }

    const result = outcome.freshness;
    if (!result) continue;

    if (result.verdict === "red") continue;

    if (result.verdict === "green") {
      filteredTopics.push(outcome.topic);
      freshness[outcome.topic.name] = {
        verdict: "green",
        reasonShort: reasonForVerdict("green"),
      };
      continue;
    }

    // verdict === "yellow" — only survive if external-driven + cold self window.
    const isExternalOnly =
      result.externalSignal.saturation === "yellow" &&
      result.selfRepetitionRisk.counts.d30 === 0;
    if (!isExternalOnly) continue;

    const reframe = await reframeTopicAngle(outcome.topic.name, userId);
    if (!reframe) continue;

    filteredTopics.push(outcome.topic);
    freshness[outcome.topic.name] = {
      verdict: "yellow",
      reasonShort: reasonForVerdict("yellow"),
    };
    reframes[outcome.topic.name] = reframe;
  }

  return {
    insufficient: false,
    allCount: topN.length,
    filteredTopics,
    freshness,
    reframes,
    rateLimited,
  };
}

export async function getTodayHubTopicsBundle(
  userId: string,
  backfillJob: BackfillJob | null,
): Promise<TodayHubTopicsBundle> {
  if (isImportingBackfillStatus(backfillJob?.status)) {
    return EMPTY_BUNDLE;
  }

  const cached = unstable_cache(
    () => buildBundleUncached(userId),
    [TODAY_HUB_CACHE_TAG_PREFIX, userId],
    {
      revalidate: TODAY_HUB_CACHE_TTL_SECONDS,
      tags: [`${TODAY_HUB_CACHE_TAG_PREFIX}:${userId}`],
    },
  );
  return cached();
}

export const __testOnly = {
  buildBundleUncached,
  reasonForVerdict,
};
