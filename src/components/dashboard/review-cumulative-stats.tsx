import { ArrowUp, ArrowDown, ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import type { BandVerdict } from "@/lib/review-sweep";
import type { BandDistribution, BaselineTrend } from "@/lib/prediction-reviews";
import { BAND_ORDER, BAND_STYLES } from "@/components/dashboard/band-palette";

interface ReviewCumulativeStatsProps {
  distribution: BandDistribution;
  trend: BaselineTrend | null;
}

function pct(count: number, total: number) {
  if (total <= 0) return 0;
  return (count / total) * 100;
}

function formatPct(value: number): string {
  const rounded = Math.round(value);
  return `${rounded}%`;
}

export function ReviewCumulativeStats({
  distribution,
  trend,
}: ReviewCumulativeStatsProps) {
  const { counts, total } = distribution;
  const ariaSummary = BAND_ORDER.map(
    (b) => `${counts[b]} ${BAND_STYLES[b].label.toLowerCase()}`,
  ).join(", ");

  return (
    <section className="rounded-[var(--radius-lg)] border-2 border-border bg-card p-6 shadow-[4px_4px_0_0_var(--muted)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">How your predictions land</h2>
        <p className="text-xs text-muted-foreground">
          {total} review{total === 1 ? "" : "s"} all-time
        </p>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No reviews yet. Predictions will score here once a post has been live
          for 24 hours.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Prediction distribution: ${ariaSummary}`}
            className="mt-4 flex h-4 w-full overflow-hidden rounded-full border border-border bg-muted"
          >
            {BAND_ORDER.filter((b) => counts[b] > 0).map((b) => (
              <span
                key={b}
                className={BAND_STYLES[b].bar}
                style={{ width: `${pct(counts[b], total)}%` }}
                title={`${BAND_STYLES[b].label}: ${counts[b]} (${formatPct(
                  pct(counts[b], total),
                )})`}
              />
            ))}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            {BAND_ORDER.map((b: BandVerdict) => (
              <li
                key={b}
                className="flex items-center gap-2 text-xs"
                title={BAND_STYLES[b].label}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 shrink-0 rounded-full", BAND_STYLES[b].dot)}
                />
                <span className="font-semibold text-foreground">
                  {counts[b]}
                </span>
                <span className="truncate text-muted-foreground">
                  {BAND_STYLES[b].shortLabel}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {formatPct(pct(counts[b], total))}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {trend ? <TrendLine trend={trend} /> : "Not enough reviews for a 30-day trend yet."}
          </div>
        </>
      )}
    </section>
  );
}

function TrendLine({ trend }: { trend: BaselineTrend }) {
  const abs = Math.abs(trend.deltaPct);
  const rounded = abs < 1 ? 0 : Math.round(abs);

  if (trend.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight weight="bold" className="size-3 text-muted-foreground" />
        Last 30 days: baseline hit-rate flat vs. the prior 30 ({formatPct(trend.last30Pct)} now).
      </span>
    );
  }

  const ArrowIcon = trend.direction === "up" ? ArrowUp : ArrowDown;
  const colorClass =
    trend.direction === "up" ? "text-quaternary" : "text-muted-foreground";

  return (
    <span className="inline-flex items-center gap-1.5">
      <ArrowIcon weight="bold" className={cn("size-3", colorClass)} />
      Last 30 days: baseline hit-rate {trend.direction} {rounded}% vs. the prior 30 ({formatPct(trend.last30Pct)} now).
    </span>
  );
}
