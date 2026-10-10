"use client";

import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { EmptyState } from "@/components/ui/empty-state";
import { getTimingEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import { cn } from "@/lib/utils";
import type {
  BestSlot,
  MiniHeatmapCell,
  CadenceStatus,
} from "@/lib/today-hub-helpers";

// ── Heatmap color scale (monochrome ink ramp) ───────────────────────

const INTENSITY_COLORS = [
  "var(--paper-2)",    // 0 — empty
  "var(--paper-3)",    // 1
  "var(--line-strong)", // 2
  "var(--ink-4)",      // 3
  "var(--ink-3)",      // 4
  "var(--ink)",        // 5 — full intensity
] as const;

function intensityToColor(t: number): string {
  const idx = Math.round(t * (INTENSITY_COLORS.length - 1));
  return INTENSITY_COLORS[Math.max(0, Math.min(idx, INTENSITY_COLORS.length - 1))];
}

// ── Cadence status styling ────────────────────────────────────────────

const CADENCE_CONFIG: Record<
  CadenceStatus,
  { dotClass: string; label: (hours: number) => string }
> = {
  on_track: {
    dotClass: "bg-quaternary",
    label: (h) => `Cadence: On track (last post ${Math.round(h)}h ago)`,
  },
  due: {
    dotClass: "bg-tertiary",
    label: (h) => `Cadence: Due (last post ${Math.round(h)}h ago)`,
  },
  overdue: {
    dotClass: "bg-destructive",
    label: (h) =>
      h === Infinity
        ? "Cadence: No posts yet"
        : `Cadence: Overdue (last post ${Math.round(h)}h ago)`,
  },
};

// ── Day labels for heatmap columns ────────────────────────────────────

const MINI_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const PERIOD_LABELS = ["AM", "PM", "Eve"] as const;

// ── Component ─────────────────────────────────────────────────────────

interface WhenToPostCardProps {
  bestSlot: BestSlot | null;
  heatmapData: MiniHeatmapCell[];
  cadenceStatus: CadenceStatus;
  lastPostHoursAgo: number;
  isLoading?: boolean;
  isImporting?: boolean;
  className?: string;
}

export function WhenToPostCard({
  bestSlot,
  heatmapData,
  cadenceStatus,
  lastPostHoursAgo,
  isLoading = false,
  isImporting = false,
  className,
}: WhenToPostCardProps) {
  const emptyStateCopy = getTimingEmptyStateCopy(isImporting);
  const cadence = CADENCE_CONFIG[cadenceStatus];
  const isEmpty = !bestSlot && heatmapData.length === 0;

  // Build a lookup: heatmapData[dayIndex * 3 + periodIndex]
  const heatLookup = new Map<string, number>();
  for (const cell of heatmapData) {
    heatLookup.set(`${cell.dayIndex}-${cell.periodIndex}`, cell.intensity);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock weight="bold" className="size-5 text-primary" />
        <h3 className="font-heading text-base font-medium">When to Post</h3>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] bg-muted/50 p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-border" />
            <div className="h-6 w-40 animate-pulse rounded bg-border" />
            <div className="h-3 w-44 animate-pulse rounded bg-border" />
          </div>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-1">
            {Array.from({ length: 3 }, (_, r) => (
              <div key={r} className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (__, c) => (
                  <div key={c} className="h-6 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ))}
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <EmptyState
          icon={<Clock weight="bold" className="size-7" />}
          iconColor="secondary"
          title={emptyStateCopy.title}
          description={emptyStateCopy.description}
          className="py-6"
        />
      )}

      {/* Content */}
      {!isLoading && !isEmpty && (
        <>
          {/* Next best slot */}
          {bestSlot && (
            <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] bg-primary/5 px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                NEXT BEST SLOT
              </span>
              <span className="font-heading text-xl font-medium text-foreground">
                {bestSlot.dayLabel}, {bestSlot.timeLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {bestSlot.avgEngagement.toFixed(1)}% avg engagement at this time
              </span>
            </div>
          )}

          {/* Mini heatmap label */}
          <span className="text-xs font-semibold text-muted-foreground">
            This week&apos;s heat
          </span>

          {/* Mini 3x7 heatmap */}
          <div
            className="flex flex-col gap-1"
            role="img"
            aria-label="Mini heatmap showing engagement by day and time of day"
          >
            {/* Day labels */}
            <div className="grid grid-cols-7 gap-1">
              {MINI_DAY_LABELS.map((label, i) => (
                <span
                  key={`day-${i}`}
                  className="text-center text-[10px] text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Heat rows (AM, PM, Evening) */}
            {PERIOD_LABELS.map((periodLabel, periodIdx) => (
              <div key={periodLabel} className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const intensity = heatLookup.get(`${dayIdx}-${periodIdx}`) ?? 0;
                  return (
                    <div
                      key={`${dayIdx}-${periodIdx}`}
                      className="h-6 rounded"
                      style={{ backgroundColor: intensityToColor(intensity) }}
                      title={`${MINI_DAY_LABELS[dayIdx]} ${periodLabel}: ${Math.round(intensity * 100)}% intensity`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Cadence status */}
          <div className="flex items-center gap-2">
            <span
              className={cn("size-2 shrink-0 rounded-full", cadence.dotClass)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {cadence.label(lastPostHoursAgo)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
