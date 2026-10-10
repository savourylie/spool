import { formatNumber } from "@/lib/engagement-prediction";

interface RangeBarProps {
  p25: number;
  p50: number;
  p75: number;
  label?: string;
}

/**
 * Visual p25–p75 range bar with a p50 marker. Used by the prediction widget
 * on Composer and by the Reviews page timeline cards. Degenerate ranges
 * (`p25 === p75 === 0` and similar) render as a thin sliver rather than
 * dividing by zero.
 */
export function RangeBar({ p25, p50, p75, label }: RangeBarProps) {
  const max = Math.max(p75 * 1.5, p75 + 100, 1);
  const leftPct = (p25 / max) * 100;
  const widthPct = Math.max(((p75 - p25) / max) * 100, 0.5);
  const markerPct = (p50 / max) * 100;

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}

      <div className="relative h-6 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted">
        <div
          className="absolute inset-y-0 bg-primary/20 transition-all duration-300 [transition-timing-function:var(--ease-bounce)]"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-primary transition-all duration-300 [transition-timing-function:var(--ease-bounce)]"
          style={{ left: `${markerPct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Low: {formatNumber(p25)}</span>
        <span className="font-bold text-primary">{formatNumber(p50)}</span>
        <span className="text-muted-foreground">High: {formatNumber(p75)}</span>
      </div>
    </div>
  );
}
