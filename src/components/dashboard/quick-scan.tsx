"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";

import { QualityGauge } from "@/components/dashboard/quality-gauge";
import {
  analyzeHeuristics,
  computeHeuristicScore,
  type QualityIssue,
} from "@/lib/quality-heuristics";

// ── Constants ────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const MAX_ISSUES_SHOWN = 3;

// ── Component ────────────────────────────────────────────────────────

export function QuickScan() {
  const [text, setText] = useState("");
  const [score, setScore] = useState(100);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const trimmed = value.trim();
        if (!trimmed) {
          setScore(100);
          setIssues([]);
          return;
        }
        const detected = analyzeHeuristics(trimmed);
        setIssues(detected);
        setScore(computeHeuristicScore(detected));
      }, DEBOUNCE_MS);
    },
    [],
  );

  const hasText = text.trim().length > 0;

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-quaternary text-white">
          <MagnifyingGlass weight="bold" className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Quick Scan
        </p>
      </div>

      {/* Textarea + gauge */}
      <div className="flex gap-4">
        <textarea
          value={text}
          onChange={handleChange}
          rows={3}
          placeholder="Paste a draft to quick-check quality..."
          aria-label="Draft text to quick-scan"
          className="w-full resize-y rounded-[var(--radius-md)] border-2 border-[#CBD5E1] bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:shadow-[4px_4px_0_var(--accent)] focus:outline-none"
        />
        {hasText && (
          <div className="flex shrink-0 items-start">
            <QualityGauge score={score} />
          </div>
        )}
      </div>

      {/* Issues preview */}
      {hasText && issues.length > 0 && (
        <div className="mt-3 space-y-1">
          {issues.slice(0, MAX_ISSUES_SHOWN).map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Warning
                weight="bold"
                className={`mt-0.5 size-3 shrink-0 ${
                  issue.severity === "high"
                    ? "text-destructive"
                    : issue.severity === "medium"
                      ? "text-tertiary"
                      : "text-muted-foreground"
                }`}
              />
              <p className="text-xs text-muted-foreground">
                {issue.description}
              </p>
            </div>
          ))}
          {issues.length > MAX_ISSUES_SHOWN && (
            <p className="text-xs text-muted-foreground">
              +{issues.length - MAX_ISSUES_SHOWN} more issue
              {issues.length - MAX_ISSUES_SHOWN > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Link to full scanner */}
      <div className="mt-4 flex justify-end">
        <Link
          href="/dashboard/create/scanner"
          className="inline-flex items-center gap-1 text-xs font-bold text-accent transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:gap-2"
        >
          Open full scanner
          <ArrowRight weight="bold" className="size-3" />
        </Link>
      </div>
    </div>
  );
}
