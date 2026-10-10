import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Card — Editorial Utility: flat, hairlined, no lift                 */
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
        "relative overflow-hidden bg-card rounded-[var(--radius-lg)] border",
        featured ? "border-foreground" : "border-border",
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
      className={cn("flex flex-col gap-1.5 px-5 pt-5", className)}
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
      className={cn(
        "font-heading text-lg font-medium tracking-[-0.015em]",
        className
      )}
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
      className={cn("px-5 py-4", className)}
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
      className={cn("flex items-center px-5 pb-5", className)}
      {...props}
    />
  )
}

/**
 * Editorial Utility removes the "sticker" floating icon circle entirely —
 * cards carry meaning through eyebrow → title → body hierarchy, not chrome.
 * Kept as an inert no-op so existing call sites compile unchanged; pass an
 * inline icon next to the title instead where a glyph adds value.
 */
function StickerCardIcon(
  props: React.ComponentProps<"div"> & {
    color?: "primary" | "secondary" | "tertiary" | "quaternary"
  }
) {
  void props
  return null
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
