"use client";

import { useMemo } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import type { TopicModelCluster } from "@/lib/topic-model";
import { getTopicPerformanceComparison } from "@/lib/topic-model";

interface TopicPerformanceProps {
  clusters: TopicModelCluster[];
  isLoading?: boolean;
}

function TopicPerformanceSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function TopicPerformance({ clusters, isLoading }: TopicPerformanceProps) {
  const bars = useMemo(
    () => getTopicPerformanceComparison(clusters),
    [clusters],
  );

  const maxEngagement = useMemo(
    () => (bars.length > 0 ? Math.max(...bars.map((b) => b.avgEngagement)) : 0),
    [bars],
  );

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="secondary">
        <ChartBar weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Topic Performance</StickerCardTitle>
        <StickerCardDescription>
          Average engagement by topic
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {isLoading ? (
          <TopicPerformanceSkeleton />
        ) : bars.length === 0 ? (
          <EmptyState
            icon={<ChartBar weight="bold" className="size-7" />}
            iconColor="secondary"
            title="No topic data yet"
            description="Topic performance will appear once your posts have topic tags assigned."
          />
        ) : (
          <div
            className="space-y-4"
            role="img"
            aria-label={`Topic performance chart. Top topic: ${bars[0]?.name} at ${bars[0]?.avgEngagement.toFixed(2)}% average engagement`}
          >
            {bars.map((bar) => {
              const widthPct =
                maxEngagement > 0
                  ? (bar.avgEngagement / maxEngagement) * 100
                  : 0;

              return (
                <div key={bar.name} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bar.name}</span>
                      <ConfidenceBadge sample={bar.postCount} compact />
                    </div>
                    <span className="text-muted-foreground">
                      {bar.avgEngagement.toFixed(2)}% avg eng
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
