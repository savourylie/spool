"use client";

import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";

import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { RangeBar } from "@/components/dashboard/range-bar";
import {
  type PredictionResult,
  type LLMRefinement,
} from "@/lib/engagement-prediction";

// ── Types ────────────────────────────────────────────────────────────

interface PredictionWidgetProps {
  prediction: PredictionResult;
  llmRefinement?: LLMRefinement | null;
  isRefining?: boolean;
  showConfidenceBadge?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const CONFIDENCE_STYLES = {
  high: "bg-quaternary/20 text-quaternary",
  medium: "bg-tertiary/20 text-tertiary",
  low: "bg-muted text-muted-foreground",
} as const;

// ── Component ────────────────────────────────────────────────────────

export function PredictionWidget({
  prediction,
  llmRefinement,
  isRefining,
  showConfidenceBadge = false,
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
      <p className="font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Predicted Views
      </p>

      {/* Statistical range bar */}
      <RangeBar p25={range.p25} p50={range.p50} p75={range.p75} />

      {/* Confidence + match count */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none ${CONFIDENCE_STYLES[range.confidence]}`}
        >
          {range.confidence}
        </span>
        {showConfidenceBadge ? (
          <ConfidenceBadge
            sample={range.matchedCount}
            className="px-2 py-0.5 text-[10px]"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Based on {range.matchedCount} similar posts
          </span>
        )}
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
