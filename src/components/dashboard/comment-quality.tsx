"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatCircleDots, ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { getCommentQualityEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

interface ReplyBreakdown {
  total: number;
  short: number;
  medium: number;
  long: number;
  meaningfulCount: number;
  meaningfulThreshold: number;
  discussionQualityScore: number;
}

interface CommentQualityProps {
  postId: string;
  isImporting?: boolean;
}

export function CommentQuality({ postId, isImporting = false }: CommentQualityProps) {
  const [data, setData] = useState<ReplyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/replies`);
      if (!res.ok) throw new Error("Failed to load replies");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/posts/${postId}/replies`);
        if (!res.ok) throw new Error("Failed to load replies");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading comment quality">
        <div aria-hidden="true" className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="h-6 w-10 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-3 py-3">
        <WarningCircle weight="bold" className="size-4 text-destructive" />
        <span className="text-xs text-destructive">{error}</span>
        <button
          type="button"
          onClick={fetchReplies}
          className="inline-flex items-center gap-1 rounded-full border-2 border-foreground px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-tertiary"
        >
          <ArrowClockwise weight="bold" className="size-3" />
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.total === 0) {
    const emptyStateCopy = getCommentQualityEmptyStateCopy(isImporting);
    return (
      <EmptyState
        icon={<ChatCircleDots weight="bold" className="size-7" />}
        iconColor="tertiary"
        title={emptyStateCopy.title}
        description={emptyStateCopy.description}
        className="py-6"
      />
    );
  }

  const shortPct = (data.short / data.total) * 100;
  const mediumPct = (data.medium / data.total) * 100;
  const longPct = (data.long / data.total) * 100;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comment Quality
      </h4>

      {/* Stacked bar */}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Reply distribution: ${data.short} short, ${data.medium} medium, ${data.long} long`}
      >
        {data.short > 0 && (
          <div
            className="bg-muted"
            style={{ width: `${shortPct}%` }}
          />
        )}
        {data.medium > 0 && (
          <div
            className="bg-[#FBBF24]"
            style={{ width: `${mediumPct}%` }}
          />
        )}
        {data.long > 0 && (
          <div
            className="bg-[#34D399]"
            style={{ width: `${longPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-muted" />
          Short ({data.short})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#FBBF24]" />
          Medium ({data.medium})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#34D399]" />
          Long ({data.long})
        </span>
      </div>

      {/* Score + summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold">{data.discussionQualityScore}</span>
        <span className="text-xs text-muted-foreground">
          Discussion Quality Score
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {data.meaningfulCount} meaningful comment{data.meaningfulCount !== 1 ? "s" : ""} ({data.meaningfulThreshold}+ words) out of {data.total} total repl{data.total !== 1 ? "ies" : "y"}
      </p>
    </div>
  );
}
