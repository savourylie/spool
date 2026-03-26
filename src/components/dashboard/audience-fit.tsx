"use client";

import { useMemo } from "react";
import { UsersFour } from "@phosphor-icons/react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
import { ErrorState } from "@/components/ui/error-state";
import { getAudienceFitEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import {
  computeAudienceAlignmentScore,
  detectDemographicShift,
  getAudienceFitRecommendations,
  MIN_SNAPSHOTS_FOR_ANALYSIS,
  type AlignmentScore,
  type EngagementWindow,
  type DemographicSnapshot,
} from "@/lib/audience-fit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemographicHistoryRow {
  dimension: string;
  key: string;
  value: number;
  fetched_at: string;
}

export interface PostMetricRow {
  published_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

// ---------------------------------------------------------------------------
// Score color config
// ---------------------------------------------------------------------------

const SCORE_CONFIG: Record<
  AlignmentScore["severity"],
  { bg: string; text: string; label: string }
> = {
  good: {
    bg: "bg-quaternary/20",
    text: "text-quaternary",
    label: "Good Fit",
  },
  moderate: {
    bg: "bg-tertiary/20",
    text: "text-tertiary",
    label: "Moderate",
  },
  severe: {
    bg: "bg-destructive/20",
    text: "text-destructive",
    label: "Poor Fit",
  },
};

const SERIES_COLORS = [
  "var(--secondary)",
  "var(--tertiary)",
  "var(--quaternary)",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aggregateWindow(
  posts: PostMetricRow[],
  label: string,
): EngagementWindow {
  return {
    periodLabel: label,
    totalViews: posts.reduce((s, p) => s + Number(p.views), 0),
    totalLikes: posts.reduce((s, p) => s + Number(p.likes), 0),
    totalReplies: posts.reduce((s, p) => s + Number(p.replies), 0),
    totalReposts: posts.reduce((s, p) => s + Number(p.reposts), 0),
    totalQuotes: posts.reduce((s, p) => s + Number(p.quotes), 0),
    totalShares: posts.reduce((s, p) => s + Number(p.shares), 0),
    postCount: posts.length,
  };
}

/** Get unique fetched_at dates (day-level) */
function getUniqueDates(rows: DemographicHistoryRow[]): string[] {
  const set = new Set(rows.map((r) => r.fetched_at.split("T")[0]));
  return [...set].sort();
}

/**
 * Determine top-1 key per dimension across all snapshots
 * (highest average value). Returns array of { dimension, key, seriesKey, label }.
 */
function getTrackedSeries(rows: DemographicHistoryRow[]) {
  const dimKeyTotals = new Map<string, Map<string, { sum: number; n: number }>>();

  for (const r of rows) {
    if (!dimKeyTotals.has(r.dimension)) {
      dimKeyTotals.set(r.dimension, new Map());
    }
    const keyMap = dimKeyTotals.get(r.dimension)!;
    const entry = keyMap.get(r.key) ?? { sum: 0, n: 0 };
    entry.sum += r.value;
    entry.n += 1;
    keyMap.set(r.key, entry);
  }

  const series: Array<{
    dimension: string;
    key: string;
    seriesKey: string;
    label: string;
  }> = [];

  for (const [dimension, keyMap] of dimKeyTotals) {
    let topKey = "";
    let topAvg = -1;
    for (const [key, { sum, n }] of keyMap) {
      const avg = sum / n;
      if (avg > topAvg) {
        topAvg = avg;
        topKey = key;
      }
    }
    if (topKey) {
      // seriesKey must be a valid JS identifier for ChartContainer CSS vars
      const seriesKey = `${dimension}_${topKey}`.replace(/[^a-zA-Z0-9_]/g, "_");
      series.push({
        dimension,
        key: topKey,
        seriesKey,
        label: `${capitalize(dimension)}: ${topKey}`,
      });
    }
  }

  return series;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build chart data points: one entry per unique date, with a field per tracked series.
 */
function buildTimelineData(
  rows: DemographicHistoryRow[],
  trackedSeries: ReturnType<typeof getTrackedSeries>,
) {
  const dates = getUniqueDates(rows);
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return dates.map((date) => {
    const point: Record<string, string | number> = {
      dateLabel: dateFormat.format(new Date(date + "T00:00:00")),
    };

    for (const series of trackedSeries) {
      // Average value for this series key on this date
      const matching = rows.filter(
        (r) =>
          r.fetched_at.startsWith(date) &&
          r.dimension === series.dimension &&
          r.key === series.key,
      );
      const avg =
        matching.length > 0
          ? matching.reduce((s, r) => s + r.value, 0) / matching.length
          : 0;
      point[series.seriesKey] = Math.round(avg * 10) / 10;
    }

    return point;
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function AudienceFitSkeleton() {
  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="secondary">
        <UsersFour weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Audience Fit</StickerCardTitle>
        <StickerCardDescription>
          Whether your followers match your content
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <div role="status" aria-label="Loading audience fit">
          <div aria-hidden="true" className="space-y-4">
            {/* Score + badge */}
            <div className="flex items-baseline gap-3">
              <div className="h-12 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            {/* Engagement comparison */}
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            {/* Shift summary */}
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            {/* Chart area */}
            <div className="h-[200px] w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </StickerCardContent>
    </StickerCard>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AudienceFitProps {
  demographicsHistory: DemographicHistoryRow[];
  postMetrics: PostMetricRow[];
  isImporting?: boolean;
}

export function AudienceFit({
  demographicsHistory,
  postMetrics,
  isImporting = false,
}: AudienceFitProps) {
  const emptyStateCopy = getAudienceFitEmptyStateCopy(isImporting);

  const uniqueDates = useMemo(
    () => getUniqueDates(demographicsHistory),
    [demographicsHistory],
  );

  const isEmpty = uniqueDates.length < MIN_SNAPSHOTS_FOR_ANALYSIS;

  // Compute alignment score and shift analysis
  const { alignment, shiftAnalysis, recommendations, computeError } = useMemo(() => {
    if (isEmpty) {
      return { alignment: null, shiftAnalysis: null, recommendations: [], computeError: false };
    }

    try {
      // Split posts by date midpoint
      const sortedPosts = [...postMetrics].sort(
        (a, b) =>
          new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
      );
      const midIndex = Math.floor(sortedPosts.length / 2);
      const prePosts = sortedPosts.slice(0, midIndex);
      const postPosts = sortedPosts.slice(midIndex);

      const preWindow = aggregateWindow(prePosts, "Earlier posts");
      const postWindow = aggregateWindow(postPosts, "Recent posts");

      const alignmentResult = computeAudienceAlignmentScore(preWindow, postWindow);

      // Split demographics history by midpoint date
      const allDates = uniqueDates;
      const midDateIndex = Math.floor(allDates.length / 2);
      const splitDate = allDates[midDateIndex];

      const preSnapshots: DemographicSnapshot[] = demographicsHistory.filter(
        (s) => s.fetched_at.split("T")[0] < splitDate,
      );
      const postSnapshots: DemographicSnapshot[] = demographicsHistory.filter(
        (s) => s.fetched_at.split("T")[0] >= splitDate,
      );

      const shiftResult = detectDemographicShift(preSnapshots, postSnapshots);
      const recs = getAudienceFitRecommendations(alignmentResult, shiftResult);

      return {
        alignment: alignmentResult,
        shiftAnalysis: shiftResult,
        recommendations: recs,
        computeError: false,
      };
    } catch {
      return { alignment: null, shiftAnalysis: null, recommendations: [], computeError: true };
    }
  }, [isEmpty, postMetrics, demographicsHistory, uniqueDates]);

  // Build timeline chart data
  const trackedSeries = useMemo(
    () => getTrackedSeries(demographicsHistory),
    [demographicsHistory],
  );

  const timelineData = useMemo(
    () => buildTimelineData(demographicsHistory, trackedSeries),
    [demographicsHistory, trackedSeries],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    trackedSeries.forEach((series, i) => {
      config[series.seriesKey] = {
        label: series.label,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      };
    });
    return config;
  }, [trackedSeries]);

  const config = alignment ? SCORE_CONFIG[alignment.severity] : SCORE_CONFIG.good;
  const showRecommendations =
    alignment && alignment.score < 70 && recommendations.length > 0;

  if (computeError) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardIcon color="secondary">
          <UsersFour weight="bold" className="size-6" />
        </StickerCardIcon>
        <StickerCardHeader>
          <StickerCardTitle>Audience Fit</StickerCardTitle>
          <StickerCardDescription>
            Whether your followers match your content
          </StickerCardDescription>
        </StickerCardHeader>
        <StickerCardContent>
          <ErrorState
            description="We couldn't compute your audience fit score right now."
            className="border-0 shadow-none hover:rotate-0 hover:scale-100"
          />
        </StickerCardContent>
      </StickerCard>
    );
  }

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="secondary">
        <UsersFour weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Audience Fit</StickerCardTitle>
        <StickerCardDescription>
          Whether your followers match your content
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {isEmpty ? (
          <EmptyState
            icon={<UsersFour weight="bold" className="size-7" />}
            iconColor="secondary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        ) : (
          <>
            {/* Score display */}
            <div className="mb-4 flex items-baseline gap-3">
              <span className="font-heading text-5xl font-bold">
                {alignment?.score ?? 0}
              </span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold leading-none ${config.bg} ${config.text}`}
              >
                {config.label}
              </span>
            </div>

            {/* Engagement rate comparison */}
            {alignment && (
              <p className="mb-4 text-sm text-muted-foreground">
                Engagement rate:{" "}
                {alignment.preViralEngagementRate.toFixed(1)}% (earlier) →{" "}
                {alignment.postViralEngagementRate.toFixed(1)}% (recent)
              </p>
            )}

            {/* Shift summary */}
            {shiftAnalysis && (
              <p className="mb-4 text-sm text-muted-foreground">
                {shiftAnalysis.summary}
              </p>
            )}

            {/* Demographic shift timeline */}
            {timelineData.length > 1 && trackedSeries.length > 0 && (
              <ChartContainer
                config={chartConfig}
                className="h-[200px] w-full"
                role="img"
                aria-label={`Demographic shift timeline: alignment score is ${alignment?.score ?? 0} out of 100`}
              >
                <LineChart
                  data={timelineData}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={35}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                  />
                  {trackedSeries.map((series) => (
                    <Line
                      key={series.seriesKey}
                      type="monotone"
                      dataKey={series.seriesKey}
                      stroke={`var(--color-${series.seriesKey})`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}

            {/* Recommendations */}
            {showRecommendations && (
              <div className="mt-4 space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.title}
                    className="rounded-[var(--radius-sm)] border-2 border-tertiary/30 bg-tertiary/10 px-4 py-3"
                  >
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
