"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `${pathname}?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  // Show up to 5 page numbers centered around current page
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pt-4">
      <div className="mb-2 flex items-center justify-center text-sm font-medium text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <nav
        className="flex items-center justify-center gap-2"
        aria-label="Pagination"
      >
        <Link
          href={buildHref(currentPage - 1)}
          aria-label="Previous page"
          className={cn(
            "inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] border border-line-strong text-sm font-medium transition-colors duration-150",
            currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-paper-2"
          )}
          aria-disabled={currentPage <= 1}
          tabIndex={currentPage <= 1 ? -1 : undefined}
        >
          <CaretLeft weight="bold" className="size-4" />
        </Link>

        {pages.map((page) => (
          <Link
            key={page}
            href={buildHref(page)}
            className={cn(
              "inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] border border-line-strong text-sm font-medium transition-colors duration-150",
              page === currentPage
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-paper-2"
            )}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Link>
        ))}

        <Link
          href={buildHref(currentPage + 1)}
          aria-label="Next page"
          className={cn(
            "inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] border border-line-strong text-sm font-medium transition-colors duration-150",
            currentPage >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-paper-2"
          )}
          aria-disabled={currentPage >= totalPages}
          tabIndex={currentPage >= totalPages ? -1 : undefined}
        >
          <CaretRight weight="bold" className="size-4" />
        </Link>
      </nav>
    </div>
  );
}
