"use client";

import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop";
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QualityGauge } from "@/components/dashboard/quality-gauge";
import { PredictionWidget } from "@/components/dashboard/prediction-widget";
import { DraftCard, type DraftState } from "@/components/dashboard/draft-card";
import { ConceptReuseAdvisory } from "@/components/dashboard/concept-reuse-advisory";
import { TopicSuggestions } from "@/components/dashboard/topic-suggestions";
import {
  FreshnessBanner,
  isRateLimited,
  type FreshnessPayload,
} from "@/components/dashboard/freshness-banner";
import { getComposerEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import {
  analyzeHeuristics,
  computeHeuristicScore,
} from "@/lib/quality-heuristics";
import {
  predictEngagement,
  type HistoricalPost,
  type PredictionResult,
  type PostCharacteristics,
} from "@/lib/engagement-prediction";
import type { ConceptAdvisoryPayload } from "@/lib/concept-library-view";

// ── Types ────────────────────────────────────────────────────────────

export interface BestTimeSlot {
  day: number;
  hour: number;
  dayLabel: string;
  timeLabel: string;
}

interface ComposerProps {
  predictionPosts: HistoricalPost[];
  bestTimes: BestTimeSlot[];
  isImporting: boolean;
  initialTopic?: string;
}

// ── State machine ────────────────────────────────────────────────────

type ComposerStatus = "idle" | "generating" | "complete" | "partial" | "error";

interface ComposerState {
  status: ComposerStatus;
  topic: string;
  style: string;
  drafts: DraftState[];
  errorMessage: string | null;
  activeDraftIndex: number | null;
  regeneratingIndex: number | null;
  // TICKET-071: pre-draft freshness verdict. Yellow/red verdicts buffer
  // incoming draft events until the user clicks "Compose anyway" so the
  // button is meaningful, not cosmetic.
  freshness: FreshnessPayload;
  freshnessAcknowledged: boolean;
  bufferedDraftEvents: BufferableAction[];
  conceptAdvisory: ConceptAdvisoryPayload | null;
  dismissedConceptAdvisoryKeys: string[];
}

type BufferableAction =
  | { type: "DRAFT_START"; index: number; shareTrigger: string | null }
  | { type: "DRAFT_TEXT"; index: number; text: string }
  | {
      type: "DRAFT_END";
      index: number;
      draftId: string | null;
      predictionId: string | null;
      content: string;
      shareTrigger: string;
    };

type ComposerAction =
  | { type: "SET_TOPIC"; topic: string }
  | { type: "SET_STYLE"; style: string }
  | { type: "START_GENERATION"; regeneratingIndex?: number }
  | BufferableAction
  | { type: "GENERATION_COMPLETE" }
  | { type: "GENERATION_ERROR"; message: string }
  | { type: "STOP_GENERATION" }
  | { type: "SELECT_DRAFT"; index: number }
  | {
      type: "SET_QUALITY";
      index: number;
      score: number;
      issues: import("@/lib/quality-heuristics").QualityIssue[];
    }
  | { type: "TOGGLE_EDIT"; index: number }
  | { type: "UPDATE_EDIT_TEXT"; index: number; text: string }
  | { type: "FRESHNESS_RECEIVED"; freshness: FreshnessPayload }
  | { type: "FRESHNESS_ACKNOWLEDGE" }
  | {
      type: "CONCEPT_ADVISORY_RECEIVED";
      advisory: ConceptAdvisoryPayload | null;
    }
  | { type: "CONCEPT_ADVISORY_DISMISS"; key: string }
  | { type: "START_PUBLISH"; index: number }
  | { type: "PUBLISH_SUCCESS"; index: number }
  | { type: "PUBLISH_ERROR"; index: number; message: string }
  | { type: "RESET" };

function shouldBufferFor(state: ComposerState): boolean {
  // Buffer draft events only when the gate returned a yellow/red verdict
  // that the user has not acknowledged. Green verdicts, null, rate-limited,
  // and single-draft regeneration all flow straight through.
  if (state.freshnessAcknowledged) return false;
  if (state.freshness === null) return false;
  if (isRateLimited(state.freshness)) return false;
  if (state.freshness.verdict === "green") return false;
  return true;
}

function makeDraft(index: number): DraftState {
  return {
    index,
    text: "",
    shareTrigger: null,
    draftId: null,
    predictionId: null,
    isStreaming: false,
    isComplete: false,
    qualityScore: null,
    qualityIssues: [],
    isEditing: false,
    editText: "",
    isPublishing: false,
    isPublished: false,
    publishError: null,
  };
}

const initialState: ComposerState = {
  status: "idle",
  topic: "",
  style: "",
  drafts: [],
  errorMessage: null,
  activeDraftIndex: null,
  regeneratingIndex: null,
  freshness: null,
  freshnessAcknowledged: false,
  bufferedDraftEvents: [],
  conceptAdvisory: null,
  dismissedConceptAdvisoryKeys: [],
};

function composerReducer(
  state: ComposerState,
  action: ComposerAction,
): ComposerState {
  switch (action.type) {
    case "SET_TOPIC":
      return { ...state, topic: action.topic };

    case "SET_STYLE":
      return { ...state, style: action.style };

    case "START_GENERATION": {
      const regenIdx = action.regeneratingIndex ?? null;
      if (regenIdx !== null) {
        // Single-draft regeneration — mark that draft as streaming, keep others.
        // Regeneration auto-acknowledges the gate: the user already chose to
        // regenerate despite any earlier warning.
        const drafts = state.drafts.map((d) =>
          d.index === regenIdx
            ? {
                ...makeDraft(regenIdx),
                isStreaming: true,
              }
            : d,
        );
        return {
          ...state,
          status: "generating",
          drafts,
          errorMessage: null,
          regeneratingIndex: regenIdx,
          freshness: null,
          freshnessAcknowledged: true,
          bufferedDraftEvents: [],
          conceptAdvisory: null,
        };
      }
      // Full generation — clear all drafts. Reset freshness so the new
      // verdict gates rendering.
      return {
        ...state,
        status: "generating",
        drafts: [],
        errorMessage: null,
        activeDraftIndex: null,
        regeneratingIndex: null,
        freshness: null,
        freshnessAcknowledged: false,
        bufferedDraftEvents: [],
        conceptAdvisory: null,
      };
    }

    case "FRESHNESS_RECEIVED": {
      // Auto-ack for green verdicts, rate-limited responses, and null
      // (gate errored) so drafts render without user interaction.
      const autoAck =
        action.freshness === null ||
        isRateLimited(action.freshness) ||
        action.freshness.verdict === "green";
      return {
        ...state,
        freshness: action.freshness,
        freshnessAcknowledged: autoAck,
      };
    }

    case "CONCEPT_ADVISORY_RECEIVED":
      return {
        ...state,
        conceptAdvisory: action.advisory,
      };

    case "CONCEPT_ADVISORY_DISMISS":
      return {
        ...state,
        dismissedConceptAdvisoryKeys:
          state.dismissedConceptAdvisoryKeys.includes(action.key)
            ? state.dismissedConceptAdvisoryKeys
            : [...state.dismissedConceptAdvisoryKeys, action.key],
      };

    case "FRESHNESS_ACKNOWLEDGE": {
      // Flush any buffered draft events through the reducer now that the
      // user has acknowledged the warning.
      let next: ComposerState = {
        ...state,
        freshnessAcknowledged: true,
        bufferedDraftEvents: [],
      };
      for (const event of state.bufferedDraftEvents) {
        next = composerReducer(next, event);
      }
      return next;
    }

    case "DRAFT_START": {
      if (shouldBufferFor(state)) {
        return {
          ...state,
          bufferedDraftEvents: [...state.bufferedDraftEvents, action],
        };
      }
      // During single-draft regen, only accept events for the targeted index
      if (
        state.regeneratingIndex !== null &&
        action.index !== state.regeneratingIndex
      ) {
        return state;
      }

      if (state.regeneratingIndex !== null) {
        // Update the existing draft slot
        const drafts = state.drafts.map((d) =>
          d.index === state.regeneratingIndex
            ? { ...d, isStreaming: true, shareTrigger: action.shareTrigger }
            : d,
        );
        return {
          ...state,
          drafts,
          activeDraftIndex: state.regeneratingIndex,
        };
      }

      // Normal generation — add new draft
      const newDraft: DraftState = {
        ...makeDraft(action.index),
        isStreaming: true,
        shareTrigger: action.shareTrigger,
      };
      return {
        ...state,
        drafts: [...state.drafts, newDraft],
        activeDraftIndex: state.activeDraftIndex ?? action.index,
      };
    }

    case "DRAFT_TEXT": {
      if (shouldBufferFor(state)) {
        return {
          ...state,
          bufferedDraftEvents: [...state.bufferedDraftEvents, action],
        };
      }
      if (
        state.regeneratingIndex !== null &&
        action.index !== state.regeneratingIndex
      ) {
        return state;
      }

      const targetIdx =
        state.regeneratingIndex !== null
          ? state.regeneratingIndex
          : action.index;
      const drafts = state.drafts.map((d) =>
        d.index === targetIdx ? { ...d, text: d.text + action.text } : d,
      );
      return { ...state, drafts };
    }

    case "DRAFT_END": {
      if (shouldBufferFor(state)) {
        return {
          ...state,
          bufferedDraftEvents: [...state.bufferedDraftEvents, action],
        };
      }
      if (
        state.regeneratingIndex !== null &&
        action.index !== state.regeneratingIndex
      ) {
        return state;
      }

      const targetIdx =
        state.regeneratingIndex !== null
          ? state.regeneratingIndex
          : action.index;
      const drafts = state.drafts.map((d) =>
        d.index === targetIdx
          ? {
              ...d,
              draftId: action.draftId,
              predictionId: action.predictionId,
              isStreaming: false,
              isComplete: true,
              text: action.content || d.text,
              shareTrigger: action.shareTrigger || d.shareTrigger,
              isPublishing: false,
              isPublished: false,
              publishError: null,
            }
          : d,
      );
      return { ...state, drafts };
    }

    case "GENERATION_COMPLETE":
      return {
        ...state,
        status: "complete",
        regeneratingIndex: null,
        drafts: state.drafts.map((d) =>
          d.isStreaming ? { ...d, isStreaming: false, isComplete: true } : d,
        ),
      };

    case "GENERATION_ERROR":
      return {
        ...state,
        status: state.drafts.some((d) => d.isComplete) ? "partial" : "error",
        errorMessage: action.message,
        regeneratingIndex: null,
        drafts: state.drafts.map((d) =>
          d.isStreaming ? { ...d, isStreaming: false } : d,
        ),
      };

    case "STOP_GENERATION":
      return {
        ...state,
        status: state.drafts.some((d) => d.isComplete) ? "partial" : "idle",
        regeneratingIndex: null,
        drafts: state.drafts
          .map((d) =>
            d.isStreaming
              ? d.text.trim().length > 0
                ? { ...d, isStreaming: false, isComplete: true }
                : null
              : d,
          )
          .filter((d): d is DraftState => d !== null),
      };

    case "SELECT_DRAFT":
      return { ...state, activeDraftIndex: action.index };

    case "SET_QUALITY": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index
          ? {
              ...d,
              qualityScore: action.score,
              qualityIssues: action.issues,
            }
          : d,
      );
      return { ...state, drafts };
    }

    case "TOGGLE_EDIT": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index
          ? (() => {
              const leavingEditMode = d.isEditing;
              const nextText = leavingEditMode ? d.editText : d.text;
              const textChanged = leavingEditMode && d.editText !== d.text;

              return {
                ...d,
                isEditing: !d.isEditing,
                // Entering edit mode: initialize editText from text
                // Exiting edit mode: persist editText back to text
                editText: !d.isEditing ? d.text : d.editText,
                text: nextText,
                // Reset quality so it re-analyzes after edit
                qualityScore: d.isEditing ? null : d.qualityScore,
                qualityIssues: d.isEditing ? [] : d.qualityIssues,
                isPublished: textChanged ? false : d.isPublished,
                publishError: textChanged ? null : d.publishError,
              };
            })()
          : d,
      );
      return { ...state, drafts };
    }

    case "UPDATE_EDIT_TEXT": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index ? { ...d, editText: action.text } : d,
      );
      return { ...state, drafts };
    }

    case "START_PUBLISH": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index
          ? { ...d, isPublishing: true, publishError: null }
          : d,
      );
      return { ...state, drafts };
    }

    case "PUBLISH_SUCCESS": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index
          ? { ...d, isPublishing: false, isPublished: true, publishError: null }
          : d,
      );
      return { ...state, drafts };
    }

    case "PUBLISH_ERROR": {
      const drafts = state.drafts.map((d) =>
        d.index === action.index
          ? {
              ...d,
              isPublishing: false,
              isPublished: false,
              publishError: action.message,
            }
          : d,
      );
      return { ...state, drafts };
    }

    case "RESET":
      return {
        ...initialState,
        topic: state.topic,
        style: state.style,
        dismissedConceptAdvisoryKeys: state.dismissedConceptAdvisoryKeys,
      };

    default:
      return state;
  }
}

// ── Style presets ────────────────────────────────────────────────────

const STYLE_PRESETS = [
  "Professional",
  "Casual",
  "Provocative",
  "Educational",
  "Humorous",
] as const;

// ── Constants ────────────────────────────────────────────────────────

const MAX_TOPIC_LENGTH = 500;

// ── Component ────────────────────────────────────────────────────────

export function Composer({
  predictionPosts,
  bestTimes,
  isImporting,
  initialTopic,
}: ComposerProps) {
  const [state, dispatch] = useReducer(composerReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const [isLLMUnavailable, setIsLLMUnavailable] = useState(false);

  const emptyCopy = getComposerEmptyStateCopy();

  // ── SSE stream handler ─────────────────────────────────────────

  const startGeneration = useCallback(
    async (regeneratingIndex?: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "START_GENERATION", regeneratingIndex });

      try {
        const now = new Date();
        const predictionContext = bestTimes[0]
          ? {
              dayOfWeek: bestTimes[0].day,
              hourOfDay: bestTimes[0].hour,
            }
          : {
              dayOfWeek: now.getDay(),
              hourOfDay: now.getHours(),
            };

        const response = await fetch("/api/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: state.topic,
            style: state.style || undefined,
            predictionContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 503) {
            setIsLLMUnavailable(true);
          }
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.error ?? `Composition failed (${response.status})`,
          );
        }

        const reader = response.body?.getReader();
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

            // Check for [DONE] signal
            if (trimmed === "data: [DONE]") {
              dispatch({ type: "GENERATION_COMPLETE" });
              return;
            }

            // Parse named SSE events: "event: <name>\ndata: <json>"
            const eventMatch = trimmed.match(/^event:\s*(\w+)/m);
            const dataMatch = trimmed.match(/^data:\s*(.+)$/m);

            if (eventMatch && dataMatch) {
              const eventName = eventMatch[1];
              let data: unknown;
              try {
                data = JSON.parse(dataMatch[1]);
              } catch {
                continue;
              }

              if (eventName === "freshness") {
                dispatch({
                  type: "FRESHNESS_RECEIVED",
                  freshness: data as FreshnessPayload,
                });
                continue;
              }

              if (eventName === "concept_advisory") {
                dispatch({
                  type: "CONCEPT_ADVISORY_RECEIVED",
                  advisory: data as ConceptAdvisoryPayload | null,
                });
                continue;
              }

              const record = data as Record<string, unknown>;
              switch (eventName) {
                case "draft_start":
                  dispatch({
                    type: "DRAFT_START",
                    index: record.index as number,
                    shareTrigger: (record.shareTrigger as string) ?? null,
                  });
                  break;
                case "draft_text":
                  dispatch({
                    type: "DRAFT_TEXT",
                    index: record.index as number,
                    text: record.text as string,
                  });
                  break;
                case "draft_end":
                  dispatch({
                    type: "DRAFT_END",
                    index: record.index as number,
                    draftId: (record.draftId as string) ?? null,
                    predictionId: (record.predictionId as string) ?? null,
                    content: (record.content as string) ?? "",
                    shareTrigger: (record.shareTrigger as string) ?? "",
                  });
                  break;
                case "error":
                  dispatch({
                    type: "GENERATION_ERROR",
                    message:
                      (record.message as string) ??
                      (record.error as string) ??
                      "Composition failed",
                  });
                  return;
              }
            }
          }
        }

        // Stream ended without [DONE] — still mark complete
        dispatch({ type: "GENERATION_COMPLETE" });
      } catch (error: unknown) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        dispatch({
          type: "GENERATION_ERROR",
          message:
            error instanceof Error ? error.message : "Composition failed",
        });
      }
    },
    [bestTimes, state.topic, state.style],
  );

  // ── Auto quality analysis ──────────────────────────────────────

  useEffect(() => {
    for (const draft of state.drafts) {
      if (draft.isComplete && draft.qualityScore === null && draft.text.trim()) {
        const textToAnalyze = draft.isEditing ? draft.editText : draft.text;
        const issues = analyzeHeuristics(textToAnalyze);
        const score = computeHeuristicScore(issues);
        dispatch({ type: "SET_QUALITY", index: draft.index, score, issues });
      }
    }
  }, [state.drafts]);

  // ── Cleanup on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Pre-fill from initialTopic ────────────────────────────────

  useEffect(() => {
    if (initialTopic && !state.topic) {
      dispatch({ type: "SET_TOPIC", topic: initialTopic });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  // ── Derived state ──────────────────────────────────────────────

  const activeDraft =
    state.activeDraftIndex !== null
      ? state.drafts.find((d) => d.index === state.activeDraftIndex) ?? null
      : state.drafts.find((d) => d.isComplete) ?? state.drafts[0] ?? null;

  const activeDraftText = activeDraft
    ? activeDraft.isEditing
      ? activeDraft.editText
      : activeDraft.text
    : "";

  // ── Engagement prediction ──────────────────────────────────────

  const prediction: PredictionResult | null = useMemo(() => {
    if (!activeDraftText.trim() || predictionPosts.length === 0) return null;

    const now = new Date();
    const chars: PostCharacteristics = {
      mediaType: "TEXT",
      textLength: activeDraftText.length,
      dayOfWeek: bestTimes[0]?.day ?? now.getDay(),
      hourOfDay: bestTimes[0]?.hour ?? now.getHours(),
    };
    return predictEngagement(predictionPosts, chars);
  }, [activeDraftText, predictionPosts, bestTimes]);

  const hasDrafts = state.drafts.length > 0;
  const isGenerating = state.status === "generating";
  const canGenerate =
    state.topic.trim().length > 0 && !isGenerating;
  const visibleConceptAdvisory =
    state.conceptAdvisory &&
    !state.dismissedConceptAdvisoryKeys.includes(state.conceptAdvisory.key)
      ? state.conceptAdvisory
      : null;

  // ── Handlers ───────────────────────────────────────────────────

  const handleGenerate = () => {
    if (canGenerate) startGeneration();
  };

  const handleStop = () => {
    abortRef.current?.abort();
    dispatch({ type: "STOP_GENERATION" });
  };

  const handleRegenerate = (index: number) => {
    if (state.topic.trim()) startGeneration(index);
  };

  const handleSurpriseMe = () => {
    dispatch({
      type: "SET_TOPIC",
      topic: "Surprise me — generate a trending topic in my niche",
    });
  };

  const handleSelectTopic = useCallback((topicName: string) => {
    dispatch({ type: "SET_TOPIC", topic: topicName });
  }, []);

  const handleMarkPublished = useCallback(
    async (index: number, draftText: string) => {
      const draft = state.drafts.find((item) => item.index === index);
      if (!draft?.predictionId) {
        return;
      }

      dispatch({ type: "START_PUBLISH", index });

      try {
        const response = await fetch("/api/compose/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            predictionId: draft.predictionId,
            draftText,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.error ?? `Failed to mark draft as published (${response.status})`,
          );
        }

        dispatch({ type: "PUBLISH_SUCCESS", index });
      } catch (error) {
        dispatch({
          type: "PUBLISH_ERROR",
          index,
          message:
            error instanceof Error
              ? error.message
              : "Failed to mark draft as published",
        });
      }
    },
    [state.drafts],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_260px]">
      {/* ── Left Panel: Topic + Style ─────────────────────────── */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="composer-topic" className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Topic
          </label>
          <textarea
            id="composer-topic"
            value={state.topic}
            onChange={(e) =>
              dispatch({ type: "SET_TOPIC", topic: e.target.value })
            }
            placeholder="What do you want to post about?"
            rows={4}
            disabled={isGenerating}
            className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--input-border)] bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] focus:border-primary focus:shadow-[var(--shadow-accent)] focus:outline-none disabled:opacity-50"
          />
          <p
            className={`text-right text-xs tabular-nums ${
              state.topic.length > MAX_TOPIC_LENGTH
                ? "font-bold text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {state.topic.length} / {MAX_TOPIC_LENGTH}
          </p>
        </div>

        {/* Style presets */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Style
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_STYLE",
                    style: state.style === preset ? "" : preset,
                  })
                }
                disabled={isGenerating}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)] disabled:opacity-50 ${
                  state.style === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <Button
            variant="candy"
            size="sm"
            className="w-full"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            <PencilLine weight="bold" className="size-4" />
            Generate Drafts
          </Button>

          {state.status === "idle" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSurpriseMe}
            >
              <Sparkle weight="bold" className="size-4" />
              Generate ideas for me
            </Button>
          )}
        </div>
      </div>

      {/* ── Center Panel: Drafts ──────────────────────────────── */}
      <div className="space-y-4">
        {visibleConceptAdvisory && (
          <ConceptReuseAdvisory
            advisory={visibleConceptAdvisory}
            onDismiss={() =>
              dispatch({
                type: "CONCEPT_ADVISORY_DISMISS",
                key: visibleConceptAdvisory.key,
              })
            }
          />
        )}

        <FreshnessBanner
          freshness={state.freshness}
          acknowledged={state.freshnessAcknowledged}
          onAcknowledge={() => dispatch({ type: "FRESHNESS_ACKNOWLEDGE" })}
        />

        {state.status === "idle" && !hasDrafts && (
          <EmptyState
            icon={<PencilLine weight="bold" className="size-7" />}
            iconColor="primary"
            title={emptyCopy.title}
            description={
              isImporting
                ? "Your posts are still importing. You can start composing, but predictions will improve once the import completes."
                : emptyCopy.description
            }
          />
        )}

        {state.status === "error" && !hasDrafts && (
          <EmptyState
            icon={<WarningCircle weight="bold" className="size-7" />}
            iconColor="secondary"
            title={
              isLLMUnavailable
                ? "AI composition unavailable"
                : "Something went wrong"
            }
            description={
              isLLMUnavailable
                ? "The AI service is not configured. Please set the LLM API key to use the composer."
                : state.errorMessage ?? "Composition failed. Please try again."
            }
            action={
              !isLLMUnavailable
                ? { label: "Try again", onClick: handleGenerate }
                : undefined
            }
          />
        )}

        {state.drafts.map((draft) => (
          <DraftCard
            key={draft.index}
            draft={draft}
            isSelected={
              (activeDraft?.index ?? null) === draft.index
            }
            onSelect={() =>
              dispatch({ type: "SELECT_DRAFT", index: draft.index })
            }
            onRegenerate={() => handleRegenerate(draft.index)}
            onToggleEdit={() =>
              dispatch({ type: "TOGGLE_EDIT", index: draft.index })
            }
            onEditTextChange={(text) =>
              dispatch({
                type: "UPDATE_EDIT_TEXT",
                index: draft.index,
                text,
              })
            }
            onMarkPublished={(draftText) =>
              handleMarkPublished(draft.index, draftText)
            }
          />
        ))}

        {isGenerating && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleStop}>
              <Stop weight="bold" className="size-4" />
              Stop generating
            </Button>
          </div>
        )}
      </div>

      {/* ── Right Panel: Quality + Prediction + Timing ────────── */}
      <div className="space-y-4">
        {hasDrafts && activeDraft && (
          <>
            {/* Quality gauge */}
            <div className="flex flex-col items-center gap-1">
              <QualityGauge
                score={activeDraft.qualityScore ?? 100}
                isLoading={activeDraft.isStreaming}
              />
              {activeDraft.qualityIssues.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground">
                  {activeDraft.qualityIssues.length} issue
                  {activeDraft.qualityIssues.length !== 1 ? "s" : ""} detected
                </p>
              )}
            </div>

            {/* Prediction */}
            {prediction && (
              <PredictionWidget
                prediction={prediction}
                showConfidenceBadge
              />
            )}
          </>
        )}

        {/* Timing recommendation */}
        {bestTimes.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] bg-paper-2 text-ink-3">
                <Clock weight="bold" className="size-4" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Best time to post
              </p>
            </div>
            <div className="space-y-1">
              {bestTimes.map((slot, i) => (
                <p key={i} className="text-sm text-foreground">
                  <span className="font-bold">{slot.dayLabel}</span>{" "}
                  {slot.timeLabel}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Topic suggestions — always visible */}
        <TopicSuggestions onSelectTopic={handleSelectTopic} />
      </div>
    </div>
  );
}
