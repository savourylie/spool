/**
 * Quality Scanner Shared Types & Parser
 *
 * Client-safe module containing types and the response parser for
 * the Content Quality Scanner. Extracted from quality-llm.ts so that
 * client components can import without pulling in server-only deps.
 */

import type { QualityIssue, IssueCategory, IssueSeverity } from "@/lib/quality-heuristics";
import type { BrandVoiceRecord } from "@/lib/brand-voice-types";

// ── Types ────────────────────────────────────────────────────────────

export interface UserContext {
  /** User's last 10 posts (most recent first) */
  recentPosts: Array<{ text: string; publishedAt: string }>;
  /** Distinct topic tags from user's posts */
  topicTags: string[];
  /** Brand voice profile (TICKET-070). Observer-only — Scanner flags drift
   *  but never rewrites toward this. See `src/lib/prompts/brand-voice-usage.md`. */
  brandVoice?: BrandVoiceRecord | null;
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

// ── V2 Types (TICKET-077) ────────────────────────────────────────────

export type FindingSeverity = "info" | "flag" | "warn";

export interface Finding {
  /** Rule or marker tag (e.g., "R1", "S12", "sentence_structure"). Required on
   *  the Algorithm axis so findings cross-reference `algorithm.md`. */
  rule?: string;
  severity: FindingSeverity;
  /** One-sentence observation about the draft. */
  message: string;
  /** Optional short quote or pointer (e.g., "Neighbor post [2] opens with..."). */
  evidence?: string;
}

export interface NeighborPost {
  id: string;
  textPreview: string;
  /** Raw weighted engagement score. */
  wes: number;
  /** WES as a percentage of views. */
  wesNormalized: number;
  publishedAt: string;
}

export interface AxisDiagnostic {
  summary: string;
  findings: Finding[];
  /** Populated on the `styleMatch` axis after the route resolves LLM citations
   *  to the full server-computed records. */
  neighborPosts?: NeighborPost[];
  /** Transient: 1-based indices the LLM cited. Stripped before the object is
   *  emitted to the client. Consumers should read `neighborPosts` instead. */
  _citations?: number[];
}

export interface ScannerDiagnosticV2 {
  styleMatch: AxisDiagnostic;
  psychology: AxisDiagnostic;
  algorithm: AxisDiagnostic;
  aiDetection: AxisDiagnostic;
}

// ── Constants ────────────────────────────────────────────────────────

const VALID_LLM_CATEGORIES: Set<IssueCategory> = new Set([
  "tone",
  "coherence",
  "similarity",
  "shareability",
  "voice-drift",
]);

const VALID_SEVERITIES: Set<IssueSeverity> = new Set(["high", "medium", "low"]);

const VALID_FINDING_SEVERITIES: Set<FindingSeverity> = new Set([
  "info",
  "flag",
  "warn",
]);

const AXIS_KEYS = [
  "styleMatch",
  "psychology",
  "algorithm",
  "aiDetection",
] as const;

type AxisKey = (typeof AXIS_KEYS)[number];

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

// ── V2 Response Parsing (TICKET-077) ─────────────────────────────────

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseFinding(item: unknown): Finding | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  const severity = record.severity;
  if (!VALID_FINDING_SEVERITIES.has(severity as FindingSeverity)) return null;

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (message.length === 0) return null;

  const finding: Finding = {
    severity: severity as FindingSeverity,
    message,
  };

  if (typeof record.rule === "string" && record.rule.length > 0) {
    finding.rule = record.rule;
  }
  if (typeof record.evidence === "string" && record.evidence.length > 0) {
    finding.evidence = record.evidence;
  }

  return finding;
}

function parseCitations(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const indices = raw.filter(
    (v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0,
  );
  return indices.length > 0 ? indices : undefined;
}

function parseAxis(raw: unknown): AxisDiagnostic {
  if (!raw || typeof raw !== "object") {
    throw new Error("axis is not an object");
  }
  const record = raw as Record<string, unknown>;

  const summary =
    typeof record.summary === "string" ? record.summary.trim() : "";

  const findings = Array.isArray(record.findings)
    ? (record.findings
        .map(parseFinding)
        .filter((f): f is Finding => f !== null))
    : [];

  const citations = parseCitations(record.neighborCitations);

  const axis: AxisDiagnostic = { summary, findings };
  if (citations) axis._citations = citations;
  return axis;
}

/**
 * Parse + validate the v2 four-axis scanner response. Strips markdown
 * fences, enforces axis presence, and filters findings with invalid
 * severity or empty messages. Throws when the top-level JSON is
 * unparseable or any of the four axes are missing.
 *
 * Neighbor citations from the LLM are preserved on each axis under the
 * transient `_citations` field; the route resolves them against the
 * server-computed candidate pool and populates `neighborPosts` before
 * emitting to the client.
 */
export function parseAndValidateResponseV2(raw: string): ScannerDiagnosticV2 {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("response is not a JSON object");
  }

  const result = {} as Record<AxisKey, AxisDiagnostic>;
  for (const axis of AXIS_KEYS) {
    const axisRaw = (parsed as Record<string, unknown>)[axis];
    if (axisRaw === undefined) {
      throw new Error(`missing axis: ${axis}`);
    }
    result[axis] = parseAxis(axisRaw);
  }

  return result as ScannerDiagnosticV2;
}
