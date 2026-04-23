/**
 * Brand Voice Extraction (TICKET-068)
 *
 * Reads a user's top-WES posts + recent comment replies, asks the LLM
 * to describe their voice across 11 dimensions, validates the JSON,
 * and upserts the result into `brand_voice_profiles`. Upstream of
 * TICKET-069 (UI) and TICKET-070 (Composer + Scanner wiring).
 */

import { createAdminClient } from "@/lib/supabase/server";
import { resolveLLMClient } from "@/lib/llm-resolver";
import { loadPrompt } from "@/lib/prompts/loader";
import { computeNormalizedWES } from "@/lib/weighted-engagement";
import { getConfidenceTier, type ConfidenceTier } from "@/lib/data-confidence";
import type { SystemBlock } from "@/lib/llm-client";
import type { Json } from "@/lib/supabase/database.types";

// ── Types ────────────────────────────────────────────────────────────

export const BRAND_VOICE_DIMENSIONS = [
  "sentence_structure",
  "tone_switching",
  "emotional_expression",
  "knowledge_presentation",
  "fan_vs_critic_reply_tone",
  "analogies",
  "humor",
  "self_reference",
  "taboo_phrases",
  "paragraph_rhythm",
  "comment_reply_characteristics",
] as const;

export type BrandVoiceDimension = (typeof BRAND_VOICE_DIMENSIONS)[number];

export interface BrandVoiceEvidence {
  postId: string;
  excerpt: string;
}

export interface BrandVoiceDimensionEntry {
  pattern: string;
  evidence: BrandVoiceEvidence[];
}

export type BrandVoiceProfile = Record<
  BrandVoiceDimension,
  BrandVoiceDimensionEntry
>;

export interface BrandVoiceRecord {
  profile: BrandVoiceProfile;
  sourcePostCount: number;
  confidenceTier: ConfidenceTier;
  updatedAt: string;
}

export class BrandVoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandVoiceValidationError";
  }
}

// ── Corpus size limits ───────────────────────────────────────────────

const TOP_POSTS_LIMIT = 30;
const REPLIES_LIMIT = 50;
const METRICS_FETCH_LIMIT = 100;
const MAX_OUTPUT_TOKENS = 4096;
const EXTRACTION_TIMEOUT_MS = 45_000;

// ── Public entry point ───────────────────────────────────────────────

export async function analyzeBrandVoice(
  userId: string,
): Promise<BrandVoiceRecord> {
  const supabase = createAdminClient();

  const [metricsResult, postsResult] = await Promise.all([
    supabase.rpc("get_posts_with_metrics", {
      p_user_id: userId,
      p_sort_column: "views",
      p_sort_order: "desc",
      p_limit: METRICS_FETCH_LIMIT,
      p_offset: 0,
    }),
    supabase
      .from("posts")
      .select("id, text_full")
      .eq("user_id", userId)
      .not("text_full", "is", null),
  ]);

  // Build the ranked top-posts corpus.
  const textLookup = new Map<string, string>();
  for (const row of postsResult.data ?? []) {
    if (row.text_full) textLookup.set(row.id, row.text_full);
  }

  const metricsRows = metricsResult.data ?? [];
  const rankedPosts = metricsRows
    .map((row) => ({
      id: row.id,
      text: textLookup.get(row.id) ?? row.text_preview ?? "",
      wes: computeNormalizedWES({
        views: Number(row.views),
        likes: Number(row.likes),
        replies: Number(row.replies),
        reposts: Number(row.reposts),
        quotes: Number(row.quotes),
        shares: Number(row.shares),
      }),
    }))
    .filter((p) => p.text.trim().length > 0)
    .sort((a, b) => b.wes - a.wes)
    .slice(0, TOP_POSTS_LIMIT);

  // Fetch the creator's recent replies — filter via the posts.user_id join
  // since post_replies has no direct user_id column.
  const postIds = (postsResult.data ?? []).map((p) => p.id);
  const repliesResult =
    postIds.length > 0
      ? await supabase
          .from("post_replies")
          .select("id, text, post_id, replied_at")
          .in("post_id", postIds)
          .not("text", "is", null)
          .order("replied_at", { ascending: false })
          .limit(REPLIES_LIMIT)
      : { data: [] as Array<{ id: string; text: string | null }> };

  const replies = (repliesResult.data ?? [])
    .map((r) => ({ id: r.id, text: r.text ?? "" }))
    .filter((r) => r.text.trim().length > 0);

  const sourcePostCount = rankedPosts.length;
  const { tier } = getConfidenceTier(sourcePostCount);

  // Empty corpus — skip LLM call, write a stub profile.
  if (rankedPosts.length === 0 && replies.length === 0) {
    const stub = buildStubProfile();
    await upsertProfile(userId, stub, 0, tier);
    return {
      profile: stub,
      sourcePostCount: 0,
      confidenceTier: tier,
      updatedAt: new Date().toISOString(),
    };
  }

  // Build the prompt and call the LLM.
  const { systemPrompt, userMessage } = buildBrandVoicePrompt({
    posts: rankedPosts,
    replies,
  });

  const llm = await resolveLLMClient(userId);
  const raw = await llm.generate({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: MAX_OUTPUT_TOKENS,
    timeout: EXTRACTION_TIMEOUT_MS,
  });

  const profile = parseAndValidateBrandVoiceJson(raw);

  const updatedAt = await upsertProfile(userId, profile, sourcePostCount, tier);

  return {
    profile,
    sourcePostCount,
    confidenceTier: tier,
    updatedAt,
  };
}

// ── Prompt construction ──────────────────────────────────────────────

interface CorpusPost {
  id: string;
  text: string;
}
interface CorpusReply {
  id: string;
  text: string;
}

function buildBrandVoicePrompt(input: {
  posts: CorpusPost[];
  replies: CorpusReply[];
}): { systemPrompt: SystemBlock[]; userMessage: string } {
  const { posts, replies } = input;

  // Stable, cacheable prefix: behavioral ground + extraction instructions.
  const knowledgePrefix = [loadPrompt("psychology"), loadPrompt("brand-voice")].join(
    "\n\n",
  );

  // User-specific corpus — uncached.
  const postsBlock =
    posts.length > 0
      ? posts.map((p) => `[postId: ${p.id}]\n${p.text}`).join("\n\n")
      : "No posts available.";

  const repliesBlock =
    replies.length > 0
      ? replies.map((r) => `[replyId: ${r.id}]\n${r.text}`).join("\n\n")
      : "No replies available.";

  const corpus = [
    "## Creator's Posts (ranked by engagement, highest first)",
    "",
    postsBlock,
    "",
    "## Creator's Replies to Commenters (most recent first)",
    "",
    repliesBlock,
  ].join("\n");

  const userMessage =
    "Extract this creator's voice profile across the 11 dimensions described in the system prompt. Return exactly one fenced JSON block.";

  return {
    systemPrompt: [
      { text: knowledgePrefix, cacheable: true },
      { text: corpus },
    ],
    userMessage,
  };
}

// ── Parse + validate ─────────────────────────────────────────────────

export function parseAndValidateBrandVoiceJson(raw: string): BrandVoiceProfile {
  if (!raw || !raw.trim()) {
    throw new BrandVoiceValidationError("LLM returned empty response");
  }

  // Strip markdown fence if present.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new BrandVoiceValidationError(
      `Failed to parse LLM JSON: ${err instanceof Error ? err.message : String(err)}. Raw (first 200 chars): ${cleaned.slice(0, 200)}`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BrandVoiceValidationError(
      "LLM output is not a JSON object at the top level",
    );
  }

  const obj = parsed as Record<string, unknown>;
  const profile: Partial<BrandVoiceProfile> = {};

  for (const dim of BRAND_VOICE_DIMENSIONS) {
    const entry = obj[dim];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BrandVoiceValidationError(
        `Missing or malformed dimension: ${dim}`,
      );
    }

    const entryObj = entry as Record<string, unknown>;
    const pattern = entryObj.pattern;
    if (typeof pattern !== "string" || pattern.trim().length === 0) {
      throw new BrandVoiceValidationError(
        `Dimension ${dim}: pattern must be a non-empty string`,
      );
    }

    const evidenceRaw = entryObj.evidence;
    if (!Array.isArray(evidenceRaw)) {
      throw new BrandVoiceValidationError(
        `Dimension ${dim}: evidence must be an array`,
      );
    }

    // Filter out malformed evidence entries; require at least one remaining.
    const evidence: BrandVoiceEvidence[] = [];
    for (const e of evidenceRaw) {
      if (!e || typeof e !== "object" || Array.isArray(e)) continue;
      const eo = e as Record<string, unknown>;
      const postId = typeof eo.postId === "string" ? eo.postId : null;
      const excerpt = typeof eo.excerpt === "string" ? eo.excerpt : null;
      if (postId === null || excerpt === null) continue;
      evidence.push({ postId, excerpt });
    }

    if (evidence.length === 0) {
      throw new BrandVoiceValidationError(
        `Dimension ${dim}: at least one valid evidence entry required`,
      );
    }

    profile[dim] = { pattern: pattern.trim(), evidence };
  }

  return profile as BrandVoiceProfile;
}

// ── Stub profile for empty corpus ────────────────────────────────────

function buildStubProfile(): BrandVoiceProfile {
  const entry: BrandVoiceDimensionEntry = {
    pattern: "Not enough data yet.",
    evidence: [],
  };
  const stub = {} as BrandVoiceProfile;
  for (const dim of BRAND_VOICE_DIMENSIONS) {
    stub[dim] = { pattern: entry.pattern, evidence: [] };
  }
  return stub;
}

// ── Upsert ───────────────────────────────────────────────────────────

async function upsertProfile(
  userId: string,
  profile: BrandVoiceProfile,
  sourcePostCount: number,
  tier: ConfidenceTier,
): Promise<string> {
  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("brand_voice_profiles").upsert(
    {
      user_id: userId,
      profile: profile as unknown as Json,
      source_post_count: sourcePostCount,
      confidence_tier: tier,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to upsert brand voice profile: ${error.message}`);
  }

  return updatedAt;
}
