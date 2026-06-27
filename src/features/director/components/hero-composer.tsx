"use client"

import * as React from "react"
import { cn } from "@/lib/utils/cn"
import { Composer } from "../composer"
import type { DirectorQuality } from "@/lib/director/contract/director"

/**
 * Typewriter placeholder: cycles a list of example prompts, typing and
 * deleting each, pausing while the user is writing.
 */
export function useTypewriterPlaceholder(examples: string[], paused: boolean) {
  const [text, setText] = React.useState(examples[0] ?? "")

  React.useEffect(() => {
    if (paused || examples.length === 0) return
    let timeoutId: ReturnType<typeof setTimeout>
    let exampleIndex = 0
    let charIndex = examples[0].length
    let phase: "pause-full" | "deleting" | "pause-empty" | "typing" = "pause-full"

    const tick = () => {
      const current = examples[exampleIndex]
      if (phase === "pause-full") {
        phase = "deleting"
        timeoutId = setTimeout(tick, 1600)
        return
      }
      if (phase === "deleting") {
        charIndex = Math.max(0, charIndex - 1)
        setText(current.slice(0, charIndex))
        if (charIndex === 0) {
          phase = "pause-empty"
          timeoutId = setTimeout(tick, 380)
        } else {
          timeoutId = setTimeout(tick, 18)
        }
        return
      }
      if (phase === "pause-empty") {
        exampleIndex = (exampleIndex + 1) % examples.length
        charIndex = 0
        phase = "typing"
        timeoutId = setTimeout(tick, 80)
        return
      }
      // typing
      const next = examples[exampleIndex]
      charIndex = Math.min(next.length, charIndex + 1)
      setText(next.slice(0, charIndex))
      if (charIndex === next.length) {
        phase = "pause-full"
        timeoutId = setTimeout(tick, 1600)
      } else {
        timeoutId = setTimeout(tick, 32)
      }
    }

    timeoutId = setTimeout(tick, 1600)
    return () => clearTimeout(timeoutId)
  }, [examples, paused])

  return text
}

type HeroComposerProps = {
  onSend: (text: string) => void
  disabled?: boolean
  busy?: boolean
  quality?: DirectorQuality
  onQualityChange?: (value: DirectorQuality) => void
  /** Optional inline submit error */
  submitError?: string | null
  showLogo?: boolean
  titleClassName?: string
}

const EXAMPLE_PROMPTS = [
  "A 15-second cinematic ad for a premium product",
  "Help me develop characters for a short film",
  "A punchy 9:16 social spot with energetic hook",
]

/**
 * The hero's centred block — WM symbol + title + framed solid composer with a
 * typewriter placeholder.
 */
export function HeroComposer({
  onSend,
  disabled,
  busy,
  quality,
  onQualityChange,
  submitError,
  showLogo = true,
  titleClassName,
}: HeroComposerProps) {
  const animatedPlaceholder = useTypewriterPlaceholder(EXAMPLE_PROMPTS, false)

  return (
    <>
      <div className="mb-12 flex w-full max-w-3xl flex-col items-center transition-all duration-500 ease-out">
        {showLogo && (
          <img
            src="/wm.svg"
            alt="WM Studio"
            className="-mt-8 mb-[-20px] h-[126px] w-auto transition-all duration-500 ease-out sm:-mt-10 sm:mb-[-26px] sm:h-[156px]"
            draggable={false}
          />
        )}
        <h1 className={cn("whitespace-nowrap text-center text-4xl font-semibold tracking-tight transition-all duration-500 ease-out sm:text-5xl md:text-6xl", titleClassName)}>
          <span className="text-zinc-50">What are we</span>{" "}
          <span className="text-white/45">making today?</span>
        </h1>
        <p className="mt-3 text-center text-[12px] font-medium leading-[1.45] tracking-0 text-zinc-400 transition-all duration-500 ease-out sm:text-[13px]">
          Describe your production and Director will build it
        </p>
      </div>

      <div className="w-full max-w-3xl transition-all duration-300 ease-out">
        <div className="relative z-10 rounded-[30px] bg-[rgba(39,39,42,0.62)] p-1 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[32px] backdrop-saturate-150 transition-all duration-300 hover:shadow-[0_20px_70px_-20px_rgba(0,0,0,0.7)]">
          <Composer
            onSend={onSend}
            disabled={disabled}
            busy={busy}
            placeholder={animatedPlaceholder || "Describe the production you want to create…"}
            quality={quality}
            onQualityChange={onQualityChange}
          />
        </div>
        {submitError && (
          <p role="alert" className="mt-2 px-4 text-center text-xs text-red-300 transition-all duration-300">
            {submitError}
          </p>
        )}
      </div>
    </>
  )
}
