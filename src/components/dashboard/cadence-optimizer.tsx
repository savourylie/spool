"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Timer } from "@phosphor-icons/react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCadenceEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import {
  computeCadenceStats,
  computeCadenceScatterData,
  getCadenceRecommendation,
  detectSameDayCollisions,
  computeAxisThresholds,
  clampAndSplitScatterData,
  CADENCE_THRESHOLDS,
  type ClampedScatterPoint,
} from "@/lib/cadence-analysis";
import { formatNumber } from "@/lib/engagement-prediction";
import { deriveCadenceStatus, type CadenceStatus } from "@/lib/today-hub-helpers";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Chart config                                                       */
/* ------------------------------------------------------------------ */

const chartConfig = {
  views: {
    label: "Views",
    color: "var(--chart-1)",
  },
  outliers: {
    label: "Outliers (beyond axis range)",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

/* ------------------------------------------------------------------ */
/*  Timezone helpers (same pattern as timing-heatmap)                   */
/* ------------------------------------------------------------------ */

const subscribeBrowserTz = () => () => {};
const getBrowserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTz = () => "UTC";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatsBar({
  avgPostsPerDay,
  avgGapHours,
  longestGapHours,
  shortestGapHours,
}: {
  avgPostsPerDay: number;
  avgGapHours: number;
  longestGapHours: number;
  shortestGapHours: number;
}) {
  const items = [
    { label: "Avg posts/day (30d)", value: avgPostsPerDay.toFixed(1) },
    { label: "Avg gap", value: `${Math.round(avgGapHours)}h` },
    { label: "Longest gap", value: `${Math.round(longestGapHours)}h` },
    { label: "Shortest gap", value: `${Math.round(shortestGapHours)}h` },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="font-heading text-xl font-bold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RecommendationBanner({ percentageImprovement }: { percentageImprovement: number }) {
  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border-2 border-tertiary bg-tertiary/10 px-4 py-2 text-sm">
      Posts spaced 18–24+ hours apart get <strong>{Math.round(percentageImprovement)}%</strong> more
      views on average based on your data.
    </div>
  );
}

function CollisionList({ collisions }: { collisions: { date: string; postViews: number[] }[] }) {
  return (
    <div className="mt-4 space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Same-day collisions
      </p>
      {collisions.map((c) => (
        <div key={c.date} className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{c.date}</span>
          <span className="text-muted-foreground">
            {c.postViews.length} posts &mdash;{" "}
            {c.postViews.map((v) => v.toLocaleString()).join(", ")} views
          </span>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OutlierDot(props: any) {
  const { cx, cy } = props;
  return (
    <g transform={`translate(${cx},${cy})`}>
      <rect
        x={-4}
        y={-4}
        width={8}
        height={8}
        transform="rotate(45)"
        fill="var(--color-outliers)"
        fillOpacity={0.5}
        stroke="var(--color-outliers)"
        strokeWidth={1}
      />
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CadenceTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as ClampedScatterPoint;
  const hours = data.originalHoursSincePrevious;
  const views = data.originalViews;

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="text-muted-foreground">
        {Math.round(hours)}h since previous post
      </p>
      <p className="font-medium">{formatNumber(views)} views</p>
      {data.isOutlier && (
        <p className="mt-1 text-muted-foreground italic">Beyond chart range</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact status config                                              */
/* ------------------------------------------------------------------ */

const COMPACT_CADENCE_DOT: Record<CadenceStatus, string> = {
  on_track: "bg-quaternary",
  due: "bg-tertiary",
  overdue: "bg-destructive",
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CadenceOptimizer({
  posts,
  isImporting,
  compact = false,
}: {
  posts: TimingPost[];
  isImporting: boolean;
  compact?: boolean;
}) {
  const timezone = useSyncExternalStore(subscribeBrowserTz, getBrowserTz, getServerTz);

  const stats = useMemo(() => computeCadenceStats(posts), [posts]);
  const rawScatterData = useMemo(() => computeCadenceScatterData(posts), [posts]);
  const clampedResult = useMemo(() => {
    if (rawScatterData.length < CADENCE_THRESHOLDS.minPostsForRecommendation) return null;
    const thresholds = computeAxisThresholds(rawScatterData);
    const result = clampAndSplitScatterData(rawScatterData, thresholds);
    // If all points are outliers, fall back to auto-scaling
    if (result.outlierCount === rawScatterData.length) return null;
    return result;
  }, [rawScatterData]);
  const recommendation = useMemo(() => getCadenceRecommendation(posts), [posts]);
  const collisions = useMemo(
    () => detectSameDayCollisions(posts, timezone),
    [posts, timezone],
  );
  const emptyStateCopy = useMemo(() => getCadenceEmptyStateCopy(isImporting), [isImporting]);

  const hasEnoughData = rawScatterData.length >= CADENCE_THRESHOLDS.minPostsForRecommendation;

  // Compact-mode extras
  const lastPostAt = useMemo(() => {
    if (posts.length === 0) return null;
    return posts.reduce((latest, p) =>
      new Date(p.published_at) > new Date(latest.published_at) ? p : latest
    ).published_at;
  }, [posts]);

  const cadenceStatus = useMemo(
    () => deriveCadenceStatus(lastPostAt, new Date()),
    [lastPostAt],
  );

  /* ── Compact render ─────────────────────────────────────────────── */

  if (compact) {
    const dotClass = COMPACT_CADENCE_DOT[cadenceStatus.status];
    const statusLabel =
      cadenceStatus.hoursAgo === Infinity
        ? "No posts yet"
        : cadenceStatus.status === "on_track"
          ? `On track (${Math.round(cadenceStatus.hoursAgo)}h ago)`
          : cadenceStatus.status === "due"
            ? `Due to post (${Math.round(cadenceStatus.hoursAgo)}h ago)`
            : `Overdue (${Math.round(cadenceStatus.hoursAgo)}h ago)`;

    const spacingSummary = hasEnoughData
      ? `Optimal spacing: ${CADENCE_THRESHOLDS.minGapHours}\u201324h \u00B7 Averaging ${Math.round(stats.avgGapHours)}h`
      : "Need more posts for cadence analysis";

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold">Posting Cadence</p>

        {/* Status dot + label */}
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", dotClass)} />
          <span className="text-xs font-medium text-muted-foreground">
            {statusLabel}
          </span>
        </div>

        {/* Spacing summary */}
        <p className="text-xs text-muted-foreground">{spacingSummary}</p>

        {/* See full analysis link */}
        <Link
          href="/dashboard/understand"
          className="text-xs font-semibold text-primary hover:underline"
        >
          See full analysis &rarr;
        </Link>
      </div>
    );
  }

  /* ── Full render ────────────────────────────────────────────────── */

  return (
    <StickerCard className="mt-10 hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="secondary">
        <Timer size={24} weight="bold" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Posting Cadence</StickerCardTitle>
        <StickerCardDescription>
          How your post spacing affects reach
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {!hasEnoughData ? (
          <EmptyState
            icon={<Timer size={28} weight="bold" />}
            iconColor="secondary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        ) : (
          <>
            <StatsBar
              avgPostsPerDay={stats.avgPostsPerDay}
              avgGapHours={stats.avgGapHours}
              longestGapHours={stats.longestGapHours}
              shortestGapHours={stats.shortestGapHours}
            />

            <ChartContainer config={chartConfig} className="h-[300px] w-full" aria-label="Post cadence scatter chart">
              <ScatterChart
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="hoursSincePrevious"
                  name="Hours since previous post"
                  unit="h"
                  tick={{ fontSize: 12 }}
                  domain={clampedResult ? [0, clampedResult.thresholds.x] : undefined}
                />
                <YAxis
                  type="number"
                  dataKey="views"
                  name="Views"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  domain={clampedResult ? [0, clampedResult.thresholds.y] : undefined}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<CadenceTooltipContent />}
                />
                <Scatter
                  data={clampedResult ? clampedResult.normalPoints : rawScatterData}
                  fill="var(--color-views)"
                  name="views"
                />
                {clampedResult && clampedResult.outlierPoints.length > 0 && (
                  <Scatter
                    data={clampedResult.outlierPoints}
                    fill="var(--color-outliers)"
                    name="outliers"
                    shape={<OutlierDot />}
                  />
                )}
              </ScatterChart>
            </ChartContainer>

            {clampedResult && clampedResult.outlierCount > 0 && (
              <>
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {clampedResult.outlierCount}{" "}
                  {clampedResult.outlierCount === 1 ? "post" : "posts"} beyond
                  range
                </p>
                <p className="sr-only">
                  Chart axes clamped at {clampedResult.thresholds.x} hours and{" "}
                  {formatNumber(clampedResult.thresholds.y)} views.{" "}
                  {clampedResult.outlierCount}{" "}
                  {clampedResult.outlierCount === 1
                    ? "post exceeds"
                    : "posts exceed"}{" "}
                  these thresholds.
                </p>
              </>
            )}

            {recommendation?.triggered && (
              <RecommendationBanner
                percentageImprovement={recommendation.percentageImprovement}
              />
            )}

            {collisions.length > 0 && <CollisionList collisions={collisions} />}
          </>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
