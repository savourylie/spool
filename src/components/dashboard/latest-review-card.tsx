"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BookOpen } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown";

import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestReviewEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import { formatNumber } from "@/lib/engagement-prediction";
import { BAND_VERDICT_STYLES } from "@/lib/band-verdict-styles";
import type { LatestReviewData } from "@/lib/latest-review";
import { cn } from "@/lib/utils";

interface LatestReviewCardProps {
  review: LatestReviewData | null;
  isImporting?: boolean;
  className?: string;
}

const REVIEWS_ROUTE = "/dashboard/understand/reviews";

export function LatestReviewCard({
  review,
  isImporting = false,
  className,
}: LatestReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen weight="fill" className="size-5 text-primary" />
          <h3 className="font-heading text-base font-bold">Latest review</h3>
        </div>
        {review && <BandVerdictChip verdict={review.verdict} />}
      </div>

      {!review ? (
        <EmptyStateView isImporting={isImporting} />
      ) : (
        <ReviewBody
          review={review}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded((prev) => !prev)}
          shouldReduceMotion={shouldReduceMotion ?? false}
        />
      )}
    </div>
  );
}

// ── Subviews ─────────────────────────────────────────────────────────

function EmptyStateView({ isImporting }: { isImporting: boolean }) {
  const copy = getLatestReviewEmptyStateCopy(isImporting);
  return (
    <EmptyState
      icon={<BookOpen weight="bold" className="size-7" />}
      iconColor="primary"
      title={copy.title}
      description={copy.description}
      className="py-6"
    />
  );
}

function BandVerdictChip({
  verdict,
}: {
  verdict: LatestReviewData["verdict"];
}) {
  const style = BAND_VERDICT_STYLES[verdict];
  return (
    <span
      role="status"
      aria-label={`Verdict: ${style.label}`}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        style.chipClass,
      )}
    >
      {style.label}
    </span>
  );
}

function ReviewBody({
  review,
  isExpanded,
  onToggleExpand,
  shouldReduceMotion,
}: {
  review: LatestReviewData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  shouldReduceMotion: boolean;
}) {
  const { textPreview, mediaType, ranges, actual, verdict, keyLearning, matchedCount } = review;
  // Inline the degenerate-range check so this client bundle doesn't pull the
  // review-sweep module (which depends on the fs-using prompt loader).
  const degenerate = ranges.p25 === ranges.p50 && ranges.p50 === ranges.p75;

  const instant = { duration: 0 };
  const spring = { type: "spring" as const, stiffness: 300, damping: 25 };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] bg-muted px-5 py-4">
        {textPreview ? (
          <p className="line-clamp-2 text-[13px] font-semibold leading-relaxed text-foreground">
            {textPreview}
          </p>
        ) : (
          <p className="text-[13px] italic text-muted-foreground">
            [{(mediaType ?? "text").toLowerCase()} post]
          </p>
        )}
        {degenerate ? (
          <DegenerateActualLine actual={actual.views} />
        ) : (
          <DeltaBar
            p25={ranges.p25}
            p50={ranges.p50}
            p75={ranges.p75}
            actualViews={actual.views}
            verdict={verdict}
          />
        )}
      </div>

      {keyLearning && (
        <p className="line-clamp-1 text-xs italic text-muted-foreground">
          {keyLearning}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {isExpanded ? "Hide details" : "Show details"}
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={shouldReduceMotion ? instant : spring}
            className="inline-flex"
          >
            <CaretDown weight="bold" className="size-3" />
          </motion.span>
        </button>
        {/* prefetch disabled until #075 ships */}
        <Link
          href={REVIEWS_ROUTE}
          prefetch={false}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          See full review
          <ArrowRight weight="bold" className="size-3" />
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? instant : spring}
            style={{ overflow: "hidden" }}
          >
            <ExpandedDetail
              ranges={ranges}
              actualViews={actual.views}
              verdict={verdict}
              matchedCount={matchedCount}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DegenerateActualLine({ actual }: { actual: number }) {
  return (
    <p
      className="text-xs text-muted-foreground"
      aria-label={`Actual views: ${actual}`}
    >
      Actual: <span className="font-semibold text-foreground">{formatNumber(actual)}</span> views
      <span className="ml-2 text-[10px] italic">(no range to compare)</span>
    </p>
  );
}

function DeltaBar({
  p25,
  p50,
  p75,
  actualViews,
  verdict,
}: {
  p25: number;
  p50: number;
  p75: number;
  actualViews: number;
  verdict: LatestReviewData["verdict"];
}) {
  const max = Math.max(p75 * 1.5, actualViews * 1.1, p75 + 100, 1);
  const leftPct = (p25 / max) * 100;
  const widthPct = ((p75 - p25) / max) * 100;
  const p50Pct = (p50 / max) * 100;
  const actualPct = Math.min(100, (actualViews / max) * 100);

  const deltaPct = p50 > 0 ? ((actualViews - p50) / p50) * 100 : 0;
  const withinBaseline = Math.abs(deltaPct) < 5;
  const deltaTone = withinBaseline
    ? "text-muted-foreground"
    : deltaPct > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-tertiary";

  const style = BAND_VERDICT_STYLES[verdict];

  return (
    <div
      className="flex items-center gap-3"
      role="img"
      aria-label={`Predicted ${formatNumber(p25)} to ${formatNumber(p75)} views with midpoint ${formatNumber(p50)}, actual ${formatNumber(actualViews)}, ${style.label}.`}
    >
      <div className="relative h-3 flex-1 overflow-hidden rounded-full border border-border bg-background">
        <div
          className="absolute inset-y-0 bg-primary/20"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-primary/70"
          style={{ left: `${p50Pct}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
            style.barClass,
          )}
          style={{ left: `${actualPct}%` }}
        />
      </div>
      <span className={cn("flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap", deltaTone)}>
        {withinBaseline ? (
          <span aria-hidden>≈</span>
        ) : deltaPct > 0 ? (
          <ArrowUp weight="bold" className="size-3" />
        ) : (
          <ArrowDown weight="bold" className="size-3" />
        )}
        {formatPercent(deltaPct)}
      </span>
    </div>
  );
}

function ExpandedDetail({
  ranges,
  actualViews,
  verdict,
  matchedCount,
}: {
  ranges: LatestReviewData["ranges"];
  actualViews: number;
  verdict: LatestReviewData["verdict"];
  matchedCount: number;
}) {
  const style = BAND_VERDICT_STYLES[verdict];
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Predicted range (views)
        </span>
        <ConfidenceBadge sample={matchedCount} compact />
      </div>
      <ExpandedRangeBar
        p25={ranges.p25}
        p50={ranges.p50}
        p75={ranges.p75}
        actualViews={actualViews}
        markerClass={style.barClass}
      />
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          Low: {formatNumber(ranges.p25)}
        </span>
        <span className="font-bold text-primary">
          {formatNumber(ranges.p50)}
        </span>
        <span className="text-muted-foreground">
          High: {formatNumber(ranges.p75)}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-semibold text-foreground">
          {formatNumber(actualViews)} views
        </span>
      </div>
    </div>
  );
}

function ExpandedRangeBar({
  p25,
  p50,
  p75,
  actualViews,
  markerClass,
}: {
  p25: number;
  p50: number;
  p75: number;
  actualViews: number;
  markerClass: string;
}) {
  const max = Math.max(p75 * 1.5, actualViews * 1.1, p75 + 100, 1);
  const leftPct = (p25 / max) * 100;
  const widthPct = ((p75 - p25) / max) * 100;
  const markerPct = (p50 / max) * 100;
  const actualPct = Math.min(100, (actualViews / max) * 100);

  return (
    <div className="relative h-5 overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-muted">
      <div
        className="absolute inset-y-0 bg-primary/20"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
      <div
        className="absolute inset-y-0 w-0.5 bg-primary"
        style={{ left: `${markerPct}%` }}
      />
      <div
        className={cn(
          "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
          markerClass,
        )}
        style={{ left: `${actualPct}%` }}
      />
    </div>
  );
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  if (Math.abs(value) < 0.05) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
