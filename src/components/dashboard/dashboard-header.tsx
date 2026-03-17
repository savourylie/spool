"use client";

import { SignOut } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button-variants";

export function DashboardHeader({ username }: { username: string }) {
  return (
    <header className="border-b-2 border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="font-heading text-xl font-bold">Spool</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">@{username}</span>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "gap-1.5",
              })}
            >
              <SignOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
