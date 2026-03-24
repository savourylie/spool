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
import { getCadenceEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import {
  computeCadenceStats,
  computeCadenceScatterData,
  getCadenceRecommendation,
  detectSameDayCollisions,
  CADENCE_THRESHOLDS,
} from "@/lib/cadence-analysis";

/* ------------------------------------------------------------------ */
/*  Chart config                                                       */
/* ------------------------------------------------------------------ */

const chartConfig = {
  views: {
    label: "Views",
    color: "var(--chart-1)",
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CadenceOptimizer({
  posts,
  isImporting,
}: {
  posts: TimingPost[];
  isImporting: boolean;
}) {
  const timezone = useSyncExternalStore(subscribeBrowserTz, getBrowserTz, getServerTz);

  const stats = useMemo(() => computeCadenceStats(posts), [posts]);
  const scatterData = useMemo(() => computeCadenceScatterData(posts), [posts]);
  const recommendation = useMemo(() => getCadenceRecommendation(posts), [posts]);
  const collisions = useMemo(
    () => detectSameDayCollisions(posts, timezone),
    [posts, timezone],
  );
  const emptyStateCopy = useMemo(() => getCadenceEmptyStateCopy(isImporting), [isImporting]);

  const hasEnoughData = scatterData.length >= CADENCE_THRESHOLDS.minPostsForRecommendation;

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

            <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
                />
                <YAxis
                  type="number"
                  dataKey="views"
                  name="Views"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Scatter
                  data={scatterData}
                  fill="var(--color-views)"
                  name="views"
                />
              </ScatterChart>
            </ChartContainer>

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
