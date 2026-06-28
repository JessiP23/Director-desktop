"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { MemoryBulbIcon } from "./memory-bulb-icon"

/** A long-term memory the orchestrator proposed; saved only on the user's accept. */
export type MemorySuggestion = {
  id: string
  memoryType: "user" | "preferences" | "facts"
  title: string
  content: string
}

/**
 * Top-right action toasts for long-term memory proposals. Persistent (no
 * auto-dismiss) until the user accepts (saves) or rejects (discards).
 */
export function MemorySuggestionToasts({
  suggestions,
  onAccept,
  onReject,
}: {
  suggestions: MemorySuggestion[]
  onAccept: (suggestion: MemorySuggestion) => Promise<void> | void
  onReject: (id: string) => void
}) {
  if (suggestions.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[9998] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 sm:right-5 sm:top-5"
      role="region"
      aria-label="Director memory suggestions"
      aria-live="polite"
    >
      {suggestions.map((suggestion) => (
        <MemorySuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  )
}

function MemorySuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: MemorySuggestion
  onAccept: (suggestion: MemorySuggestion) => Promise<void> | void
  onReject: (id: string) => void
}) {
  const [saving, setSaving] = React.useState(false)

  const handleAccept = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onAccept(suggestion)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto overflow-hidden rounded-[14px] bg-[#15171b] ring-1 ring-white/[0.09]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] backdrop-blur-xl",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <MemoryBulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#facc15]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#a1a1aa]">Memory suggestion</p>
          {suggestion.title ? (
            <p className="mt-1 text-[13px] font-semibold text-[#f4f4f5]">{suggestion.title}</p>
          ) : null}
          <p className="mt-0.5 break-words text-[13px] leading-snug text-[#f4f4f5]/85">
            {suggestion.content}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={saving}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#f4f4f5] px-3 text-[12px] font-semibold text-[#15171b] transition-colors hover:bg-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => onReject(suggestion.id)}
              disabled={saving}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.12] px-3 text-[12px] font-medium text-[#a1a1aa] transition-colors hover:bg-white/[0.06] hover:text-[#f4f4f5] disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
