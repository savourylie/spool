import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";

import type { RedFreshnessRow } from "@/lib/freshness-log";

interface RedVerdictsTableProps {
  rows: RedFreshnessRow[];
  /** Max rows the caller fetched; used to render a "Showing N most recent" footer. */
  fetchLimit: number;
  /** Reference epoch for relative-time rendering. Pass from the page so the
   * component stays pure during render. */
  now: number;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatRelativeTime(dateString: string, now: number) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return relativeTimeFormatter.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

export function RedVerdictsTable({
  rows,
  fetchLimit,
  now,
}: RedVerdictsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No red verdicts in the last 30 days.
      </p>
    );
  }

  const hitCap = rows.length >= fetchLimit;

  return (
    <details className="group mt-4 rounded-[var(--radius-md)] border border-border bg-card">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground list-none [&::-webkit-details-marker]:hidden">
        <span>Red verdicts · last 30 days · {rows.length}</span>
        <CaretDown
          weight="bold"
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border align-top"
              >
                <td className="max-w-[280px] px-4 py-2">
                  <span className="block truncate" title={row.topic}>
                    {row.topic || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  <time dateTime={row.createdAt}>
                    {formatRelativeTime(row.createdAt, now)}
                  </time>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.reasonSummary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hitCap && (
          <p className="border-t border-border bg-muted px-4 py-2 text-[11px] text-muted-foreground">
            Showing {fetchLimit} most recent.
          </p>
        )}
      </div>
    </details>
  );
}
