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
import type { QualityIssue, IssueCategory, IssueSeverity } from "@/lib/quality-heuristics";

// ── Types ────────────────────────────────────────────────────────────

export interface UserContext {
  /** User's last 10 posts (most recent first) */
  recentPosts: Array<{ text: string; publishedAt: string }>;
  /** Distinct topic tags from user's posts */
  topicTags: string[];
}

export interface SuggestedRewrite {
  label: string;
  text: string;
}

export interface ShareabilityAssessment {
  /** 0-100 score */
  score: number;
  /** Which of the 4 share-trigger categories this post best matches, or "none" */
  topTrigger: string;
  /** 1-2 sentence explanation */
  reasoning: string;
}

export interface LLMAnalysisResult {
  issues: QualityIssue[];
  rewrites: SuggestedRewrite[];
  shareability: ShareabilityAssessment;
  tone: string;
}

// ── Constants ────────────────────────────────────────────────────────

const VALID_LLM_CATEGORIES: Set<IssueCategory> = new Set([
  "tone",
  "coherence",
  "similarity",
  "shareability",
]);

const VALID_SEVERITIES: Set<IssueSeverity> = new Set(["high", "medium", "low"]);

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

// ── Response Parsing ─────────────────────────────────────────────────

/**
 * Parse and validate the raw LLM response string into a typed LLMAnalysisResult.
 * Strips markdown fences, handles missing fields with defaults, and filters
 * issues with invalid severity/category values.
 */
export function parseAndValidateResponse(raw: string): LLMAnalysisResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned);

  // Validate and filter issues
  const rawIssues: QualityIssue[] = Array.isArray(parsed.issues)
    ? parsed.issues
        .filter(
          (item: Record<string, unknown>) =>
            VALID_SEVERITIES.has(item.severity as IssueSeverity) &&
            VALID_LLM_CATEGORIES.has(item.category as IssueCategory),
        )
        .map((item: Record<string, unknown>, index: number) => ({
          id:
            typeof item.id === "string" && item.id.length > 0
              ? item.id
              : `llm-${item.category}-${index}`,
          severity: item.severity as IssueSeverity,
          category: item.category as IssueCategory,
          description: String(item.description ?? ""),
          suggestion: String(item.suggestion ?? ""),
        }))
    : [];

  // Validate rewrites
  const rawRewrites: SuggestedRewrite[] = Array.isArray(parsed.rewrites)
    ? parsed.rewrites
        .filter(
          (item: Record<string, unknown>) =>
            typeof item.label === "string" && typeof item.text === "string",
        )
        .map((item: Record<string, unknown>) => ({
          label: String(item.label),
          text: String(item.text),
        }))
    : [];

  // Validate shareability
  const rawShare = parsed.shareability;
  const shareability: ShareabilityAssessment =
    rawShare && typeof rawShare === "object"
      ? {
          score: Math.max(
            0,
            Math.min(100, Number(rawShare.score) || 0),
          ),
          topTrigger: String(rawShare.topTrigger ?? "none"),
          reasoning: String(rawShare.reasoning ?? ""),
        }
      : { score: 0, topTrigger: "none", reasoning: "" };

  // Validate tone
  const tone =
    typeof parsed.tone === "string" ? parsed.tone : "";

  return {
    issues: rawIssues,
    rewrites: rawRewrites,
    shareability,
    tone,
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
