"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { cn } from "@/lib/utils";
import type {
  TopicSuggestion,
  SemanticDistance,
} from "@/lib/topic-suggestions";

// ── Dot color map (matches topic-suggestions.tsx) ─────────────────────

const DISTANCE_DOT: Record<SemanticDistance, string> = {
  near: "bg-quaternary",
  medium: "bg-tertiary",
  far: "bg-muted-foreground",
};

// Fallback ordered colors when distance isn't the primary signal
const ORDERED_DOT_COLORS = ["bg-quaternary", "bg-secondary", "bg-tertiary"];

// ── Component ─────────────────────────────────────────────────────────

export function WhatToPostCard({
  isImporting = false,
  className,
}: {
  isImporting?: boolean;
  className?: string;
}) {
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(!isImporting);
  const [isInsufficient, setIsInsufficient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isImporting) return;

    const controller = new AbortController();

    async function fetchTopics() {
      try {
        const res = await fetch("/api/topics", {
          method: "POST",
          signal: controller.signal,
        });

        if (!res.ok) {
          setError("Failed to load suggestions");
          setIsLoading(false);
          return;
        }

        const data = await res.json();

        if (data.insufficient) {
          setIsInsufficient(true);
          setIsLoading(false);
          return;
        }

        setTopics((data.suggestions ?? []).slice(0, 3));
        setIsLoading(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Failed to load suggestions");
        setIsLoading(false);
      }
    }

    fetchTopics();
    return () => controller.abort();
  }, [isImporting]);

  const firstTopic = topics[0]?.name;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkle weight="fill" className="size-5 text-primary" />
        <h3 className="font-heading text-base font-bold">What to Post Next</h3>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 py-3">
            <SpinnerGap
              weight="bold"
              className="size-4 animate-spin text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Analyzing your topics&hellip;
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <p className="py-2 text-xs text-muted-foreground">{error}</p>
      )}

      {/* Insufficient posts */}
      {!isLoading && !error && (isInsufficient || isImporting) && (
        <p className="py-2 text-xs text-muted-foreground">
          {isImporting
            ? "Analyzing your content\u2026"
            : "Post at least 5 times to unlock topic suggestions."}
        </p>
      )}

      {/* Topic rows */}
      {!isLoading && !error && !isInsufficient && !isImporting && topics.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {topics.map((topic, i) => (
              <div
                key={topic.name}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-muted px-4 py-3"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    DISTANCE_DOT[topic.semanticDistance] ?? ORDERED_DOT_COLORS[i % 3],
                  )}
                />
                <span className="text-[13px] font-medium text-foreground">
                  {topic.name}
                  {topic.rationale && (
                    <span className="text-muted-foreground">
                      {" \u2014 "}
                      {topic.rationale}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {firstTopic && (
            <Link
              href={`/dashboard/create/compose?topic=${encodeURIComponent(firstTopic)}`}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              <PencilLine weight="bold" className="size-4" />
              Go compose
            </Link>
          )}
        </>
      )}

      {/* No suggestions */}
      {!isLoading && !error && !isInsufficient && !isImporting && topics.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          No suggestions available right now.
        </p>
      )}
    </div>
  );
}
