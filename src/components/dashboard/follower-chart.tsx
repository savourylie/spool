"use client";

import { useId, useMemo } from "react";
import { TrendUp } from "@phosphor-icons/react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { getFollowerEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

export type DailyStatRow = { date: string; followers_count: number | null };
export type PostSummary = {
  id: string;
  text_preview: string | null;
  permalink: string | null;
  published_at: string;
};

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  followers: number;
  isSpike: boolean;
  spikeGain: number;
  linkedPost: PostSummary | null;
}

const chartConfig = {
  followers: {
    label: "Followers",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function findNearestPost(
  spikeDate: string,
  posts: PostSummary[]
): PostSummary | null {
  const spikeTime = new Date(spikeDate).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  let best: PostSummary | null = null;
  let bestDiff = Infinity;

  for (const post of posts) {
    const diff = Math.abs(new Date(post.published_at).getTime() - spikeTime);
    if (diff <= oneDayMs && diff < bestDiff) {
      bestDiff = diff;
      best = post;
    }
  }

  return best;
}

function processData(
  dailyStats: DailyStatRow[],
  posts: PostSummary[]
): ChartDataPoint[] {
  const filtered = dailyStats.filter(
    (row): row is DailyStatRow & { followers_count: number } =>
      row.followers_count !== null
  );

  return filtered.map((row, i) => {
    const prev = i > 0 ? filtered[i - 1].followers_count : null;
    const gain = prev !== null ? row.followers_count - prev : 0;
    const isSpike = prev !== null && prev > 0 && gain / prev > 0.05;

    return {
      date: row.date,
      dateLabel: new Date(row.date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      followers: row.followers_count,
      isSpike,
      spikeGain: isSpike ? gain : 0,
      linkedPost: isSpike ? findNearestPost(row.date, posts) : null,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SpikeDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.isSpike) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="var(--color-followers)"
      stroke="white"
      strokeWidth={2}
      style={{ cursor: payload.linkedPost?.permalink ? "pointer" : "default" }}
      onClick={() => {
        if (payload.linkedPost?.permalink) {
          window.open(payload.linkedPost.permalink, "_blank");
        }
      }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{data.dateLabel}</p>
      <p className="text-muted-foreground">
        {data.followers.toLocaleString()} followers
      </p>
      {data.isSpike && (
        <>
          <p className="mt-1 font-medium text-emerald-600">
            +{data.spikeGain.toLocaleString()} followers
          </p>
          {data.linkedPost?.text_preview && (
            <p className="mt-0.5 max-w-48 truncate text-muted-foreground">
              {data.linkedPost.text_preview}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function FollowerChart({
  dailyStats,
  posts,
  isImporting = false,
}: {
  dailyStats: DailyStatRow[];
  posts: PostSummary[];
  isImporting?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const chartData = useMemo(
    () => processData(dailyStats, posts),
    [dailyStats, posts]
  );
  const emptyStateCopy = getFollowerEmptyStateCopy(isImporting);

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon>
        <TrendUp weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Follower Growth</StickerCardTitle>
        <StickerCardDescription>
          Daily follower count over time
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {chartData.length <= 1 ? (
          <EmptyState
            icon={<TrendUp weight="bold" className="size-7" />}
            iconColor="quaternary"
            title={emptyStateCopy.title}
            description={emptyStateCopy.description}
          />
        ) : (
          <>
          <ChartContainer
            config={chartConfig}
            className="h-[300px] w-full"
            role="img"
            aria-label={`Follower growth chart: ${chartData.length} days, from ${chartData[0]?.followers.toLocaleString()} to ${chartData[chartData.length - 1]?.followers.toLocaleString()} followers`}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient
                  id={`fill-${gradientId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-followers)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-followers)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={50}
              />
              <ChartTooltip content={<CustomTooltipContent />} />
              <Area
                type="monotone"
                dataKey="followers"
                stroke="var(--color-followers)"
                strokeWidth={2}
                fill={`url(#fill-${gradientId})`}
                dot={<SpikeDot />}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>
          {chartData.some((d) => d.isSpike) && (
            <p className="sr-only">
              Growth spikes detected on:{" "}
              {chartData
                .filter((d) => d.isSpike)
                .map(
                  (d) =>
                    `${d.dateLabel} (+${d.spikeGain.toLocaleString()} followers)`
                )
                .join("; ")}
              .
            </p>
          )}
          </>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
