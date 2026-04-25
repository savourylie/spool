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
import type { ILLMClient } from "@/lib/llm-provider";

// ── Constants ────────────────────────────────────────────────────────

export const MIN_POSTS_FOR_SUGGESTIONS = 5;
export const SUGGESTION_COUNT = 8;
export const TOPIC_SUGGESTIONS_TIMEOUT_MS = 12_000;
export const APPROX_CHARS_PER_TOKEN = 4;

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

export interface TopicSuggestionsProgress {
  generatedTokens: number;
}

// ── Prompt ────────────────────────────────────────────────────────────

const VALID_DISTANCES: ReadonlySet<string> = new Set([
  "near",
  "medium",
  "far",
]);

const UPPERCASE_SHORT_WORDS = 3;

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

function extractFirstJSONArray(raw: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === "\\") {
        isEscaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseSuggestionArray(raw: string): unknown {
  try {
    return unwrapSuggestionPayload(JSON.parse(raw));
  } catch {
    const extracted = extractFirstJSONArray(raw);
    if (!extracted) {
      throw new Error("Expected JSON array of topic suggestions");
    }
    return unwrapSuggestionPayload(JSON.parse(extracted));
  }
}

function unwrapSuggestionPayload(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.suggestions)) {
    return record.suggestions;
  }
  if (Array.isArray(record.topics)) {
    return record.topics;
  }

  return parsed;
}

function formatTopicName(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.length <= UPPERCASE_SHORT_WORDS) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function dedupeSuggestions(
  suggestions: TopicSuggestion[],
): TopicSuggestion[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key = suggestion.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildFallbackRationale(
  cluster: TopicCluster,
  isPrimaryTerm: boolean,
  semanticDistance: SemanticDistance,
): string {
  const clusterName = formatTopicName(cluster.topic);

  if (isPrimaryTerm) {
    return `Recurring theme in your strongest ${clusterName} posts.`;
  }

  if (semanticDistance === "medium") {
    return `Related keyword that frequently appears alongside your ${clusterName} content.`;
  }

  return `Secondary angle connected to your ${clusterName} posts.`;
}

export function buildFallbackTopicSuggestions(
  posts: TopicPost[],
): TopicSuggestionsResult {
  const clusters = extractTopics(posts, 5);

  if (clusters.length === 0) {
    return { suggestions: [], coreTopics: [] };
  }

  const topScore = clusters[0]?.score || 1;
  const suggestions: TopicSuggestion[] = [];

  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
    const cluster = clusters[clusterIndex];
    const terms = [cluster.topic, ...cluster.keywords.filter((k) => k !== cluster.topic)];

    for (let termIndex = 0; termIndex < terms.length; termIndex++) {
      if (suggestions.length >= SUGGESTION_COUNT) {
        break;
      }

      const semanticDistance: SemanticDistance =
        clusterIndex === 0
          ? termIndex === 0
            ? "near"
            : "medium"
          : clusterIndex === 1 && termIndex === 0
            ? "medium"
            : "far";

      const baseScore =
        semanticDistance === "near" ? 92 : semanticDistance === "medium" ? 78 : 64;
      const clusterWeight = Math.max(
        0.75,
        Math.min(1, cluster.score / topScore || 0.75),
      );

      suggestions.push({
        name: formatTopicName(terms[termIndex]),
        relevanceScore: Math.max(
          0,
          Math.min(100, Math.round(baseScore * clusterWeight)),
        ),
        semanticDistance,
        rationale: buildFallbackRationale(
          cluster,
          termIndex === 0,
          semanticDistance,
        ),
      });
    }
  }

  return {
    suggestions: dedupeSuggestions(suggestions).slice(0, SUGGESTION_COUNT),
    coreTopics: clusters.map((c) => c.topic),
  };
}

export function parseTopicSuggestions(raw: string): TopicSuggestion[] {
  let cleaned = raw.trim();

  // Strip markdown fences if present
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = parseSuggestionArray(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of topic suggestions");
  }

  return dedupeSuggestions(
    parsed
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
      }),
  );
}

export function estimateGeneratedTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil(normalized.length / APPROX_CHARS_PER_TOKEN),
  );
}

// ── Orchestrator ──────────────────────────────────────────────────────

export async function generateTopicSuggestions(
  posts: TopicPost[],
  llm: ILLMClient,
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
    timeout: TOPIC_SUGGESTIONS_TIMEOUT_MS,
  });

  let suggestions: TopicSuggestion[];
  try {
    suggestions = parseTopicSuggestions(raw);
  } catch {
    return buildFallbackTopicSuggestions(posts);
  }

  if (suggestions.length === 0) {
    return buildFallbackTopicSuggestions(posts);
  }

  return { suggestions: suggestions.slice(0, SUGGESTION_COUNT), coreTopics };
}

export async function streamTopicSuggestions(
  posts: TopicPost[],
  llm: ILLMClient,
  onProgress?: (progress: TopicSuggestionsProgress) => void,
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

  let raw = "";
  let lastGeneratedTokens = 0;

  for await (const chunk of llm.generateStreamIterator({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 512,
    timeout: TOPIC_SUGGESTIONS_TIMEOUT_MS,
  })) {
    raw += chunk;

    const generatedTokens = estimateGeneratedTokens(raw);
    if (generatedTokens > lastGeneratedTokens) {
      lastGeneratedTokens = generatedTokens;
      onProgress?.({ generatedTokens });
    }
  }

  let suggestions: TopicSuggestion[];
  try {
    suggestions = parseTopicSuggestions(raw);
  } catch {
    return buildFallbackTopicSuggestions(posts);
  }

  if (suggestions.length === 0) {
    return buildFallbackTopicSuggestions(posts);
  }

  return { suggestions: suggestions.slice(0, SUGGESTION_COUNT), coreTopics };
}
