"use client";

import { useMemo } from "react";
import { Crosshair } from "@phosphor-icons/react";
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
import { getSemanticFocusEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import {
  computeSemanticFocusData,
  getScoreLevel,
  LOW_SCORE_THRESHOLD,
  MIN_POSTS_FOR_FOCUS,
  type SemanticFocusPost,
  type ScoreLevel,
} from "@/lib/semantic-focus";

// ---------------------------------------------------------------------------
// Score color config
// ---------------------------------------------------------------------------

const SCORE_CONFIG: Record<
  ScoreLevel,
  { bg: string; text: string; label: string; chartColor: string }
> = {
  high: {
    bg: "bg-quaternary/20",
    text: "text-quaternary",
    label: "Focused",
    chartColor: "var(--quaternary)",
  },
  medium: {
    bg: "bg-tertiary/20",
    text: "text-tertiary",
    label: "Mixed",
    chartColor: "var(--tertiary)",
  },
  low: {
    bg: "bg-destructive/20",
    text: "text-destructive",
    label: "Scattered",
    chartColor: "var(--destructive)",
  },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function SemanticFocusSkeleton() {
  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="quaternary">
        <Crosshair weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Semantic Focus</StickerCardTitle>
        <StickerCardDescription>
          How concentrated your content is around core topics
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <div role="status" aria-label="Loading semantic focus">
          <div aria-hidden="true" className="space-y-4">
            {/* Score + badge */}
            <div className="flex items-baseline gap-3">
              <div className="h-12 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            {/* Topic badges */}
            <div className="flex gap-2">
              <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />
            </div>
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

interface SemanticFocusProps {
  posts: SemanticFocusPost[];
  isImporting?: boolean;
  bare?: boolean;
}

export function SemanticFocus({
  posts,
  isImporting = false,
  bare = false,
}: SemanticFocusProps) {
  const { focusData, computeError } = useMemo(() => {
    try {
      return { focusData: computeSemanticFocusData(posts), computeError: null };
    } catch {
      return { focusData: null, computeError: true };
    }
  }, [posts]);

  const emptyStateCopy = getSemanticFocusEmptyStateCopy(isImporting);

  if (computeError || !focusData) {
    const errorContent = (
      <ErrorState
        description="We couldn't compute your focus score right now."
        className="border-0 shadow-none hover:rotate-0 hover:scale-100"
      />
    );

    if (bare) return errorContent;

    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardIcon color="quaternary">
          <Crosshair weight="bold" className="size-6" />
        </StickerCardIcon>
        <StickerCardHeader>
          <StickerCardTitle>Semantic Focus</StickerCardTitle>
          <StickerCardDescription>
            How concentrated your content is around core topics
          </StickerCardDescription>
        </StickerCardHeader>
        <StickerCardContent>{errorContent}</StickerCardContent>
      </StickerCard>
    );
  }

  const scoreLevel = getScoreLevel(focusData.currentScore);
  const config = SCORE_CONFIG[scoreLevel];

  const chartConfig = {
    score: {
      label: "Focus Score",
      color: config.chartColor,
    },
  } satisfies ChartConfig;

  const isEmpty =
    focusData.postCount < MIN_POSTS_FOR_FOCUS || focusData.currentScore === 0;

  const content = isEmpty ? (
    <EmptyState
      icon={<Crosshair weight="bold" className="size-7" />}
      iconColor="quaternary"
      title={emptyStateCopy.title}
      description={emptyStateCopy.description}
    />
  ) : (
    <>
      {/* Score display */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-heading text-5xl font-bold">
          {Math.round(focusData.currentScore)}
        </span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold leading-none ${config.bg} ${config.text}`}
        >
          {config.label}
        </span>
      </div>

      {/* Topic cluster badges */}
      {focusData.topClusters.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {focusData.topClusters.map((cluster) => (
            <span
              key={cluster.topic}
              className="rounded-full border-2 border-foreground bg-muted px-3 py-1 text-sm font-medium capitalize"
            >
              {cluster.topic}
            </span>
          ))}
        </div>
      )}

      {/* 30-day trend line */}
      {focusData.trend.length > 1 && (
        <ChartContainer
          config={chartConfig}
          className="h-[200px] w-full"
          role="img"
          aria-label={`Semantic focus trend: score is ${Math.round(focusData.currentScore)} out of 100 over the last 30 days`}
        >
          <LineChart
            data={focusData.trend}
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
            />
            <ChartTooltip
              content={<ChartTooltipContent hideIndicator />}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--color-score)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Low score warning */}
      {focusData.currentScore < LOW_SCORE_THRESHOLD && (
        <div className="mt-4 rounded-[var(--radius-sm)] border-2 border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
          Your content is spread across many topics. Narrowing to 2–3
          core themes can improve algorithmic reach.
        </div>
      )}
    </>
  );

  if (bare) return content;

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="quaternary">
        <Crosshair weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Semantic Focus</StickerCardTitle>
        <StickerCardDescription>
          How concentrated your content is around core topics
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>{content}</StickerCardContent>
    </StickerCard>
  );
}
