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
        <ArrowRight weight="bold" className="ml-1 size-4" />
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
