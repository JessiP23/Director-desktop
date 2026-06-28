"use client"

import * as React from "react"
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils/cn"

export type DirectorToastVariant = "error" | "success" | "info"

export type DirectorToast = {
  id: string
  message: string
  variant?: DirectorToastVariant
  durationMs?: number
}

const ICON_MAP = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  info: InformationCircleIcon,
}

const ICON_COLOR: Record<DirectorToastVariant, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-[#71717a]",
}

const PROGRESS_COLOR: Record<DirectorToastVariant, string> = {
  success: "#34d399",
  error: "#f87171",
  info: "#52525b",
}

export function DirectorToastContainer({
  toasts,
  onDismiss,
  onReportError,
}: {
  toasts: DirectorToast[]
  onDismiss: (id: string) => void
  onReportError?: (message: string) => Promise<void>
}) {
  if (toasts.length === 0) return null
  return (
    <div
      className="pointer-events-auto fixed right-4 top-4 z-[9999] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2 sm:right-5 sm:top-5"
      role="region"
      aria-label="Director notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <DirectorToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onReportError={onReportError}
        />
      ))}
    </div>
  )
}

function DirectorToastItem({
  toast,
  onDismiss,
  onReportError,
}: {
  toast: DirectorToast
  onDismiss: (id: string) => void
  onReportError?: (message: string) => Promise<void>
}) {
  const [mounted, setMounted] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [reportState, setReportState] = React.useState<"idle" | "sending" | "sent">("idle")
  const onDismissRef = React.useRef(onDismiss)
  React.useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])

  const duration = toast.durationMs ?? 6000

  React.useEffect(() => {
    const enter = window.requestAnimationFrame(() => setMounted(true))
    const auto = window.setTimeout(() => {
      setLeaving(true)
      window.setTimeout(() => onDismissRef.current(toast.id), 250)
    }, duration)
    return () => {
      window.cancelAnimationFrame(enter)
      window.clearTimeout(auto)
    }
  }, [toast.id, duration])

  const handleDismiss = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => onDismissRef.current(toast.id), 250)
  }

  const variant = toast.variant ?? "error"
  const Icon = ICON_MAP[variant]

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative overflow-hidden will-change-transform",
        "rounded-[14px] bg-[#15171b] ring-1 ring-white/[0.09]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]",
        "backdrop-blur-xl",
        "transition-[transform,opacity] duration-250 ease-out",
        mounted && !leaving
          ? "translate-x-0 translate-y-0 opacity-100"
          : "translate-x-3 opacity-0",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLOR[variant])} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] leading-snug text-[#f4f4f5]">
            {toast.message}
          </p>
          {variant === "error" && onReportError && (
            <button
              type="button"
              disabled={reportState !== "idle"}
              onClick={() => {
                setReportState("sending")
                void onReportError(toast.message)
                  .then(() => setReportState("sent"))
                  .catch(() => setReportState("idle"))
              }}
              className="mt-1.5 text-[11px] font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition-colors hover:text-zinc-300 disabled:no-underline disabled:opacity-60"
            >
              {reportState === "sent" ? "Issue reported" : "Report issue"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="-mr-0.5 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#52525b] transition-colors hover:text-[#a1a1aa] focus:outline-none"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] origin-left"
        style={{
          width: "100%",
          background: PROGRESS_COLOR[variant],
          opacity: 0.5,
          animation: leaving ? "none" : `directorToastProgress ${duration}ms linear forwards`,
        }}
      />

      <style>{`
        @keyframes directorToastProgress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDirectorToasts() {
  const [toasts, setToasts] = React.useState<DirectorToast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (message: string, variant: DirectorToastVariant = "error", durationMs?: number) => {
      if (!message) return
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => {
        if (current.some((t) => t.message === message && t.variant === variant)) return current
        const next = [...current, { id, message, variant, durationMs }]
        return next.length > 4 ? next.slice(next.length - 4) : next
      })
    },
    [],
  )

  return { toasts, push, dismiss }
}
