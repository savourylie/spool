"use client";

import type { QualityIssue, IssueSeverity } from "@/lib/quality-heuristics";

const severityOrder: Record<IssueSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const severityStyles: Record<
  IssueSeverity,
  { badge: string; label: string }
> = {
  high: {
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    label: "HIGH",
  },
  medium: {
    badge: "border-tertiary/30 bg-tertiary/10 text-tertiary",
    label: "MEDIUM",
  },
  low: {
    badge: "border-primary/30 bg-primary/10 text-primary",
    label: "LOW",
  },
};

interface QualityIssuesListProps {
  issues: QualityIssue[];
}

export function QualityIssuesList({ issues }: QualityIssuesListProps) {
  if (issues.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No issues detected.
      </p>
    );
  }

  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Issues
      </h3>
      <ul className="space-y-2">
        {sorted.map((issue) => {
          const style = severityStyles[issue.severity];
          return (
            <li
              key={issue.id}
              className="rounded-[var(--radius-sm)] border border-border p-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
                >
                  {style.label}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {issue.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {issue.suggestion}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
