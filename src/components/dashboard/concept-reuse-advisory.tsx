"use client";

import { Lightbulb, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ConceptAdvisoryPayload } from "@/lib/concept-library-view";

interface ConceptReuseAdvisoryProps {
  advisory: ConceptAdvisoryPayload;
  onDismiss: () => void;
}

const riskClass: Record<
  ConceptAdvisoryPayload["matches"][number]["reuseRisk"],
  string
> = {
  green: "bg-quaternary",
  yellow: "bg-tertiary",
  red: "bg-destructive",
};

function formatAnalogies(
  analogies: ConceptAdvisoryPayload["matches"][number]["analogies"],
): string {
  if (analogies.length === 0) return "No analogies captured yet.";
  return analogies
    .map((item) => `${item.analogy} (${item.count}x)`)
    .join(", ");
}

export function ConceptReuseAdvisory({
  advisory,
  onDismiss,
}: ConceptReuseAdvisoryProps) {
  const primary = advisory.matches[0];
  if (!primary) return null;

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-foreground bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary text-white">
          <Lightbulb weight="bold" className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">
                Heads up - you&apos;ve explained &quot;{primary.concept}&quot;{" "}
                {primary.usesInWindow}{" "}
                {primary.usesInWindow === 1 ? "time" : "times"} in the last{" "}
                {advisory.windowDays} days.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Analogies used: {formatAnalogies(primary.analogies)} Consider a
                fresh angle.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss concept advisory"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X weight="bold" className="size-4" />
            </button>
          </div>

          {advisory.matches.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {advisory.matches.slice(1).map((match) => (
                <span
                  key={match.concept}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-muted px-2.5 py-1 text-xs font-bold"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      riskClass[match.reuseRisk],
                    )}
                    aria-hidden="true"
                  />
                  {match.concept}: {match.usesInWindow}x
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
