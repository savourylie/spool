"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";

import type {
  TopicSuggestion,
  SemanticDistance,
} from "@/lib/topic-suggestions";

// ── Types ────────────────────────────────────────────────────────────

interface TopicSuggestionsProps {
  onSelectTopic: (topicName: string) => void;
}

// ── Distance styling ─────────────────────────────────────────────────

const DISTANCE_DOT: Record<SemanticDistance, string> = {
  near: "bg-quaternary",
  medium: "bg-tertiary",
  far: "bg-muted-foreground",
};

const DISTANCE_HOVER: Record<SemanticDistance, string> = {
  near: "hover:bg-quaternary/5",
  medium: "hover:bg-paper-2/5",
  far: "hover:bg-muted/50",
};

const DISTANCE_LABEL: Record<SemanticDistance, string> = {
  near: "Near",
  medium: "Medium",
  far: "Far",
};

// ── Component ────────────────────────────────────────────────────────

export function TopicSuggestions({ onSelectTopic }: TopicSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInsufficient, setIsInsufficient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTokens, setGeneratedTokens] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSuggestions() {
      setSuggestions([]);
      setError(null);
      setIsInsufficient(false);
      setGeneratedTokens(0);
      setIsLoading(true);

      try {
        const res = await fetch("/api/topics?stream=1", {
          method: "POST",
          signal: controller.signal,
        });

        if (!res.ok) {
          setError("Failed to load suggestions");
          setIsLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const msg of messages) {
            const trimmed = msg.trim();
            if (!trimmed) continue;

            if (trimmed === "data: [DONE]") {
              setIsLoading(false);
              return;
            }

            const eventMatch = trimmed.match(/^event:\s*(\w+)/m);
            const dataMatch = trimmed.match(/^data:\s*(.+)$/m);

            if (!eventMatch || !dataMatch) {
              continue;
            }

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataMatch[1]);
            } catch {
              continue;
            }

            switch (eventMatch[1]) {
              case "progress":
                setGeneratedTokens(
                  Math.max(0, Number(data.generatedTokens) || 0),
                );
                break;
              case "result":
                if (data.insufficient) {
                  setIsInsufficient(true);
                  setSuggestions([]);
                } else {
                  setSuggestions((data.suggestions as TopicSuggestion[]) ?? []);
                }
                break;
              case "error":
                setError("Failed to load suggestions");
                setIsLoading(false);
                return;
            }
          }
        }

        setIsLoading(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Failed to load suggestions");
        setIsLoading(false);
      }
    }

    fetchSuggestions();

    return () => controller.abort();
  }, []);

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] bg-paper-2 text-ink-3">
          <Lightbulb weight="bold" className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Suggested Topics
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-start gap-2 py-3">
          <SpinnerGap
            weight="bold"
            className="size-4 animate-spin text-muted-foreground"
          />
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              Analyzing your topics&hellip;
            </p>
            <p className="text-[10px] font-medium tabular-nums text-muted-foreground">
              {generatedTokens > 0
                ? `~${generatedTokens} tokens generated`
                : "Waiting for first tokens..."}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <p className="py-2 text-xs text-muted-foreground">{error}</p>
      )}

      {/* Insufficient posts */}
      {!isLoading && !error && isInsufficient && (
        <p className="py-2 text-xs text-muted-foreground">
          Post at least 5 times to unlock topic suggestions.
        </p>
      )}

      {/* Suggestions list */}
      {!isLoading && !error && !isInsufficient && suggestions.length > 0 && (
        <div className="space-y-0.5">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => onSelectTopic(s.name)}
              title={s.rationale}
              aria-label={`${s.name} — ${s.rationale}`}
              className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-all duration-300 [transition-timing-function:var(--ease-bounce)] ${DISTANCE_HOVER[s.semanticDistance]}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${DISTANCE_DOT[s.semanticDistance]}`}
                />
                <span className="text-sm font-medium text-foreground">
                  {s.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {DISTANCE_LABEL[s.semanticDistance]}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {s.relevanceScore}%
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No suggestions returned (but sufficient posts) */}
      {!isLoading &&
        !error &&
        !isInsufficient &&
        suggestions.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">
            No suggestions available right now.
          </p>
        )}
    </div>
  );
}
