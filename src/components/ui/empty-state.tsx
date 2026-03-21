import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

const iconColorMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  quaternary: "bg-quaternary",
} as const;

interface EmptyStateProps {
  icon: React.ReactNode;
  iconColor?: keyof typeof iconColorMap;
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
  iconColor = "primary",
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
        className={cn(
          "flex size-14 items-center justify-center rounded-full text-white",
          iconColorMap[iconColor]
        )}
      >
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold">{title}</h3>
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
