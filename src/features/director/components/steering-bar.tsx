"use client"

import { PencilLine } from "lucide-react"

/**
 * Steering bar shown above the composer when the Director paused on an
 * ask_user interrupt: the question with its options as one-click chips,
 * plus a "write your own" affordance that focuses the composer (any free
 * text answers the question too — the next message resumes the turn).
 */
export function SteeringBar({
  question,
  options,
  disabled,
  onSelect,
  onCustom,
}: {
  question: string
  options: string[]
  disabled?: boolean
  onSelect: (text: string) => void
  onCustom: () => void
}) {
  return (
    <div className="mb-2 rounded-[30px] bg-[#141416] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Director needs your input
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-zinc-200">{question}</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {options.map((option, index) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(option)}
                className="flex w-full items-baseline gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-500">{index + 1}</span>
                {option}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={onCustom}
              className="inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PencilLine className="h-3 w-3" aria-hidden />
              Write your own
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
