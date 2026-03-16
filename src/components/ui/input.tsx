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
        "flex w-full bg-input border-2 border-input-border rounded-[var(--radius-md)]",
        "h-12 px-4 text-sm text-foreground placeholder:text-muted-foreground",
        "transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
        "focus:border-primary focus:shadow-[var(--shadow-accent)] focus:outline-none",
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
        "text-xs font-bold uppercase tracking-wide text-foreground",
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
        "flex w-full bg-input border-2 border-input-border rounded-[var(--radius-md)]",
        "h-12 px-4 text-sm text-foreground placeholder:text-muted-foreground",
        "transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
        "focus:border-primary focus:shadow-[var(--shadow-accent)] focus:outline-none",
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
