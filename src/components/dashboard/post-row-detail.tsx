"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PostRow } from "./post-table";
import { CommentQuality } from "./comment-quality";

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
  views: {
    label: "Views",
    color: "var(--chart-1)",
  },
  engagementRate: {
    label: "Eng. Rate %",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

function computeChartData(metrics: MetricSnapshot[]): ChartDataPoint[] {
  return metrics.map((m) => {
    const views = m.views ?? 0;
    const likes = m.likes ?? 0;
    const replies = m.replies ?? 0;
    const reposts = m.reposts ?? 0;
    const quotes = m.quotes ?? 0;
    const shares = m.shares ?? 0;
    const engagementRate =
      views > 0
        ? ((likes + replies + reposts + quotes + shares) / views) * 100
        : 0;

    return {
      date: m.fetched_at
        ? new Date(m.fetched_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "",
      views,
      engagementRate: Math.round(engagementRate * 100) / 100,
    };
  });
}

export function PostRowDetail({ post, isImporting = false }: { post: PostRow; isImporting?: boolean }) {
  const [metrics, setMetrics] = useState<MetricSnapshot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const res = await fetch(`/api/posts/${post.id}/metrics`);
        if (!res.ok) throw new Error("Failed to load metrics");
        const data = await res.json();
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const chartData = metrics ? computeChartData(metrics) : [];

  return (
    <div className="px-6 py-4 pl-10 bg-accent/5">
      {/* Full post text */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4">
        {post.text_preview || "No text content."}
      </p>

      {/* Sparkline */}
      <div className="mb-4">
        {loading && (
          <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">
            Loading metrics…
          </div>
        )}
        {error && (
          <div className="h-[100px] flex items-center justify-center text-xs text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && chartData.length < 2 && (
          <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">
            Not enough data points for a sparkline.
          </div>
        )}
        {!loading && !error && chartData.length >= 2 && (
          <ChartContainer
            config={chartConfig}
            className="h-[100px] w-full [&_.recharts-cartesian-grid_line]:stroke-transparent"
            role="img"
            aria-label={`Engagement sparkline: ${chartData.length} snapshots, latest ${chartData[chartData.length - 1]?.views.toLocaleString()} views`}
          >
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
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
        )}
        {!loading && !error && chartData.length >= 2 && (
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: "var(--chart-1)" }}
              />
              Views
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-0.5 rounded-full border-t border-dashed"
                style={{ borderColor: "var(--chart-5)" }}
              />
              Eng. Rate
            </span>
          </div>
        )}
      </div>

      {/* Comment quality */}
      <div className="mb-4">
        <CommentQuality postId={post.id} isImporting={isImporting} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline transition-colors"
          >
            View on Threads
            <ArrowSquareOut weight="bold" className="size-4" />
          </a>
        )}
        <Link
          href={`/dashboard/create/scanner?text=${encodeURIComponent(post.text_preview || "")}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline transition-colors"
        >
          Scan this post
          <MagnifyingGlass weight="bold" className="size-4" />
        </Link>
      </div>
    </div>
  );
}
