"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brain } from "@phosphor-icons/react/dist/ssr/Brain";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr/ChartLineUp";
import { Palette } from "@phosphor-icons/react/dist/ssr/Palette";
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RulePill } from "@/components/dashboard/rule-pill";
import { MIN_POST_LENGTH } from "@/lib/quality-heuristics";
import { extractCompletedAxes } from "@/lib/scanner-stream-parser";
import type {
  AxisDiagnostic,
  FindingSeverity,
  NeighborPost,
  ScannerDiagnosticV2,
} from "@/lib/quality-scanner-shared";

const DEBOUNCE_MS = 500;

type AxisKey = "styleMatch" | "psychology" | "algorithm" | "aiDetection";

interface AxisConfig {
  key: AxisKey;
  title: string;
  description: string;
  icon: ReactNode;
  iconColor: "primary" | "secondary" | "tertiary" | "quaternary";
}

const AXIS_CONFIG: AxisConfig[] = [
  {
    key: "styleMatch",
    title: "Style Matching",
    description:
      "How closely the draft matches your voice and top-performing posts.",
    icon: <Palette weight="bold" className="size-6" />,
    iconColor: "quaternary",
  },
  {
    key: "psychology",
    title: "Psychology Triggers",
    description: "Hook type, cognitive biases, and retellability.",
    icon: <Brain weight="bold" className="size-6" />,
    iconColor: "secondary",
  },
  {
    key: "algorithm",
    title: "Algorithm Alignment",
    description: "Rule references, red-line checks, and distribution signals.",
    icon: <ChartLineUp weight="bold" className="size-6" />,
    iconColor: "tertiary",
  },
  {
    key: "aiDetection",
    title: "AI-Tone Detection",
    description: "Markers that make the draft read as AI-generated.",
    icon: <Robot weight="bold" className="size-6" />,
    iconColor: "primary",
  },
];

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  info: "border-primary/30 bg-primary/10 text-primary",
  flag: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  warn: "border-destructive/30 bg-destructive/10 text-destructive",
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  info: "Info",
  flag: "Flag",
  warn: "Warn",
};

type AxisState =
  | { status: "pending" }
  | { status: "streaming" }
  | { status: "complete"; data: AxisDiagnostic }
  | { status: "error"; message: string };

type AxisStateMap = Record<AxisKey, AxisState>;

function initialAxisState(): AxisStateMap {
  return {
    styleMatch: { status: "pending" },
    psychology: { status: "pending" },
    algorithm: { status: "pending" },
    aiDetection: { status: "pending" },
  };
}

interface FourAxisScannerProps {
  text: string;
}

export function FourAxisScanner({ text }: FourAxisScannerProps) {
  const [axes, setAxes] = useState<AxisStateMap>(initialAxisState);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < MIN_POST_LENGTH) {
      abortRef.current?.abort();
      setAxes(initialAxisState());
      setStreamError(null);
      setPartialWarning(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void startStream(trimmed, controller.signal);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function startStream(input: string, signal: AbortSignal): Promise<void> {
    setStreamError(null);
    setPartialWarning(null);
    setAxes({
      styleMatch: { status: "streaming" },
      psychology: { status: "streaming" },
      algorithm: { status: "streaming" },
      aiDetection: { status: "streaming" },
    });

    try {
      const response = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
        signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Analysis failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulator = "";
      let buffer = "";
      let v2ResultApplied = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;
          const payload = trimmedLine.slice(6);

          if (payload === "[DONE]") continue;

          if (payload.startsWith("{")) {
            let obj: Record<string, unknown> | null = null;
            try {
              obj = JSON.parse(payload) as Record<string, unknown>;
            } catch {
              // Malformed sentinel — skip this line. A text delta would
              // start with `"`, so we never fall through to the delta path.
            }

            if (obj) {
              if (typeof obj.error === "string") {
                throw new Error(obj.error);
              }
              if (obj.__v2_result && isValidScannerResult(obj.__v2_result)) {
                applyFinalResult(obj.__v2_result as ScannerDiagnosticV2);
                v2ResultApplied = true;
              } else if (typeof obj.__v2_error === "string") {
                setPartialWarning(
                  `Final analysis incomplete — partial results shown. (${obj.__v2_error})`,
                );
              }
            }
            continue;
          }

          try {
            const delta = JSON.parse(payload);
            if (typeof delta === "string") {
              accumulator += delta;
              applyPartialAxes(accumulator);
            }
          } catch {
            // Non-JSON payload — ignore
          }
        }
      }

      if (!v2ResultApplied) {
        setAxes((prev) => {
          const next = { ...prev };
          for (const { key } of AXIS_CONFIG) {
            if (
              next[key].status === "streaming" ||
              next[key].status === "pending"
            ) {
              next[key] = {
                status: "error",
                message: "Axis did not complete.",
              };
            }
          }
          return next;
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setStreamError(message);
      setAxes((prev) => {
        const next = { ...prev };
        for (const { key } of AXIS_CONFIG) {
          if (next[key].status !== "complete") {
            next[key] = { status: "error", message };
          }
        }
        return next;
      });
    }
  }

  function applyPartialAxes(accumulator: string): void {
    const partial = extractCompletedAxes(accumulator);
    setAxes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { key } of AXIS_CONFIG) {
        const parsed = partial[key];
        if (parsed && next[key].status !== "complete") {
          next[key] = { status: "complete", data: parsed };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function applyFinalResult(result: ScannerDiagnosticV2): void {
    setAxes({
      styleMatch: { status: "complete", data: result.styleMatch },
      psychology: { status: "complete", data: result.psychology },
      algorithm: { status: "complete", data: result.algorithm },
      aiDetection: { status: "complete", data: result.aiDetection },
    });
  }

  if (!text.trim() || text.trim().length < MIN_POST_LENGTH) {
    return null;
  }

  return (
    <div className="space-y-6">
      {streamError && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border-2 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {streamError}
        </div>
      )}
      {partialWarning && !streamError && (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border-2 border-tertiary/40 bg-tertiary/10 p-4 text-sm text-tertiary"
        >
          {partialWarning}
        </div>
      )}
      <div className="space-y-6">
        {AXIS_CONFIG.map((cfg) => (
          <AxisCard key={cfg.key} config={cfg} state={axes[cfg.key]} />
        ))}
      </div>
    </div>
  );
}

interface AxisCardProps {
  config: AxisConfig;
  state: AxisState;
}

function AxisCard({ config, state }: AxisCardProps) {
  return (
    <CollapsibleSection
      title={config.title}
      description={config.description}
      summary={<AxisSummaryBadge state={state} />}
      icon={config.icon}
      iconColor={config.iconColor}
      defaultOpen
    >
      <AxisCardBody config={config} state={state} />
    </CollapsibleSection>
  );
}

function AxisSummaryBadge({ state }: { state: AxisState }) {
  if (state.status === "streaming" || state.status === "pending") {
    return <span className="text-xs text-muted-foreground">Analyzing…</span>;
  }
  if (state.status === "error") {
    return <span className="text-xs text-destructive">Error</span>;
  }
  const counts: Record<FindingSeverity, number> = {
    warn: 0,
    flag: 0,
    info: 0,
  };
  for (const f of state.data.findings) counts[f.severity]++;
  const orderedSeverities: FindingSeverity[] = ["warn", "flag", "info"];
  const chips = orderedSeverities
    .filter((s) => counts[s] > 0)
    .map((s) => (
      <span
        key={s}
        className={`inline-flex items-center rounded-full border-2 px-2 py-0.5 text-[0.7rem] font-bold leading-none ${SEVERITY_STYLES[s]}`}
      >
        {counts[s]} {SEVERITY_LABEL[s].toLowerCase()}
      </span>
    ));
  if (chips.length === 0) {
    return <span className="text-xs text-muted-foreground">Clean</span>;
  }
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function AxisCardBody({ config, state }: AxisCardProps) {
  if (state.status === "pending") {
    return <p className="text-sm text-muted-foreground">Waiting for input…</p>;
  }
  if (state.status === "streaming") {
    return (
      <div className="space-y-3" aria-live="polite" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-[var(--radius-md)] bg-muted"
          />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t analyze this axis. {state.message}
      </p>
    );
  }

  const { summary, findings, neighborPosts } = state.data;
  const isAlgorithm = config.key === "algorithm";
  const isStyleMatch = config.key === "styleMatch";

  return (
    <div className="space-y-4">
      {summary && <p className="text-sm text-foreground">{summary}</p>}
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No flags detected for this axis.
        </p>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding, i) => (
            <li
              key={i}
              className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border-2 border-border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={finding.severity} />
                {isAlgorithm && finding.rule && (
                  <RulePill rule={finding.rule} />
                )}
              </div>
              <p className="text-sm text-foreground">{finding.message}</p>
              {finding.evidence && (
                <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                  {finding.evidence}
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
      {isStyleMatch && neighborPosts && neighborPosts.length > 0 && (
        <NeighborStrip neighbors={neighborPosts} />
      )}
    </div>
  );
}

function SeverityChip({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 px-2 py-0.5 text-[0.7rem] font-bold uppercase leading-none ${SEVERITY_STYLES[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function NeighborStrip({ neighbors }: { neighbors: NeighborPost[] }) {
  return (
    <div className="space-y-2 border-t-2 border-border pt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Similar posts
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {neighbors.slice(0, 3).map((n) => (
          <NeighborCard key={n.id} neighbor={n} />
        ))}
      </div>
    </div>
  );
}

function NeighborCard({ neighbor }: { neighbor: NeighborPost }) {
  const cardClass =
    "block rounded-[var(--radius-md)] border-2 border-border bg-card p-2 text-xs transition-colors";
  const body = (
    <>
      <p className="line-clamp-2 text-foreground">{neighbor.textPreview}</p>
      <div className="mt-1 flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span className="font-bold">{neighbor.wesNormalized.toFixed(1)}%</span>
        <span>{formatShortDate(neighbor.publishedAt)}</span>
      </div>
    </>
  );
  if (neighbor.permalink) {
    return (
      <a
        href={neighbor.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cardClass} hover:border-foreground/60 hover:bg-muted`}
      >
        {body}
      </a>
    );
  }
  return <div className={cardClass}>{body}</div>;
}

function isValidScannerResult(value: unknown): value is ScannerDiagnosticV2 {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    isAxisDiagnosticShape(record.styleMatch) &&
    isAxisDiagnosticShape(record.psychology) &&
    isAxisDiagnosticShape(record.algorithm) &&
    isAxisDiagnosticShape(record.aiDetection)
  );
}

function isAxisDiagnosticShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.summary === "string" && Array.isArray(record.findings)
  );
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
