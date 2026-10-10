"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  CheckCircle,
  SpinnerGap,
} from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button-variants";

interface ReplyReviewButtonProps {
  replyId: string;
  reviewStatus: string;
}

export function ReplyReviewButton({
  replyId,
  reviewStatus,
}: ReplyReviewButtonProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;
  const isReviewed = reviewStatus === "reviewed";

  const handleClick = async () => {
    if (isBusy) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: isReviewed ? "needs_review" : "reviewed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update reply");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const Icon = isBusy
    ? SpinnerGap
    : isReviewed
      ? ArrowCounterClockwise
      : CheckCircle;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className={buttonVariants({
          variant: isReviewed ? "ghost" : "outline",
          size: "sm",
        })}
      >
        <Icon
          weight="bold"
          className={isBusy ? "size-3.5 animate-spin" : "size-3.5"}
        />
        {isReviewed ? "Undo review" : "Mark reviewed"}
      </button>
      {errorMessage ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}
