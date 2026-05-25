"use client"

import { Input as InputPrimitive } from "@base-ui/react/input"
import { Field } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Input — DESIGN.md styled input                                     */
/* ------------------------------------------------------------------ */

function Input({
  className,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "flex w-full bg-input border border-input-border rounded-[var(--radius-sm)]",
        "h-9 px-3 text-sm text-foreground placeholder:text-ink-4",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-ink-3",
        "focus:border-accent focus:shadow-[var(--shadow-accent)] focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  FormField — label + input + description + error                    */
/* ------------------------------------------------------------------ */

function FormField({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Field.Root>) {
  return (
    <Field.Root
      data-slot="form-field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      {children}
    </Field.Root>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Field.Label>) {
  return (
    <Field.Label
      data-slot="form-label"
      className={cn(
        "text-xs font-medium text-ink-2",
        className
      )}
      {...props}
    />
  )
}

function FormControl({
  className,
  ...props
}: React.ComponentProps<typeof Field.Control>) {
  return (
    <Field.Control
      data-slot="form-control"
      className={cn(
        "flex w-full bg-input border border-input-border rounded-[var(--radius-sm)]",
        "h-9 px-3 text-sm text-foreground placeholder:text-ink-4",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-ink-3",
        "focus:border-accent focus:shadow-[var(--shadow-accent)] focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<typeof Field.Description>) {
  return (
    <Field.Description
      data-slot="form-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormError({
  className,
  ...props
}: React.ComponentProps<typeof Field.Error>) {
  return (
    <Field.Error
      data-slot="form-error"
      className={cn("text-xs text-destructive", className)}
      {...props}
    />
  )
}

export {
  Input,
  FormField,
  FormLabel,
  FormControl,
  FormDescription,
  FormError,
}
