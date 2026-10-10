"use client";

import { Star } from "@phosphor-icons/react/dist/ssr/Star";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { getBestPostEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import { formatNumber } from "@/lib/engagement-prediction";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

export interface BestPostData {
  textPreview: string | null;
  permalink: string | null;
  views: number;
  likes: number;
  replies: number;
  mediaType: string;
  publishedAt: string;
  whyFactors: string[];
}

interface BestPostCardProps {
  post: BestPostData | null;
  /** Number of posts in the 7-day window — backs the confidence badge. */
  sampleSize?: number;
  isLoading?: boolean;
  isImporting?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────

export function BestPostCard({
  post,
  sampleSize,
  isLoading = false,
  isImporting = false,
  className,
}: BestPostCardProps) {
  const emptyStateCopy = getBestPostEmptyStateCopy(isImporting);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star weight="fill" className="size-5 text-tertiary" />
          <h3 className="font-heading text-base font-medium">Best Post (7d)</h3>
        </div>
        {sampleSize !== undefined && !isLoading && (
          <ConfidenceBadge sample={sampleSize} compact />
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-muted p-4">
            <div className="h-4 w-full animate-pulse rounded bg-border" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
            <div className="mt-1 flex gap-4">
              <div className="h-4 w-16 animate-pulse rounded bg-border" />
              <div className="h-4 w-14 animate-pulse rounded bg-border" />
              <div className="h-4 w-16 animate-pulse rounded bg-border" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-44 animate-pulse rounded bg-muted" />
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !post && (
        <EmptyState
          icon={<Star weight="bold" className="size-7" />}
          iconColor="tertiary"
          title={emptyStateCopy.title}
          description={emptyStateCopy.description}
          className="py-6"
        />
      )}

      {/* Post content */}
      {!isLoading && post && (
        <>
          {/* Preview */}
          <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-muted px-5 py-4">
            {post.textPreview ? (
              <p className="line-clamp-3 text-[13px] leading-relaxed text-foreground">
                {post.textPreview}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted-foreground">
                [{post.mediaType.toLowerCase()} post]
              </p>
            )}
            <div className="flex gap-4">
              <span className="text-xs font-semibold text-primary">
                {formatNumber(post.views)} views
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatNumber(post.likes)} likes
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatNumber(post.replies)} replies
              </span>
            </div>
          </div>

          {/* Why it worked */}
          {post.whyFactors.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Why it worked
              </span>
              <div className="flex flex-col gap-1">
                {post.whyFactors.map((factor) => (
                  <span key={factor} className="text-xs text-foreground">
                    {"\u2022 "}{factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
