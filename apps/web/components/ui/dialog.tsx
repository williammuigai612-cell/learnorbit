"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Cross2Icon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("lh-modal-overlay fixed inset-0 bg-black/40", className)}
    style={{ zIndex: 'var(--z-modal-backdrop)', willChange: 'opacity' }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  // NOTE: Overlay and Content are rendered as direct, sibling children of
  // DialogPortal. Radix wraps *each* child in <Presence> so it can defer
  // unmount until the exit animation finishes. Wrapping them in a single
  // outer <div> would collapse that into one Presence that sees no animation
  // on itself → immediate unmount → no close animation.
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // Centering uses the standalone `translate` CSS property (not `transform`)
      // so the keyframes can animate `scale` and `opacity` independently
      // without ever touching the centering translate. Keeps shrink-to-fit
      // sizing (`w-auto`) working with `position: fixed`.
      style={{
        zIndex: 'var(--z-modal)' as any,
        translate: '-50% -50%',
        willChange: 'scale, opacity',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      onKeyDown={(e) => {
        // Prevent Radix from swallowing keystrokes (e.g. "D") inside form inputs
        const target = e.target as HTMLElement
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          e.stopPropagation()
        }
      }}
      className={cn(
        "lh-modal-content fixed left-[50%] top-[50%] grid w-full max-w-lg gap-0 border border-gray-200/80 bg-white shadow-2xl shadow-black/10 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute end-4 top-4 p-1.5 rounded-lg bg-gray-100/80 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none"
        aria-label="Close dialog"
      >
        <Cross2Icon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-0 text-center sm:text-start",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

// Phase 9D (M7): the column-reverse stack had no gap at all, so below `sm`
// the two buttons touched (measured 0px at 360x640 and 390x844).
// `gap-y-2`/`sm:gap-y-0` rather than the more obvious `gap-2`/`sm:gap-0`:
// five callers pass their own unprefixed `gap-2` (the `mt-5 gap-2` footers in
// home.tsx, account/page.tsx and AccountDangerZone.tsx, plus Modal.tsx), and
// twMerge keeps a caller's `gap-2` *alongside* a base `sm:gap-0` — which
// measured an 8px desktop regression for those five (20px -> 12px between
// buttons). Scoping the gap to the row axis fixes the stack and is inert in a
// single-row flex, so every desktop measurement stayed identical.
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-y-2 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-y-0",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight text-gray-900",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
