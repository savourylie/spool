"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <StickerCard className="max-w-md hover:rotate-0 hover:scale-100">
        <StickerCardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <WarningCircle weight="bold" className="size-7" />
            </div>
            <h3 className="font-heading text-lg font-medium">
              Something went wrong
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Try again
              </Button>
              <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Go home
              </Link>
            </div>
          </div>
        </StickerCardContent>
      </StickerCard>
    </div>
  );
}
