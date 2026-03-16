import { cn } from "@/lib/utils"

export function ProgressBar({
  percentage,
  className,
}: {
  percentage: number | null
  className?: string
}) {
  const indeterminate = percentage === null

  return (
    <div
      className={cn(
        "h-6 w-full overflow-hidden rounded-full border-2 border-foreground bg-muted shadow-[var(--shadow-default)]",
        className,
      )}
    >
      {indeterminate ? (
        <div
          className="h-full w-1/4 rounded-full bg-primary"
          style={{ animation: "progress-indeterminate 1.5s ease-in-out infinite" }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            transition: "width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      )}
    </div>
  )
}
