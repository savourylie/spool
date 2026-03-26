/**
 * Topic Suggestion Engine
 *
 * Analyzes the user's top-performing posts to extract core topics (via TF-IDF
 * from topic-classification.ts), then calls the LLM to generate semantically
 * adjacent topic suggestions scored by audience relevance and distance.
 *
 * Depends on: topic-classification (TICKET-033), llm-client (TICKET-037).
 */

import {
  extractTopics,
  type TopicPost,
  type TopicCluster,
} from "@/lib/topic-classification";
import { LLMClient } from "@/lib/llm-client";

// ── Constants ────────────────────────────────────────────────────────

export const MIN_POSTS_FOR_SUGGESTIONS = 5;
export const SUGGESTION_COUNT = 8;

// ── Types ────────────────────────────────────────────────────────────

export type SemanticDistance = "near" | "medium" | "far";

export interface TopicSuggestion {
  name: string;
  relevanceScore: number; // 0-100
  semanticDistance: SemanticDistance;
  rationale: string;
}

export interface TopicSuggestionsResult {
  suggestions: TopicSuggestion[];
  coreTopics: string[];
}

// ── Prompt ────────────────────────────────────────────────────────────

const VALID_DISTANCES: ReadonlySet<string> = new Set([
  "near",
  "medium",
  "far",
]);

const SYSTEM_PROMPT = `You are a content strategist for social media creators on Threads.

Given a creator's core topics and related keywords (extracted from their best-performing posts), suggest ${SUGGESTION_COUNT} adjacent topics they should consider posting about.

For each suggestion, provide:
- "name": a concise, human-readable topic name (2-4 words, Title Case)
- "relevanceScore": 0-100 indicating how relevant this topic is to their existing audience
- "semanticDistance": one of "near", "medium", or "far"
  - "near" = a subtopic, angle, or deeper dive within their existing focus
  - "medium" = an adjacent field that shares audience overlap
  - "far" = a creative crossover that could attract new audience segments
- "rationale": one sentence explaining why this topic fits

Balance the suggestions: approximately 3 near, 3 medium, and 2 far.

Return ONLY a valid JSON array. No markdown fences, no extra text.

Example output:
[
  {"name": "AI Ethics Debates", "relevanceScore": 88, "semanticDistance": "near", "rationale": "Direct extension of your AI content with strong engagement potential."},
  {"name": "Remote Work Culture", "relevanceScore": 62, "semanticDistance": "medium", "rationale": "Your tech audience overlaps heavily with remote workers."}
]`;

export function buildTopicSuggestionsPrompt(
  coreTopics: string[],
  clusters: TopicCluster[],
): { systemPrompt: string; userMessage: string } {
  const topicLines = clusters
    .map(
      (c) =>
        `- "${c.topic}" (score: ${c.score.toFixed(2)}, keywords: ${c.keywords.join(", ")})`,
    )
    .join("\n");

  const userMessage = `Creator's core topics (from their top-performing posts):
${topicLines}

Suggest ${SUGGESTION_COUNT} adjacent topics this creator should explore.`;

  return { systemPrompt: SYSTEM_PROMPT, userMessage };
}

// ── Parser ────────────────────────────────────────────────────────────

export function parseTopicSuggestions(raw: string): TopicSuggestion[] {
  let cleaned = raw.trim();

  // Strip markdown fences if present
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of topic suggestions");
  }

  return parsed
    .filter(
      (item: unknown): item is Record<string, unknown> =>
        item != null &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        ((item as Record<string, unknown>).name as string).trim().length > 0,
    )
    .map((item) => {
      const rawScore = Number(item.relevanceScore);
      const score = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : 50;

      const distRaw = String(item.semanticDistance ?? "").toLowerCase();
      const semanticDistance: SemanticDistance = VALID_DISTANCES.has(distRaw)
        ? (distRaw as SemanticDistance)
        : "medium";

      return {
        name: String(item.name).trim(),
        relevanceScore: score,
        semanticDistance,
        rationale: typeof item.rationale === "string" ? item.rationale : "",
      };
    });
}

// ── Orchestrator ──────────────────────────────────────────────────────

export async function generateTopicSuggestions(
  posts: TopicPost[],
  llm: LLMClient,
): Promise<TopicSuggestionsResult> {
  const clusters = extractTopics(posts, 5);

  if (clusters.length === 0) {
    return { suggestions: [], coreTopics: [] };
  }

  const coreTopics = clusters.map((c) => c.topic);
  const { systemPrompt, userMessage } = buildTopicSuggestionsPrompt(
    coreTopics,
    clusters,
  );

  const raw = await llm.generate({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 512,
  });

  const suggestions = parseTopicSuggestions(raw);

  return { suggestions, coreTopics };
}
