/**
 * Data Confidence Tier
 *
 * Classifies a sample size (count of comparable posts) into one of five
 * confidence tiers. The rubric is defined in `src/lib/prompts/data-confidence.md`
 * and must stay in sync.
 *
 *   Directional  < 5  comparable posts
 *   Weak         5–9
 *   Usable       10–19
 *   Strong       20–49
 *   Deep         50+
 *
 * Pure util, no React imports — safe to reuse server-side.
 */

export type ConfidenceTier =
  | "directional"
  | "weak"
  | "usable"
  | "strong"
  | "deep";

export interface ConfidenceTierInfo {
  tier: ConfidenceTier;
  label: string;
  suggestedCopy: string;
}

const TIER_LABEL: Record<ConfidenceTier, string> = {
  directional: "Directional",
  weak: "Weak",
  usable: "Usable",
  strong: "Strong",
  deep: "Deep",
};

const TIER_COPY: Record<ConfidenceTier, string> = {
  directional: "Sample is too small to call a pattern yet.",
  weak: "There's a lean here, but confidence is low.",
  usable: "Stable enough to guide decisions; still sensitive to outliers.",
  strong: "Reliable baseline — one outlier doesn't move the aggregate.",
  deep: "Cross-dimensional patterns hold in your data.",
};

/**
 * Classify a sample size into a confidence tier.
 *
 * When `tier === "directional"` (fewer than 5 comparable posts), callers
 * should opt into a "description-only" mode — hide confident-looking
 * numeric values (e.g., percentages, single-point predictions) and show
 * a prose observation with the count attached instead. The rubric in
 * `src/lib/prompts/data-confidence.md` explains why honest weak labels
 * beat confident wrong ones.
 *
 * Negative, NaN, or fractional inputs are clamped to a non-negative
 * integer by floor+max before classification.
 */
export function getConfidenceTier(sampleSize: number): ConfidenceTierInfo {
  const n =
    Number.isFinite(sampleSize) && sampleSize > 0
      ? Math.floor(sampleSize)
      : 0;

  let tier: ConfidenceTier;
  if (n < 5) tier = "directional";
  else if (n < 10) tier = "weak";
  else if (n < 20) tier = "usable";
  else if (n < 50) tier = "strong";
  else tier = "deep";

  return {
    tier,
    label: TIER_LABEL[tier],
    suggestedCopy: TIER_COPY[tier],
  };
}
