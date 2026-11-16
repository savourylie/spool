"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/* Editorial Utility checkbox — one sharp 16px box. Hairlined at rest,
   ink-filled when checked or mixed (the primary button's ink-on-paper),
   with the accent only in the focus ring. */
function Checkbox({
  className,
  indeterminate,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-input text-primary-foreground transition-colors duration-150",
        "data-[unchecked]:hover:border-ink-3",
        "data-[checked]:border-foreground data-[checked]:bg-primary",
        "data-[indeterminate]:border-foreground data-[indeterminate]:bg-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {indeterminate ? (
          <Minus weight="bold" className="size-3" />
        ) : (
          <Check weight="bold" className="size-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
