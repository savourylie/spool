import { createHash } from "node:crypto";

import type { PredictionRange } from "@/lib/engagement-prediction";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/server";

type PostPredictionRow = Database["public"]["Tables"]["post_predictions"]["Row"];

export type PredictionId = PostPredictionRow["id"];

export const POST_PREDICTION_DRAFT_TEXT_LIMIT = 1000;
export const POST_PREDICTION_LINK_WINDOW_DAYS = 7;
export const POST_PREDICTION_SIMILARITY_THRESHOLD = 0.7;

interface SnapshotPredictionInput {
  userId: string;
  draftText: string;
  ranges: PredictionRange;
  driverFactors: Json;
}

interface MarkPredictionPublishedInput {
  userId: string;
  predictionId: PredictionId;
  draftText: string;
}

interface LinkPredictionToPostInput {
  userId: string;
  postId: string;
  postText: string | null | undefined;
  now?: Date;
}

export interface LinkedPredictionResult {
  predictionId: PredictionId;
  similarity: number;
}

function normalizeDraftText(text: string): string {
  return text.trim();
}

function hashDraftText(text: string): string {
  return createHash("sha256")
    .update(normalizeDraftText(text))
    .digest("hex");
}

function toStoredDraftText(text: string): string | null {
  const normalized = normalizeDraftText(text);
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, POST_PREDICTION_DRAFT_TEXT_LIMIT);
}

function normalizeSimilarityText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function toTrigramSet(text: string): Set<string> {
  const normalized = normalizeSimilarityText(text);
  if (!normalized) {
    return new Set();
  }

  if (normalized.length < 3) {
    return new Set([normalized]);
  }

  const padded = `  ${normalized}  `;
  const trigrams = new Set<string>();

  for (let index = 0; index <= padded.length - 3; index += 1) {
    trigrams.add(padded.slice(index, index + 3));
  }

  return trigrams;
}

export function jaccardTrigramSimilarity(a: string, b: string): number {
  const aTrigrams = toTrigramSet(a);
  const bTrigrams = toTrigramSet(b);

  if (aTrigrams.size === 0 || bTrigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const trigram of aTrigrams) {
    if (bTrigrams.has(trigram)) {
      intersection += 1;
    }
  }

  const union = aTrigrams.size + bTrigrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function snapshotPrediction({
  userId,
  draftText,
  ranges,
  driverFactors,
}: SnapshotPredictionInput): Promise<PredictionId> {
  const normalizedDraftText = normalizeDraftText(draftText);
  if (!normalizedDraftText) {
    throw new Error("Draft text is required");
  }

  const supabase = createAdminClient();
  const draftTextHash = hashDraftText(normalizedDraftText);

  const { data: existingPrediction, error: existingError } = await supabase
    .from("post_predictions")
    .select("id")
    .eq("user_id", userId)
    .eq("draft_text_hash", draftTextHash)
    .is("post_id", null)
    .eq("review_state", "pending")
    .order("predicted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingPrediction?.id) {
    return existingPrediction.id;
  }

  const { data: insertedPrediction, error: insertError } = await supabase
    .from("post_predictions")
    .insert({
      user_id: userId,
      draft_text_hash: draftTextHash,
      ranges: {
        p25: ranges.p25,
        p50: ranges.p50,
        p75: ranges.p75,
        matchedCount: ranges.matchedCount,
        confidence: ranges.confidence,
      },
      driver_factors: driverFactors,
    })
    .select("id")
    .single();

  if (insertError || !insertedPrediction) {
    throw insertError ?? new Error("Failed to create post prediction");
  }

  return insertedPrediction.id;
}

export async function markPredictionPublished({
  userId,
  predictionId,
  draftText,
}: MarkPredictionPublishedInput): Promise<void> {
  const normalizedDraftText = normalizeDraftText(draftText);
  const storedDraftText = toStoredDraftText(normalizedDraftText);

  if (!storedDraftText) {
    throw new Error("Draft text is required");
  }

  const supabase = createAdminClient();
  const { data: updatedPrediction, error: updateError } = await supabase
    .from("post_predictions")
    .update({
      draft_text_hash: hashDraftText(normalizedDraftText),
      draft_text: storedDraftText,
    })
    .eq("id", predictionId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (updateError || !updatedPrediction) {
    throw updateError ?? new Error("Failed to update published prediction");
  }
}

export async function linkPredictionToPost({
  userId,
  postId,
  postText,
  now = new Date(),
}: LinkPredictionToPostInput): Promise<LinkedPredictionResult | null> {
  const normalizedPostText = normalizeDraftText(postText ?? "");
  if (!normalizedPostText) {
    return null;
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - POST_PREDICTION_LINK_WINDOW_DAYS);

  const supabase = createAdminClient();
  const { data: candidatePredictions, error: candidatesError } = await supabase
    .from("post_predictions")
    .select("id, draft_text")
    .eq("user_id", userId)
    .is("post_id", null)
    .not("draft_text", "is", null)
    .eq("review_state", "pending")
    .gte("predicted_at", cutoff.toISOString())
    .order("predicted_at", { ascending: false });

  if (candidatesError) {
    throw candidatesError;
  }

  let bestMatch: LinkedPredictionResult | null = null;

  for (const candidate of candidatePredictions ?? []) {
    if (!candidate.draft_text) {
      continue;
    }

    const similarity = jaccardTrigramSimilarity(
      normalizedPostText,
      candidate.draft_text,
    );

    if (similarity < POST_PREDICTION_SIMILARITY_THRESHOLD) {
      continue;
    }

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = {
        predictionId: candidate.id,
        similarity,
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  const { data: linkedPrediction, error: updateError } = await supabase
    .from("post_predictions")
    .update({ post_id: postId })
    .eq("id", bestMatch.predictionId)
    .eq("user_id", userId)
    .is("post_id", null)
    .eq("review_state", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!linkedPrediction) {
    return null;
  }

  return bestMatch;
}
