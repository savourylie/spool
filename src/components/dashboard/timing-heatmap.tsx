"use client";

import { useState, useSyncExternalStore, useMemo, useCallback } from "react";
import { Clock } from "@phosphor-icons/react";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getTimingEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TimingPost = {
  published_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
};

type Bucket = { count: number; totalEngRate: number; totalViews: number };
type Grid = Bucket[][];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12a";
  if (i < 12) return `${i}a`;
  if (i === 12) return "12p";
  return `${i - 12}p`;
});

const MIN_POSTS_FOR_CELL = 2;

const BLOCK_LABELS = ["12a\u20134a", "4a\u20138a", "8a\u201312p", "12p\u20134p", "4p\u20138p", "8p\u201312a"] as const;
const HOURS_PER_BLOCK = 4;
const NUM_BLOCKS = 6;

export function formatSlot(day: number, hour: number): string {
  const timeStr =
    hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
  return `${DAY_LABELS[day]} ${timeStr}`;
}

/* ------------------------------------------------------------------ */
/*  Color interpolation                                                */
/* ------------------------------------------------------------------ */

// Monochrome ink ramp: paper-2 (empty) → ink (full intensity), theme-aware.
function interpolateColor(t: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, t)) * 100);
  return `color-mix(in oklab, var(--ink) ${pct}%, var(--paper-2))`;
}

/* ------------------------------------------------------------------ */
/*  Timezone helpers                                                   */
/* ------------------------------------------------------------------ */

function getGroupedTimezones(): Record<string, string[]> {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Australia/Sydney",
    ];
  }

  const grouped: Record<string, string[]> = {};
  for (const tz of zones) {
    const slash = tz.indexOf("/");
    const continent = slash > -1 ? tz.slice(0, slash) : "Other";
    if (!grouped[continent]) grouped[continent] = [];
    grouped[continent].push(tz);
  }
  return grouped;
}

/* ------------------------------------------------------------------ */
/*  Tooltip component                                                  */
/* ------------------------------------------------------------------ */

function CellTooltip({
  bucket,
  day,
  hour,
  x,
  y,
}: {
  bucket: Bucket;
  day: number;
  hour: number;
  x: number;
  y: number;
}) {
  const avgEng = bucket.count > 0 ? bucket.totalEngRate / bucket.count : 0;
  const avgViews = bucket.count > 0 ? Math.round(bucket.totalViews / bucket.count) : 0;

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[calc(100vw-2rem)] rounded-[var(--radius-sm)] border border-foreground bg-card px-3 py-2 text-xs shadow-[var(--shadow-default)]"
      style={{ left: Math.max(120, Math.min(x, typeof window !== "undefined" ? window.innerWidth - 120 : x)), top: y, transform: "translate(-50%, -110%)" }}
    >
      <p className="font-heading font-medium">
        {DAY_LABELS[day]} {hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`}
      </p>
      <p>{bucket.count} post{bucket.count !== 1 ? "s" : ""}</p>
      <p>Avg engagement: {avgEng.toFixed(2)}%</p>
      <p>Avg views: {avgViews.toLocaleString()}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banners                                                            */
/* ------------------------------------------------------------------ */

function LowDataBanner({ count }: { count: number }) {
  return (
    <div className="mb-4 rounded-[var(--radius-sm)] border border-tertiary bg-tertiary/10 px-4 py-2 text-sm">
      Post more to improve accuracy. Based on <strong>{count}</strong> post
      {count !== 1 ? "s" : ""} so far.
    </div>
  );
}

function SameTimeBanner({ day, hour }: { day: number; hour: number }) {
  const timeStr =
    hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;
  return (
    <div className="mb-4 rounded-[var(--radius-sm)] border border-secondary bg-secondary/10 px-4 py-2 text-sm">
      You always post at <strong>{DAY_LABELS[day]} {timeStr}</strong>. Try varying your schedule to discover better times.
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

// Hydration-safe browser timezone via useSyncExternalStore
const subscribeBrowserTz = () => () => {};
const getBrowserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTz = () => "UTC";

export function TimingHeatmap({
  posts,
  isImporting = false,
  compact = false,
}: {
  posts: TimingPost[];
  isImporting?: boolean;
  compact?: boolean;
}) {
  const initialTz = useSyncExternalStore(subscribeBrowserTz, getBrowserTz, getServerTz);
  const [timezone, setTimezone] = useState(initialTz);
  const [tooltip, setTooltip] = useState<{
    bucket: Bucket;
    day: number;
    hour: number;
    x: number;
    y: number;
  } | null>(null);

  const groupedTimezones = useMemo(() => getGroupedTimezones(), []);
  const emptyStateCopy = getTimingEmptyStateCopy(isImporting);

  // Build the 7x24 grid
  const { grid, totalPosts, allSameSlot, bestSlots } = useMemo(() => {
    const g: Grid = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ count: 0, totalEngRate: 0, totalViews: 0 }))
    );

    let total = 0;
    const slotSet = new Set<string>();

    for (const post of posts) {
      const date = new Date(post.published_at);
      // Use Intl to get day/hour in the target timezone
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "numeric",
        hour12: false,
      }).formatToParts(date);

      const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
      const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";

      const dayMap: Record<string, number> = {
        Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
      };
      const day = dayMap[weekdayStr] ?? 0;
      // hour12:false gives "24" for midnight in some locales — normalize to 0
      const hour = parseInt(hourStr, 10) % 24;

      const engRate =
        post.views > 0
          ? ((post.likes + post.replies + post.reposts + post.quotes + post.shares) / post.views) * 100
          : 0;

      g[day][hour].count += 1;
      g[day][hour].totalEngRate += engRate;
      g[day][hour].totalViews += post.views;

      slotSet.add(`${day}-${hour}`);
      total++;
    }

    // Check if all posts land in the same slot
    const isSameSlot = slotSet.size === 1;
    let sameSlotDay = 0;
    let sameSlotHour = 0;
    if (isSameSlot) {
      const [d, h] = [...slotSet][0].split("-").map(Number);
      sameSlotDay = d;
      sameSlotHour = h;
    }

    // Find top 3 best slots (among cells with >= MIN_POSTS_FOR_CELL)
    const candidates: { day: number; hour: number; avg: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (g[d][h].count >= MIN_POSTS_FOR_CELL) {
          candidates.push({ day: d, hour: h, avg: g[d][h].totalEngRate / g[d][h].count });
        }
      }
    }
    candidates.sort((a, b) => b.avg - a.avg);
    const top3 = candidates.slice(0, 3);

    return {
      grid: g,
      totalPosts: total,
      allSameSlot: isSameSlot && total > 0 ? { day: sameSlotDay, hour: sameSlotHour } : null,
      bestSlots: top3,
    };
  }, [posts, timezone]);

  // Normalization range (only cells with enough data)
  const { minEng, maxEng } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h].count >= MIN_POSTS_FOR_CELL) {
          const avg = grid[d][h].totalEngRate / grid[d][h].count;
          if (avg < min) min = avg;
          if (avg > max) max = avg;
        }
      }
    }
    if (min === Infinity) { min = 0; max = 0; }
    return { minEng: min, maxEng: max };
  }, [grid]);

  // Compact 7x6 grid — aggregate 4-hour blocks from the full grid
  const compactGrid = useMemo(() => {
    if (!compact) return null;
    return Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: NUM_BLOCKS }, (_, b) => {
        let count = 0;
        let totalEngRate = 0;
        let totalViews = 0;
        for (let h = b * HOURS_PER_BLOCK; h < (b + 1) * HOURS_PER_BLOCK; h++) {
          count += grid[d][h].count;
          totalEngRate += grid[d][h].totalEngRate;
          totalViews += grid[d][h].totalViews;
        }
        return { count, totalEngRate, totalViews } as Bucket;
      })
    );
  }, [compact, grid]);

  const { compactMinEng, compactMaxEng } = useMemo(() => {
    if (!compactGrid) return { compactMinEng: 0, compactMaxEng: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (let d = 0; d < 7; d++) {
      for (let b = 0; b < NUM_BLOCKS; b++) {
        if (compactGrid[d][b].count >= MIN_POSTS_FOR_CELL) {
          const avg = compactGrid[d][b].totalEngRate / compactGrid[d][b].count;
          if (avg < min) min = avg;
          if (avg > max) max = avg;
        }
      }
    }
    if (min === Infinity) { min = 0; max = 0; }
    return { compactMinEng: min, compactMaxEng: max };
  }, [compactGrid]);

  const showTooltipForElement = useCallback(
    (el: HTMLElement, day: number, hour: number) => {
      const rect = el.getBoundingClientRect();
      setTooltip({
        bucket: grid[day][hour],
        day,
        hour,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [grid]
  );

  const handleCellHover = useCallback(
    (e: React.MouseEvent, day: number, hour: number) => {
      showTooltipForElement(e.target as HTMLElement, day, hour);
    },
    [showTooltipForElement]
  );

  const handleCellFocus = useCallback(
    (e: React.FocusEvent, day: number, hour: number) => {
      showTooltipForElement(e.target as HTMLElement, day, hour);
    },
    [showTooltipForElement]
  );

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  const summaryText =
    bestSlots.length > 0
      ? `Best times: ${bestSlots.map((s) => formatSlot(s.day, s.hour)).join(", ")}`
      : "Not enough data to determine best posting times yet.";

  /* ── Compact render ─────────────────────────────────────────────── */

  if (compact && compactGrid) {
    const cRange = compactMaxEng - compactMinEng;

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold">Best Time to Post</p>

        <div role="grid" aria-label="Compact posting time heatmap: engagement rate by day and 4-hour block">
          {/* Block labels */}
          <div
            className="grid gap-0.5 mb-0.5"
            style={{ gridTemplateColumns: `2.5rem repeat(${NUM_BLOCKS}, 1fr)` }}
          >
            <div /> {/* spacer for day labels */}
            {BLOCK_LABELS.map((label) => (
              <div key={label} className="text-center text-[9px] text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAY_LABELS.map((dayLabel, dayIdx) => (
            <div
              key={dayLabel}
              className="grid gap-0.5 mb-0.5"
              style={{ gridTemplateColumns: `2.5rem repeat(${NUM_BLOCKS}, 1fr)` }}
            >
              <div className="flex items-center text-xs font-medium text-muted-foreground pr-1 justify-end">
                {dayLabel}
              </div>
              {Array.from({ length: NUM_BLOCKS }, (_, blockIdx) => {
                const bucket = compactGrid[dayIdx][blockIdx];
                const hasData = bucket.count >= MIN_POSTS_FOR_CELL;
                const avgEng = hasData ? bucket.totalEngRate / bucket.count : 0;
                const t = hasData && cRange > 0 ? (avgEng - compactMinEng) / cRange : 0;

                return (
                  <div
                    key={blockIdx}
                    role="gridcell"
                    aria-label={
                      hasData
                        ? `${dayLabel} ${BLOCK_LABELS[blockIdx]}: ${bucket.count} posts, ${avgEng.toFixed(1)}% avg engagement`
                        : `${dayLabel} ${BLOCK_LABELS[blockIdx]}: no data`
                    }
                    className={`aspect-square rounded-sm flex items-center justify-center text-[9px] font-bold leading-none ${
                      hasData
                        ? ""
                        : "border border-dashed border-border"
                    }`}
                    style={{
                      backgroundColor: hasData ? interpolateColor(t) : undefined,
                      color: hasData
                        ? t > 0.5
                          ? "var(--paper)"
                          : "var(--foreground)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>Lower</span>
          <div
            className="h-2 w-20 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${interpolateColor(0)}, ${interpolateColor(0.5)}, ${interpolateColor(1)})`,
            }}
          />
          <span>Higher</span>
        </div>
      </div>
    );
  }

  /* ── Full render ────────────────────────────────────────────────── */

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardHeader>
        <div className="flex items-center justify-between gap-4">
          <StickerCardTitle>Best Time to Post</StickerCardTitle>
          <select
            aria-label="Select timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-12 md:h-9 rounded-[var(--radius-sm)] border border-input-border bg-input px-2 text-sm outline-none focus:border-ring focus-visible:ring-3 focus-visible:ring-ring"
          >
            {Object.entries(groupedTimezones).map(([continent, zones]) => (
              <optgroup key={continent} label={continent}>
                {zones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <StickerCardDescription>{summaryText}</StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {totalPosts > 0 && totalPosts < 20 && <LowDataBanner count={totalPosts} />}
        {allSameSlot && <SameTimeBanner day={allSameSlot.day} hour={allSameSlot.hour} />}

        {/* Heatmap grid */}
        <div className="overflow-x-auto" role="grid" aria-label="Posting time heatmap: engagement rate by day and hour">
          {/* Hour labels */}
          <div
            className="grid gap-0.5 mb-0.5"
            style={{ gridTemplateColumns: `3rem repeat(24, minmax(1.5rem, 1fr))` }}
          >
            <div /> {/* spacer for day labels */}
            {HOUR_LABELS.map((label) => (
              <div key={label} className="text-center text-[10px] text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAY_LABELS.map((dayLabel, dayIdx) => (
            <div
              key={dayLabel}
              className="grid gap-0.5 mb-0.5"
              style={{ gridTemplateColumns: `3rem repeat(24, minmax(1.5rem, 1fr))` }}
            >
              <div className="flex items-center text-xs font-medium text-muted-foreground pr-1 justify-end">
                {dayLabel}
              </div>
              {Array.from({ length: 24 }, (_, hourIdx) => {
                const bucket = grid[dayIdx][hourIdx];
                const hasData = bucket.count >= MIN_POSTS_FOR_CELL;
                const avgEng = hasData ? bucket.totalEngRate / bucket.count : 0;
                const range = maxEng - minEng;
                const t = hasData && range > 0 ? (avgEng - minEng) / range : 0;

                return (
                  <div
                    key={hourIdx}
                    tabIndex={hasData ? 0 : -1}
                    role="gridcell"
                    aria-label={
                      hasData
                        ? `${dayLabel} ${HOUR_LABELS[hourIdx]}: ${bucket.count} posts, ${avgEng.toFixed(1)}% avg engagement`
                        : `${dayLabel} ${HOUR_LABELS[hourIdx]}: no data`
                    }
                    className={`aspect-square rounded-sm transition-colors flex items-center justify-center text-[8px] font-bold leading-none ${
                      hasData
                        ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        : "border border-dashed border-border"
                    }`}
                    style={{
                      backgroundColor: hasData
                        ? interpolateColor(t)
                        : undefined,
                      color: hasData
                        ? t > 0.5
                          ? "var(--paper)"
                          : "var(--foreground)"
                        : undefined,
                    }}
                    onMouseEnter={(e) => handleCellHover(e, dayIdx, hourIdx)}
                    onMouseLeave={handleCellLeave}
                    onFocus={(e) => {
                      if (hasData) handleCellFocus(e, dayIdx, hourIdx);
                    }}
                    onBlur={handleCellLeave}
                  >
                    {hasData && <span aria-hidden="true">{avgEng.toFixed(0)}%</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>Lower</span>
          <div
            className="h-2 w-24 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${interpolateColor(0)}, ${interpolateColor(0.5)}, ${interpolateColor(1)})`,
            }}
          />
          <span>Higher</span>
        </div>

        {totalPosts === 0 && (
          <EmptyState
            icon={<Clock weight="bold" className="size-7" />}
            iconColor="secondary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
            className="mt-4"
          />
        )}

        {tooltip && (
          <CellTooltip
            bucket={tooltip.bucket}
            day={tooltip.day}
            hour={tooltip.hour}
            x={tooltip.x}
            y={tooltip.y}
          />
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
