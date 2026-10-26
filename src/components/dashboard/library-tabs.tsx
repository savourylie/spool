"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  LIBRARY_TABS,
  LIBRARY_TAB_LABELS,
  type LibraryTab,
} from "@/lib/library-tabs";
import { cn } from "@/lib/utils";

export function LibraryTabs({
  counts,
  activeTab,
}: {
  counts: Record<LibraryTab, number>;
  activeTab: LibraryTab;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(tab: LibraryTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page");
    params.delete("post");
    params.delete("reply");
    params.delete("repost");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <nav
      aria-label="Post library sections"
      className="sticky top-0 z-20 mt-5 flex items-stretch gap-1 overflow-x-auto border-b border-border bg-background"
    >
      {LIBRARY_TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Link
            key={tab}
            href={buildHref(tab)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-sm transition-colors",
              isActive
                ? "font-medium text-foreground"
                : "text-ink-3 hover:text-foreground",
            )}
          >
            {LIBRARY_TAB_LABELS[tab]}
            <span className="font-mono text-[11px] tabular-nums text-ink-4">
              {counts[tab].toLocaleString()}
            </span>
            {isActive ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 bg-foreground" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
