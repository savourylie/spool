import type { BandVerdict } from "@/lib/review-sweep";

/**
 * Visual palette for the five prediction bands.
 *
 * Deliberately distinct from the green/yellow/red freshness verdict palette
 * and from the ConfidenceBadge tier palette — those convey different things
 * (data-freshness vs. sample-size-confidence vs. hit-direction) and should
 * not collide visually. Mapped onto the Playful Geometric design tokens:
 *   baseline       → quaternary (emerald, "good calibration")
 *   above_optimistic → secondary (pink, "surprise beat")
 *   below_conservative → muted   ("underwhelmed")
 */
export interface BandStyle {
  label: string;
  shortLabel: string;
  bar: string;
  dot: string;
  chip: string;
  borderL: string;
}

export const BAND_STYLES: Record<BandVerdict, BandStyle> = {
  below_conservative: {
    label: "Below conservative",
    shortLabel: "Below",
    bar: "bg-muted-foreground/40",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    borderL: "border-l-muted-foreground",
  },
  conservative: {
    label: "Conservative",
    shortLabel: "Conservative",
    bar: "bg-primary/40",
    dot: "bg-primary",
    chip: "bg-primary/15 text-primary",
    borderL: "border-l-primary",
  },
  baseline: {
    label: "Baseline",
    shortLabel: "Baseline",
    bar: "bg-quaternary",
    dot: "bg-quaternary",
    chip: "bg-quaternary/25 text-foreground",
    borderL: "border-l-quaternary",
  },
  optimistic: {
    label: "Optimistic",
    shortLabel: "Optimistic",
    bar: "bg-quaternary/60",
    dot: "bg-quaternary/70",
    chip: "bg-quaternary/40 text-foreground",
    borderL: "border-l-quaternary",
  },
  above_optimistic: {
    label: "Above optimistic",
    shortLabel: "Above",
    bar: "bg-secondary",
    dot: "bg-secondary",
    chip: "bg-secondary/25 text-foreground",
    borderL: "border-l-secondary",
  },
};

/** Ordered list for rendering the stacked bar + legend. */
export const BAND_ORDER: readonly BandVerdict[] = [
  "below_conservative",
  "conservative",
  "baseline",
  "optimistic",
  "above_optimistic",
];
