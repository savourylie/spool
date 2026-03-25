/**
 * Quality LLM Analysis
 *
 * Server-side LLM analysis layer for the Content Quality Scanner.
 * Provides deeper content assessment using Claude: tone detection,
 * topic coherence, semantic similarity, and shareability scoring.
 *
 * Depends on: llm-client (TICKET-037), quality-heuristics types (TICKET-038).
 */

import { LLMClient } from "@/lib/llm-client";
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

const SCANNER_SYSTEM_PROMPT = `You are a social media content quality analyst specializing in the Threads algorithm. Analyze the user's draft post and return ONLY a valid JSON object — no markdown fences, no explanation, no wrapping.

## User's Recent Posts (for tone and similarity comparison)
{RECENT_POSTS}

## User's Usual Topics
{TOPIC_TAGS}

## Analysis Instructions

Analyze the draft post for these four dimensions:

1. **Tone**: Does the post sound AI-generated, overly formal, or unnatural compared to the user's recent posts? Flag if the writing style noticeably diverges from their established voice.

2. **Coherence**: Does the post align with the user's usual topics listed above? Flag if it's a hard topic pivot with no connection to their established content themes.

3. **Similarity**: Is the post too semantically similar to any of their recent posts? The algorithm penalizes near-duplicate content. Flag if the core idea closely overlaps a recent post.

4. **Shareability**: Score the post against these 4 private-share triggers (the content types people DM to friends):
   (a) Articulating what readers think but can't express — "voice of the reader"
   (b) Systematic time-saving compilations — checklists, curated lists, how-tos
   (c) Counterintuitive data-backed conclusions — surprising facts that challenge assumptions
   (d) Shareable conversation frameworks — templates, prompts, or structures others can reuse

## Required JSON Schema

{
  "issues": [
    {
      "id": "string — unique kebab-case identifier, e.g. 'ai-tone-detected'",
      "severity": "high | medium | low",
      "category": "tone | coherence | similarity | shareability",
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
 */
export function buildScannerPrompt(
  text: string,
  userContext: UserContext,
): { systemPrompt: string; userMessage: string } {
  const recentPostsBlock =
    userContext.recentPosts.length > 0
      ? userContext.recentPosts
          .map(
            (p, i) =>
              `${i + 1}. [${p.publishedAt}] ${p.text}`,
          )
          .join("\n")
      : "No recent posts available.";

  const topicTagsBlock =
    userContext.topicTags.length > 0
      ? userContext.topicTags.join(", ")
      : "No established topics yet.";

  const systemPrompt = SCANNER_SYSTEM_PROMPT.replace(
    "{RECENT_POSTS}",
    recentPostsBlock,
  ).replace("{TOPIC_TAGS}", topicTagsBlock);

  return {
    systemPrompt,
    userMessage: `Analyze this draft post:\n\n${text}`,
  };
}

// ── Analysis Functions ───────────────────────────────────────────────

/**
 * Run LLM analysis on post text. Awaits the full response and returns
 * a parsed, validated result. Use for non-streaming contexts.
 */
export async function analyzeWithLLM(
  text: string,
  userContext: UserContext,
): Promise<LLMAnalysisResult> {
  const llm = new LLMClient();
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
): ReadableStream<Uint8Array> {
  const llm = new LLMClient();
  const { systemPrompt, userMessage } = buildScannerPrompt(text, userContext);

  return llm.generateStream({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
}
