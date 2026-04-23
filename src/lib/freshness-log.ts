// Freshness log aggregator (TICKET-072).
//
// Summarizes the last-7-days verdict distribution from freshness_checks so the
// Today Hub "Freshness log health" card can render a compact stacked bar.
// Bounded workload: per-user rate limit is 10 checks/hour, giving ~1,680 rows
// max over 7 days — tiny, no pagination or RPC needed.
//
// Server-only: uses createAdminClient.

import { createAdminClient } from "@/lib/supabase/server";

export const FRESHNESS_LOG_WINDOW_DAYS = 7;

export interface FreshnessLogCounts {
  green: number;
  yellow: number;
  red: number;
  total: number;
  /** False when the window contains zero checks — drives first-run empty state. */
  hasData: boolean;
}

const EMPTY: FreshnessLogCounts = {
  green: 0,
  yellow: 0,
  red: 0,
  total: 0,
  hasData: false,
};

export async function getFreshnessLogCounts(
  userId: string,
  now: Date = new Date(),
): Promise<FreshnessLogCounts> {
  if (!userId) return EMPTY;

  const since = new Date(
    now.getTime() - FRESHNESS_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("freshness_checks")
    .select("verdict")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error || !data) {
    return EMPTY;
  }

  let green = 0;
  let yellow = 0;
  let red = 0;
  for (const row of data) {
    if (row.verdict === "green") green += 1;
    else if (row.verdict === "yellow") yellow += 1;
    else if (row.verdict === "red") red += 1;
  }
  const total = green + yellow + red;
  return { green, yellow, red, total, hasData: total > 0 };
}
