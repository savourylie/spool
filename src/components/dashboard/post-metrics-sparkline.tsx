"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/engagement-prediction";

interface MetricSnapshot {
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  fetched_at: string | null;
}

interface ChartDataPoint {
  date: string;
  views: number;
  engagementRate: number;
}

const chartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
  engagementRate: { label: "Eng. rate %", color: "var(--chart-5)" },
} satisfies ChartConfig;

function computeChartData(metrics: MetricSnapshot[]): ChartDataPoint[] {
  return metrics.map((snapshot) => {
    const views = snapshot.views ?? 0;
    const engagement =
      (snapshot.likes ?? 0) +
      (snapshot.replies ?? 0) +
      (snapshot.reposts ?? 0) +
      (snapshot.quotes ?? 0) +
      (snapshot.shares ?? 0);

    return {
      date: snapshot.fetched_at
        ? new Date(snapshot.fetched_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "",
      views,
      engagementRate:
        views > 0 ? Math.round((engagement / views) * 10_000) / 100 : 0,
    };
  });
}

export function PostMetricsSparkline({
  postId,
  className,
}: {
  postId: string;
  className?: string;
}) {
  const [metrics, setMetrics] = useState<MetricSnapshot[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/posts/${postId}/metrics`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load metrics");
        return response.json() as Promise<MetricSnapshot[]>;
      })
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const chartData = metrics ? computeChartData(metrics) : [];
  const latest = chartData.at(-1);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Momentum</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
          {metrics
            ? `${metrics.length} snapshot${metrics.length === 1 ? "" : "s"}`
            : "Loading"}
          {latest ? ` · ${formatNumber(latest.views)} views` : ""}
        </span>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-ink-3">
          Snapshot history is unavailable right now.
        </p>
      ) : null}

      {!error && metrics && chartData.length < 2 ? (
        <p className="mt-3 text-xs text-ink-3">
          Not enough snapshots for a trend yet. Metrics are captured on each
          sync.
        </p>
      ) : null}

      {!error && chartData.length >= 2 ? (
        <>
          <ChartContainer
            config={chartConfig}
            className="mt-2 h-[130px] w-full [&_.recharts-cartesian-grid_line]:stroke-transparent"
            role="img"
            aria-label={`Engagement history across ${chartData.length} snapshots`}
          >
            <LineChart
              data={chartData}
              margin={{ top: 6, right: 4, bottom: 0, left: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis yAxisId="views" hide />
              <YAxis yAxisId="rate" hide orientation="right" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => String(value)}
                  />
                }
              />
              <Line
                yAxisId="views"
                type="monotone"
                dataKey="views"
                stroke="var(--color-views)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="engagementRate"
                stroke="var(--color-engagementRate)"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
          <div className="mt-1 flex items-center gap-4 text-[11px] text-ink-3">
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: "var(--chart-1)" }}
              />
              Views
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded-full border-t border-dashed"
                style={{ borderColor: "var(--chart-5)" }}
              />
              Engagement rate
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
