import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { FreshnessChip } from "@/lib/today-hub-freshness";
import type { TopicSuggestion } from "@/lib/topic-suggestions";

const VERDICT_DOT: Record<FreshnessChip["verdict"], string> = {
  green: "bg-quaternary",
  yellow: "bg-tertiary",
};

interface WhatToPostCardProps {
  topics: TopicSuggestion[];
  freshness: Record<string, FreshnessChip>;
  reframes: Record<string, string>;
  /** True when suggestions were produced but every candidate failed the freshness gate. */
  allFilteredOut: boolean;
  /** True when the user has too few posts for suggestions. */
  insufficient: boolean;
  isImporting?: boolean;
  rateLimited?: boolean;
  className?: string;
}

export function WhatToPostCard({
  topics,
  freshness,
  reframes,
  allFilteredOut,
  insufficient,
  isImporting = false,
  rateLimited = false,
  className,
}: WhatToPostCardProps) {
  const firstTopic = topics[0]?.name;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkle weight="fill" className="size-5 text-primary" />
        <h3 className="font-heading text-base font-medium">What to Post Next</h3>
      </div>

      {isImporting && (
        <p className="py-2 text-xs text-muted-foreground">
          Analyzing your content&hellip;
        </p>
      )}

      {!isImporting && insufficient && (
        <p className="py-2 text-xs text-muted-foreground">
          Post at least 5 times to unlock topic suggestions.
        </p>
      )}

      {!isImporting && !insufficient && allFilteredOut && (
        <EmptyState
          icon={<Sparkle weight="fill" className="size-6" />}
          iconColor="primary"
          title="Nothing fresh surfaced"
          description="All suggested topics hit the freshness gate. Try a custom topic in Composer."
          action={{ label: "Open Composer", href: "/dashboard/create/compose" }}
          className="py-6"
        />
      )}

      {!isImporting && !insufficient && !allFilteredOut && topics.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {topics.map((topic) => {
              const chip = freshness[topic.name];
              const reframe = reframes[topic.name];
              const dotClass = chip
                ? VERDICT_DOT[chip.verdict]
                : "bg-muted-foreground";
              const tooltip =
                chip?.reasonShort ??
                "Freshness check unavailable — showing unfiltered.";
              return (
                <div
                  key={topic.name}
                  className="flex items-start gap-3 rounded-[var(--radius-sm)] bg-muted px-4 py-3"
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotClass)}
                    title={tooltip}
                    aria-label={tooltip}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13px] font-medium text-foreground">
                      {topic.name}
                      {topic.rationale && (
                        <span className="text-muted-foreground">
                          {" — "}
                          {topic.rationale}
                        </span>
                      )}
                    </span>
                    {reframe && (
                      <span className="text-[11px] text-muted-foreground">
                        Reframed angle:{" "}
                        <span className="text-foreground">{reframe}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {rateLimited && (
            <p className="text-[11px] text-muted-foreground">
              Freshness check temporarily unavailable — showing unfiltered
              suggestions.
            </p>
          )}

          {firstTopic && (
            <Link
              href={`/dashboard/create/compose?topic=${encodeURIComponent(firstTopic)}`}
              className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--ink-3))]"
            >
              <PencilLine weight="bold" className="size-4" />
              Go compose
            </Link>
          )}
        </>
      )}
    </div>
  );
}
