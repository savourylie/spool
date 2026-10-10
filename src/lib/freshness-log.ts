// Freshness log aggregator (TICKET-072, extended in TICKET-075).
//
// Summarizes verdict distribution from freshness_checks so Today Hub and the
// Reviews page can render a compact stacked bar. Also fetches the red-verdict
// list used by the Reviews page "red verdicts" table.
//
// Bounded workload: per-user rate limit is 10 checks/hour, giving tiny row
// counts even over a 30-day window — no RPC or server-side pagination needed.
//
// Server-only: uses createAdminClient.

import { createAdminClient } from "@/lib/supabase/server";
import { extractFreshnessReason } from "@/lib/prediction-reviews";

export const FRESHNESS_LOG_WINDOW_DAYS = 7;

export interface FreshnessLogCounts {
  green: number;
  yellow: number;
  red: number;
  total: number;
  /** False when the window contains zero checks — drives first-run empty state. */
  hasData: boolean;
}

export interface RedFreshnessRow {
  id: string;
  topic: string;
  createdAt: string;
  reasonSummary: string;
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
  windowDays: number = FRESHNESS_LOG_WINDOW_DAYS,
): Promise<FreshnessLogCounts> {
  if (!userId) return EMPTY;

  const since = new Date(
    now.getTime() - windowDays * 24 * 60 * 60 * 1000,
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

/**
 * Fetch the most recent red-verdict freshness checks within the window.
 *
 * Each row is decorated with a short `reasonSummary` synthesized from the
 * stored JSONB signals so the UI table can render without re-parsing.
 * On error returns an empty list rather than throwing — this is a side
 * panel and should degrade silently if the audit table is unreachable.
 */
export async function fetchRedFreshnessVerdicts(
  userId: string,
  opts: { windowDays: number; limit: number },
  now: Date = new Date(),
): Promise<RedFreshnessRow[]> {
  if (!userId) return [];
  const { windowDays, limit } = opts;
  if (limit <= 0) return [];

  const since = new Date(
    now.getTime() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("freshness_checks")
    .select("id, topic, created_at, external_signal, self_repetition_risk")
    .eq("user_id", userId)
    .eq("verdict", "red")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    topic: row.topic,
    createdAt: row.created_at ?? new Date().toISOString(),
    reasonSummary: extractFreshnessReason({
      external_signal: row.external_signal,
      self_repetition_risk: row.self_repetition_risk,
    }),
  }));
}
