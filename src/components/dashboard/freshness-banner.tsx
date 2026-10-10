"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";

import { Button } from "@/components/ui/button";
import type {
  FreshnessResult,
  FreshnessSource,
} from "@/lib/freshness-gate";

export type FreshnessPayload =
  | FreshnessResult
  | { runId: string | null; rateLimited: true }
  | null;

export function isRateLimited(
  f: FreshnessPayload,
): f is { runId: string | null; rateLimited: true } {
  return f !== null && "rateLimited" in f && f.rateLimited === true;
}

interface VerdictCopy {
  title: string;
  body: string;
  ctaLabel: string;
}

function verdictCopy(f: FreshnessResult): VerdictCopy {
  const self = f.selfRepetitionRisk;
  const extBand = f.externalSignal.saturation;

  if (f.verdict === "red") {
    if (self.severity === "high") {
      return {
        title: "You've covered this recently",
        body: self.matchedCluster
          ? `${self.counts.d7} post${self.counts.d7 === 1 ? "" : "s"} in the last 7 days tagged “${self.matchedCluster}.” Repetition this tight burns freshness fast.`
          : "Your recent posts cluster tightly around this angle.",
        ctaLabel: "Compose anyway",
      };
    }
    if (extBand === "red") {
      return {
        title: "This topic looks saturated",
        body: "Highly-related trending topics are already dominating the feed. Reach may compress against the wave.",
        ctaLabel: "Compose anyway",
      };
    }
    return {
      title: "Freshness warning",
      body: "Multiple signals suggest caution on this angle.",
      ctaLabel: "Compose anyway",
    };
  }

  if (f.verdict === "yellow") {
    if (self.severity === "medium" || self.severity === "low") {
      return {
        title: "Similar to recent posts",
        body: self.matchedCluster
          ? `You've posted about “${self.matchedCluster}” recently (${self.counts.d30} in 30 days). Consider a fresh angle.`
          : "Your recent posts brush against this angle.",
        ctaLabel: "Continue",
      };
    }
    if (extBand === "yellow") {
      return {
        title: "Related trends are active",
        body: "There's room to post on this, but expect some competition for attention.",
        ctaLabel: "Continue",
      };
    }
    return {
      title: "Freshness caution",
      body: "One or more signals suggest tuning the angle.",
      ctaLabel: "Continue",
    };
  }

  return {
    title: "Fresh angle",
    body: "No saturation or self-repetition detected.",
    ctaLabel: "Continue",
  };
}

function verdictTheme(verdict: "green" | "yellow" | "red") {
  switch (verdict) {
    case "red":
      return {
        border: "border-destructive/30",
        bg: "bg-destructive/10",
        icon: "text-destructive",
        Icon: WarningCircle,
      };
    case "yellow":
      return {
        border: "border-tertiary/40",
        bg: "bg-tertiary/10",
        icon: "text-tertiary-foreground",
        Icon: WarningCircle,
      };
    case "green":
      return {
        border: "border-quaternary/40",
        bg: "bg-quaternary/10",
        icon: "text-quaternary",
        Icon: CheckCircle,
      };
  }
}

function SourcesList({ sources }: { sources: FreshnessSource[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No specific sources — this verdict combines weak signals.
      </p>
    );
  }
  const external = sources.filter((s) => s.type === "external");
  const self = sources.filter((s) => s.type === "self");

  return (
    <div className="space-y-3">
      {external.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trending on X
          </p>
          <ul className="space-y-1 text-sm">
            {external.map((s, i) => (
              <li key={`ext-${i}`} className="text-foreground">
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {self.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your recent posts
          </p>
          <ul className="space-y-1 text-sm">
            {self.map((s, i) => (
              <li key={`self-${i}`}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground"
                  >
                    {s.label}
                  </a>
                ) : (
                  <span className="text-foreground">{s.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface FreshnessBannerProps {
  freshness: FreshnessPayload;
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export function FreshnessBanner({
  freshness,
  acknowledged,
  onAcknowledge,
}: FreshnessBannerProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (freshness === null) return null;

  if (isRateLimited(freshness)) {
    return (
      <div className="mb-4 rounded-[var(--radius-md)] border border-muted-foreground/30 bg-muted px-4 py-3">
        <div className="flex items-start gap-3">
          <Info
            weight="bold"
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              Freshness check temporarily unavailable
            </p>
            <p className="text-sm text-muted-foreground">
              Hourly limit reached. Drafts will still generate — try again
              later for a full check.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { verdict, externalSignal, sources } = freshness;

  // Green = silent. The composer auto-acknowledges green verdicts so drafts
  // render without interruption; surfacing a confirmation adds noise.
  if (verdict === "green") return null;

  const theme = verdictTheme(verdict);
  const copy = verdictCopy(freshness);
  const { Icon } = theme;

  return (
    <div
      className={`mb-4 rounded-[var(--radius-md)] border ${theme.border} ${theme.bg} px-4 py-3`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon
          weight="bold"
          className={`mt-0.5 size-5 shrink-0 ${theme.icon}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold">{copy.title}</p>
            <p className="text-sm text-muted-foreground">{copy.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setWhyOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            aria-expanded={whyOpen}
          >
            {whyOpen ? "Hide details" : "Why?"}
            <motion.span
              animate={{ rotate: whyOpen ? 180 : 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 20 }
              }
            >
              <CaretDown weight="bold" className="size-3" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {whyOpen && (
              <motion.div
                initial={
                  shouldReduceMotion ? false : { height: 0, opacity: 0 }
                }
                animate={{ height: "auto", opacity: 1 }}
                exit={
                  shouldReduceMotion ? undefined : { height: 0, opacity: 0 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 300, damping: 25 }
                }
                style={{ overflow: "hidden" }}
              >
                <div className="pt-2">
                  <SourcesList sources={sources} />
                  {externalSignal.unavailable && !isRateLimited(freshness) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      External trend signal is unavailable right now — verdict
                      based on your posts only.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button
          size="sm"
          variant={verdict === "red" ? "candy" : "outline"}
          onClick={onAcknowledge}
          disabled={acknowledged}
        >
          {acknowledged ? "Composing…" : copy.ctaLabel}
        </Button>
      </div>
    </div>
  );
}
