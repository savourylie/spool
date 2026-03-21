import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold transition-all duration-300 [transition-timing-function:var(--ease-bounce)] outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        candy: [
          "rounded-full border-2 border-foreground bg-primary text-primary-foreground",
          "shadow-[var(--shadow-default)]",
          "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
          "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[var(--shadow-active)]",
          "focus-visible:ring-3 focus-visible:ring-ring focus-visible:shadow-[var(--shadow-hover)]",
        ],
        outline: [
          "rounded-full border-2 border-foreground bg-transparent text-foreground",
          "hover:bg-tertiary",
          "focus-visible:ring-3 focus-visible:ring-ring",
        ],
        ghost:
          "rounded-full hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring",
        link: "text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring",
        destructive: [
          "rounded-full border-2 border-destructive bg-destructive/10 text-destructive",
          "hover:bg-destructive/20",
          "focus-visible:ring-3 focus-visible:ring-destructive/50",
        ],
      },
      size: {
        default: "h-12 px-6 text-sm",
        sm: "h-12 px-4 text-sm md:h-9",
        lg: "h-14 px-8 text-base",
        icon: "size-12",
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
