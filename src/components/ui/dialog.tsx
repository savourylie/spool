"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

/* Editorial Utility dialog — a hairlined sheet of paper centered over a flat,
   dimmed backdrop. No lift and no motion; the popup simply appears.

   Controlled by the caller through `open` / `onOpenChange`. Escape and an
   outside press arrive as `onOpenChange(false, details)`. A caller that must
   not be dismissed (a destructive run in flight) calls `details.cancel()`,
   which leaves the dialog open and keeps Base UI from handling the event. */

type DialogChangeEventDetails = DialogPrimitive.Root.ChangeEventDetails

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

/* Portal, backdrop and popup together: they are never useful apart. */
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/40"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "rounded-[var(--radius-lg)] border border-line-strong bg-paper p-6 text-foreground outline-hidden",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg font-medium tracking-[-0.015em] text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-ink-2", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogTitle, DialogDescription }
export type { DialogChangeEventDetails }
