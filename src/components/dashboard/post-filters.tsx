"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { TextT, Image, VideoCamera, SquaresFour, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MEDIA_TYPES = [
  { key: "TEXT", label: "Text", icon: TextT, color: "bg-accent" },
  { key: "IMAGE", label: "Image", icon: Image, color: "bg-secondary" },
  { key: "VIDEO", label: "Video", icon: VideoCamera, color: "bg-tertiary" },
  { key: "CAROUSEL", label: "Carousel", icon: SquaresFour, color: "bg-quaternary" },
] as const;

const ALL_TYPE_KEYS = MEDIA_TYPES.map((t) => t.key);

function formatChipDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PostFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Parse current filter state from URL
  const typesParam = searchParams.get("types");
  const selectedTypes: string[] = typesParam
    ? typesParam.split(",").filter((t) => ALL_TYPE_KEYS.includes(t as (typeof ALL_TYPE_KEYS)[number]))
    : [...ALL_TYPE_KEYS];
  const allSelected = selectedTypes.length === ALL_TYPE_KEYS.length;

  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  const hasFilters = !allSelected || fromDate !== "" || toDate !== "";

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page"); // Always reset pagination on filter change
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleType(type: string) {
    let next: string[];
    if (selectedTypes.includes(type)) {
      // Prevent deselecting the last remaining type
      if (selectedTypes.length <= 1) return;
      next = selectedTypes.filter((t) => t !== type);
    } else {
      next = [...selectedTypes, type];
    }
    // Omit types param when all are selected
    const allNowSelected = next.length === ALL_TYPE_KEYS.length;
    navigate({ types: allNowSelected ? null : next.join(",") });
  }

  function clearAll() {
    navigate({ types: null, from: null, to: null });
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Row 1: Media type toggles + date range */}
      <div className="flex flex-wrap items-center gap-2">
        {MEDIA_TYPES.map(({ key, label, icon: Icon, color }) => {
          const isActive = selectedTypes.includes(key);
          return (
            <Button
              key={key}
              variant={isActive ? "candy" : "outline"}
              size="sm"
              className={cn(
                "gap-1.5",
                isActive && [
                  color,
                  "text-white border-foreground",
                  // Override candy shadow for a flat active look
                  "shadow-none hover:shadow-none hover:translate-x-0 hover:translate-y-0",
                ]
              )}
              onClick={() => toggleType(key)}
            >
              <Icon weight={isActive ? "fill" : "regular"} className="size-4" />
              {label}
            </Button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">From</label>
          <Input
            type="date"
            min="2024-04-13"
            value={fromDate}
            onChange={(e) => navigate({ from: e.target.value || null })}
            className="h-9 w-40"
          />
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">To</label>
          <Input
            type="date"
            min="2024-04-13"
            value={toDate}
            onChange={(e) => navigate({ to: e.target.value || null })}
            className="h-9 w-40"
          />
        </div>
      </div>

      {/* Row 2: Active filter chips + Clear all */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {!allSelected && (
            <button
              onClick={() => navigate({ types: null })}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-2 border-foreground bg-muted px-3 py-1 text-xs font-bold transition-colors hover:bg-muted/70"
            >
              Types: {selectedTypes.map((t) => MEDIA_TYPES.find((m) => m.key === t)?.label).join(", ")}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {fromDate && (
            <button
              onClick={() => navigate({ from: null })}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-2 border-foreground bg-muted px-3 py-1 text-xs font-bold transition-colors hover:bg-muted/70"
            >
              From: {formatChipDate(fromDate)}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {toDate && (
            <button
              onClick={() => navigate({ to: null })}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border-2 border-foreground bg-muted px-3 py-1 text-xs font-bold transition-colors hover:bg-muted/70"
            >
              To: {formatChipDate(toDate)}
              <X weight="bold" className="size-3" />
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
