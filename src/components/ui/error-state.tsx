"use client";

import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  const router = useRouter();
  const handleRetry = onRetry ?? (() => router.refresh());

  return (
    <StickerCard className={className ?? "hover:rotate-0 hover:scale-100"}>
      <StickerCardContent>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <WarningCircle weight="bold" className="size-7" />
          </div>
          <h3 className="font-heading text-lg font-bold">{title}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            Try again
          </Button>
        </div>
      </StickerCardContent>
    </StickerCard>
  );
}
