/**
 * Quality Scanner Shared Types & Parser
 *
 * Client-safe module containing types and the response parser for
 * the Content Quality Scanner. Extracted from quality-llm.ts so that
 * client components can import without pulling in server-only deps.
 */

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
