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
    <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Pagination">
      <Link
        href={buildHref(currentPage - 1)}
        aria-label="Previous page"
        className={cn(
          "inline-flex items-center justify-center size-12 md:size-10 rounded-full border-2 border-foreground text-sm font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
          currentPage <= 1
            ? "pointer-events-none opacity-40"
            : "hover:bg-tertiary"
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
            "inline-flex items-center justify-center size-12 md:size-10 rounded-full border-2 border-foreground text-sm font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
            page === currentPage
              ? "bg-accent text-accent-foreground"
              : "hover:bg-tertiary"
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
          "inline-flex items-center justify-center size-12 md:size-10 rounded-full border-2 border-foreground text-sm font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
          currentPage >= totalPages
            ? "pointer-events-none opacity-40"
            : "hover:bg-tertiary"
        )}
        aria-disabled={currentPage >= totalPages}
        tabIndex={currentPage >= totalPages ? -1 : undefined}
      >
        <CaretRight weight="bold" className="size-4" />
      </Link>
    </nav>
  );
}
