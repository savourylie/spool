"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";

import type { TrendingTopic } from "@/app/api/grok-search/route";

// ── Types ────────────────────────────────────────────────────────────

interface GrokTrendingProps {
  topics: string[];
}

// ── Component ────────────────────────────────────────────────────────

export function GrokTrending({ topics }: GrokTrendingProps) {
  const [trends, setTrends] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(topics.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (topics.length === 0) return;

    const controller = new AbortController();

    fetch("/api/grok-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch trends");
        return res.json();
      })
      .then((data) => {
        setTrends(data.trends ?? []);
        setIsLoading(false);
        setError(null);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError("Failed to load trending topics");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [topics, retryCount]);

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] bg-paper-2 text-ink-3">
          <TrendUp weight="bold" className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Trending on X
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-2">
            <SpinnerGap
              weight="bold"
              className="size-4 animate-spin text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Searching trending topics&hellip;
            </p>
          </div>
          {/* Skeleton rows */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-muted px-3 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-border" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-border" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              setRetryCount((c) => c + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:bg-paper-2"
          >
            <ArrowClockwise weight="bold" className="size-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty — no topics provided */}
      {!isLoading && !error && topics.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          Post more to discover trending topics in your niche.
        </p>
      )}

      {/* Empty — no trends found */}
      {!isLoading && !error && topics.length > 0 && trends.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          No relevant trends found right now.
        </p>
      )}

      {/* Trends list */}
      {!isLoading && !error && trends.length > 0 && (
        <div className="space-y-1">
          {trends.map((trend, idx) => (
            <div
              key={trend.title}
              className={`flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:bg-muted ${
                idx === 0 ? "bg-secondary/10" : ""
              }`}
            >
              {/* Left: title + meta */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {trend.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {trend.postCount}
                  </span>
                  <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                    {trend.matchedTopic}
                  </span>
                </div>
              </div>

              {/* Right: compose CTA */}
              <Link
                href={`/dashboard/create/compose?topic=${encodeURIComponent(trend.title)}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--accent)_88%,var(--ink))]"
              >
                Compose
                <ArrowRight weight="bold" className="size-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
