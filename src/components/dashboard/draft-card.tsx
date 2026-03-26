"use client";

import { useState, useCallback } from "react";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { Pencil } from "@phosphor-icons/react/dist/ssr/Pencil";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";

import { cn } from "@/lib/utils";
import { StickerCard, StickerCardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QualityIssue } from "@/lib/quality-heuristics";

// ── Types ────────────────────────────────────────────────────────────

export interface DraftState {
  index: number;
  text: string;
  shareTrigger: string | null;
  draftId: string | null;
  isStreaming: boolean;
  isComplete: boolean;
  qualityScore: number | null;
  qualityIssues: QualityIssue[];
  isEditing: boolean;
  editText: string;
}

interface DraftCardProps {
  draft: DraftState;
  isSelected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onToggleEdit: () => void;
  onEditTextChange: (text: string) => void;
}

// ── Share-trigger styles ─────────────────────────────────────────────

const TRIGGER_STYLES: Record<string, string> = {
  "voice-of-the-reader":
    "bg-secondary/20 text-secondary border-secondary/30",
  "time-saving-compilation":
    "bg-tertiary/20 text-tertiary border-tertiary/30",
  "counterintuitive-data":
    "bg-quaternary/20 text-quaternary border-quaternary/30",
  "conversation-framework":
    "bg-primary/20 text-primary border-primary/30",
};

const TRIGGER_LABELS: Record<string, string> = {
  "voice-of-the-reader": "Voice of the Reader",
  "time-saving-compilation": "Time-Saving Compilation",
  "counterintuitive-data": "Counterintuitive Data",
  "conversation-framework": "Conversation Framework",
};

// ── Helpers ──────────────────────────────────────────────────────────

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-foreground"
    />
  );
}

function QualityScorePill({ score }: { score: number }) {
  const color =
    score < 40
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : score < 70
        ? "bg-tertiary/10 text-tertiary border-tertiary/30"
        : "bg-quaternary/10 text-quaternary border-quaternary/30";

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
        color,
      )}
    >
      {score}/100
    </span>
  );
}

function ShareTriggerBadge({ trigger }: { trigger: string | null }) {
  if (!trigger) return null;
  const style = TRIGGER_STYLES[trigger] ?? "bg-muted text-muted-foreground";
  const label = TRIGGER_LABELS[trigger] ?? trigger;

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide",
        style,
      )}
    >
      {label}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────

const THREADS_CHAR_LIMIT = 500;

export function DraftCard({
  draft,
  isSelected,
  onSelect,
  onRegenerate,
  onToggleEdit,
  onEditTextChange,
}: DraftCardProps) {
  const [copied, setCopied] = useState(false);

  const displayText = draft.isEditing ? draft.editText : draft.text;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — ignore
    }
  }, [displayText]);

  return (
    <StickerCard
      className={cn(
        "cursor-pointer hover:rotate-0 hover:scale-100",
        isSelected &&
          "border-primary shadow-[var(--shadow-featured)]",
      )}
      onClick={onSelect}
    >
      <StickerCardContent>
        {/* Header: trigger badge + quality pill */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <ShareTriggerBadge trigger={draft.shareTrigger} />
          {draft.qualityScore !== null && (
            <QualityScorePill score={draft.qualityScore} />
          )}
        </div>

        {/* Draft text or edit textarea */}
        {draft.isEditing ? (
          <div className="space-y-1">
            <textarea
              value={draft.editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-[var(--radius-md)] border-2 border-[var(--input-border)] bg-input px-3 py-2 text-sm text-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] focus:border-primary focus:shadow-[var(--shadow-accent)] focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
            <p
              className={cn(
                "text-right text-xs tabular-nums",
                draft.editText.length > THREADS_CHAR_LIMIT
                  ? "font-bold text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {draft.editText.length} / {THREADS_CHAR_LIMIT}
            </p>
          </div>
        ) : (
          <p className="min-h-[4rem] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {draft.text}
            {draft.isStreaming && <StreamingCursor />}
          </p>
        )}

        {/* Action buttons */}
        {(draft.isComplete || draft.text.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="candy"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              disabled={draft.isStreaming}
            >
              {copied ? (
                <Check weight="bold" className="size-4" />
              ) : (
                <ClipboardText weight="bold" className="size-4" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={draft.isStreaming}
            >
              <ArrowsClockwise weight="bold" className="size-4" />
              Regenerate
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEdit();
              }}
              disabled={draft.isStreaming}
            >
              <Pencil weight="bold" className="size-4" />
              {draft.isEditing ? "Done" : "Edit"}
            </Button>
          </div>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
