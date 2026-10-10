import { cn } from "@/lib/utils";
import {
  getConfidenceTier,
  type ConfidenceTier,
} from "@/lib/data-confidence";

const TIER_STYLES: Record<ConfidenceTier, string> = {
  directional: "bg-paper-3 text-ink-3",
  weak: "bg-warn-soft text-warn",
  usable: "bg-accent-soft text-accent",
  strong: "bg-pos-soft text-pos",
  deep: "bg-pos text-[var(--paper)]",
};

const TIER_TOOLTIP: Record<ConfidenceTier, string> = {
  directional:
    "Directional confidence — fewer than 5 comparable posts. Sample is too small to call a pattern.",
  weak:
    "Weak confidence — 5–9 comparable posts. Enough to notice a lean, not enough for evidence.",
  usable:
    "Usable confidence — 10–19 comparable posts. Guides decisions but sensitive to outliers.",
  strong:
    "Strong confidence — 20–49 comparable posts. Reliable working baseline.",
  deep:
    "Deep confidence — 50+ comparable posts. Cross-dimensional patterns hold.",
};

interface ConfidenceBadgeProps {
  /** Count of comparable posts backing the claim. */
  sample: number;
  /**
   * Optional override. If omitted, tier is derived from `sample` via
   * {@link getConfidenceTier}. Pass explicitly only when the surface
   * has already computed the tier or needs to display a non-standard
   * label (e.g. when falling back to platform benchmarks).
   */
  tier?: ConfidenceTier;
  /** Hide the " · N posts" suffix for tight spaces. Tier label still shows. */
  compact?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  sample,
  tier: tierOverride,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  const info = getConfidenceTier(sample);
  const tier = tierOverride ?? info.tier;
  const clampedSample =
    Number.isFinite(sample) && sample > 0 ? Math.floor(sample) : 0;

  return (
    <span
      role="status"
      title={TIER_TOOLTIP[tier]}
      aria-label={`${info.label} confidence, based on ${clampedSample} post${clampedSample === 1 ? "" : "s"}. ${TIER_TOOLTIP[tier]}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] whitespace-nowrap",
        TIER_STYLES[tier],
        className,
      )}
    >
      <span>{info.label}</span>
      {!compact && (
        <>
          <span aria-hidden="true">&middot;</span>
          <span>
            {clampedSample} post{clampedSample === 1 ? "" : "s"}
          </span>
        </>
      )}
    </span>
  );
}
