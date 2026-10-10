"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, SpinnerGap } from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button-variants";

export function PostSyncButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSyncing || isPending;

  const handleSync = async () => {
    if (isBusy) return;

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/posts/sync", { method: "POST" });

      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to sync posts");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isBusy}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {isBusy ? (
          <SpinnerGap weight="bold" className="size-3.5 animate-spin" />
        ) : (
          <ArrowsClockwise weight="bold" className="size-3.5" />
        )}
        {isBusy ? "Syncing..." : "Sync posts"}
      </button>
      {errorMessage ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
