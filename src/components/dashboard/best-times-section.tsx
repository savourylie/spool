import { cn } from "@/lib/utils";
import { formatSlot } from "@/components/dashboard/timing-heatmap";

interface BestTimesSectionProps {
  bestSlots: { day: number; hour: number; avg: number }[];
  className?: string;
}

export function BestTimesSection({ bestSlots, className }: BestTimesSectionProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Best 3 Times
      </p>
      {bestSlots.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {bestSlots.map((slot, i) => (
            <li
              key={`${slot.day}-${slot.hour}`}
              className="flex items-center gap-2 text-sm"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="font-medium">
                {formatSlot(slot.day, slot.hour)}
              </span>
              <span className="text-muted-foreground">
                {slot.avg.toFixed(1)}%
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not enough data to determine best posting times yet.
        </p>
      )}
    </div>
  );
}
