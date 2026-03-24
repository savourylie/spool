"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  Flame,
  X,
  Timer,
  Crosshair,
  ChatText,
  Warning,
} from "@phosphor-icons/react";
import type { ViralRecoveryState } from "@/lib/viral-detection";

const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getLocalStorageKey(postId: string) {
  return `spool_viral_dismissed_${postId}`;
}

function isDismissedInStorage(postId: string): boolean {
  try {
    const stored = localStorage.getItem(getLocalStorageKey(postId));
    if (!stored) return false;
    const dismissedAt = new Date(stored).getTime();
    return Date.now() - dismissedAt < DISMISSAL_TTL_MS;
  } catch {
    return false;
  }
}

function formatCountdown(targetIso: string): string | null {
  const remaining = new Date(targetIso).getTime() - Date.now();
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `Safe to post in: ${hours}h ${minutes}m`;
}

function PlaybookItem({
  icon: Icon,
  text,
  extra,
}: {
  icon: React.ComponentType<{ weight: "bold"; className: string }>;
  text: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon weight="bold" className="mt-0.5 size-4 shrink-0 text-tertiary/70" />
      <div>
        <p className="text-sm">{text}</p>
        {extra}
      </div>
    </div>
  );
}

// Stable no-op subscribe for useSyncExternalStore (localStorage has no events)
const noopSubscribe = () => () => {};

export function ViralRecoveryCard({
  recoveryState,
}: {
  recoveryState: ViralRecoveryState;
}) {
  // Hydration-safe localStorage check: returns false on server, reads storage on client
  const isDismissedFromStorage = useSyncExternalStore(
    noopSubscribe,
    () => isDismissedInStorage(recoveryState.viralPost.id),
    () => false,
  );
  const [localDismissed, setLocalDismissed] = useState(false);

  const [countdown, setCountdown] = useState<string | null>(() =>
    formatCountdown(recoveryState.safeToPostMinimum),
  );

  // Countdown timer — update every 60 seconds
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(recoveryState.safeToPostMinimum));
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [recoveryState.safeToPostMinimum]);

  if (isDismissedFromStorage || localDismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(
        getLocalStorageKey(recoveryState.viralPost.id),
        new Date().toISOString(),
      );
    } catch {
      // localStorage may be unavailable
    }
    setLocalDismissed(true);
  };

  const preview = recoveryState.viralPost.text_preview
    ? recoveryState.viralPost.text_preview.length > 60
      ? recoveryState.viralPost.text_preview.slice(0, 60) + "\u2026"
      : recoveryState.viralPost.text_preview
    : "Untitled post";

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border-2 border-tertiary/30 bg-tertiary/10 px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <Flame
          weight="bold"
          className="mt-0.5 size-5 shrink-0 text-tertiary"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                Your post &ldquo;{preview}&rdquo; went viral
              </p>
              {recoveryState.followerSpikeMagnitude != null && (
                <p className="text-sm text-muted-foreground">
                  +{recoveryState.followerSpikeMagnitude.toLocaleString()} new
                  followers
                </p>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-tertiary/20 hover:text-foreground"
              aria-label="Dismiss alert"
            >
              <X weight="bold" className="size-4" />
            </button>
          </div>

          <div className="space-y-2">
            <PlaybookItem
              icon={Timer}
              text="Wait 24-48 hours before posting again"
              extra={
                <p className="mt-0.5 text-xs font-semibold text-tertiary">
                  {countdown ?? "Safe to post now"}
                </p>
              }
            />
            <PlaybookItem
              icon={Crosshair}
              text="Next post should target your usual audience, not the new followers"
            />
            <PlaybookItem
              icon={ChatText}
              text="Actively reply to quality comments on the viral post"
            />
            <PlaybookItem
              icon={Warning}
              text="Avoid posting similar content (algorithm detects semantic similarity)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
