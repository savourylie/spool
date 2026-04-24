/**
 * Band verdict presentation map — shared by Today Hub Latest Review card (#076)
 * and Reviews Page (#075). Keeps label + Tailwind classes colocated so both
 * surfaces render the 5-band palette identically.
 *
 * Palette follows the #075 visual reference: gray / blue / green / emerald /
 * violet. Tailwind utilities are used directly (rather than design-token
 * aliases) because the design system has only four accent tokens and this
 * palette needs five distinct steps.
 */

import type { BandVerdict } from "@/lib/review-sweep";

export interface BandVerdictStyle {
  /** Human-readable chip label. */
  label: string;
  /** Tailwind classes for a chip/badge (includes bg, text, border). */
  chipClass: string;
  /** Solid fill for bars, markers, and accents. */
  barClass: string;
  /** Left-border accent for review cards on the Reviews page (#075). */
  leftBorderClass: string;
}

export const BAND_VERDICT_STYLES: Record<BandVerdict, BandVerdictStyle> = {
  below_conservative: {
    label: "Below conservative",
    chipClass: "bg-muted text-muted-foreground border-border",
    barClass: "bg-muted-foreground",
    leftBorderClass: "border-l-muted-foreground",
  },
  conservative: {
    label: "Conservative",
    chipClass:
      "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-300",
    barClass: "bg-blue-500",
    leftBorderClass: "border-l-blue-500",
  },
  baseline: {
    label: "Baseline",
    chipClass:
      "bg-green-500/15 text-green-700 border-green-500/40 dark:text-green-300",
    barClass: "bg-green-500",
    leftBorderClass: "border-l-green-500",
  },
  optimistic: {
    label: "Optimistic",
    chipClass:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
    barClass: "bg-emerald-500",
    leftBorderClass: "border-l-emerald-500",
  },
  above_optimistic: {
    label: "Above optimistic",
    chipClass:
      "bg-violet-500/15 text-violet-700 border-violet-500/40 dark:text-violet-300",
    barClass: "bg-violet-500",
    leftBorderClass: "border-l-violet-500",
  },
};
