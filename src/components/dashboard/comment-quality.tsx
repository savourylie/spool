"use client";

import { useEffect, useState } from "react";

interface ReplyBreakdown {
  total: number;
  short: number;
  medium: number;
  long: number;
  meaningfulCount: number;
  meaningfulThreshold: number;
  discussionQualityScore: number;
}

export function CommentQuality({ postId }: { postId: string }) {
  const [data, setData] = useState<ReplyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReplies() {
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

    fetchReplies();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
        Loading comment quality…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
        No replies yet
      </div>
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
