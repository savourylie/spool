"use client";

import { useTheme } from "next-themes";
import { Sun } from "@phosphor-icons/react/dist/ssr/Sun";
import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle light / dark"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground",
        className,
      )}
    >
      {/* Icon is chosen by the .dark class (set pre-paint by next-themes),
          so both render server-side and CSS shows the right one — no flash. */}
      <Moon className="size-[18px] dark:hidden" />
      <Sun className="hidden size-[18px] dark:block" />
    </button>
  );
}
