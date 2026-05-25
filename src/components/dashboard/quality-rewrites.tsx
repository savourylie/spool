"use client";

import { Button } from "@/components/ui/button";
import type { SuggestedRewrite } from "@/lib/quality-scanner-shared";

interface QualityRewritesProps {
  rewrites: SuggestedRewrite[];
  onApply: (text: string) => void;
}

export function QualityRewrites({ rewrites, onApply }: QualityRewritesProps) {
  if (rewrites.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Suggested Rewrites
      </h3>
      <ul className="space-y-3">
        {rewrites.map((rewrite, i) => (
          <li
            key={i}
            className="rounded-[var(--radius-sm)] border border-border p-3"
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {rewrite.label}
            </p>
            <p className="mb-3 whitespace-pre-wrap text-sm text-foreground">
              {rewrite.text}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApply(rewrite.text)}
            >
              Apply fix
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
