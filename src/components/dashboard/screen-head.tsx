import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial Utility screen header — a mono eyebrow over a tight-tracked
 * title, optional right-aligned actions, all sitting on a hairline.
 */
export function ScreenHead({
  eyebrow,
  title,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="eyebrow mb-1.5">{eyebrow}</div>
        ) : null}
        <h1 className="font-heading text-2xl font-medium tracking-[-0.025em]">
          {title}
        </h1>
        {children ? (
          <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
