import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { ReplyFilters } from "@/components/dashboard/reply-filters";
import { ReplySyncButton } from "@/components/dashboard/reply-sync-button";
import { ReplyTable, type ReplyAuditRow } from "@/components/dashboard/reply-table";
import { ScreenHead } from "@/components/dashboard/screen-head";
import { createAdminClient } from "@/lib/supabase/server";
import {
  POSTS_PAGE_SIZE,
  getPostsTotalPages,
} from "@/lib/posts-pagination";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const metadata: Metadata = { title: "Replies — Spool" };

export const dynamic = "force-dynamic";

const VALID_RISK_LEVELS = ["unknown", "low", "medium", "high"] as const;
const VALID_REVIEW_STATUSES = ["needs_review", "reviewed"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidRisk(value: string): value is (typeof VALID_RISK_LEVELS)[number] {
  return (VALID_RISK_LEVELS as readonly string[]).includes(value);
}

function isValidStatus(
  value: string,
): value is (typeof VALID_REVIEW_STATUSES)[number] {
  return (VALID_REVIEW_STATUSES as readonly string[]).includes(value);
}

function buildRedirectHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string" && value.length > 0) {
      search.set(key, value);
    }
  }
  search.set("page", String(page));
  return `/dashboard/replies?${search.toString()}`;
}

export default async function RepliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const riskParam = String(params.risk ?? "");
  const statusParam = String(params.status ?? "");
  const queryParam = String(params.q ?? "").trim();
  const fromRaw = String(params.from ?? "");
  const toRaw = String(params.to ?? "");

  const risk = isValidRisk(riskParam) ? riskParam : null;
  const reviewStatus = isValidStatus(statusParam) ? statusParam : null;
  const dateFrom = DATE_REGEX.test(fromRaw) ? fromRaw : null;
  const dateTo = DATE_REGEX.test(toRaw) ? toRaw : null;
  const searchQuery = queryParam.length > 0 ? queryParam : null;
  const hasFilters =
    risk !== null ||
    reviewStatus !== null ||
    dateFrom !== null ||
    dateTo !== null ||
    searchQuery !== null;

  const supabase = createAdminClient();
  const userId = session.value;
  const offset = (page - 1) * POSTS_PAGE_SIZE;

  let query = supabase
    .from("user_replies")
    .select(
      "id, text, permalink, replied_at, risk_level, risk_categories, risk_summary, review_status",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("replied_at", { ascending: false })
    .range(offset, offset + POSTS_PAGE_SIZE - 1);

  if (risk) {
    query = query.eq("risk_level", risk);
  }
  if (reviewStatus) {
    query = query.eq("review_status", reviewStatus);
  }
  if (dateFrom) {
    query = query.gte("replied_at", `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    query = query.lte("replied_at", `${dateTo}T23:59:59.999Z`);
  }
  if (searchQuery) {
    query = query.ilike("text", `%${searchQuery}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return <ErrorState description="We couldn't load your replies right now." />;
  }

  const replies = (data ?? []) as ReplyAuditRow[];
  const totalCount = count ?? 0;
  const totalPages = getPostsTotalPages(totalCount);

  if (totalPages > 0 && page > totalPages) {
    redirect(buildRedirectHref(params, totalPages));
  }

  return (
    <div className="py-8">
      <ScreenHead
        eyebrow="All · authored replies"
        title={`${totalCount.toLocaleString()} replies`}
        actions={<ReplySyncButton />}
      >
        Scan your public replies for tone, professionalism, and reputation risk.
      </ScreenHead>

      <div className="mt-6">
        <ReplyFilters />
        <ReplyTable
          replies={replies}
          currentPage={page}
          totalCount={totalCount}
          totalPages={totalPages}
          hasFilters={hasFilters}
        />
      </div>
    </div>
  );
}
