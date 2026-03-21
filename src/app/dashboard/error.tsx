"use client";

import { WarningCircle } from "@phosphor-icons/react";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardContent>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <WarningCircle weight="bold" className="size-7" />
          </div>
          <h3 className="font-heading text-lg font-bold">Something went wrong</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </StickerCardContent>
    </StickerCard>
  );
}
