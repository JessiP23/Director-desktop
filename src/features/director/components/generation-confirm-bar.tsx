"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils/cn"

export type GenerationReferenceKind = "image" | "video" | "audio"

export type GenerationReferenceAsset = {
  id: string
  kind: GenerationReferenceKind
  label: string
  url: string
  description?: string
  source?: "approved" | "upload"
}

export type PendingGenerationPreview = {
  tool: "generate_image" | "generate_video"
  credits?: number
  args: Record<string, unknown>
  prompt: string
  aspectRatio: string | null
  durationSeconds: number | null
  resolution: string | null
  resolutionOptions: string[]
  imageUrl: string | null
  referenceImageUrls: string[]
  referenceVideoUrls: string[]
  referenceAudioUrls: string[]
}

export type GenerationOverride = {
  tool: "generate_image" | "generate_video"
  args: Record<string, unknown>
}

export type GenerationConfirmationSummary = {
  items: Array<{
    tool: "generate_image" | "generate_video"
    aspectRatio?: string
    durationSeconds?: number
    resolution?: string
    credits?: number
    references: Array<{
      kind: GenerationReferenceKind
      label: string
      url: string
    }>
  }>
  totalCredits?: number
}

const SEEDANCE_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5", "3:4", "2:3"]
const SEEDANCE_DURATION_SECONDS = [3, 5, 10, 15, 20, 30]
const SEEDANCE_VIDEO_RESOLUTIONS = ["720p", "1080p", "4K"]

export type PendingEdit = {
  prompt: string
  aspectRatio: string | null
  durationSeconds: number | null
  resolution: string | null
  excluded: Set<string>
  addedReferences: GenerationReferenceAsset[]
}

function initialEdit(p: PendingGenerationPreview): PendingEdit {
  return {
    prompt: p.prompt,
    aspectRatio: p.aspectRatio,
    durationSeconds: p.durationSeconds,
    resolution: p.resolution,
    excluded: new Set(),
    addedReferences: [],
  }
}

const REFERENCE_LIMITS: Record<GenerationReferenceKind, number> = {
  image: 9,
  video: 3,
  audio: 3,
}
const SELECTED_REFERENCES_PAGE_SIZE = 4
const AVAILABLE_REFERENCES_PAGE_SIZE = 6

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const candidate of urls) {
    const url = candidate.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function referenceUrlsForKind(p: PendingGenerationPreview, kind: GenerationReferenceKind): string[] {
  if (kind === "image") return p.referenceImageUrls
  if (kind === "video") return p.referenceVideoUrls
  return p.referenceAudioUrls
}

function finalReferenceUrls(p: PendingGenerationPreview, edit: PendingEdit, kind: GenerationReferenceKind): string[] {
  return uniqueUrls([
    ...referenceUrlsForKind(p, kind).filter((url) => !edit.excluded.has(url)),
    ...edit.addedReferences.filter((asset) => asset.kind === kind).map((asset) => asset.url),
  ]).slice(0, REFERENCE_LIMITS[kind])
}

function referenceAssetForUrl(
  url: string,
  kind: GenerationReferenceKind,
  catalog: GenerationReferenceAsset[],
  fallbackLabel: string,
): GenerationReferenceAsset {
  const found = catalog.find((asset) => asset.url === url)
  return found ?? { id: `${kind}:${url}`, kind, label: fallbackLabel, url }
}

function effectiveCredits(p: PendingGenerationPreview, edit: PendingEdit): number | undefined {
  if (typeof p.credits !== "number") return undefined
  if (p.tool !== "generate_video") return p.credits
  const base = p.durationSeconds ?? 5
  const next = edit.durationSeconds ?? base
  if (!base) return p.credits
  return Math.max(1, Math.round((p.credits * next) / base))
}

export function buildGenerationOverrides(
  pending: PendingGenerationPreview[],
  edits: PendingEdit[],
  _referenceCatalog: GenerationReferenceAsset[] = [],
): GenerationOverride[] {
  return pending.map((p, i) => {
    const edit = edits[i] ?? initialEdit(p)
    const imageRefs = finalReferenceUrls(p, edit, "image")
    const videoRefs = finalReferenceUrls(p, edit, "video")
    const audioRefs = finalReferenceUrls(p, edit, "audio")
    const referencesEdited = edit.excluded.size > 0 || edit.addedReferences.length > 0
    const sourceImageExcluded = Boolean(p.imageUrl && edit.excluded.has(p.imageUrl))
    const forceVideoReferenceMode = p.tool === "generate_video" && referencesEdited && (
      imageRefs.length > 0 ||
      videoRefs.length > 0 ||
      audioRefs.length > 0
    )
    const finalImageRefs = forceVideoReferenceMode && p.imageUrl && !sourceImageExcluded && !imageRefs.includes(p.imageUrl)
      ? uniqueUrls([p.imageUrl, ...imageRefs]).slice(0, REFERENCE_LIMITS.image)
      : imageRefs
    const args: Record<string, unknown> = {
      ...p.args,
      prompt: edit.prompt,
      aspectRatio: edit.aspectRatio,
    }
    if (p.tool === "generate_video" && edit.durationSeconds != null) args.durationSeconds = edit.durationSeconds
    if (p.tool === "generate_video" && edit.resolution) args.resolution = edit.resolution
    if (forceVideoReferenceMode || sourceImageExcluded) args.imageUrl = null
    args.referenceImageUrls = finalImageRefs.length > 0 ? finalImageRefs : null
    if (p.tool === "generate_video") {
      args.referenceVideoUrls = videoRefs.length > 0 ? videoRefs : null
      args.referenceAudioUrls = audioRefs.length > 0 ? audioRefs : null
    }
    return { tool: p.tool, args }
  })
}

export function GenerationConfirmBar(props: {
  pending: PendingGenerationPreview[]
  availableReferences?: GenerationReferenceAsset[]
  disabled?: boolean
  onConfirm: (text: string, overrides?: GenerationOverride[], summary?: GenerationConfirmationSummary) => void | Promise<void>
}) {
  const signature = props.pending
    .map((p) => [
      p.tool,
      p.prompt,
      p.aspectRatio,
      p.durationSeconds,
      p.resolution,
      p.resolutionOptions.join(","),
      p.imageUrl,
      p.referenceImageUrls.join(","),
      p.referenceVideoUrls.join(","),
      p.referenceAudioUrls.join(","),
    ].join(":"))
    .concat("|refs:", (props.availableReferences ?? []).map((asset) => `${asset.kind}:${asset.url}:${asset.label}`).join(","))
    .join("|")
  return <ConfirmBarInner key={signature} {...props} />
}

function ConfirmBarInner({
  pending,
  availableReferences = [],
  disabled,
  onConfirm,
}: {
  pending: PendingGenerationPreview[]
  availableReferences?: GenerationReferenceAsset[]
  disabled?: boolean
  onConfirm: (text: string, overrides?: GenerationOverride[], summary?: GenerationConfirmationSummary) => void | Promise<void>
}) {
  const prefersReducedMotion = useReducedMotion()
  const [busy, setBusy] = React.useState(false)
  const [step, setStep] = React.useState<0 | 1>(0)
  const [stepDirection, setStepDirection] = React.useState<1 | -1>(1)
  const [edits, setEdits] = React.useState<PendingEdit[]>(() => pending.map(initialEdit))
  const referenceCatalog = React.useMemo(() => {
    const seen = new Set<string>()
    return availableReferences.filter((asset) => {
      if (!asset.url || seen.has(asset.url)) return false
      seen.add(asset.url)
      return true
    })
  }, [availableReferences])

  const stepTitle = step === 0 ? "Review references" : "Review settings"
  const creditValues = pending.map((item, i) => effectiveCredits(item, edits[i] ?? initialEdit(item)))
  const allPriced = creditValues.every((value) => typeof value === "number")
  const totalCredits = creditValues.reduce((sum, value) => (sum ?? 0) + (value ?? 0), 0)
  const isBusy = disabled || busy

  const update = (index: number, patch: Partial<PendingEdit>) =>
    setEdits((current) => current.map((edit, idx) => (idx === index ? { ...edit, ...patch } : edit)))
  const referenceLimitReached = (p: PendingGenerationPreview, edit: PendingEdit, kind: GenerationReferenceKind) =>
    finalReferenceUrls(p, edit, kind).length >= REFERENCE_LIMITS[kind]
  const addReference = (index: number, p: PendingGenerationPreview, asset: GenerationReferenceAsset) =>
    setEdits((current) =>
      current.map((edit, idx) => {
        if (idx !== index) return edit
        if (referenceLimitReached(p, edit, asset.kind)) return edit
        if (referenceUrlsForKind(p, asset.kind).includes(asset.url)) {
          const excluded = new Set(edit.excluded)
          excluded.delete(asset.url)
          return { ...edit, excluded }
        }
        if (edit.addedReferences.some((item) => item.url === asset.url)) return edit
        return { ...edit, addedReferences: [...edit.addedReferences, asset] }
      }),
    )
  const removeAddedReference = (index: number, url: string) =>
    setEdits((current) =>
      current.map((edit, idx) =>
        idx === index
          ? { ...edit, addedReferences: edit.addedReferences.filter((asset) => asset.url !== url) }
          : edit,
      ),
    )
  const toggleRef = (index: number, url: string) =>
    setEdits((current) =>
      current.map((edit, idx) => {
        if (idx !== index) return edit
        const next = new Set(edit.excluded)
        if (next.has(url)) next.delete(url)
        else next.add(url)
        return { ...edit, excluded: next }
      }),
    )

  const anyEdited = pending.some((p, i) => {
    const edit = edits[i]
    if (!edit) return false
    return (
      edit.prompt !== p.prompt ||
      edit.aspectRatio !== p.aspectRatio ||
      edit.durationSeconds !== p.durationSeconds ||
      edit.resolution !== p.resolution ||
      edit.excluded.size > 0 ||
      edit.addedReferences.length > 0
    )
  })

  const handleConfirm = async () => {
    if (isBusy) return
    setBusy(true)
    try {
      await onConfirm("Proceed", anyEdited ? buildGenerationOverrides(pending, edits, referenceCatalog) : undefined)
    } finally {
      setBusy(false)
    }
  }
  const goToStep = (nextStep: 0 | 1) => {
    if (nextStep === step || isBusy) return
    setStepDirection(nextStep > step ? 1 : -1)
    setStep(nextStep)
  }
  const slideOffset = prefersReducedMotion ? 0 : 14
  const stepTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div className="mb-2 rounded-[24px] bg-[#141416] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-300" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={step}
                  initial={{ opacity: 0, x: stepDirection * slideOffset }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: stepDirection * -slideOffset }}
                  transition={stepTransition}
                  className="text-[13px] leading-5 text-zinc-200"
                >
                  {stepTitle}
                </motion.p>
              </AnimatePresence>
            </div>
            {allPriced && (totalCredits ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-200">
                {totalCredits} credits
              </span>
            )}
          </div>

          <div className="mt-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: stepDirection * slideOffset }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: stepDirection * -slideOffset }}
                transition={stepTransition}
                className="space-y-3"
              >
                {pending.map((p, i) => {
              const edit = edits[i] ?? initialEdit(p)
              const ratios = Array.from(new Set([...(p.aspectRatio ? [p.aspectRatio] : []), ...SEEDANCE_ASPECT_RATIOS]))
              const durations = Array.from(
                new Set([...(p.durationSeconds ? [p.durationSeconds] : []), ...SEEDANCE_DURATION_SECONDS]),
              ).sort((a, b) => a - b)
              const resolutions = Array.from(
                new Set([...(p.resolution ? [p.resolution] : []), ...(p.resolutionOptions.length > 0 ? p.resolutionOptions : SEEDANCE_VIDEO_RESOLUTIONS)]),
              )
              const currentImageRefs = finalReferenceUrls(p, edit, "image")
              const currentVideoRefs = finalReferenceUrls(p, edit, "video")
              const currentAudioRefs = finalReferenceUrls(p, edit, "audio")
              const originalUrls = new Set([
                p.imageUrl,
                ...p.referenceImageUrls,
                ...p.referenceVideoUrls,
                ...p.referenceAudioUrls,
              ].filter((url): url is string => typeof url === "string" && url.length > 0))
              const selectedUrls = new Set([
                ...currentImageRefs,
                ...currentVideoRefs,
                ...currentAudioRefs,
                ...edit.addedReferences.map((asset) => asset.url),
              ])
              const candidateKinds: GenerationReferenceKind[] = p.tool === "generate_video"
                ? ["image", "video", "audio"]
                : ["image"]
              const candidates = referenceCatalog.filter((asset) =>
                candidateKinds.includes(asset.kind) &&
                !selectedUrls.has(asset.url) &&
                !originalUrls.has(asset.url),
              )
              const selectedReferenceItems: Array<{ key: string; node: React.ReactNode }> = []
              if (p.imageUrl) {
                selectedReferenceItems.push({
                  key: `source:${p.imageUrl}`,
                  node: (
                    <PayloadThumb
                      url={p.imageUrl}
                      kind="image"
                      label="Keyframe"
                      selected={!edit.excluded.has(p.imageUrl)}
                      removed={edit.excluded.has(p.imageUrl)}
                      onToggle={() => toggleRef(i, p.imageUrl!)}
                      toggleLabel="Remove reference"
                      disabled={isBusy}
                    />
                  ),
                })
              }
              p.referenceImageUrls.forEach((url, ri) => {
                const asset = referenceAssetForUrl(url, "image", referenceCatalog, `Image ${ri + 1}`)
                selectedReferenceItems.push({
                  key: `image:${url}`,
                  node: (
                    <PayloadThumb
                      url={url}
                      kind="image"
                      label={asset.label}
                      selected={!edit.excluded.has(url)}
                      removed={edit.excluded.has(url)}
                      onToggle={() => toggleRef(i, url)}
                      toggleLabel="Remove reference"
                      disabled={isBusy}
                    />
                  ),
                })
              })
              p.referenceVideoUrls.forEach((url, ri) => {
                const asset = referenceAssetForUrl(url, "video", referenceCatalog, `Video ${ri + 1}`)
                selectedReferenceItems.push({
                  key: `video:${url}`,
                  node: (
                    <PayloadThumb
                      url={url}
                      kind="video"
                      label={asset.label}
                      selected={!edit.excluded.has(url)}
                      removed={edit.excluded.has(url)}
                      onToggle={() => toggleRef(i, url)}
                      toggleLabel="Remove reference"
                      disabled={isBusy}
                    />
                  ),
                })
              })
              p.referenceAudioUrls.forEach((url, ri) => {
                const asset = referenceAssetForUrl(url, "audio", referenceCatalog, `Audio ${ri + 1}`)
                selectedReferenceItems.push({
                  key: `audio:${url}`,
                  node: (
                    <PayloadThumb
                      url={url}
                      kind="audio"
                      label={asset.label}
                      selected={!edit.excluded.has(url)}
                      removed={edit.excluded.has(url)}
                      onToggle={() => toggleRef(i, url)}
                      toggleLabel="Remove reference"
                      disabled={isBusy}
                    />
                  ),
                })
              })
              edit.addedReferences.forEach((asset) => {
                selectedReferenceItems.push({
                  key: `added:${asset.url}`,
                  node: (
                    <PayloadThumb
                      url={asset.url}
                      kind={asset.kind}
                      label={asset.label}
                      selected
                      onToggle={() => removeAddedReference(i, asset.url)}
                      toggleLabel="Remove reference"
                      disabled={isBusy}
                    />
                  ),
                })
              })
              return (
                <div key={i} className="min-w-0 space-y-2.5">
                  {step === 0 ? (
                    <div className="space-y-2.5">
                      <div>
                        <div className="mb-3 text-[10px] font-medium text-zinc-500">
                          Selected references
                        </div>
                        {selectedReferenceItems.length > 0 ? (
                          <div className="-ml-[34px] w-[calc(100%+34px)]">
                            <SelectedReferenceCarousel
                              items={selectedReferenceItems}
                              disabled={isBusy}
                              previousLabel="Previous"
                              nextLabel="Next"
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-500">No selected references</p>
                        )}
                      </div>
                      {candidates.length > 0 && (
                        <div>
                          <div className="mb-3 text-[10px] font-medium text-zinc-500">
                            Available references
                          </div>
                          <div className="-ml-[34px] w-[calc(100%+34px)]">
                            <AvailableReferenceCarousel
                              assets={candidates}
                              disabled={isBusy}
                              addLabel="Add reference"
                              previousLabel="Previous"
                              nextLabel="Next"
                              isDisabled={(asset) => referenceLimitReached(p, edit, asset.kind)}
                              onAdd={(asset) => addReference(i, p, asset)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <SettingOptionCarousel
                        label="Format"
                        disabled={isBusy}
                        options={ratios.map((ratio) => ({
                          key: ratio,
                          label: ratio === "adaptive" ? "Auto" : ratio,
                          selected: edit.aspectRatio === ratio,
                          recommended: ratio === p.aspectRatio,
                          onSelect: () => update(i, { aspectRatio: ratio }),
                        }))}
                        recommendedLabel="Rec"
                      />

                      {p.tool === "generate_video" && p.durationSeconds != null && (
                        <SettingOptionCarousel
                          label="Duration"
                          disabled={isBusy}
                          options={durations.map((duration) => ({
                            key: String(duration),
                            label: `${duration}s`,
                            selected: edit.durationSeconds === duration,
                            recommended: duration === p.durationSeconds,
                            onSelect: () => update(i, { durationSeconds: duration }),
                          }))}
                          recommendedLabel="Rec"
                        />
                      )}

                      {p.tool === "generate_video" && resolutions.length > 1 && (
                        <SettingOptionCarousel
                          label="Resolution"
                          disabled={isBusy}
                          options={resolutions.map((resolution) => ({
                            key: resolution,
                            label: resolution,
                            selected: edit.resolution === resolution,
                            recommended: resolution === p.resolution,
                            onSelect: () => update(i, { resolution }),
                          }))}
                          recommendedLabel="Rec"
                        />
                      )}
                    </div>
                  )}
                </div>
              )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {anyEdited && <AgentEditAcknowledgement text="Edits will be applied" />}
            {step === 1 && (
              <button
                type="button"
                onClick={() => goToStep(0)}
                disabled={isBusy}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-full px-4 text-[12px] font-medium transition-colors",
                  isBusy ? "cursor-not-allowed text-zinc-600" : "text-zinc-400 hover:text-zinc-100",
                )}
              >
                Back
              </button>
            )}
            {step === 0 ? (
              <button
                type="button"
                onClick={() => goToStep(1)}
                disabled={isBusy}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition-colors",
                  isBusy ? "cursor-not-allowed bg-zinc-100/40 text-zinc-950/60" : "bg-zinc-100 text-zinc-950 hover:bg-white",
                )}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isBusy}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition-colors",
                  isBusy ? "cursor-not-allowed bg-zinc-100/40 text-zinc-950/60" : "bg-zinc-100 text-zinc-950 hover:bg-white",
                )}
              >
                {busy ? "Proceeding..." : "Proceed"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentEditAcknowledgement({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion()
  const [typing, setTyping] = React.useState({ text, length: 0 })
  const visibleLength = prefersReducedMotion ? text.length : typing.text === text ? typing.length : 0

  React.useEffect(() => {
    if (prefersReducedMotion) return
    let frame: number | undefined
    const typeNext = () => {
      setTyping((current) => {
        const currentLength = current.text === text ? current.length : 0
        const next = Math.min(text.length, currentLength + 1)
        if (next < text.length) frame = window.setTimeout(typeNext, 18)
        return { text, length: next }
      })
    }
    frame = window.setTimeout(typeNext, 80)
    return () => {
      if (frame) window.clearTimeout(frame)
    }
  }, [prefersReducedMotion, text])

  return (
    <p
      aria-label={text}
      aria-live="polite"
      className="mr-auto min-w-0 max-w-[22rem] truncate text-[11px] leading-4 text-zinc-400"
    >
      <span aria-hidden="true">
        {text.slice(0, visibleLength)}
        <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 animate-pulse bg-zinc-400" />
      </span>
    </p>
  )
}

function SettingOptionCarousel({
  label,
  options,
  disabled,
  recommendedLabel,
}: {
  label: string
  options: Array<{
    key: string
    label: string
    selected: boolean
    recommended?: boolean
    onSelect: () => void
  }>
  disabled?: boolean
  recommendedLabel: string
}) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-medium text-zinc-500">{label}</div>
      <div className="flex min-w-0 justify-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            onClick={option.onSelect}
            aria-pressed={option.selected}
            aria-label={`${label}: ${option.label}${option.recommended ? `, ${recommendedLabel}` : ""}`}
            className={cn(
              "inline-flex min-h-8 min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-lg px-2 py-1 text-center text-[11px] tabular-nums transition-colors",
              option.selected
                ? "bg-zinc-100 text-zinc-950"
                : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200",
            )}
          >
            <span>{option.label}</span>
            {option.recommended && <span className="text-[9px] opacity-65">{recommendedLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function PayloadThumb({
  url,
  kind,
  label,
  selected,
  removed,
  onToggle,
  toggleLabel,
  disabled,
}: {
  url: string
  kind: GenerationReferenceKind
  label: string
  selected?: boolean
  removed?: boolean
  onToggle?: () => void
  toggleLabel?: string
  disabled?: boolean
}) {
  const interactive = Boolean(onToggle)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onToggle || disabled) return
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onToggle()
  }
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive && !disabled ? 0 : undefined}
      aria-label={interactive ? toggleLabel : undefined}
      aria-pressed={interactive ? selected && !removed : undefined}
      onClick={interactive && !disabled ? onToggle : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex max-w-36 shrink-0 flex-col items-center gap-1 outline-none",
        interactive && "cursor-pointer",
        disabled && "cursor-not-allowed",
      )}
    >
      <div className="relative inline-flex max-w-36">
        <div
          className={cn(
            "inline-flex h-20 overflow-hidden rounded-lg bg-black/30 ring-1 transition-all",
            kind === "audio" ? "w-20" : "min-w-12 max-w-36",
            selected && !removed ? "ring-white" : "ring-white/0",
            interactive && "group-hover:ring-white/70 group-focus-visible:ring-white/70",
            removed && "opacity-35 grayscale",
          )}
        >
          {kind === "audio" ? (
            <span className="flex h-full w-full items-center justify-center bg-[#111113] text-zinc-400">
              <SpeakerWaveIcon className="h-5 w-5" />
            </span>
          ) : kind === "video" ? (
            <video
              src={url}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                try {
                  event.currentTarget.currentTime = 0.08
                } catch {}
              }}
              className="h-full w-auto max-w-36 object-contain"
            />
          ) : (
            <img src={url} alt={label} className="h-full w-auto max-w-36 object-contain" loading="lazy" />
          )}
        </div>
        {onToggle && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all",
              removed
                ? "border-white/25 bg-zinc-950/80 hover:border-white/60"
                : "border-white bg-white text-zinc-950 shadow-sm",
            )}
          >
            {!removed && <CheckIcon className="h-3.5 w-3.5 stroke-[2.5]" />}
          </span>
        )}
      </div>
      <span className={cn("max-w-36 truncate text-center text-[10px] text-zinc-500", removed && "line-through")}>
        {label}
      </span>
    </div>
  )
}

function SelectedReferenceCarousel({
  items,
  disabled,
  previousLabel,
  nextLabel,
}: {
  items: Array<{ key: string; node: React.ReactNode }>
  disabled?: boolean
  previousLabel: string
  nextLabel: string
}) {
  const [page, setPage] = React.useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / SELECTED_REFERENCES_PAGE_SIZE))
  const activePage = Math.min(page, pageCount - 1)

  const visible = items.slice(
    activePage * SELECTED_REFERENCES_PAGE_SIZE,
    activePage * SELECTED_REFERENCES_PAGE_SIZE + SELECTED_REFERENCES_PAGE_SIZE,
  )
  const canGoPrev = activePage > 0
  const canGoNext = activePage < pageCount - 1
  const showArrows = pageCount > 1

  return (
    <div className="grid w-full min-w-0 grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-1">
      <button
        type="button"
        disabled={disabled || !canGoPrev}
        onClick={() => setPage((current) => Math.max(0, current - 1))}
        aria-label={previousLabel}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 disabled:pointer-events-none disabled:text-zinc-700",
          !showArrows && "invisible",
        )}
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
      </button>
      <div className="flex min-w-0 justify-center gap-3 overflow-hidden px-2 py-2 justify-self-stretch">
        {visible.map((item) => (
          <React.Fragment key={item.key}>{item.node}</React.Fragment>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !canGoNext}
        onClick={() => setPage((current) => Math.min(pageCount - 1, Math.min(current, pageCount - 1) + 1))}
        aria-label={nextLabel}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 disabled:pointer-events-none disabled:text-zinc-700",
          !showArrows && "invisible",
        )}
      >
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AvailableReferenceCarousel({
  assets,
  disabled,
  addLabel,
  previousLabel,
  nextLabel,
  isDisabled,
  onAdd,
}: {
  assets: GenerationReferenceAsset[]
  disabled?: boolean
  addLabel: string
  previousLabel: string
  nextLabel: string
  isDisabled: (asset: GenerationReferenceAsset) => boolean
  onAdd: (asset: GenerationReferenceAsset) => void
}) {
  const [page, setPage] = React.useState(0)
  const pageCount = Math.max(1, Math.ceil(assets.length / AVAILABLE_REFERENCES_PAGE_SIZE))
  const activePage = Math.min(page, pageCount - 1)

  const visible = assets.slice(
    activePage * AVAILABLE_REFERENCES_PAGE_SIZE,
    activePage * AVAILABLE_REFERENCES_PAGE_SIZE + AVAILABLE_REFERENCES_PAGE_SIZE,
  )
  const canGoPrev = activePage > 0
  const canGoNext = activePage < pageCount - 1
  const showArrows = pageCount > 1

  return (
    <div className="grid w-full min-w-0 grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-1">
      <button
        type="button"
        disabled={disabled || !canGoPrev}
        onClick={() => setPage((current) => Math.max(0, current - 1))}
        aria-label={previousLabel}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 disabled:pointer-events-none disabled:text-zinc-700",
          !showArrows && "invisible",
        )}
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
      </button>
      <div className="flex w-full max-w-[31.875rem] justify-center gap-1.5 overflow-hidden py-2 justify-self-center">
        {visible.map((asset) => (
          <ReferenceChoice
            key={asset.url}
            asset={asset}
            disabled={disabled || isDisabled(asset)}
            label={addLabel}
            onAdd={() => onAdd(asset)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !canGoNext}
        onClick={() => setPage((current) => Math.min(pageCount - 1, Math.min(current, pageCount - 1) + 1))}
        aria-label={nextLabel}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 disabled:pointer-events-none disabled:text-zinc-700",
          !showArrows && "invisible",
        )}
      >
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ReferenceChoice({
  asset,
  disabled,
  label,
  onAdd,
}: {
  asset: GenerationReferenceAsset
  disabled?: boolean
  label: string
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`${label}: ${asset.label}`}
      className={cn(
        "group flex max-w-20 shrink-0 flex-col items-center gap-1 rounded-lg text-left transition-opacity",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-11 overflow-hidden rounded-md bg-black/30",
          asset.kind === "audio" ? "w-11" : "min-w-8 max-w-20",
        )}
      >
        {asset.kind === "audio" ? (
          <span className="flex h-full w-full items-center justify-center bg-[#111113] text-zinc-400">
            <SpeakerWaveIcon className="h-5 w-5" />
          </span>
        ) : asset.kind === "video" ? (
          <video
            src={asset.url}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              try {
                event.currentTarget.currentTime = 0.08
              } catch {}
            }}
            className="h-full w-auto max-w-20 object-contain"
          />
        ) : (
          <img src={asset.url} alt={asset.label} className="h-full w-auto max-w-20 object-contain" loading="lazy" />
        )}
      </span>
      <span className="max-w-20 truncate text-center text-[9px] text-zinc-500">{asset.label}</span>
    </button>
  )
}
