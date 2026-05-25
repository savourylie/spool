import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

interface EmptyStateProps {
  icon: React.ReactNode;
  /** Retained for API compatibility; Editorial Utility renders a neutral chip. */
  iconColor?: "primary" | "secondary" | "tertiary" | "quaternary";
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-line bg-paper-2 text-ink-3"
      >
        {icon}
      </div>
      <h3 className="font-heading text-lg font-medium tracking-[-0.015em]">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action &&
        (action.href ? (
          <Link href={action.href} className={buttonVariants({ variant: "candy", size: "sm" })}>
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
