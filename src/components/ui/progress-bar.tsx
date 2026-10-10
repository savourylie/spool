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
        "h-2 w-full overflow-hidden rounded-[2px] bg-paper-3",
        className,
      )}
    >
      {indeterminate ? (
        <div
          className="h-full w-1/4 bg-primary"
          style={{ animation: "progress-indeterminate 1.5s ease-in-out infinite" }}
        />
      ) : (
        <div
          className="h-full bg-primary"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
            transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}
    </div>
  )
}
