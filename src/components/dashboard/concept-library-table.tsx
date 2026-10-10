"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  Books,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  FunnelSimple,
  MagnifyingGlass,
  Rows,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  ConceptLibraryRow,
  ConceptPostOccurrence,
  ConceptAnalogyCount,
} from "@/lib/concept-library-view";

type SortKey = "reuseRisk" | "lastUsedAt" | "timesExplained";
type SortDirection = "asc" | "desc";

interface ConceptLibraryTableProps {
  rows: ConceptLibraryRow[];
}

const PAGE_SIZE = 50;
const riskOrder: Record<ConceptLibraryRow["reuseRisk"], number> = {
  green: 1,
  yellow: 2,
  red: 3,
};

const riskLabel: Record<ConceptLibraryRow["reuseRisk"], string> = {
  green: "Fresh",
  yellow: "Watch",
  red: "High reuse",
};

const riskClass: Record<ConceptLibraryRow["reuseRisk"], string> = {
  green: "border-quaternary bg-quaternary/15 text-foreground",
  yellow: "border-tertiary bg-tertiary/20 text-foreground",
  red: "border-destructive bg-destructive/10 text-destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAnalogies(analogies: ConceptAnalogyCount[]): string {
  if (analogies.length === 0) return "None captured";
  const visible = analogies
    .slice(0, 3)
    .map((item) => `${item.analogy} (${item.count}x)`);
  const hidden = analogies.length - visible.length;
  return hidden > 0 ? `${visible.join(", ")} +${hidden} more` : visible.join(", ");
}

function SortButton({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "desc" ? CaretDown : CaretUp;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
        active
          ? "border-foreground bg-tertiary text-foreground shadow-[var(--shadow-default)]"
          : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {label}
      {active && <Icon weight="bold" className="size-3.5" />}
    </button>
  );
}

function ReuseRiskChip({ risk }: { risk: ConceptLibraryRow["reuseRisk"] }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold",
        riskClass[risk],
      )}
    >
      {riskLabel[risk]}
    </span>
  );
}

function ConceptOccurrencesDrawer({ concept }: { concept: string }) {
  const [rows, setRows] = useState<ConceptPostOccurrence[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setError(null);

    async function load() {
      try {
        const response = await fetch(
          `/api/concept-library/concepts/${encodeURIComponent(concept)}/posts`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load posts");
        }
        const payload = (await response.json()) as {
          rows: ConceptPostOccurrence[];
        };
        setRows(payload.rows);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load posts");
      }
    }

    load();
    return () => controller.abort();
  }, [concept]);

  return (
    <div className="bg-accent/5 px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Rows weight="bold" className="size-4" />
        </div>
        <p className="text-sm font-bold">Posts using this concept</p>
      </div>

      {!rows && !error && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading posts...
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No posts found for this concept.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => {
            const scannerHref = `/dashboard/create/scanner?text=${encodeURIComponent(
              row.textPreview ?? "",
            )}`;
            return (
              <div
                key={`${row.postId}-${row.seenAt}`}
                className="rounded-[var(--radius-md)] border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(row.seenAt)}</span>
                  {row.relatedCluster && <span>{row.relatedCluster}</span>}
                  {row.analogy && <span>Analogy: {row.analogy}</span>}
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed">
                  {row.textPreview ?? "No text preview available."}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {row.permalink ? (
                    <a
                      href={row.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Open post
                      <ArrowSquareOut weight="bold" className="size-4" />
                    </a>
                  ) : (
                    <Link
                      href={scannerHref}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Scan preview
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ConceptLibraryTable({ rows }: ConceptLibraryTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("reuseRisk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);
  const [rebuildStatus, setRebuildStatus] = useState<
    "idle" | "running" | "error"
  >("idle");
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setExpandedConcept(null);
  }, [query, sortKey, sortDirection]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const searched = normalizedQuery
      ? rows.filter((row) => {
          const analogyText = row.analogies
            .map((item) => item.analogy)
            .join(" ")
            .toLowerCase();
          return (
            row.concept.includes(normalizedQuery) ||
            analogyText.includes(normalizedQuery)
          );
        })
      : rows;

    const direction = sortDirection === "desc" ? -1 : 1;
    return [...searched].sort((a, b) => {
      let result = 0;
      if (sortKey === "reuseRisk") {
        result = riskOrder[a.reuseRisk] - riskOrder[b.reuseRisk];
      } else if (sortKey === "lastUsedAt") {
        result =
          new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
      } else {
        result = a.timesExplained - b.timesExplained;
      }
      return result * direction || a.concept.localeCompare(b.concept);
    });
  }, [query, rows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(nextKey);
      setSortDirection("desc");
    }
  }

  async function handleRebuild() {
    setRebuildStatus("running");
    setRebuildMessage(null);

    try {
      const response = await fetch("/api/concept-library/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Rebuild failed");
      }

      router.refresh();
      setRebuildStatus("idle");
    } catch (err) {
      setRebuildStatus("error");
      setRebuildMessage(
        err instanceof Error ? err.message : "Unable to rebuild library",
      );
    }
  }

  if (rows.length === 0) {
    return (
      <div>
        <EmptyState
          icon={<Books weight="bold" className="size-7" />}
          iconColor="quaternary"
          title="Build your concept library"
          description="Run the extractor across your posts to see concepts, analogies, and reuse risk here."
          action={{
            label:
              rebuildStatus === "running" ? "Building..." : "Build library",
            onClick: rebuildStatus === "running" ? undefined : handleRebuild,
          }}
        />
        {rebuildStatus === "error" && (
          <p className="mx-auto max-w-md text-center text-sm text-destructive">
            {rebuildMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:min-w-[320px]">
          <MagnifyingGlass
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search concepts or analogies"
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <SortButton
            active={sortKey === "reuseRisk"}
            direction={sortDirection}
            label="Reuse risk"
            onClick={() => toggleSort("reuseRisk")}
          />
          <SortButton
            active={sortKey === "lastUsedAt"}
            direction={sortDirection}
            label="Last used"
            onClick={() => toggleSort("lastUsedAt")}
          />
          <SortButton
            active={sortKey === "timesExplained"}
            direction={sortDirection}
            label="Times explained"
            onClick={() => toggleSort("timesExplained")}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          Showing {pageRows.length} of {filteredRows.length.toLocaleString()}{" "}
          concepts
        </p>
        <p>{rows.length.toLocaleString()} total in library</p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-foreground">
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Concept
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                First-seen post
              </th>
              <th className="px-3 py-3 text-right font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Times explained
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Analogies used
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reuse risk
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last used
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Related cluster
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const isExpanded = expandedConcept === row.concept;
              const firstPost = row.firstSeenPost;
              const firstPostHref = firstPost?.permalink;
              return (
                <tr
                  key={row.concept}
                  className={cn(index % 2 === 1 ? "bg-muted" : "bg-card")}
                >
                  <td colSpan={7} className="p-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedConcept((current) =>
                          current === row.concept ? null : row.concept,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedConcept((current) =>
                            current === row.concept ? null : row.concept,
                          );
                        }
                      }}
                      className={cn(
                        "grid min-w-[980px] cursor-pointer grid-cols-[1.1fr_1.25fr_0.65fr_1.35fr_0.7fr_0.7fr_0.8fr] items-center border-b border-border transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset",
                        isExpanded ? "bg-accent/5" : "hover:bg-accent/5",
                      )}
                    >
                      <div className="px-3 py-3">
                        <p className="font-bold text-foreground">
                          {row.concept}
                        </p>
                      </div>
                      <div className="px-3 py-3">
                        {firstPost ? (
                          <div>
                            {firstPostHref ? (
                              <a
                                href={firstPostHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                              >
                                {formatDate(firstPost.seenAt)}
                                <ArrowSquareOut
                                  weight="bold"
                                  className="size-3.5"
                                />
                              </a>
                            ) : (
                              <span className="font-semibold">
                                {formatDate(firstPost.seenAt)}
                              </span>
                            )}
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {firstPost.textPreview ?? "No preview available"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </div>
                      <div className="px-3 py-3 text-right tabular-nums">
                        {row.timesExplained}
                      </div>
                      <div className="px-3 py-3 text-muted-foreground">
                        {formatAnalogies(row.analogies)}
                      </div>
                      <div className="px-3 py-3">
                        <ReuseRiskChip risk={row.reuseRisk} />
                      </div>
                      <div className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(row.lastUsedAt)}
                      </div>
                      <div className="px-3 py-3">
                        {row.relatedCluster ? (
                          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold">
                            {row.relatedCluster}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                    <div
                      className="grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--ease-bounce)]"
                      style={{
                        gridTemplateRows: isExpanded ? "1fr" : "0fr",
                      }}
                    >
                      <div className="overflow-hidden">
                        {isExpanded && (
                          <ConceptOccurrencesDrawer concept={row.concept} />
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<FunnelSimple weight="bold" className="size-7" />}
                    iconColor="tertiary"
                    title="No concepts match"
                    description="Try a different concept name or analogy phrase."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <CaretLeft weight="bold" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              <CaretRight weight="bold" className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
