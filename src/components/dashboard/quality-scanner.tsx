"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Article } from "@phosphor-icons/react/dist/ssr/Article";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QualityGauge } from "@/components/dashboard/quality-gauge";
import { QualityIssuesList } from "@/components/dashboard/quality-issues-list";
import { QualityRewrites } from "@/components/dashboard/quality-rewrites";
import { PredictionWidget } from "@/components/dashboard/prediction-widget";
import { FourAxisScanner } from "@/components/dashboard/four-axis-scanner";
import {
  analyzeHeuristics,
  computeHeuristicScore,
  MIN_POST_LENGTH,
  type QualityIssue,
} from "@/lib/quality-heuristics";
import {
  parseAndValidateResponse,
  type LLMAnalysisResult,
  type MarkerMatch,
} from "@/lib/quality-scanner-shared";
import {
  predictEngagement,
  type HistoricalPost,
  type PredictionResult,
  type LLMRefinement,
  type PostCharacteristics,
} from "@/lib/engagement-prediction";

// ── Types ────────────────────────────────────────────────────────────

export interface ScannerPost {
  id: string;
  text_preview: string | null;
  text_full: string | null;
  published_at: string;
}

interface QualityScannerProps {
  posts: ScannerPost[];
  predictionPosts: HistoricalPost[];
  initialText?: string;
  /** When true, render the four-axis diagnostic UI (TICKET-078). Requires
   *  the server to have `SCANNER_V2_ENABLED=true` so `/api/scanner` returns
   *  the v2 stream shape. */
  scannerV2?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;
const THREADS_CHAR_LIMIT = 500;

// ── Component ────────────────────────────────────────────────────────

export function QualityScanner({
  posts,
  predictionPosts,
  initialText,
  scannerV2 = false,
}: QualityScannerProps) {
  const [text, setText] = useState("");
  const [heuristicIssues, setHeuristicIssues] = useState<QualityIssue[]>([]);
  const [heuristicScore, setHeuristicScore] = useState(100);
  const [llmResult, setLlmResult] = useState<LLMAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [llmRefinement, setLlmRefinement] = useState<LLMRefinement | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [activeAiMarker, setActiveAiMarker] = useState<MarkerMatch | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ──────────────────────────────────────────────

  const allIssues: QualityIssue[] = [
    ...heuristicIssues,
    ...(llmResult?.issues ?? []),
  ];
  const displayScore = llmResult
    ? computeHeuristicScore(allIssues)
    : heuristicScore;

  // ── SSE stream handler ─────────────────────────────────────────

  const startStream = useCallback(async (inputText: string, signal: AbortSignal) => {
    setLlmLoading(true);
    setLlmResult(null);
    setLlmError(null);

    try {
      const response = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
        signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Analysis failed (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulator = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last (possibly incomplete) chunk
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const payload = trimmed.slice(6);

          if (payload === "[DONE]") {
            try {
              const result = parseAndValidateResponse(accumulator);
              setLlmResult(result);
            } catch {
              setLlmError("Could not parse AI response.");
            }
            setLlmLoading(false);
            return;
          }

          // Check for error objects
          if (payload.startsWith("{")) {
            try {
              const obj = JSON.parse(payload);
              if (obj.error) {
                setLlmError(String(obj.error));
                setLlmLoading(false);
                return;
              }
            } catch {
              // Not a JSON error object — ignore
            }
          }

          // Text delta: JSON-encoded string
          try {
            const delta = JSON.parse(payload) as string;
            accumulator += delta;
          } catch {
            // Non-JSON payload — append raw
            accumulator += payload;
          }
        }
      }

      // Stream ended without [DONE] — try to parse what we have
      if (accumulator.trim()) {
        try {
          const result = parseAndValidateResponse(accumulator);
          setLlmResult(result);
        } catch {
          setLlmError("AI analysis ended unexpectedly.");
        }
      }
      setLlmLoading(false);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLlmError(
        error instanceof Error ? error.message : "Analysis failed.",
      );
      setLlmLoading(false);
    }
  }, []);

  // ── Debounced analysis ─────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed) {
      setHeuristicIssues([]);
      setHeuristicScore(100);
      setLlmResult(null);
      setLlmLoading(false);
      setLlmError(null);
      setPrediction(null);
      setLlmRefinement(null);
      setIsRefining(false);
      setIsPublishing(false);
      setIsPublished(false);
      setPublishError(null);
      setActiveAiMarker(null);
      abortRef.current?.abort();
      return;
    }

    setIsPublished(false);
    setPublishError(null);
    setActiveAiMarker(null);

    debounceRef.current = setTimeout(() => {
      // Abort previous in-flight requests and create a fresh controller
      // shared by all async work in this analysis cycle
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // 1. Heuristic analysis (sync, instant)
      const issues = analyzeHeuristics(trimmed);
      setHeuristicIssues(issues);
      setHeuristicScore(computeHeuristicScore(issues));

      // 2. LLM analysis (async, streamed) — v1 only. In v2, the
      //    FourAxisScanner owns its own stream against /api/scanner.
      if (!scannerV2 && trimmed.length >= MIN_POST_LENGTH) {
        startStream(trimmed, controller.signal);
      } else {
        setLlmResult(null);
        setLlmLoading(false);
      }

      // 3. Engagement prediction (sync, instant)
      const now = new Date();
      const chars: PostCharacteristics = {
        mediaType: "TEXT",
        textLength: trimmed.length,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
      };
      const predResult = predictEngagement(predictionPosts, chars);
      setPrediction(predResult);
      setLlmRefinement(null);

      // 4. Optional LLM refinement (async) — only if prediction succeeded
      if (predResult.status === "ok" && trimmed.length >= MIN_POST_LENGTH) {
        setIsRefining(true);
        fetch("/api/prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            p25: predResult.range.p25,
            p50: predResult.range.p50,
            p75: predResult.range.p75,
          }),
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setLlmRefinement(data as LLMRefinement);
          })
          .catch(() => {})
          .finally(() => setIsRefining(false));
      } else {
        setIsRefining(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, startStream, predictionPosts, scannerV2]);

  // ── Cleanup on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Pre-fill from initialText ─────────────────────────────────

  useEffect(() => {
    if (initialText && !text) {
      setText(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  // ── Post selector handler ──────────────────────────────────────

  const handleSelectPost = (post: ScannerPost) => {
    setText(post.text_full ?? post.text_preview ?? "");
    setShowPostSelector(false);
  };

  // ── Apply rewrite handler ──────────────────────────────────────

  const handleApplyRewrite = (rewriteText: string) => {
    setText(rewriteText);
  };

  const handleMarkPublished = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || prediction?.status !== "ok") {
      return;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await fetch("/api/scanner/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          range: prediction.range,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Failed to mark text as published (${response.status})`,
        );
      }

      setIsPublished(true);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Failed to mark text as published",
      );
      setIsPublished(false);
    } finally {
      setIsPublishing(false);
    }
  }, [prediction, text]);

  // ── Render ─────────────────────────────────────────────────────

  const hasText = text.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Input area + gauge */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
        {/* Left: textarea + controls */}
        <div className="space-y-2">
          <div className="relative">
            {scannerV2 && activeAiMarker && (
              <DraftHighlightOverlay text={text} marker={activeAiMarker} />
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste a draft post to analyze..."
              rows={5}
              aria-label="Draft post text to analyze"
              className={`relative z-20 w-full resize-y rounded-[var(--radius-md)] border border-[var(--input-border)] px-4 py-3 text-sm placeholder:text-muted-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] focus:border-primary focus:shadow-[var(--shadow-accent)] focus:outline-none ${
                scannerV2 && activeAiMarker
                  ? "bg-transparent text-transparent caret-foreground"
                  : "bg-input text-foreground"
              }`}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPostSelector(!showPostSelector)}
            >
              <Article weight="bold" className="size-4" />
              Analyze existing post
            </Button>

            <p
              className={`text-xs tabular-nums ${
                text.length > THREADS_CHAR_LIMIT
                  ? "font-bold text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {text.length} / {THREADS_CHAR_LIMIT}
            </p>
          </div>

          {/* Post selector */}
          <div
            className="grid transition-all duration-300 [transition-timing-function:var(--ease-bounce)]"
            style={{
              gridTemplateRows: showPostSelector ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              {posts.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No posts imported yet.
                </p>
              ) : (
                <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-[var(--radius-md)] border border-border p-2">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectPost(post)}
                        className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <p className="truncate text-sm text-foreground">
                          {post.text_preview ?? "(no text)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.published_at).toLocaleDateString()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right: gauge + summaries */}
        {hasText && (
          <div className="flex flex-col items-center gap-3">
            <QualityGauge score={displayScore} isLoading={llmLoading} />

            {llmResult?.tone && (
              <p className="text-center text-xs text-muted-foreground">
                <span className="font-bold">Tone:</span> {llmResult.tone}
              </p>
            )}

            {llmResult?.shareability && llmResult.shareability.score > 0 && (
              <div className="text-center">
                <p className="text-xs font-bold text-muted-foreground">
                  Shareability: {llmResult.shareability.score}/100
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {llmResult.shareability.reasoning}
                </p>
              </div>
            )}

            {llmLoading && (
              <p className="text-xs text-muted-foreground">
                AI analysis in progress...
              </p>
            )}

            {llmError && (
              <p className="text-xs text-destructive">
                {llmError}
              </p>
            )}

            {prediction && (
              <PredictionWidget
                prediction={prediction}
                llmRefinement={llmRefinement}
                isRefining={isRefining}
              />
            )}
          </div>
        )}
      </div>

      {/* Results area */}
      {hasText ? (
        <div className="space-y-6">
          {scannerV2 ? (
            <FourAxisScanner
              text={text}
              onAiMarkerActiveChange={setActiveAiMarker}
            />
          ) : (
            <>
              <QualityIssuesList issues={allIssues} />
              <QualityRewrites
                rewrites={llmResult?.rewrites ?? []}
                onApply={handleApplyRewrite}
              />
            </>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap justify-center gap-3">
              {prediction?.status === "ok" && (
                <Button
                  variant={isPublished ? "ghost" : "outline"}
                  size="sm"
                  onClick={handleMarkPublished}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <SpinnerGap
                      weight="bold"
                      className="size-4 animate-spin"
                    />
                  ) : isPublished ? (
                    <Check weight="bold" className="size-4" />
                  ) : null}
                  {isPublishing
                    ? "Saving..."
                    : isPublished
                      ? "Published"
                      : "Mark as published"}
                </Button>
              )}

              {scannerV2 ? (
                text.trim().length >= MIN_POST_LENGTH && (
                  <Link
                    href={`/dashboard/create/compose?from=scanner&text=${encodeURIComponent(text.trim())}`}
                  >
                    <Button variant="candy" size="sm">
                      Get rewrite suggestions
                      <ArrowRight weight="bold" className="size-4" />
                    </Button>
                  </Link>
                )
              ) : (
                llmResult && !llmLoading && (
                  <Link
                    href={`/dashboard/create/compose?topic=${encodeURIComponent(
                      text.trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 120) || text.trim().slice(0, 120)
                    )}`}
                  >
                    <Button variant="candy" size="sm">
                      Generate a better version
                      <ArrowRight weight="bold" className="size-4" />
                    </Button>
                  </Link>
                )
              )}
            </div>

            {publishError && (
              <p className="text-center text-xs text-destructive">
                {publishError}
              </p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<MagnifyingGlass weight="bold" className="size-7" />}
          iconColor="quaternary"
          title="Type or paste a draft post to analyze"
          description="We'll check for patterns the algorithm demotes and suggest improvements."
        />
      )}
    </div>
  );
}

function DraftHighlightOverlay({
  text,
  marker,
}: {
  text: string;
  marker: MarkerMatch;
}) {
  const start = Math.max(
    0,
    Math.min(marker.location.charStart, text.length),
  );
  const end = Math.max(start, Math.min(marker.location.charEnd, text.length));
  const chunks = [
    { key: "before", text: text.slice(0, start), highlight: false },
    { key: "active", text: text.slice(start, end), highlight: true },
    { key: "after", text: text.slice(end), highlight: false },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[var(--radius-md)] border border-transparent bg-input px-4 py-3 text-sm text-foreground whitespace-pre-wrap break-words"
    >
      {chunks.map((chunk) =>
        chunk.highlight ? (
          <span
            key={chunk.key}
            className="rounded-[3px] bg-tertiary/30 underline decoration-tertiary decoration-2 underline-offset-4"
          >
            {chunk.text}
          </span>
        ) : (
          <span key={chunk.key}>{chunk.text}</span>
        ),
      )}
    </div>
  );
}
