import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/engagement-prediction";
import type { ReviewedPredictionRow } from "@/lib/prediction-reviews";
import { RangeBar } from "@/components/dashboard/range-bar";
import { BAND_STYLES } from "@/components/dashboard/band-palette";

interface PredictionReviewCardProps {
  row: ReviewedPredictionRow;
  /** Reference epoch for relative-time rendering. Pass from the page so the
   * component stays pure during render. */
  now: number;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatRelativeTime(dateString: string, now: number) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return relativeTimeFormatter.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

function formatSignedDelta(actual: number, p50: number) {
  const delta = actual - p50;
  if (delta === 0) return "exactly on baseline";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(delta))} vs. baseline`;
}

export function PredictionReviewCard({
  row,
  now,
}: PredictionReviewCardProps) {
  const style = BAND_STYLES[row.actual.bandVerdict];
  const excerpt = row.post?.textPreview?.trim() || null;
  const permalink = row.post?.permalink ?? null;
  const narrative = row.narrative?.trim() ?? "";
  const relativeLabel = formatRelativeTime(row.reviewedAt, now);

  return (
    <article
      className={cn(
        "rounded-[var(--radius-md)] border border-l-[6px] border-border bg-card p-5 shadow-[4px_4px_0_0_var(--muted)]",
        style.borderL,
      )}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {excerpt ? (
            permalink ? (
              <Link
                href={permalink}
                target="_blank"
                rel="noreferrer noopener"
                className="line-clamp-2 font-semibold text-foreground hover:underline"
                title={excerpt}
              >
                {excerpt}
              </Link>
            ) : (
              <p
                className="line-clamp-2 font-semibold text-foreground"
                title={excerpt}
              >
                {excerpt}
              </p>
            )
          ) : (
            <p className="font-semibold italic text-muted-foreground">
              (post deleted)
            </p>
          )}
          {row.post?.topicTag && (
            <p className="mt-1 text-xs text-muted-foreground">
              Topic: {row.post.topicTag}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span
            className={cn(
              "inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
              style.chip,
            )}
          >
            {style.label}
          </span>
          <time
            dateTime={row.reviewedAt}
            className="text-xs text-muted-foreground"
          >
            Reviewed {relativeLabel}
          </time>
        </div>
      </div>

      {/* Metric grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Predicted views
          </p>
          <div className="mt-1.5">
            <RangeBar
              p25={row.ranges.p25}
              p50={row.ranges.p50}
              p75={row.ranges.p75}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Based on {row.ranges.matchedCount} similar posts · confidence:{" "}
            {row.ranges.confidence}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Actual (24h)
          </p>
          <p className="mt-1 font-heading text-2xl font-medium">
            {formatNumber(row.actual.views)}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              views
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(row.actual.likes)} likes ·{" "}
            {formatNumber(row.actual.replies)} replies ·{" "}
            {formatNumber(row.actual.shares)} shares
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatSignedDelta(row.actual.views, row.ranges.p50)}
          </p>
          {row.actual.source === "latest" && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              Latest snapshot, not the 24h window.
            </p>
          )}
        </div>
      </div>

      {/* Narrative */}
      {narrative && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
            <span className="line-clamp-2 group-open:line-clamp-none">
              {narrative}
            </span>
            <span className="mt-1 inline-block text-[11px] font-semibold text-primary group-open:hidden">
              Read more
            </span>
            <span className="mt-1 hidden text-[11px] font-semibold text-primary group-open:inline-block">
              Show less
            </span>
          </summary>
        </details>
      )}
    </article>
  );
}
