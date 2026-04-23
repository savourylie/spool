/**
 * Brand Voice — pure type + constant module.
 *
 * Split from `brand-voice.ts` so client components can import the
 * types and the dimension tuple without dragging in the server-only
 * `fs` reads inside the prompt loader.
 */

import type { ConfidenceTier } from "@/lib/data-confidence";

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
