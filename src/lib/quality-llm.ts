/**
 * Quality LLM Analysis
 *
 * Server-side LLM analysis layer for the Content Quality Scanner.
 * Provides deeper content assessment using Claude: tone detection,
 * topic coherence, semantic similarity, and shareability scoring.
 *
 * Brand voice discipline (TICKET-070): Scanner is the OBSERVER — it
 * flags drift against the creator's established voice but MUST NOT
 * rewrite drafts toward the profile. Rewrites for `voice-drift` must
 * restore the creator's own patterns, never impose a generic voice.
 * See `src/lib/prompts/brand-voice-usage.md` for why this asymmetry
 * with Composer is load-bearing (feedback-loop homogenization).
 *
 * Depends on: llm-client (TICKET-037), quality-heuristics types (TICKET-038),
 * prompt loader (TICKET-067), brand voice extraction (TICKET-068).
 */

import type { ILLMClient } from "@/lib/llm-provider";
import type { SystemBlock } from "@/lib/llm-client";
import { loadPrompt } from "@/lib/prompts/loader";
import {
  BRAND_VOICE_DIMENSIONS,
  type BrandVoiceRecord,
} from "@/lib/brand-voice-types";
import {
  parseAndValidateResponse,
  type UserContext,
  type SuggestedRewrite,
  type ShareabilityAssessment,
  type LLMAnalysisResult,
} from "@/lib/quality-scanner-shared";

// Re-export shared types and parser for backward compatibility
export { parseAndValidateResponse };
export type { UserContext, SuggestedRewrite, ShareabilityAssessment, LLMAnalysisResult };

// ── Prompt Construction ──────────────────────────────────────────────

const SCANNER_INSTRUCTIONS = `You are a social media content quality analyst specializing in the Threads algorithm. Analyze the user's draft post and return ONLY a valid JSON object — no markdown fences, no explanation, no wrapping.

## Analysis Instructions

Analyze the draft post for these five dimensions:

1. **Tone**: Does the post sound AI-generated, overly formal, or unnatural compared to the user's recent posts? Use the AI detection markers above to identify common tells. Flag if the writing style noticeably diverges from their established voice.

2. **Coherence**: Does the post align with the user's usual topics listed below? Flag if it's a hard topic pivot with no connection to their established content themes.

3. **Similarity**: Is the post too semantically similar to any of their recent posts? The algorithm penalizes near-duplicate content (see R4). Flag if the core idea closely overlaps a recent post.

4. **Shareability**: Score the post against these 4 private-share triggers (the content types people DM to friends):
   (a) Articulating what readers think but can't express — "voice of the reader"
   (b) Systematic time-saving compilations — checklists, curated lists, how-tos
   (c) Counterintuitive data-backed conclusions — surprising facts that challenge assumptions
   (d) Shareable conversation frameworks — templates, prompts, or structures others can reuse

5. **Voice drift**: If — and only if — the user context includes an "established voice" section describing 11 dimensions, compare the draft's patterns against those dimensions. Emit a \`voice-drift\` issue when sentence structure, paragraph rhythm, tone switching, humor, analogies, taboo phrases, self-reference, or other established dimensions materially diverge from the creator's pattern. In \`description\`, cite which dimension drifted and how (e.g., "draft uses 40-word sentences; sentence_structure pattern is 'short, fragment-heavy'"). If no established voice section is provided, do NOT emit any voice-drift issues.

   **Critical constraint on rewrites for voice-drift**: DO NOT rewrite the draft toward the established voice using the evidence excerpts as templates. The Scanner is an observer, not a rewriter-toward-profile. Rewrites for \`voice-drift\` issues must only restore the creator's own patterns (as described by the dimension). Never impose a generic "better" voice or copy evidence excerpts. If you cannot produce a faithful rewrite, omit the rewrite and leave the flag alone.

## Required JSON Schema

{
  "issues": [
    {
      "id": "string — unique kebab-case identifier, e.g. 'ai-tone-detected'",
      "severity": "high | medium | low",
      "category": "tone | coherence | similarity | shareability | voice-drift",
      "description": "string — what the issue is",
      "suggestion": "string — specific actionable fix"
    }
  ],
  "rewrites": [
    {
      "label": "string — short description of what this rewrite improves",
      "text": "string — the full rewritten post text"
    }
  ],
  "shareability": {
    "score": "number 0-100",
    "topTrigger": "string — which of the 4 triggers this post best matches (or 'none')",
    "reasoning": "string — 1-2 sentences explaining the score"
  },
  "tone": "string — 1 sentence summary of the post's detected tone"
}

Return 0-3 issues (only genuine problems), 0-2 rewrites (only if issues were found), and always return shareability and tone. If the post is high quality, return an empty issues array.`;

/**
 * Build the system prompt and user message for the scanner LLM call.
 *
 * Returns an array of SystemBlocks where the stable knowledge prefix is
 * marked `cacheable: true` so Anthropic prompt caching can reuse it across
 * requests. The user-variable suffix (recent posts + topic tags) is kept
 * in its own uncached block.
 */
export function buildScannerPrompt(
  text: string,
  userContext: UserContext,
): { systemPrompt: SystemBlock[]; userMessage: string } {
  const recentPostsBlock =
    userContext.recentPosts.length > 0
      ? userContext.recentPosts
          .map((p, i) => `${i + 1}. [${p.publishedAt}] ${p.text}`)
          .join("\n")
      : "No recent posts available.";

  const topicTagsBlock =
    userContext.topicTags.length > 0
      ? userContext.topicTags.join(", ")
      : "No established topics yet.";

  // Stable prefix: scanner role + algorithm/psychology/ai-detection knowledge +
  // static instructions and JSON schema. This is large and rarely changes —
  // ideal for prompt caching.
  const knowledgePrefix = [
    loadPrompt("algorithm"),
    loadPrompt("psychology"),
    loadPrompt("ai-detection"),
    SCANNER_INSTRUCTIONS,
  ].join("\n\n");

  const variableSuffix = [
    "## User's Recent Posts (for tone and similarity comparison)",
    recentPostsBlock,
    "",
    "## User's Usual Topics",
    topicTagsBlock,
  ].join("\n");

  const blocks: SystemBlock[] = [
    { text: knowledgePrefix, cacheable: true },
    { text: variableSuffix },
  ];

  // Brand voice observer block (TICKET-070): included whenever the user has
  // a non-stub profile, regardless of tier. The Scanner uses this as a
  // reference to flag drift — it must NOT rewrite toward the profile. See
  // `src/lib/prompts/brand-voice-usage.md`.
  const brandVoice = userContext.brandVoice;
  if (brandVoice && brandVoice.sourcePostCount > 0) {
    blocks.push({ text: buildBrandVoiceObserverBlock(brandVoice) });
  }

  return {
    systemPrompt: blocks,
    userMessage: `Analyze this draft post:\n\n${text}`,
  };
}

// ── Brand Voice Observer Block (TICKET-070) ──────────────────────────

/**
 * Build the Scanner's brand-voice observer block. Each of the 11
 * dimensions is rendered as pattern + exactly 1 evidence excerpt
 * (truncated — observer doesn't need exhaustive evidence). The block
 * title and body repeat the "do not rewrite toward" constraint
 * documented in `src/lib/prompts/brand-voice-usage.md`.
 */
function buildBrandVoiceObserverBlock(record: BrandVoiceRecord): string {
  const dimensionLines: string[] = [];

  for (const dim of BRAND_VOICE_DIMENSIONS) {
    const entry = record.profile[dim];
    if (!entry) continue;
    const firstExcerpt = entry.evidence[0];
    const excerptLine = firstExcerpt ? `\n  Example: "${firstExcerpt.excerpt}"` : "";
    dimensionLines.push(`### ${dim}\nPattern: ${entry.pattern}${excerptLine}`);
  }

  return [
    "## User's established voice (flag drift only — do not rewrite toward this)",
    "",
    `Extracted from ${record.sourcePostCount} posts (confidence: ${record.confidenceTier}). Use these 11 dimensions as a REFERENCE for flagging drift — emit a \`voice-drift\` issue when the draft materially diverges. DO NOT generate rewrites that rephrase the draft in this voice using the examples as templates; that's Composer's job. Rewrites must only restore the creator's own patterns.`,
    "",
    dimensionLines.join("\n\n"),
  ].join("\n");
}

// ── Analysis Functions ───────────────────────────────────────────────

/**
 * Run LLM analysis on post text. Awaits the full response and returns
 * a parsed, validated result. Use for non-streaming contexts.
 */
export async function analyzeWithLLM(
  text: string,
  userContext: UserContext,
  llm: ILLMClient,
): Promise<LLMAnalysisResult> {
  const { systemPrompt, userMessage } = buildScannerPrompt(text, userContext);

  const raw = await llm.generate({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return parseAndValidateResponse(raw);
}

/**
 * Run LLM analysis with streaming. Returns a ReadableStream of SSE events
 * suitable for direct use in a Response. The client accumulates text deltas
 * and parses the final JSON.
 */
export function analyzeWithLLMStream(
  text: string,
  userContext: UserContext,
  llm: ILLMClient,
): ReadableStream<Uint8Array> {
  const { systemPrompt, userMessage } = buildScannerPrompt(text, userContext);

  return llm.generateStream({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
}
