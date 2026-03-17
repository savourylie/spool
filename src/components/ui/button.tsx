"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import type { VariantProps } from "class-variance-authority"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-variants"

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
