"use client";

import { useMemo } from "react";
import { Target } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TopicModelCluster } from "@/lib/topic-model";
import { getAudienceTopicFit } from "@/lib/topic-model";
import type { DemographicSnapshot } from "@/lib/audience-fit";

interface AudienceTopicFitProps {
  clusters: TopicModelCluster[];
  demographics: DemographicSnapshot[];
  totalPosts: number;
  isLoading?: boolean;
}

const fitLabelStyles = {
  strong: "bg-quaternary/20 text-emerald-700",
  average: "bg-tertiary/20 text-amber-700",
  weak: "bg-secondary/20 text-pink-700",
} as const;

function AudienceTopicFitSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-2">
        <div className="h-10 w-16 animate-pulse rounded bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function AudienceTopicFit({
  clusters,
  demographics,
  totalPosts,
  isLoading,
}: AudienceTopicFitProps) {
  const fitEntries = useMemo(
    () => getAudienceTopicFit(clusters, demographics),
    [clusters, demographics],
  );

  const coreTopics = useMemo(
    () => clusters.filter((c) => c.name !== "Other"),
    [clusters],
  );

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="quaternary">
        <Target weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Content Focus</StickerCardTitle>
        <StickerCardDescription>
          Topic distribution and audience fit
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {isLoading ? (
          <AudienceTopicFitSkeleton />
        ) : clusters.length === 0 ? (
          <EmptyState
            icon={<Target weight="bold" className="size-7" />}
            iconColor="quaternary"
            title="No topic data yet"
            description="Content focus insights will appear once your posts have topic tags assigned."
          />
        ) : (
          <div className="space-y-6">
            {/* Total posts stat */}
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-medium">
                {totalPosts}
              </span>
              <span className="text-sm text-muted-foreground">Posts total</span>
            </div>

            <p className="text-sm text-muted-foreground">
              Your content is spread across {clusters.length} topic
              {clusters.length !== 1 ? "s" : ""}. The topics below show which
              themes resonate most with your audience.
            </p>

            {/* Core Topics pills */}
            {coreTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Core Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {coreTopics.map((topic) => (
                    <span
                      key={topic.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-foreground px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${topic.color}30` }}
                    >
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: topic.color }}
                        aria-hidden="true"
                      />
                      {topic.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Audience-Topic Fit */}
            {fitEntries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Audience-Topic Fit
                </p>
                <div className="space-y-2">
                  {fitEntries.map((entry) => (
                    <div
                      key={entry.topicName}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium">{entry.topicName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {entry.relativePerformance >= 0 ? "+" : ""}
                          {entry.relativePerformance.toFixed(0)}%
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            fitLabelStyles[entry.fitLabel],
                          )}
                        >
                          {entry.fitLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
