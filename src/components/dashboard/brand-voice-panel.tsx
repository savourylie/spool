"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  ChatCircle,
  ChatsTeardrop,
  GraduationCap,
  Heart,
  Prohibit,
  SpeakerHigh,
  Smiley,
  TextAlignLeft,
  TextT,
  TreeStructure,
  UserCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  BRAND_VOICE_DIMENSIONS,
  type BrandVoiceDimension,
  type BrandVoiceRecord,
} from "@/lib/brand-voice-types";

interface BrandVoicePanelProps {
  record: BrandVoiceRecord | null;
  postPermalinkMap: Record<string, string | null>;
}

const DIMENSION_LABELS: Record<BrandVoiceDimension, string> = {
  sentence_structure: "Sentence Structure",
  tone_switching: "Tone Switching",
  emotional_expression: "Emotional Expression",
  knowledge_presentation: "Knowledge Presentation",
  fan_vs_critic_reply_tone: "Fan vs. Critic Reply Tone",
  analogies: "Analogies",
  humor: "Humor",
  self_reference: "Self-Reference",
  taboo_phrases: "Taboo Phrases",
  paragraph_rhythm: "Paragraph Rhythm",
  comment_reply_characteristics: "Comment-Reply Characteristics",
};

const DIMENSION_ICONS: Record<BrandVoiceDimension, PhosphorIcon> = {
  sentence_structure: TextT,
  tone_switching: ArrowsLeftRight,
  emotional_expression: Heart,
  knowledge_presentation: GraduationCap,
  fan_vs_critic_reply_tone: ChatsTeardrop,
  analogies: TreeStructure,
  humor: Smiley,
  self_reference: UserCircle,
  taboo_phrases: Prohibit,
  paragraph_rhythm: TextAlignLeft,
  comment_reply_characteristics: ChatCircle,
};

const DIMENSION_COLORS = [
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
] as const;

export function BrandVoicePanel({
  record,
  postPermalinkMap,
}: BrandVoicePanelProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isBusy = isRefreshing || isPending;

  const handleRefresh = async () => {
    if (isBusy) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/brand-voice/refresh", { method: "POST" });

      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      const body: { error?: string; retryAfter?: number } = await res
        .json()
        .catch(() => ({}));

      if (res.status === 429) {
        const seconds = Math.max(1, Math.ceil(Number(body.retryAfter ?? 60)));
        const minutes = Math.max(1, Math.ceil(seconds / 60));
        setErrorMessage(
          `Refresh available again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`,
        );
      } else if (res.status === 503) {
        setErrorMessage("AI service unavailable — check LLM configuration.");
      } else if (res.status === 502) {
        setErrorMessage("Extraction produced invalid output — please retry.");
      } else if (res.status === 401) {
        setErrorMessage("Your session expired. Please sign in again.");
      } else {
        setErrorMessage(body.error ?? "Extraction failed. Please try again.");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!record) {
    return (
      <div className="py-8">
        <h1 className="font-heading text-3xl font-bold">Your Brand Voice</h1>
        <p className="mt-2 text-muted-foreground">
          Extract your voice from your posts so the Composer can draft on your
          style.
        </p>
        <div className="mt-8">
          <EmptyState
            icon={<SpeakerHigh weight="bold" className="size-7" />}
            iconColor="primary"
            title="Extract your brand voice"
            description="Run your top posts through an LLM to build an 11-dimension voice profile, grounded in real excerpts from your own posts."
            action={{
              label: isBusy ? "Extracting…" : "Extract your brand voice",
              onClick: handleRefresh,
            }}
          />
        </div>
        {errorMessage && (
          <p
            role="alert"
            className="mt-4 text-center text-sm font-medium text-destructive"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  const { profile, sourcePostCount, confidenceTier } = record;
  // Gate on the 10-post composition threshold (ticket banner copy), not
  // only on tier === "directional" (<5). Users with 5–9 posts also need
  // to know the Composer won't use the profile yet.
  const isDirectional = sourcePostCount < 10;

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-heading text-3xl font-bold">
              Your Brand Voice
            </h1>
            <ConfidenceBadge
              sample={sourcePostCount}
              tier={confidenceTier}
            />
          </div>
          <p className="mt-2 text-muted-foreground">
            Your voice fingerprint across 11 dimensions, with real excerpts
            from your own posts.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isBusy}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {isBusy
            ? "Refreshing…"
            : isDirectional
              ? "Refresh (directional)"
              : "Refresh voice"}
        </button>
      </div>

      {isDirectional && (
        <div
          role="status"
          className="mt-6 rounded-[var(--radius-md)] border-2 border-tertiary bg-tertiary/25 px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">
            This profile is directional
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We need 10+ posts to drive composition. The Composer won&apos;t use
            this profile yet.
          </p>
        </div>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 text-sm font-medium text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-10 space-y-8">
        {BRAND_VOICE_DIMENSIONS.map((dim, idx) => {
          const entry = profile[dim];
          const Icon = DIMENSION_ICONS[dim];
          const iconColor = DIMENSION_COLORS[idx % DIMENSION_COLORS.length];
          const evidence = entry?.evidence ?? [];
          const pattern = entry?.pattern ?? "Not enough data yet.";

          return (
            <CollapsibleSection
              key={dim}
              title={DIMENSION_LABELS[dim]}
              description={pattern}
              summary={
                <span className="text-xs font-medium text-muted-foreground">
                  {evidence.length}{" "}
                  {evidence.length === 1 ? "excerpt" : "excerpts"}
                </span>
              }
              icon={<Icon weight="bold" className="size-6" />}
              iconColor={iconColor}
            >
              <div className="space-y-3">
                {evidence.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">
                    No excerpts yet — refresh after more posts land.
                  </p>
                ) : (
                  evidence.map((ev, evIdx) => {
                    const permalink = postPermalinkMap[ev.postId];
                    return (
                      <blockquote
                        key={`${ev.postId}-${evIdx}`}
                        className="rounded-[var(--radius-sm)] border-2 border-border bg-muted/30 px-4 py-3"
                      >
                        <p className="text-sm leading-relaxed text-foreground">
                          &ldquo;{ev.excerpt}&rdquo;
                        </p>
                        {permalink && (
                          <a
                            href={permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            View post
                            <ArrowSquareOut
                              weight="bold"
                              className="size-3.5"
                            />
                          </a>
                        )}
                      </blockquote>
                    );
                  })
                )}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
