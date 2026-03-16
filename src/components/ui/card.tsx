import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Sticker Card — DESIGN.md compound component                       */
/* ------------------------------------------------------------------ */

function StickerCard({
  className,
  featured = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { featured?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative overflow-visible bg-card border-2 border-foreground rounded-[var(--radius-lg)]",
        featured
          ? "shadow-[var(--shadow-featured)]"
          : "shadow-[var(--shadow-soft)]",
        "transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
        "hover:rotate-[-1deg] hover:scale-[1.02]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function StickerCardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 px-6 pt-6", className)}
      {...props}
    />
  )
}

function StickerCardTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("font-heading font-bold text-lg", className)}
      {...props}
    />
  )
}

function StickerCardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function StickerCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 py-4", className)}
      {...props}
    />
  )
}

function StickerCardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 pb-6", className)}
      {...props}
    />
  )
}

const iconColorMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  quaternary: "bg-quaternary",
} as const

function StickerCardIcon({
  className,
  color = "primary",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  color?: keyof typeof iconColorMap
}) {
  return (
    <div
      data-slot="card-icon"
      className={cn(
        "absolute -top-6 left-6 flex size-12 items-center justify-center rounded-full text-white",
        iconColorMap[color],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardFooter,
  StickerCardIcon,
}
