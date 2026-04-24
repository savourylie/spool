import Link from "next/link";
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";

import { cn } from "@/lib/utils";
import type { FreshnessLogCounts } from "@/lib/freshness-log";

interface FreshnessLogCardProps {
  counts: FreshnessLogCounts;
  className?: string;
  /** Label above the bar. Default "Last 7 days". */
  windowLabel?: string;
  /** Hide the "See review log" link — useful when rendered on the reviews page. */
  showReviewLink?: boolean;
}

interface Segment {
  key: "green" | "yellow" | "red";
  count: number;
  bar: string;
  dot: string;
  label: string;
  tooltip: string;
}

function buildSegments(counts: FreshnessLogCounts): Segment[] {
  return [
    {
      key: "green",
      count: counts.green,
      bar: "bg-quaternary",
      dot: "bg-quaternary",
      label: "fresh",
      tooltip: `${counts.green} fresh`,
    },
    {
      key: "yellow",
      count: counts.yellow,
      bar: "bg-tertiary",
      dot: "bg-tertiary",
      label: "caution",
      tooltip: `${counts.yellow} caution`,
    },
    {
      key: "red",
      count: counts.red,
      bar: "bg-destructive",
      dot: "bg-destructive",
      label: "saturated",
      tooltip: `${counts.red} saturated`,
    },
  ];
}

export function FreshnessLogCard({
  counts,
  className,
  windowLabel = "Last 7 days",
  showReviewLink = true,
}: FreshnessLogCardProps) {
  const { total, hasData } = counts;
  const segments = buildSegments(counts);
  const ariaSummary = `Freshness log ${windowLabel.toLowerCase()}: ${counts.green} fresh, ${counts.yellow} caution, ${counts.red} saturated.`;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartBar weight="fill" className="size-5 text-primary" />
          <h3 className="font-heading text-base font-bold">
            Freshness log health
          </h3>
        </div>
        {showReviewLink && (
          <Link
            href="/dashboard/understand/reviews"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            See review log
            <ArrowRight weight="bold" className="size-3" />
          </Link>
        )}
      </div>

      {!hasData ? (
        <p className="py-2 text-xs text-muted-foreground">
          No checks yet — topics you draft or scan will show up here.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{windowLabel}</p>
          <div
            role="img"
            aria-label={ariaSummary}
            className="flex h-3 w-full overflow-hidden rounded-full border border-border bg-muted"
          >
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <span
                  key={s.key}
                  className={s.bar}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={s.tooltip}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {segments.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5"
                title={s.tooltip}
              >
                <span className={cn("size-2 rounded-full", s.dot)} />
                <span className="font-semibold text-foreground">{s.count}</span>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
