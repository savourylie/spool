/**
 * Concept Library (TICKET-080)
 *
 * Extracts {concept, analogy, evidence} from a post's full text, persists
 * them to `concept_ledger`, and aggregates reuse risk over a 90-day
 * window. Upstream of TICKET-081 (UI + Composer pre-draft advisory).
 *
 * Precision-first: the prompt instructs the classifier to skip uncertain
 * concepts rather than fabricate them. Empty output is a valid result.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { resolveLLMClient } from "@/lib/llm-resolver";
import { loadPrompt } from "@/lib/prompts/loader";
import type { SystemBlock } from "@/lib/llm-client";

// ── Tune-friendly constants ──────────────────────────────────────────

export const REUSE_RISK_WINDOW_DAYS = 90;
export const REUSE_RISK_GREEN_MAX = 1; // 0–1 uses in window → green
export const REUSE_RISK_YELLOW_MAX = 2; // 2 uses in window → yellow
// 3+ uses in window → red

const EXTRACTION_MAX_TOKENS = 1200;
const EXTRACTION_TIMEOUT_MS = 30_000;
const DEFAULT_BATCH_SIZE = 20;

// ── Types ────────────────────────────────────────────────────────────

export type ReuseRisk = "green" | "yellow" | "red";

export interface LedgerRow {
  id: string;
  concept: string;
  analogy: string | null;
  postId: string;
  seenAt: string;
}

interface ExtractedConcept {
  concept: string;
  analogy: string | null;
  evidence: string;
}

export class ConceptExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConceptExtractionError";
  }
}

// ── Parse + validate ─────────────────────────────────────────────────

function stripMarkdownFence(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned.startsWith("```")) return cleaned;
  return cleaned.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "");
}

function normalizeExtractedConcepts(parsed: unknown): ExtractedConcept[] {
  const conceptsRaw = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>).concepts
      : null;

  if (!Array.isArray(conceptsRaw)) {
    throw new ConceptExtractionError(
      "LLM output missing required `concepts` array",
    );
  }

  const out: ExtractedConcept[] = [];
  for (const entry of conceptsRaw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const concept = typeof e.concept === "string" ? e.concept.trim() : "";
    if (concept.length === 0) continue;

    const analogyRaw = e.analogy;
    const analogy =
      typeof analogyRaw === "string" && analogyRaw.trim().length > 0
        ? analogyRaw.trim().toLowerCase()
        : null;

    const evidence = typeof e.evidence === "string" ? e.evidence.trim() : "";

    out.push({
      concept: concept.toLowerCase(),
      analogy,
      evidence,
    });
  }

  // Dedupe within the post — keep the first occurrence (which retains its analogy).
  const seen = new Set<string>();
  const deduped: ExtractedConcept[] = [];
  for (const c of out) {
    if (seen.has(c.concept)) continue;
    seen.add(c.concept);
    deduped.push(c);
  }

  return deduped;
}

function extractCompleteJSONObjects(raw: string): string[] {
  const conceptsIndex = raw.indexOf('"concepts"');
  const arrayStart =
    conceptsIndex >= 0 ? raw.indexOf("[", conceptsIndex) : raw.indexOf("[");
  if (arrayStart < 0) return [];

  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = arrayStart + 1; i < raw.length; i++) {
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
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function parsePartialConceptObjects(raw: string): ExtractedConcept[] {
  const parsedObjects = extractCompleteJSONObjects(raw)
    .map((objectRaw) => {
      try {
        return JSON.parse(objectRaw);
      } catch {
        return null;
      }
    })
    .filter((entry): entry is Record<string, unknown> => entry != null);

  if (parsedObjects.length === 0) {
    throw new ConceptExtractionError("No complete concept objects found");
  }

  return normalizeExtractedConcepts({ concepts: parsedObjects });
}

export function parseAndValidateConcepts(raw: string): ExtractedConcept[] {
  if (!raw || !raw.trim()) {
    throw new ConceptExtractionError("LLM returned empty response");
  }

  const cleaned = stripMarkdownFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    try {
      return parsePartialConceptObjects(cleaned);
    } catch {
      throw new ConceptExtractionError(
        `Failed to parse LLM JSON: ${err instanceof Error ? err.message : String(err)}. Raw (first 200 chars): ${cleaned.slice(0, 200)}`,
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ConceptExtractionError(
      "LLM output is not a JSON object at the top level",
    );
  }

  return normalizeExtractedConcepts(parsed);
}

// ── Public: extract for a single post ────────────────────────────────

export async function extractConceptsForPost(
  postId: string,
): Promise<LedgerRow[]> {
  const supabase = createAdminClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id, text_full, published_at")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    throw new Error(
      `Failed to load post ${postId}: ${postError.message}`,
    );
  }
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Posts without text (e.g. media-only carousels) cannot yield concepts.
  // Mark them processed so rebuild doesn't keep retrying.
  if (!post.text_full || post.text_full.trim().length === 0) {
    await supabase
      .from("posts")
      .update({ concept_extracted_at: new Date().toISOString() })
      .eq("id", postId);
    return [];
  }

  const systemPrompt: SystemBlock[] = [
    { text: loadPrompt("concept-extraction"), cacheable: true },
  ];
  const userMessage = `## Post\n\n${post.text_full}`;

  const llm = await resolveLLMClient(post.user_id);
  const raw = await llm.generate({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: EXTRACTION_MAX_TOKENS,
    timeout: EXTRACTION_TIMEOUT_MS,
  });

  let concepts: ExtractedConcept[];
  try {
    concepts = parseAndValidateConcepts(raw);
  } catch (err) {
    // The ledger is advisory. A malformed model response should not leave the
    // post in a permanent retry loop that blocks rebuild progress.
    const message =
      err instanceof Error
        ? err.message.split(". Raw (first 200 chars):")[0]
        : String(err);
    console.warn("[concept-library] Ignoring malformed extraction output:", {
      postId,
      error: message,
    });
    concepts = [];
  }

  let insertedRows: LedgerRow[] = [];
  if (concepts.length > 0) {
    const rows = concepts.map((c) => ({
      user_id: post.user_id,
      concept: c.concept,
      analogy: c.analogy,
      post_id: post.id,
      seen_at: post.published_at,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("concept_ledger")
      .upsert(rows, {
        onConflict: "user_id,concept,post_id",
        ignoreDuplicates: true,
      })
      .select("id, concept, analogy, post_id, seen_at");

    if (insertError) {
      throw new Error(
        `Failed to upsert concept rows for post ${postId}: ${insertError.message}`,
      );
    }

    insertedRows = (inserted ?? []).map((r) => ({
      id: r.id,
      concept: r.concept,
      analogy: r.analogy,
      postId: r.post_id,
      seenAt: r.seen_at,
    }));
  }

  // Always mark the post processed — even on zero-concept results — so the
  // rebuild path does not keep retrying this post forever.
  const { error: markError } = await supabase
    .from("posts")
    .update({ concept_extracted_at: new Date().toISOString() })
    .eq("id", postId);

  if (markError) {
    throw new Error(
      `Failed to mark post ${postId} as extracted: ${markError.message}`,
    );
  }

  return insertedRows;
}

// ── Public: extract a batch for a user ───────────────────────────────

export async function extractForUser(
  userId: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<{ processed: number; skipped: number }> {
  const supabase = createAdminClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .is("concept_extracted_at", null)
    .not("text_full", "is", null)
    .order("published_at", { ascending: false })
    .limit(batchSize);

  if (error) {
    throw new Error(
      `Failed to load unprocessed posts for user ${userId}: ${error.message}`,
    );
  }

  let processed = 0;
  let skipped = 0;

  for (const p of posts ?? []) {
    try {
      await extractConceptsForPost(p.id);
      processed += 1;
    } catch (err) {
      // Swallow per-post failures so one bad LLM call doesn't abort the batch.
      // The post stays with `concept_extracted_at = null` and will be retried.
      console.error("[concept-library] Failed to extract for post:", {
        userId,
        postId: p.id,
        error: err instanceof Error ? err.message : err,
      });
      skipped += 1;
    }
  }

  return { processed, skipped };
}

// ── Public: compute reuse risk ───────────────────────────────────────

export function classifyReuseRisk(count: number): ReuseRisk {
  if (count <= REUSE_RISK_GREEN_MAX) return "green";
  if (count <= REUSE_RISK_YELLOW_MAX) return "yellow";
  return "red";
}

export async function computeReuseRisk(
  userId: string,
  concept: string,
): Promise<ReuseRisk> {
  const normalized = concept.trim().toLowerCase();
  if (normalized.length === 0) return "green";

  const supabase = createAdminClient();
  const since = new Date(
    Date.now() - REUSE_RISK_WINDOW_DAYS * 86_400_000,
  ).toISOString();

  const { count, error } = await supabase
    .from("concept_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("concept", normalized)
    .gte("seen_at", since);

  if (error) {
    throw new Error(
      `Failed to compute reuse risk for concept "${normalized}": ${error.message}`,
    );
  }

  return classifyReuseRisk(count ?? 0);
}
