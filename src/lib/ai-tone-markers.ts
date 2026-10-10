/**
 * AI-tone marker taxonomy for the Scanner.
 *
 * IDs map the `ai-detection.md` knowledge file into stable UI groups:
 * S01-S10 are sentence-level, ST01-ST05 are structure-level, and C01-C05
 * are content-level markers.
 */

export type AiToneMarkerCategory = "sentence" | "structure" | "content";

export type AiToneMarkerId =
  | "S01"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08"
  | "S09"
  | "S10"
  | "ST01"
  | "ST02"
  | "ST03"
  | "ST04"
  | "ST05"
  | "C01"
  | "C02"
  | "C03"
  | "C04"
  | "C05";

export interface AiToneMarkerDefinition {
  id: AiToneMarkerId;
  category: AiToneMarkerCategory;
  title: string;
  hint: string;
}

export interface AiToneRemediation {
  id: string;
  title: string;
  description: string;
}

export const AI_TONE_MARKERS: AiToneMarkerDefinition[] = [
  {
    id: "S01",
    category: "sentence",
    title: "Canned liveness phrases",
    hint: "Predictable phrases like \"here's the thing\" or \"let's be real\".",
  },
  {
    id: "S02",
    category: "sentence",
    title: "Over-symmetric contrast",
    hint: "Neat \"not X, but Y\" or \"stop X, start Y\" contrast.",
  },
  {
    id: "S03",
    category: "sentence",
    title: "High gold-sentence density",
    hint: "Too many back-to-back lines that all sound quotable.",
  },
  {
    id: "S04",
    category: "sentence",
    title: "Performative transitions",
    hint: "Announced pivots like \"here's where it gets interesting\".",
  },
  {
    id: "S05",
    category: "sentence",
    title: "Rhetorical-question closures",
    hint: "A closing question standing in for the argument.",
  },
  {
    id: "S06",
    category: "sentence",
    title: "Too-complete causal chains",
    hint: "One sentence carries cause, deeper cause, and meta-cause.",
  },
  {
    id: "S07",
    category: "sentence",
    title: "Formal connectors",
    hint: "Essay connectors like furthermore, moreover, or consequently.",
  },
  {
    id: "S08",
    category: "sentence",
    title: "Uniform bullet lists",
    hint: "Items share the same length, shape, and rhythm.",
  },
  {
    id: "S09",
    category: "sentence",
    title: "Labeled-emotion intros",
    hint: "Emotion labels like shockingly or fascinatingly lead the sentence.",
  },
  {
    id: "S10",
    category: "sentence",
    title: "Philosophical closers",
    hint: "Specifics suddenly become a broad cosmic lesson.",
  },
  {
    id: "ST01",
    category: "structure",
    title: "Frictionless argument",
    hint: "Every paragraph moves cleanly forward with no caveat or detour.",
  },
  {
    id: "ST02",
    category: "structure",
    title: "Over-complete close",
    hint: "The ending restates, gives steps, and adds a CTA.",
  },
  {
    id: "ST03",
    category: "structure",
    title: "Tidy paragraph closes",
    hint: "Every paragraph ends with a neat summary beat.",
  },
  {
    id: "ST04",
    category: "structure",
    title: "Perfect narrative arc",
    hint: "Hook, context, tension, turn, and resolution land too cleanly.",
  },
  {
    id: "ST05",
    category: "structure",
    title: "Uniform info density",
    hint: "Paragraphs carry the same weight and amount of new information.",
  },
  {
    id: "C01",
    category: "content",
    title: "Unsourced hanging numbers",
    hint: "Precise numbers appear without source, sample, or qualifier.",
  },
  {
    id: "C02",
    category: "content",
    title: "One-directional evidence",
    hint: "Every example supports the conclusion with no counter-case.",
  },
  {
    id: "C03",
    category: "content",
    title: "Abstract claim, no concrete case",
    hint: "Broad claims appear without a named niche, timeframe, or result.",
  },
  {
    id: "C04",
    category: "content",
    title: "Too-neutral stance",
    hint: "The draft avoids a clear opinion with calibrated balance.",
  },
  {
    id: "C05",
    category: "content",
    title: "Unnecessary knowledge display",
    hint: "Background appears to look informed rather than advance the point.",
  },
];

export const AI_TONE_REMEDIATIONS: AiToneRemediation[] = [
  {
    id: "method-1",
    title: "Anchor to a concrete case",
    description: "Replace abstraction with a specific niche, timeframe, and result.",
  },
  {
    id: "method-2",
    title: "Admit a prior misread",
    description: "Show where your judgment changed instead of delivering the conclusion fully formed.",
  },
  {
    id: "method-3",
    title: "Acknowledge an exception",
    description: "Add the case that partly weakens the argument.",
  },
  {
    id: "method-4",
    title: "Hedge numbers with source or feel",
    description: "Qualify precise numbers with source, sample, or uncertainty.",
  },
  {
    id: "method-5",
    title: "Leave imperfect phrasing in",
    description: "Keep one sentence slightly messy when that is how the thought arrived.",
  },
  {
    id: "method-6",
    title: "Close with what I do",
    description: "End on your own next move instead of a generic reader checklist.",
  },
];

export const AI_TONE_MARKERS_BY_ID: Record<AiToneMarkerId, AiToneMarkerDefinition> =
  AI_TONE_MARKERS.reduce(
    (acc, marker) => {
      acc[marker.id] = marker;
      return acc;
    },
    {} as Record<AiToneMarkerId, AiToneMarkerDefinition>,
  );

export function getAiToneMarker(
  id: string,
): AiToneMarkerDefinition | null {
  return AI_TONE_MARKERS_BY_ID[id as AiToneMarkerId] ?? null;
}
