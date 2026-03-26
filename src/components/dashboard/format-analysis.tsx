"use client";

import { useMemo } from "react";
import { ChartBarHorizontal } from "@phosphor-icons/react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getFormatEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import type { PostRow } from "@/components/dashboard/post-table";
import {
  MIN_POSTS_FOR_ANALYSIS,
  computeFormatBreakdown,
  computeTextLengthBuckets,
  generateFormatRecommendation,
} from "@/lib/format-analysis";

/* ------------------------------------------------------------------ */
/*  Chart configs                                                      */
/* ------------------------------------------------------------------ */

const formatChartConfig = {
  avgViews: {
    label: "Avg Views",
    color: "var(--chart-1)",
  },
  avgWes: {
    label: "Avg WES",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FormatBarChart({
  data,
}: {
  data: { mediaType: string; avgViews: number; avgWes: number }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Engagement by media type
      </p>
      <ChartContainer config={formatChartConfig} className="h-[250px] w-full" aria-label="Engagement by media type chart">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mediaType" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="views"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />
          <YAxis
            yAxisId="wes"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            yAxisId="views"
            dataKey="avgViews"
            fill="var(--color-avgViews)"
            radius={[4, 4, 0, 0]}
            name="avgViews"
          />
          <Bar
            yAxisId="wes"
            dataKey="avgWes"
            fill="var(--color-avgWes)"
            radius={[4, 4, 0, 0]}
            name="avgWes"
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function TextLengthBars({
  data,
}: {
  data: { bucket: string; label: string; count: number; avgEngagementRate: number }[];
}) {
  const nonEmpty = data.filter((d) => d.count > 0);
  if (nonEmpty.length === 0) return null;

  const maxRate = Math.max(...nonEmpty.map((d) => d.avgEngagementRate), 1);

  return (
    <div className="mt-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Engagement by post length
      </p>
      <div className="space-y-3">
        {data.map((bucket) => (
          <div key={bucket.bucket}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{bucket.label}</span>
              <span className="text-muted-foreground">
                {bucket.count > 0
                  ? `${bucket.avgEngagementRate.toFixed(1)}% eng. rate · ${bucket.count} posts`
                  : "No posts"}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              {bucket.count > 0 && (
                <div
                  className="h-full rounded-full bg-[var(--chart-3)] transition-all duration-300"
                  style={{
                    width: `${(bucket.avgEngagementRate / maxRate) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationBanner({
  formatComparison,
  lengthComparison,
}: {
  formatComparison: string;
  lengthComparison: string | null;
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border-2 border-tertiary bg-tertiary/10 px-4 py-2 text-sm">
      <strong>{formatComparison}</strong>
      {lengthComparison && (
        <>
          {" "}
          {lengthComparison}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function FormatAnalysis({
  posts,
  isImporting,
}: {
  posts: PostRow[];
  isImporting: boolean;
}) {
  const breakdown = useMemo(() => computeFormatBreakdown(posts), [posts]);
  const buckets = useMemo(() => computeTextLengthBuckets(posts), [posts]);
  const recommendation = useMemo(
    () => generateFormatRecommendation(posts),
    [posts],
  );
  const emptyStateCopy = useMemo(
    () => getFormatEmptyStateCopy(isImporting),
    [isImporting],
  );

  const hasEnoughData = posts.length >= MIN_POSTS_FOR_ANALYSIS;

  return (
    <StickerCard className="mt-10 hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="tertiary">
        <ChartBarHorizontal size={24} weight="bold" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Content Format Analysis</StickerCardTitle>
        <StickerCardDescription>
          Which content formats perform best for your audience
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {!hasEnoughData ? (
          <EmptyState
            icon={<ChartBarHorizontal size={28} weight="bold" />}
            iconColor="tertiary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        ) : (
          <>
            <FormatBarChart data={breakdown} />
            <TextLengthBars data={buckets} />
            {recommendation && (
              <RecommendationBanner
                formatComparison={recommendation.formatComparison}
                lengthComparison={recommendation.lengthComparison}
              />
            )}
          </>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
