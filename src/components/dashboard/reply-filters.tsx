"use client";

import { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FunnelSimple, MagnifyingGlass, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RISK_FILTERS = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "unknown", label: "Unknown" },
] as const;

const STATUS_FILTERS = [
  { key: "all", label: "All statuses" },
  { key: "needs_review", label: "Needs review" },
  { key: "reviewed", label: "Reviewed" },
] as const;

function formatChipDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReplyFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const risk = searchParams.get("risk") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const query = searchParams.get("q") ?? "";
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  const hasFilters =
    risk !== "all" ||
    status !== "all" ||
    query !== "" ||
    fromDate !== "" ||
    toDate !== "";

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = String(formData.get("q") ?? "").trim();
    navigate({ q: nextQuery || null });
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FunnelSimple weight="bold" className="size-3.5" />
          Risk
        </span>
        {RISK_FILTERS.map((item) => (
          <Button
            key={item.key}
            variant={risk === item.key ? "candy" : "outline"}
            size="sm"
            onClick={() => navigate({ risk: item.key })}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((item) => (
          <Button
            key={item.key}
            variant={status === item.key ? "candy" : "outline"}
            size="sm"
            onClick={() => navigate({ status: item.key })}
          >
            {item.label}
          </Button>
        ))}

        <form
          onSubmit={onSearchSubmit}
          className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto"
        >
          <div className="relative w-full sm:w-64">
            <MagnifyingGlass
              weight="bold"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search replies"
              className="h-12 pl-9 md:h-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="reply-filter-from" className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          From
        </label>
        <Input
          id="reply-filter-from"
          type="date"
          min="2024-04-13"
          value={fromDate}
          onChange={(event) => navigate({ from: event.target.value || null })}
          className="h-12 w-full sm:w-40 md:h-9"
        />
        <label htmlFor="reply-filter-to" className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
          To
        </label>
        <Input
          id="reply-filter-to"
          type="date"
          min="2024-04-13"
          value={toDate}
          onChange={(event) => navigate({ to: event.target.value || null })}
          className="h-12 w-full sm:w-40 md:h-9"
        />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {risk !== "all" && (
            <button
              type="button"
              onClick={() => navigate({ risk: null })}
              className="inline-flex min-h-12 items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-paper-2 md:min-h-0"
            >
              Risk: {risk}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {status !== "all" && (
            <button
              type="button"
              onClick={() => navigate({ status: null })}
              className="inline-flex min-h-12 items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-paper-2 md:min-h-0"
            >
              Status: {status.replace("_", " ")}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {query && (
            <button
              type="button"
              onClick={() => navigate({ q: null })}
              className="inline-flex min-h-12 items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-paper-2 md:min-h-0"
            >
              Search: {query}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {fromDate && (
            <button
              type="button"
              onClick={() => navigate({ from: null })}
              className="inline-flex min-h-12 items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-paper-2 md:min-h-0"
            >
              From: {formatChipDate(fromDate)}
              <X weight="bold" className="size-3" />
            </button>
          )}
          {toDate && (
            <button
              type="button"
              onClick={() => navigate({ to: null })}
              className="inline-flex min-h-12 items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-paper-2 md:min-h-0"
            >
              To: {formatChipDate(toDate)}
              <X weight="bold" className="size-3" />
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({
                risk: null,
                status: null,
                q: null,
                from: null,
                to: null,
              })
            }
            className={cn("text-xs")}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
