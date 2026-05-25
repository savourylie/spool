import { cva, type VariantProps } from "class-variance-authority"

/* Editorial Utility buttons — two intents, one sharp shape.
   Primary is ink on paper; everything else is hairlined.
   No gradient fills, no hard drop shadows. Accent appears only
   in the focus ring. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-medium tracking-[-0.005em] transition-colors duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
  {
    variants: {
      variant: {
        candy: [
          "border border-foreground bg-primary text-primary-foreground",
          "hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--ink-3))]",
        ],
        outline: [
          "border border-line-strong bg-transparent text-foreground",
          "hover:border-foreground hover:bg-paper-2",
        ],
        ghost: "text-ink-2 hover:bg-paper-2 hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
        destructive: [
          "border border-[color-mix(in_oklab,var(--neg)_40%,transparent)] bg-transparent text-destructive",
          "hover:border-destructive hover:bg-neg-soft",
        ],
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "candy",
      size: "default",
    },
  }
)

export { buttonVariants }
export type { VariantProps }
