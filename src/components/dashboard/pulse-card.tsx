"use client";

import { Pulse } from "@phosphor-icons/react/dist/ssr/Pulse";
import { TrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { TrendDown } from "@phosphor-icons/react/dist/ssr/TrendDown";
import { Minus } from "@phosphor-icons/react/dist/ssr/Minus";
import type { Icon } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { getPulseEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import { cn } from "@/lib/utils";
import type { VelocityTrend } from "@/lib/today-hub-helpers";

// ── Velocity config ───────────────────────────────────────────────────

const TREND_CONFIG: Record<
  VelocityTrend,
  { Icon: Icon; colorClass: string; label: string }
> = {
  up: {
    Icon: TrendUp,
    colorClass: "text-quaternary",
    label: "Velocity trending up vs. last week",
  },
  down: {
    Icon: TrendDown,
    colorClass: "text-destructive",
    label: "Velocity trending down vs. last week",
  },
  flat: {
    Icon: Minus,
    colorClass: "text-muted-foreground",
    label: "Velocity flat vs. last week",
  },
};

// ── Component ─────────────────────────────────────────────────────────

interface PulseCardProps {
  followersDelta: number;
  postCount: number;
  avgEngagementRate: number;
  velocityTrend: VelocityTrend;
  isLoading?: boolean;
  isImporting?: boolean;
  className?: string;
}

export function PulseCard({
  followersDelta,
  postCount,
  avgEngagementRate,
  velocityTrend,
  isLoading = false,
  isImporting = false,
  className,
}: PulseCardProps) {
  const emptyStateCopy = getPulseEmptyStateCopy(isImporting);
  const trend = TREND_CONFIG[velocityTrend];
  const isEmpty = followersDelta === 0 && postCount === 0 && avgEngagementRate === 0;

  // Followers delta color
  const followerColor =
    followersDelta > 0
      ? "text-quaternary"
      : followersDelta < 0
        ? "text-destructive"
        : "text-foreground";

  const followerText =
    followersDelta > 0
      ? `+${followersDelta}`
      : String(followersDelta);

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
          <Pulse weight="bold" className="size-5 text-primary" />
          <h3 className="font-heading text-base font-medium">Pulse (7d)</h3>
        </div>
        {!isLoading && <ConfidenceBadge sample={postCount} compact />}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-14 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <EmptyState
          icon={<Pulse weight="bold" className="size-7" />}
          iconColor="primary"
          title={emptyStateCopy.title}
          description={emptyStateCopy.description}
          className="py-6"
        />
      )}

      {/* Metrics */}
      {!isLoading && !isEmpty && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className={cn("font-heading text-2xl font-medium", followerColor)}>
                {followerText}
              </span>
              <span className="text-xs text-muted-foreground">Followers</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-2xl font-medium text-foreground">
                {postCount}
              </span>
              <span className="text-xs text-muted-foreground">Posts</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-2xl font-medium text-primary">
                {avgEngagementRate.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">Avg Eng.</span>
            </div>
          </div>

          {/* Velocity trend */}
          <div className="flex items-center gap-1.5">
            <trend.Icon weight="bold" className={cn("size-4", trend.colorClass)} />
            <span className={cn("text-xs font-medium", trend.colorClass)}>
              {trend.label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
