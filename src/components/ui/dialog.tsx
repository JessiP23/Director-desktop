"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X as XIcon } from "lucide-react"

import { cn } from "@/lib/utils/cn"

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("Dialog components must be used within Dialog")
  }
  return context
}

function composeEventHandlers<E extends { defaultPrevented?: boolean }>(
  original?: (event: E) => void,
  next?: (event: E) => void
) {
  return (event: E) => {
    original?.(event)
    if (event.defaultPrevented) return
    next?.(event)
  }
}

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const titleId = React.useId()
  const descriptionId = React.useId()

  const currentOpen = isControlled ? open : internalOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DialogContext.Provider value={{ open: currentOpen, setOpen, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  asChild,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { setOpen } = useDialogContext()

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>)
    if (!event.defaultPrevented) {
      setOpen(true)
    }
  }, [onClick, setOpen])

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>
    const childProps = child.props as { onClick?: (event: React.MouseEvent<HTMLElement>) => void }
    return React.cloneElement(child, {
      ...props,
      "data-slot": "dialog-trigger",
      onClick: composeEventHandlers(childProps.onClick, handleClick),
    })
  }

  return (
    <button
      type="button"
      data-slot="dialog-trigger"
      onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogPortal({
  children,
}: {
  children: React.ReactNode
}) {
  if (typeof document === "undefined") return null
  return createPortal(<div data-slot="dialog-portal">{children}</div>, document.body)
}

function DialogClose({
  asChild,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { setOpen } = useDialogContext()

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>)
    if (!event.defaultPrevented) {
      setOpen(false)
    }
  }, [onClick, setOpen])

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>
    const childProps = child.props as { onClick?: (event: React.MouseEvent<HTMLElement>) => void }
    return React.cloneElement(child, {
      ...props,
      "data-slot": "dialog-close",
      onClick: composeEventHandlers(childProps.onClick, handleClick),
    })
  }

  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogOverlay({
  className,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = useDialogContext()
  if (!open) return null

  return (
    <div
      data-slot="dialog-overlay"
      data-state={open ? "open" : "closed"}
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[800] bg-black/50",
        className
      )}
      onClick={composeEventHandlers(onClick, () => setOpen(false))}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showCloseButton?: boolean
  overlayClassName?: string
}) {
  const { open, setOpen, titleId, descriptionId } = useDialogContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open, setOpen])

  React.useEffect(() => {
    if (!open) return
    contentRef.current?.focus()
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <div
        ref={contentRef}
        data-slot="dialog-content"
        data-state={open ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[801] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg min-w-0",
          className
        )}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            onClick={() => setOpen(false)}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext()
  return (
    <h2
      data-slot="dialog-title"
      id={props.id ?? titleId}
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId } = useDialogContext()
  return (
    <p
      data-slot="dialog-description"
      id={props.id ?? descriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
