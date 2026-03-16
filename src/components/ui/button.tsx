"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"

import { cn } from "@/lib/utils"

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
        sm: "h-9 px-4 text-sm",
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

function Button({
  className,
  variant = "candy",
  size = "default",
  trailingIcon,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    trailingIcon?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      {trailingIcon && (
        <span className="ml-1 inline-flex size-6 items-center justify-center rounded-full bg-white/30">
          <ArrowRight weight="bold" className="size-3.5 text-primary-foreground" />
        </span>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
