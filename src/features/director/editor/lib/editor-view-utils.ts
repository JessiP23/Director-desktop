import type { StreamItem } from "@/lib/director/stream"
import type { resolveEditorPlanItems } from "./editor-plan-apply"

export type EditorClip = {
  id: string
  url: string
  kind: "image" | "video" | "audio" | "text" | "other"
  toolName: string
  timestamp: string
}

export type TrackType = "media" | "audio" | "text"
export type Track = { id: string; type: TrackType; clipIds: string[] }

// A text overlay drawn over the preview during its timeline slot. Position is
// kept in `clipTransforms` (shared with media), so it reuses the same drag +
// alignment-guide machinery; here we only hold the content and look.
export type TextOverlay = {
  id: string
  text: string
  /** Font size as a percentage of the frame height (resolution-independent). */
  fontSize: number
  color: string
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: 400 | 600 | 700
  italic: boolean
  textAlign: "left" | "center" | "right"
  shadow: boolean
  motion: "none" | "fade" | "rise" | "scale"
  /** Slot length on the timeline, in seconds. */
  duration: number
}

export const DEFAULT_TEXT_OVERLAY_SECONDS = 3
export const MAX_TEXT_OVERLAY_SECONDS = 120
export const DEFAULT_TEXT_FONT_SIZE = 8
export const MIN_TEXT_FONT_SIZE = 2
export const MAX_TEXT_FONT_SIZE = 30
export const DEFAULT_TEXT_COLOR = "#ffffff"
export const DEFAULT_TEXT_FONT_FAMILY = "sans" as const
export const DEFAULT_TEXT_FONT_WEIGHT = 600 as const
export const DEFAULT_TEXT_ALIGN = "center" as const
export const TEXT_FONT_FAMILIES = {
  sans: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  serif: "var(--font-instrument-serif), Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} satisfies Record<TextOverlay["fontFamily"], string>

export type ClipTrim = { start: number; end: number }
// How a clip is sized/positioned inside the preview frame. `scale` is relative
// to a frame-filling clip (1 = fits the frame); `x`/`y` offset the clip's centre
// as a percentage of the frame (0 = centred).
export type ClipTransform = { scale: number; x: number; y: number }
export const DEFAULT_CLIP_TRANSFORM: ClipTransform = { scale: 1, x: 0, y: 0 }
export const MIN_CLIP_SCALE = 0.1
export const MAX_CLIP_SCALE = 5
export const MAX_CLIP_OFFSET = 200
// How close (in % of the frame) a clip edge/centre must get to a frame
// edge/centre before it snaps there and the alignment guide appears.
export const CLIP_CENTER_SNAP_PERCENT = 1.5
// Which vertical / horizontal alignment guide is currently active.
export type GuideX = "center" | "left" | "right"
export type GuideY = "center" | "top" | "bottom"

// How much of each edge of a clip is cropped away, as a percentage of the clip.
export type ClipCrop = { top: number; right: number; bottom: number; left: number }
export const DEFAULT_CLIP_CROP: ClipCrop = { top: 0, right: 0, bottom: 0, left: 0 }
// Always leave at least this much of the clip visible on each axis.
export const MIN_CROP_REMAINING = 10

// The preview supports two mutually-exclusive edit modes, toggled from the
// player controls and off by default.
export type PreviewEditMode = "none" | "resize" | "crop"
export type ClipLayout = {
  clipId: string
  trackId: string
  /** Absolute start of the clip's source slot (before trim) in seconds. */
  slotStart: number
  /** Untrimmed length of the slot. */
  sourceDuration: number
  /** Visible (trimmed) length. */
  duration: number
  /** Absolute start of the visible portion (slotStart + trim.start). */
  visibleStart: number
  trim: ClipTrim
}

// The editor timeline is persisted per conversation in localStorage so tracks,
// their clip order, uploaded clips and the pane height survive page refreshes.
export const TIMELINE_STORAGE_PREFIX = "director-editor-timeline:"

// A video clip carries audio, so placing it on a media track also drops a linked
// audio clip on the audio track (mirrors DaVinci / Premiere). The companion's id
// is the video clip id plus this suffix.
export const AUDIO_LINK_SUFFIX = "__audio"

// Sequence settings exposed in the editor.
export const RESOLUTION_OPTIONS = [
  { label: "4K — 3840×2160", value: "3840x2160" },
  { label: "1080p — 1920×1080", value: "1920x1080" },
  { label: "720p — 1280×720", value: "1280x720" },
  { label: "Vertical — 1080×1920", value: "1080x1920" },
  { label: "Square — 1080×1080", value: "1080x1080" },
] as const
export const FPS_OPTIONS = [24, 25, 30, 60] as const
export const FPS_SELECT_OPTIONS = FPS_OPTIONS.map((fps) => ({ label: `${fps} fps`, value: fps }))
export const DEFAULT_RESOLUTION = "1920x1080" as const
export const DEFAULT_FPS = 24 as const
export const DEFAULT_TIMELINE_CLIP_SECONDS = 5
export const MIN_TIMELINE_CLIP_SECONDS = 0.25
export const DEFAULT_TIMELINE_VISIBLE_SECONDS = 20
export const MIN_TIMELINE_VISIBLE_SECONDS = 1
export const MAX_TIMELINE_VISIBLE_SECONDS = 120

export type SequenceResolution = (typeof RESOLUTION_OPTIONS)[number]["value"]
export type SequenceFps = (typeof FPS_OPTIONS)[number]

export type PersistedTimeline = {
  tracks: Track[]
  localClips: EditorClip[]
  timelineHeight: number
  assigned: string[]
  /** Right-hand halves produced by splitting a clip — they reuse a source url. */
  splitClips?: EditorClip[]
  clipTrims?: Record<string, ClipTrim>
  /** Explicit start offset (seconds) per clip — set once a clip is dragged. */
  clipStarts?: Record<string, number>
  /** Size/position of each clip inside the preview frame. */
  clipTransforms?: Record<string, ClipTransform>
  /** Per-edge crop of each clip. */
  clipCrops?: Record<string, ClipCrop>
  /** Text overlays keyed by their clip id. */
  textOverlays?: Record<string, TextOverlay>
  resolution?: SequenceResolution
  fps?: SequenceFps
  visibleSeconds?: number
  /** Id of the last Editor-agent plan applied, so it is applied only once. */
  appliedAgentPlanId?: string
}

type ResolvedEditorPlanItem = ReturnType<typeof resolveEditorPlanItems>[number]

export function normalizeResolution(value: unknown): SequenceResolution {
  return RESOLUTION_OPTIONS.some((option) => option.value === value)
    ? (value as SequenceResolution)
    : DEFAULT_RESOLUTION
}

export function normalizeFps(value: unknown): SequenceFps {
  return FPS_OPTIONS.includes(value as SequenceFps) ? (value as SequenceFps) : DEFAULT_FPS
}

export function aspectRatioFromResolution(resolution: string): number {
  const [w, h] = resolution.split("x").map(Number)
  return w && h ? w / h : 16 / 9
}

export function defaultTracks(): Track[] {
  return [
    { id: "track-media", type: "media", clipIds: [] },
    { id: "track-audio", type: "audio", clipIds: [] },
  ]
}

export function loadPersistedTimeline(runId: string | null): PersistedTimeline | null {
  if (!runId || typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_PREFIX + runId)
    return raw ? (JSON.parse(raw) as PersistedTimeline) : null
  } catch {
    return null
  }
}

export function tracksWithAgentPlan(params: {
  tracks: Track[]
  mediaItems: ResolvedEditorPlanItem[]
  audioItems: ResolvedEditorPlanItem[]
  placedIds: Set<string>
  companionIds: string[]
}): Track[] {
  const firstMedia = params.tracks.findIndex((track) => track.type === "media")
  const firstAudio = params.tracks.findIndex((track) => track.type === "audio")

  return params.tracks.map((track, index) => {
    const kept = track.clipIds.filter(
      (clipId) => !params.placedIds.has(baseClipId(clipId)) && !params.companionIds.includes(clipId),
    )
    if (index === firstMedia) {
      return { ...track, clipIds: params.mediaItems.map((item) => item.clipId) }
    }
    if (index === firstAudio) {
      const keptNativeAudio = kept.filter((clipId) => !clipId.endsWith(AUDIO_LINK_SUFFIX))
      return {
        ...track,
        clipIds: [
          ...params.companionIds,
          ...params.audioItems.map((item) => item.clipId),
          ...keptNativeAudio,
        ],
      }
    }
    return kept.length === track.clipIds.length ? track : { ...track, clipIds: kept }
  })
}

export function trimMapWithAgentPlan(
  current: Record<string, ClipTrim>,
  resolved: ResolvedEditorPlanItem[],
): Record<string, ClipTrim> {
  const next = { ...current }
  for (const item of resolved) {
    const companionId = item.kind === "video" ? item.clipId + AUDIO_LINK_SUFFIX : null
    if (item.trim) {
      const trim = normalizeTrim(item.trim)
      next[item.clipId] = trim
      if (companionId) next[companionId] = trim
    } else {
      delete next[item.clipId]
      if (companionId) delete next[companionId]
    }
  }
  return next
}

export function startMapWithoutAgentPlanSlots(
  current: Record<string, number>,
  resolved: ResolvedEditorPlanItem[],
  companionIds: string[],
): Record<string, number> {
  const next = { ...current }
  for (const item of resolved) delete next[item.clipId]
  for (const companion of companionIds) delete next[companion]
  return next
}

/**
 * Derive the editable clips (completed media generations) from the conversation
 * stream. Newest generations end up last so the timeline reads left to right in
 * chronological order.
 */
export function collectEditorClips(items: StreamItem[]): EditorClip[] {
  const clips: EditorClip[] = []
  for (const item of items) {
    if (
      item.kind === "tool-generation" &&
      item.status === "completed" &&
      item.resultUrl &&
      (item.resultKind === "video" || item.resultKind === "image" || item.resultKind === "audio")
    ) {
      clips.push({
        id: item.id,
        url: item.resultUrl,
        kind: item.resultKind,
        toolName: item.toolName,
        timestamp: item.timestamp,
      })
    }
  }
  return clips
}

export function prettyToolName(toolName: string): string {
  return toolName
    .replace(/^studio_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatTime(seconds: number, precision = 0): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  if (precision > 0) {
    const rounded = Number(seconds.toFixed(precision))
    const mins = Math.floor(rounded / 60)
    const secs = rounded - mins * 60
    return `${mins}:${secs.toFixed(precision).padStart(precision + 3, "0")}`
  }
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function precisionForFps(fps: number): number {
  return fps >= 50 ? 3 : 2
}

export function frameStepForFps(fps: number): number {
  return 1 / Math.max(1, fps)
}

export function snapTimeToFrame(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds)) return 0
  const frameStep = frameStepForFps(fps)
  return Math.round(seconds / frameStep) * frameStep
}

// Place a dragged clip on its track so it can sit flush against a neighbour but
// never overlap one. `visibleStart`/`duration` describe the dragged clip's
// on-screen extent; `siblings` are the other clips' extents on the same track.
// When an edge lands within `snapSeconds` of a neighbour edge it snaps flush;
// then the clip is clamped into the nearest gap wide enough to hold it.
export function resolveClipPlacement(
  visibleStart: number,
  duration: number,
  siblings: { start: number; end: number }[],
  snapSeconds: number,
): number {
  if (siblings.length === 0) return Math.max(0, visibleStart)
  const sorted = [...siblings].sort((a, b) => a.start - b.start)

  // Magnetic snap to the closest neighbour edge within range. All candidates are
  // measured from the original position so the nearest one wins.
  let vs = visibleStart
  let bestSnap = snapSeconds
  for (const s of sorted) {
    // Dragged clip's left edge meets the neighbour's right edge (sits after it).
    const afterDist = Math.abs(visibleStart - s.end)
    if (afterDist <= bestSnap) {
      vs = s.end
      bestSnap = afterDist
    }
    // Dragged clip's right edge meets the neighbour's left edge (sits before it).
    const beforeDist = Math.abs(visibleStart + duration - s.start)
    if (beforeDist <= bestSnap) {
      vs = s.start - duration
      bestSnap = beforeDist
    }
  }

  // Clamp into the nearest gap big enough to hold the clip, guaranteeing no
  // overlap.
  const gaps: { lo: number; hi: number }[] = []
  let cursor = 0
  for (const s of sorted) {
    if (s.start - cursor >= duration - 1e-4) gaps.push({ lo: cursor, hi: s.start })
    cursor = Math.max(cursor, s.end)
  }
  gaps.push({ lo: cursor, hi: Infinity })

  let best = vs
  let bestDist = Infinity
  for (const gap of gaps) {
    const clamped = Math.min(Math.max(vs, gap.lo), gap.hi - duration)
    const dist = Math.abs(clamped - vs)
    if (dist < bestDist) {
      bestDist = dist
      best = clamped
    }
  }
  return Math.max(0, best)
}

// Snap a value to the nearest candidate target within `range`, returning the
// snapped value and which guide (if any) it landed on.
export function snapToGuide<G extends string>(
  value: number,
  candidates: { target: number; guide: G }[],
  range: number,
): { value: number; guide: G | null } {
  let best: { value: number; guide: G | null } = { value, guide: null }
  let bestDist = range
  for (const candidate of candidates) {
    const dist = Math.abs(value - candidate.target)
    if (dist <= bestDist) {
      bestDist = dist
      best = { value: candidate.target, guide: candidate.guide }
    }
  }
  return best
}

export function clampSeconds(seconds: number, min: number, max: number): number {
  return Math.min(Math.max(seconds, min), max)
}

export function normalizeDuration(seconds: number | null | undefined): number {
  return Number.isFinite(seconds) && seconds && seconds > 0
    ? Math.max(seconds, MIN_TIMELINE_CLIP_SECONDS)
    : DEFAULT_TIMELINE_CLIP_SECONDS
}

export function normalizeVisibleSeconds(value: unknown): number {
  const seconds = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(seconds)) return DEFAULT_TIMELINE_VISIBLE_SECONDS
  return Math.min(Math.max(seconds, MIN_TIMELINE_VISIBLE_SECONDS), MAX_TIMELINE_VISIBLE_SECONDS)
}

export function baseClipId(id: string): string {
  return id.endsWith(AUDIO_LINK_SUFFIX) ? id.slice(0, -AUDIO_LINK_SUFFIX.length) : id
}

export function normalizeTrim(value: unknown): ClipTrim {
  if (!value || typeof value !== "object") return { start: 0, end: 0 }
  const trim = value as Partial<ClipTrim>
  return {
    start: Math.max(0, Number.isFinite(trim.start) ? Number(trim.start) : 0),
    end: Math.max(0, Number.isFinite(trim.end) ? Number(trim.end) : 0),
  }
}

export function normalizeTransform(value: unknown): ClipTransform {
  if (!value || typeof value !== "object") return { ...DEFAULT_CLIP_TRANSFORM }
  const transform = value as Partial<ClipTransform>
  const scale = Number.isFinite(transform.scale) ? Number(transform.scale) : 1
  const x = Number.isFinite(transform.x) ? Number(transform.x) : 0
  const y = Number.isFinite(transform.y) ? Number(transform.y) : 0
  return {
    scale: clampSeconds(scale, MIN_CLIP_SCALE, MAX_CLIP_SCALE),
    x: clampSeconds(x, -MAX_CLIP_OFFSET, MAX_CLIP_OFFSET),
    y: clampSeconds(y, -MAX_CLIP_OFFSET, MAX_CLIP_OFFSET),
  }
}

export function normalizeCrop(value: unknown): ClipCrop {
  if (!value || typeof value !== "object") return { ...DEFAULT_CLIP_CROP }
  const crop = value as Partial<ClipCrop>
  const side = (v: unknown) => clampSeconds(Number.isFinite(v) ? Number(v) : 0, 0, 100 - MIN_CROP_REMAINING)
  return { top: side(crop.top), right: side(crop.right), bottom: side(crop.bottom), left: side(crop.left) }
}

export function normalizeTextOverlay(id: string, value: unknown): TextOverlay {
  const overlay = (value ?? {}) as Partial<TextOverlay>
  const fontSize = Number.isFinite(overlay.fontSize) ? Number(overlay.fontSize) : DEFAULT_TEXT_FONT_SIZE
  const duration = Number.isFinite(overlay.duration) ? Number(overlay.duration) : DEFAULT_TEXT_OVERLAY_SECONDS
  return {
    id,
    text: typeof overlay.text === "string" ? overlay.text : "",
    fontSize: clampSeconds(fontSize, MIN_TEXT_FONT_SIZE, MAX_TEXT_FONT_SIZE),
    color: typeof overlay.color === "string" ? overlay.color : DEFAULT_TEXT_COLOR,
    fontFamily:
      overlay.fontFamily === "serif" || overlay.fontFamily === "mono" ? overlay.fontFamily : DEFAULT_TEXT_FONT_FAMILY,
    fontWeight:
      overlay.fontWeight === 400 || overlay.fontWeight === 700 ? overlay.fontWeight : DEFAULT_TEXT_FONT_WEIGHT,
    italic: overlay.italic === true,
    textAlign:
      overlay.textAlign === "left" || overlay.textAlign === "right" ? overlay.textAlign : DEFAULT_TEXT_ALIGN,
    shadow: overlay.shadow !== false,
    motion:
      overlay.motion === "fade" || overlay.motion === "rise" || overlay.motion === "scale" ? overlay.motion : "none",
    duration: Math.max(MIN_TIMELINE_CLIP_SECONDS, duration),
  }
}

export function videoPreviewUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = "t=0.1"
    return parsed.toString()
  } catch {
    return url.includes("#") ? url : `${url}#t=0.1`
  }
}

export function syncMediaElementTime(media: HTMLMediaElement | null, seconds: number) {
  if (!media || !Number.isFinite(seconds)) return
  const nextTime = Math.max(0, seconds)
  try {
    if (Math.abs(media.currentTime - nextTime) > 0.05) {
      media.currentTime = nextTime
    }
  } catch {
    // Some browsers reject seeking before metadata is available; loadedmetadata
    // retries the same sync path.
  }
}
