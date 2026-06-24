/**
 * Migration from the legacy localStorage editor format to the canonical
 * timeline model.
 *
 * The old editor (editor-view.tsx) persists a `PersistedTimeline` blob per run
 * under `director-editor-timeline:<runId>`: seconds-based, with editorial state
 * scattered across parallel `Record<clipId, …>` maps and audio companions keyed
 * by an `<id>__audio` suffix. Crucially it does NOT store the source url/kind of
 * generated clips (those come from the run stream) nor measured durations
 * (re-measured at runtime), so migration takes them as context.
 *
 * The result is always a valid timeline: it is run through `sanitizeTimeline`,
 * which drops anything that cannot be made consistent rather than failing — so a
 * partially-corrupt legacy blob still yields a usable timeline.
 *
 * Pure module — safe on client and server.
 */

import { clampFps, framesToSeconds, normalizeFps, secondsToFrames } from "./frames"
import { mediaIdFromUrl } from "./media-catalog"
import {
  type Clip,
  type ClipCrop,
  type ClipKind,
  type ClipText,
  type ClipTransform,
  type MediaKind,
  type MediaRef,
  type Timeline,
  type Track,
  type TrackKind,
  DEFAULT_SEQUENCE,
  TIMELINE_VERSION,
} from "./timeline-model"
import { sanitizeTimeline } from "./timeline-validate"

const AUDIO_LINK_SUFFIX = "__audio"
const DEFAULT_IMAGE_SECONDS = 5
const DEFAULT_MEDIA_FALLBACK_SECONDS = 5

// ---- Legacy shapes (mirrored, not imported, to avoid pulling in React) ----

export type LegacyEditorClip = { id: string; url: string; kind: string; toolName?: string; timestamp?: string }
export type LegacyTrack = { id: string; type: string; clipIds: string[] }
export type LegacyTrim = { start: number; end: number }
export type LegacyTransform = { scale: number; x: number; y: number }
export type LegacyCrop = { top: number; right: number; bottom: number; left: number }
export type LegacyTextOverlay = {
  id: string
  text: string
  fontSize: number
  color: string
  duration: number
  fontFamily?: "sans" | "serif" | "mono"
  fontWeight?: 400 | 600 | 700
  italic?: boolean
  textAlign?: "left" | "center" | "right"
  shadow?: boolean
  motion?: "none" | "fade" | "rise" | "scale"
}

export type LegacyPersistedTimeline = {
  tracks?: LegacyTrack[]
  localClips?: LegacyEditorClip[]
  splitClips?: LegacyEditorClip[]
  clipTrims?: Record<string, LegacyTrim>
  clipStarts?: Record<string, number>
  clipTransforms?: Record<string, LegacyTransform>
  clipCrops?: Record<string, LegacyCrop>
  textOverlays?: Record<string, LegacyTextOverlay>
  resolution?: string
  fps?: number
}

export type LegacyMigrationContext = {
  /** Generated clips from the run stream (id → url/kind) that localStorage omits. */
  sourceClips?: Array<{ id: string; url: string; kind: string }>
  /** Measured source durations in seconds, keyed by base (non-companion) clip id. */
  durations?: Record<string, number>
}

function baseClipId(id: string): string {
  return id.endsWith(AUDIO_LINK_SUFFIX) ? id.slice(0, -AUDIO_LINK_SUFFIX.length) : id
}

function asMediaKind(kind: string): MediaKind | null {
  return kind === "video" || kind === "image" || kind === "audio" ? kind : null
}

function parseResolution(resolution: string | undefined): { width: number; height: number } {
  if (typeof resolution === "string") {
    const [w, h] = resolution.split("x").map((n) => Number.parseInt(n, 10))
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { width: w, height: h }
  }
  return { width: DEFAULT_SEQUENCE.width, height: DEFAULT_SEQUENCE.height }
}

function legacyTrackKind(type: string): TrackKind {
  return type === "audio" ? "audio" : type === "text" ? "text" : "media"
}

/**
 * Convert a legacy persisted timeline into the canonical model. Positions are
 * reconstructed with the same packing rule the legacy layout used (per-track
 * cursor, with explicit `clipStarts` overriding it) so existing edits land where
 * the user left them.
 */
export function migrateLegacyTimeline(
  persisted: LegacyPersistedTimeline,
  context: LegacyMigrationContext = {},
): Timeline {
  const fps = normalizeFps(persisted.fps)
  const { width, height } = parseResolution(persisted.resolution)

  // Resolve every clip id to a source url/kind. Generated clips come from the
  // stream context; uploaded + split clips carry their own url in the blob.
  const urlByClipId = new Map<string, { url: string; kind: string }>()
  for (const clip of context.sourceClips ?? []) urlByClipId.set(clip.id, { url: clip.url, kind: clip.kind })
  for (const clip of persisted.localClips ?? []) urlByClipId.set(clip.id, { url: clip.url, kind: clip.kind })
  for (const clip of persisted.splitClips ?? []) urlByClipId.set(clip.id, { url: clip.url, kind: clip.kind })

  const textOverlays = persisted.textOverlays ?? {}
  const trims = persisted.clipTrims ?? {}
  const starts = persisted.clipStarts ?? {}
  const transforms = persisted.clipTransforms ?? {}
  const crops = persisted.clipCrops ?? {}
  const durations = context.durations ?? {}

  // Dedupe media by url so a clip and its split halves share one asset. The
  // natural length comes from the measured clip duration (seconds), keyed by
  // base clip id — images have no natural length, so they pass none.
  const mediaByUrl = new Map<string, MediaRef>()
  const mediaIdForUrl = (url: string, kind: MediaKind, durationSeconds?: number): string => {
    const existing = mediaByUrl.get(url)
    if (existing) {
      if (existing.durationFrames === undefined && durationSeconds && durationSeconds > 0) {
        existing.durationFrames = secondsToFrames(durationSeconds, fps)
      }
      return existing.id
    }
    // Stable, url-derived id shared with the live catalogue (media-catalog.ts).
    const id = mediaIdFromUrl(url)
    const ref: MediaRef = { id, url, kind }
    if (durationSeconds && durationSeconds > 0) ref.durationFrames = secondsToFrames(durationSeconds, fps)
    mediaByUrl.set(url, ref)
    return id
  }

  const sourceSeconds = (clipId: string, kind: ClipKind): number => {
    const base = baseClipId(clipId)
    if (kind === "text") return textOverlays[base]?.duration ?? 3
    if (kind === "image") return DEFAULT_IMAGE_SECONDS
    return durations[base] ?? DEFAULT_MEDIA_FALLBACK_SECONDS
  }

  const tracks: Track[] = []
  const clips: Record<string, Clip> = {}
  const linkPairs: Array<[string, string]> = []

  for (const legacyTrack of persisted.tracks ?? []) {
    const kind = legacyTrackKind(legacyTrack.type)
    const track: Track = { id: legacyTrack.id, kind, clipIds: [] }
    let cursor = 0

    for (const clipId of legacyTrack.clipIds ?? []) {
      const base = baseClipId(clipId)
      const isCompanion = clipId.endsWith(AUDIO_LINK_SUFFIX)
      const overlay = textOverlays[base]

      // Determine clip kind from the track + resolver.
      let kindOfClip: ClipKind
      let mediaId: string | null = null
      let text: ClipText | null = null
      if (kind === "text" || overlay) {
        kindOfClip = "text"
        text = overlay
          ? {
              text: overlay.text,
              fontSize: overlay.fontSize,
              color: overlay.color,
              ...(overlay.fontFamily ? { fontFamily: overlay.fontFamily } : {}),
              ...(overlay.fontWeight ? { fontWeight: overlay.fontWeight } : {}),
              ...(overlay.italic !== undefined ? { italic: overlay.italic } : {}),
              ...(overlay.textAlign ? { textAlign: overlay.textAlign } : {}),
              ...(overlay.shadow !== undefined ? { shadow: overlay.shadow } : {}),
              ...(overlay.motion ? { motion: overlay.motion } : {}),
            }
          : { text: "", fontSize: 8, color: "#ffffff" }
      } else {
        const resolved = urlByClipId.get(base)
        const sourceKind = asMediaKind(resolved?.kind ?? "")
        if (!resolved || !sourceKind) continue // unknown source — skip (sanitize would drop it anyway)
        // A companion is the audio of a video: the media keeps the source kind,
        // the clip is audio.
        kindOfClip = isCompanion ? "audio" : (sourceKind as ClipKind)
        const measuredSeconds = sourceKind === "image" ? undefined : durations[base]
        mediaId = mediaIdForUrl(resolved.url, sourceKind, measuredSeconds)
      }

      const slotSeconds = sourceSeconds(clipId, kindOfClip)
      const trim = trims[clipId] ?? { start: 0, end: 0 }
      const explicit = starts[clipId]
      const rawSlot = Number.isFinite(explicit) ? Number(explicit) : cursor
      const visibleStartSeconds = Math.max(0, rawSlot + (trim.start || 0))
      const slotStartSeconds = visibleStartSeconds - (trim.start || 0)

      const durationFrames = Math.max(1, secondsToFrames(slotSeconds, fps))
      const trimStartFrame = Math.max(0, secondsToFrames(trim.start || 0, fps))
      const trimEndFrame = Math.max(0, secondsToFrames(trim.end || 0, fps))
      const startFrame = Math.max(0, secondsToFrames(visibleStartSeconds, fps))

      const transform = transforms[clipId]
      const crop = crops[clipId]

      const clip: Clip = {
        id: clipId,
        trackId: track.id,
        kind: kindOfClip,
        mediaId,
        startFrame,
        durationFrames,
        trimStartFrame,
        trimEndFrame,
        linkedClipId: null,
        transform: transform ? ({ ...transform } as ClipTransform) : null,
        crop: crop ? ({ ...crop } as ClipCrop) : null,
        text,
      }
      clips[clipId] = clip
      track.clipIds.push(clipId)
      cursor = Math.max(cursor, slotStartSeconds + slotSeconds)

      // A companion audio clip links back to its base video clip.
      if (isCompanion) linkPairs.push([base, clipId])
    }

    tracks.push(track)
  }

  // Establish symmetric A/V links where both ends survived as video/audio.
  for (const [videoId, audioId] of linkPairs) {
    const video = clips[videoId]
    const audio = clips[audioId]
    if (video && audio && video.kind === "video" && audio.kind === "audio") {
      video.linkedClipId = audioId
      audio.linkedClipId = videoId
    }
  }

  const media: Record<string, MediaRef> = {}
  for (const ref of mediaByUrl.values()) media[ref.id] = ref

  const timeline: Timeline = {
    version: TIMELINE_VERSION,
    sequence: { width, height, fps: clampFps(fps) },
    // An empty tracks array makes sanitizeTimeline fall back to the defaults.
    tracks,
    clips,
    media,
  }

  // Final safety net: guarantee a structurally valid, overlap-free timeline.
  return sanitizeTimeline(timeline)
}

/**
 * The subset of the legacy editor state the panel hydrates from / persists.
 * (`migrateLegacyTimeline` consumes the superset `LegacyPersistedTimeline`.)
 */
export type LegacyTimelineState = {
  tracks: LegacyTrack[]
  localClips: LegacyEditorClip[]
  splitClips: LegacyEditorClip[]
  clipTrims: Record<string, LegacyTrim>
  clipStarts: Record<string, number>
  clipTransforms: Record<string, LegacyTransform>
  clipCrops: Record<string, LegacyCrop>
  textOverlays: Record<string, LegacyTextOverlay>
  /** Source seconds per clip id, to seed the panel's measured-duration cache. */
  durations: Record<string, number>
  /** Base ids of placed clips, to seed the panel's one-shot auto-place guard. */
  assigned: string[]
  resolution: string
  fps: number
}

/**
 * Inverse of {@link migrateLegacyTimeline}: project the canonical timeline back
 * onto the editor panel's seconds-based state, so the existing UI can hydrate
 * from the authoritative server timeline without a handler rewrite.
 *
 * The legacy panel keeps audio companions implicit (id `"<videoId>__audio"`,
 * auto-derived from the video), so a canonical companion clip is mapped to that
 * id and dropped from the clip pool. `clipStarts` is set for every clip from its
 * slot start (startFrame − trimStart), so the panel reproduces the exact layout.
 */
export function timelineToLegacy(timeline: Timeline): LegacyTimelineState {
  const fps = timeline.sequence.fps

  // Canonical companion (audio linked to a video) → legacy "<videoId>__audio".
  const legacyIdOf = new Map<string, string>()
  for (const clip of Object.values(timeline.clips)) {
    const linked = clip.linkedClipId ? timeline.clips[clip.linkedClipId] : undefined
    legacyIdOf.set(clip.id, clip.kind === "audio" && linked?.kind === "video" ? `${linked.id}__audio` : clip.id)
  }

  const tracks: LegacyTrack[] = timeline.tracks.map((track) => ({
    id: track.id,
    type: track.kind,
    clipIds: track.clipIds.map((id) => legacyIdOf.get(id) ?? id),
  }))

  const localClips: LegacyEditorClip[] = []
  const clipTrims: Record<string, LegacyTrim> = {}
  const clipStarts: Record<string, number> = {}
  const clipTransforms: Record<string, LegacyTransform> = {}
  const clipCrops: Record<string, LegacyCrop> = {}
  const textOverlays: Record<string, LegacyTextOverlay> = {}
  const durations: Record<string, number> = {}

  for (const clip of Object.values(timeline.clips)) {
    const id = legacyIdOf.get(clip.id) ?? clip.id
    const isCompanion = id.endsWith(AUDIO_LINK_SUFFIX)

    if (clip.trimStartFrame || clip.trimEndFrame) {
      clipTrims[id] = {
        start: framesToSeconds(clip.trimStartFrame, fps),
        end: framesToSeconds(clip.trimEndFrame, fps),
      }
    }
    // Slot start in seconds: visibleStart − trimStart (the panel re-derives
    // visibleStart = max(0, slotStart + trim.start)).
    clipStarts[id] = framesToSeconds(clip.startFrame - clip.trimStartFrame, fps)
    if (clip.transform) clipTransforms[id] = { ...clip.transform }
    if (clip.crop) clipCrops[id] = { ...clip.crop }

    if (clip.kind === "text") {
      textOverlays[id] = {
        id,
        text: clip.text?.text ?? "",
        fontSize: clip.text?.fontSize ?? 8,
        color: clip.text?.color ?? "#ffffff",
        duration: framesToSeconds(clip.durationFrames, fps),
        ...(clip.text?.fontFamily ? { fontFamily: clip.text.fontFamily } : {}),
        ...(clip.text?.fontWeight ? { fontWeight: clip.text.fontWeight } : {}),
        ...(clip.text?.italic !== undefined ? { italic: clip.text.italic } : {}),
        ...(clip.text?.textAlign ? { textAlign: clip.text.textAlign } : {}),
        ...(clip.text?.shadow !== undefined ? { shadow: clip.text.shadow } : {}),
        ...(clip.text?.motion ? { motion: clip.text.motion } : {}),
      }
      continue
    }

    const media = clip.mediaId ? timeline.media[clip.mediaId] : undefined
    if (media && (clip.kind === "video" || clip.kind === "audio")) {
      // Seed the measured-duration cache so the panel's layout is right at once.
      const sourceFrames = media.durationFrames && media.durationFrames > 0 ? media.durationFrames : clip.durationFrames
      durations[id] = framesToSeconds(sourceFrames, fps)
    }
    // Companions are auto-derived by the panel from their video; only real
    // (non-companion) clips populate the resolvable pool.
    if (!isCompanion && media) {
      localClips.push({ id, url: media.url, kind: clip.kind, toolName: "", timestamp: "" })
    }
  }

  const assigned = [
    ...new Set(
      tracks.flatMap((track) =>
        track.clipIds.map((id) => (id.endsWith(AUDIO_LINK_SUFFIX) ? id.slice(0, -AUDIO_LINK_SUFFIX.length) : id)),
      ),
    ),
  ]

  return {
    tracks,
    localClips,
    splitClips: [],
    clipTrims,
    clipStarts,
    clipTransforms,
    clipCrops,
    textOverlays,
    durations,
    assigned,
    resolution: `${timeline.sequence.width}x${timeline.sequence.height}`,
    fps,
  }
}
