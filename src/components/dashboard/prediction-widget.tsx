"use client";

import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";

import {
  formatNumber,
  type PredictionResult,
  type LLMRefinement,
} from "@/lib/engagement-prediction";

// ── Types ────────────────────────────────────────────────────────────

interface PredictionWidgetProps {
  prediction: PredictionResult;
  llmRefinement?: LLMRefinement | null;
  isRefining?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const CONFIDENCE_STYLES = {
  high: "bg-quaternary/20 text-quaternary",
  medium: "bg-tertiary/20 text-tertiary",
  low: "bg-muted text-muted-foreground",
} as const;

function RangeBar({
  p25,
  p50,
  p75,
  label,
}: {
  p25: number;
  p50: number;
  p75: number;
  label?: string;
}) {
  // Scale: 0 to max where max gives some headroom beyond p75
  const max = Math.max(p75 * 1.5, p75 + 100, 1);
  const leftPct = (p25 / max) * 100;
  const widthPct = ((p75 - p25) / max) * 100;
  const markerPct = (p50 / max) * 100;

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}

      {/* Bar track */}
      <div className="relative h-6 overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-muted">
        {/* Range fill (p25 – p75) */}
        <div
          className="absolute inset-y-0 bg-primary/20 transition-all duration-300 [transition-timing-function:var(--ease-bounce)]"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        {/* P50 marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-primary transition-all duration-300 [transition-timing-function:var(--ease-bounce)]"
          style={{ left: `${markerPct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          Low: {formatNumber(p25)}
        </span>
        <span className="font-bold text-primary">
          {formatNumber(p50)}
        </span>
        <span className="text-muted-foreground">
          High: {formatNumber(p75)}
        </span>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function PredictionWidget({
  prediction,
  llmRefinement,
  isRefining,
}: PredictionWidgetProps) {
  if (prediction.status === "insufficient_data") {
    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground">
          Need at least {prediction.required} posts for predictions (
          {prediction.totalPosts} imported so far).
        </p>
      </div>
    );
  }

  const { range } = prediction;

  return (
    <div className="space-y-3 py-2">
      {/* Title */}
      <p className="font-heading text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Predicted Views
      </p>

      {/* Statistical range bar */}
      <RangeBar p25={range.p25} p50={range.p50} p75={range.p75} />

      {/* Confidence + match count */}
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none ${CONFIDENCE_STYLES[range.confidence]}`}
        >
          {range.confidence}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Based on {range.matchedCount} similar posts
        </span>
      </div>

      {/* LLM refinement */}
      {isRefining && (
        <div className="flex items-center gap-1.5 pt-1">
          <SpinnerGap
            weight="bold"
            className="size-3.5 animate-spin text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground">
            Adjusting prediction...
          </span>
        </div>
      )}

      {llmRefinement && !isRefining && (
        <div className="space-y-2 border-t border-border pt-2">
          <RangeBar
            p25={llmRefinement.adjustedP25}
            p50={llmRefinement.adjustedP50}
            p75={llmRefinement.adjustedP75}
            label="AI-adjusted"
          />
          {llmRefinement.reasoning && (
            <p className="text-[10px] italic text-muted-foreground">
              {llmRefinement.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
