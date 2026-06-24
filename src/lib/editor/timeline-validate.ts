/**
 * Timeline invariants: validation (structured issues) and sanitization
 * (defense-in-depth coercion of untrusted JSON, mirroring brief-store).
 *
 * `validateTimeline` is the contract the command engine and the persistence
 * layer hold the model to. `sanitizeTimeline` is the lenient reader used when
 * loading persisted/agent-provided JSON: it never throws, dropping anything it
 * cannot make valid, and the result is guaranteed to pass `validateTimeline`.
 *
 * Pure module — safe on client and server.
 */

import { MAX_FPS, MIN_CLIP_FRAMES, MIN_FPS, clampFps, clampFrames } from "./frames"
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
  TIMELINE_VERSION,
  clipEndFrame,
  createEmptyTimeline,
  defaultTracks,
} from "./timeline-model"

export type ValidationIssue = { code: string; message: string; path?: string }
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] }

const TRACK_KINDS: ReadonlySet<TrackKind> = new Set(["media", "audio", "text"])
const CLIP_KINDS: ReadonlySet<ClipKind> = new Set(["video", "image", "audio", "text"])

/** Which clip kinds a given track kind may hold. */
export function clipKindAllowedOnTrack(clipKind: ClipKind, trackKind: TrackKind): boolean {
  if (trackKind === "media") return clipKind === "video" || clipKind === "image"
  if (trackKind === "audio") return clipKind === "audio"
  return clipKind === "text"
}

// ============================================================
// Validation
// ============================================================

export function validateTimeline(timeline: Timeline): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (code: string, message: string, path?: string) => issues.push({ code, message, path })

  if (timeline.version !== TIMELINE_VERSION) {
    add("version", `Unsupported timeline version ${String(timeline.version)}`)
  }

  const seq = timeline.sequence
  if (!seq || !(seq.width > 0) || !(seq.height > 0)) add("sequence", "Sequence must have positive width and height")
  if (!seq || !(seq.fps >= MIN_FPS && seq.fps <= MAX_FPS)) add("sequence", `Sequence fps must be ${MIN_FPS}–${MAX_FPS}`)

  const trackById = new Map<string, Track>()
  for (const track of timeline.tracks) {
    if (trackById.has(track.id)) add("track.duplicate", `Duplicate track id ${track.id}`, track.id)
    if (!TRACK_KINDS.has(track.kind)) add("track.kind", `Invalid track kind ${track.kind}`, track.id)
    trackById.set(track.id, track)
  }

  // Every clip id appears in exactly one track's clipIds, and refers to a clip.
  const clipToTrack = new Map<string, string>()
  for (const track of timeline.tracks) {
    const seen = new Set<string>()
    for (const clipId of track.clipIds) {
      if (seen.has(clipId)) add("track.clip.duplicate", `Clip ${clipId} listed twice on track ${track.id}`, clipId)
      seen.add(clipId)
      if (!timeline.clips[clipId]) {
        add("track.clip.dangling", `Track ${track.id} references missing clip ${clipId}`, clipId)
        continue
      }
      if (clipToTrack.has(clipId)) {
        add("clip.multiplaced", `Clip ${clipId} placed on multiple tracks`, clipId)
      }
      clipToTrack.set(clipId, track.id)
    }
  }

  for (const clip of Object.values(timeline.clips)) {
    const where = clipToTrack.get(clip.id)
    if (!where) add("clip.unplaced", `Clip ${clip.id} is not listed on any track`, clip.id)
    else if (where !== clip.trackId) {
      add("clip.track.mismatch", `Clip ${clip.id} trackId ${clip.trackId} disagrees with placement ${where}`, clip.id)
    }
    if (!CLIP_KINDS.has(clip.kind)) add("clip.kind", `Invalid clip kind ${clip.kind}`, clip.id)

    const track = trackById.get(clip.trackId)
    if (track && !clipKindAllowedOnTrack(clip.kind, track.kind)) {
      add("clip.track.kind", `Clip kind ${clip.kind} not allowed on ${track.kind} track`, clip.id)
    }

    // Media linkage.
    if (clip.kind === "text") {
      if (clip.mediaId !== null) add("clip.text.media", `Text clip ${clip.id} must not reference media`, clip.id)
      if (!clip.text || typeof clip.text.text !== "string") add("clip.text.content", `Text clip ${clip.id} missing text`, clip.id)
    } else {
      if (!clip.mediaId || !timeline.media[clip.mediaId]) {
        add("clip.media.dangling", `Clip ${clip.id} references missing media ${clip.mediaId}`, clip.id)
      }
    }

    // Frame invariants.
    if (!Number.isInteger(clip.startFrame) || clip.startFrame < 0) add("clip.startFrame", `Clip ${clip.id} startFrame must be a non-negative integer`, clip.id)
    if (!Number.isInteger(clip.durationFrames) || clip.durationFrames <= 0) add("clip.durationFrames", `Clip ${clip.id} durationFrames must be a positive integer`, clip.id)
    if (!Number.isInteger(clip.trimStartFrame) || clip.trimStartFrame < 0) add("clip.trimStartFrame", `Clip ${clip.id} trimStartFrame must be a non-negative integer`, clip.id)
    if (!Number.isInteger(clip.trimEndFrame) || clip.trimEndFrame < 0) add("clip.trimEndFrame", `Clip ${clip.id} trimEndFrame must be a non-negative integer`, clip.id)
    if (clip.durationFrames - clip.trimStartFrame - clip.trimEndFrame < MIN_CLIP_FRAMES) {
      add("clip.trim.overflow", `Clip ${clip.id} trims leave less than ${MIN_CLIP_FRAMES} visible frame`, clip.id)
    }

    // Symmetric A/V link.
    if (clip.linkedClipId) {
      const peer = timeline.clips[clip.linkedClipId]
      if (!peer) add("clip.link.dangling", `Clip ${clip.id} linked to missing clip ${clip.linkedClipId}`, clip.id)
      else if (peer.linkedClipId !== clip.id) add("clip.link.asymmetric", `Clip ${clip.id} link is not reciprocated by ${peer.id}`, clip.id)
    }
  }

  // No overlap within a track (by visible span).
  for (const track of timeline.tracks) {
    const placed = track.clipIds
      .map((id) => timeline.clips[id])
      .filter((c): c is Clip => Boolean(c))
      .slice()
      .sort((a, b) => a.startFrame - b.startFrame)
    for (let i = 1; i < placed.length; i += 1) {
      if (placed[i].startFrame < clipEndFrame(placed[i - 1])) {
        add("track.overlap", `Clips ${placed[i - 1].id} and ${placed[i].id} overlap on track ${track.id}`, track.id)
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

export function assertValidTimeline(timeline: Timeline): void {
  const result = validateTimeline(timeline)
  if (!result.valid) {
    const first = result.issues[0]
    throw new Error(`Invalid timeline: ${first.message}${result.issues.length > 1 ? ` (+${result.issues.length - 1} more)` : ""}`)
  }
}

// ============================================================
// Sanitization (lenient reader for untrusted JSON)
// ============================================================

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function sanitizeTransform(value: unknown): ClipTransform | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  return { scale: num(v.scale, 1), x: num(v.x, 0), y: num(v.y, 0) }
}

function sanitizeCrop(value: unknown): ClipCrop | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const edge = (e: unknown) => Math.min(100, Math.max(0, num(e, 0)))
  return { top: edge(v.top), right: edge(v.right), bottom: edge(v.bottom), left: edge(v.left) }
}

function sanitizeText(value: unknown): ClipText | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (typeof v.text !== "string") return null
  const text: ClipText = {
    text: v.text.slice(0, 2000),
    fontSize: num(v.fontSize, 8),
    color: typeof v.color === "string" ? v.color.slice(0, 32) : "#ffffff",
  }
  if (v.fontFamily === "sans" || v.fontFamily === "serif" || v.fontFamily === "mono") text.fontFamily = v.fontFamily
  if (v.fontWeight === 400 || v.fontWeight === 600 || v.fontWeight === 700) text.fontWeight = v.fontWeight
  if (typeof v.italic === "boolean") text.italic = v.italic
  if (v.textAlign === "left" || v.textAlign === "center" || v.textAlign === "right") text.textAlign = v.textAlign
  if (typeof v.shadow === "boolean") text.shadow = v.shadow
  if (v.motion === "none" || v.motion === "fade" || v.motion === "rise" || v.motion === "scale") text.motion = v.motion
  return text
}

function sanitizeMedia(value: unknown): MediaRef | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const id = typeof v.id === "string" ? v.id : null
  const url = typeof v.url === "string" ? v.url : null
  const kind = v.kind as MediaKind
  if (!id || !url || (kind !== "video" && kind !== "image" && kind !== "audio")) return null
  const media: MediaRef = { id, url, kind }
  if (typeof v.label === "string" && v.label.trim()) media.label = v.label.slice(0, 600)
  if (typeof v.durationFrames === "number" && Number.isFinite(v.durationFrames) && v.durationFrames > 0) {
    media.durationFrames = clampFrames(v.durationFrames)
  }
  return media
}

/**
 * Coerce an arbitrary value into a valid Timeline. Always returns a structurally
 * valid timeline (worst case: an empty one). Clips that cannot be made valid —
 * dangling media, frame overflow, overlaps, wrong track kind — are dropped so a
 * corrupt persisted row can never poison the editor.
 */
export function sanitizeTimeline(raw: unknown): Timeline {
  if (!raw || typeof raw !== "object") return createEmptyTimeline()
  const src = raw as Record<string, unknown>

  const base = createEmptyTimeline({
    width: typeof (src.sequence as Record<string, unknown>)?.width === "number" ? (src.sequence as Record<string, number>).width : undefined,
    height: typeof (src.sequence as Record<string, unknown>)?.height === "number" ? (src.sequence as Record<string, number>).height : undefined,
    fps: clampFps(num((src.sequence as Record<string, unknown>)?.fps, 24)),
  })

  // Media catalogue.
  const media: Record<string, MediaRef> = {}
  if (src.media && typeof src.media === "object") {
    for (const entry of Object.values(src.media as Record<string, unknown>)) {
      const m = sanitizeMedia(entry)
      if (m) media[m.id] = m
    }
  }
  base.media = media

  // Tracks (fall back to defaults if none usable).
  const rawTracks = Array.isArray(src.tracks) ? src.tracks : []
  const tracks: Track[] = []
  const trackIds = new Set<string>()
  for (const entry of rawTracks) {
    if (!entry || typeof entry !== "object") continue
    const t = entry as Record<string, unknown>
    const id = typeof t.id === "string" ? t.id : null
    const kind = t.kind as TrackKind
    if (!id || trackIds.has(id) || !TRACK_KINDS.has(kind)) continue
    trackIds.add(id)
    tracks.push({ id, kind, clipIds: [] })
  }
  base.tracks = tracks.length ? tracks : defaultTracks()
  const trackByIdLocal = new Map(base.tracks.map((t) => [t.id, t]))

  // Clips: validate each in isolation, then place if its track accepts it and
  // it does not overlap an already-accepted clip on that track.
  const clips: Record<string, Clip> = {}
  const rawClips = src.clips && typeof src.clips === "object" ? Object.values(src.clips as Record<string, unknown>) : []
  // Preserve track order by walking each track's clipIds against the clip pool.
  const clipPool = new Map<string, Record<string, unknown>>()
  for (const entry of rawClips) {
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "string") {
      clipPool.set((entry as Record<string, string>).id, entry as Record<string, unknown>)
    }
  }

  const acceptClip = (c: Record<string, unknown>): Clip | null => {
    const id = typeof c.id === "string" ? c.id : null
    const kind = c.kind as ClipKind
    const trackId = typeof c.trackId === "string" ? c.trackId : null
    if (!id || !trackId || !CLIP_KINDS.has(kind)) return null
    const track = trackByIdLocal.get(trackId)
    if (!track || !clipKindAllowedOnTrack(kind, track.kind)) return null

    const durationFrames = clampFrames(num(c.durationFrames, 0))
    if (durationFrames < MIN_CLIP_FRAMES) return null
    const trimStartFrame = clampFrames(num(c.trimStartFrame, 0))
    const trimEndFrame = clampFrames(num(c.trimEndFrame, 0))
    if (durationFrames - trimStartFrame - trimEndFrame < MIN_CLIP_FRAMES) return null

    let mediaId: string | null = null
    let text: ClipText | null = null
    if (kind === "text") {
      text = sanitizeText(c.text)
      if (!text) return null
    } else {
      mediaId = typeof c.mediaId === "string" ? c.mediaId : null
      if (!mediaId || !media[mediaId]) return null
    }

    return {
      id,
      trackId,
      kind,
      mediaId,
      startFrame: clampFrames(num(c.startFrame, 0)),
      durationFrames,
      trimStartFrame,
      trimEndFrame,
      linkedClipId: typeof c.linkedClipId === "string" ? c.linkedClipId : null,
      transform: sanitizeTransform(c.transform),
      crop: sanitizeCrop(c.crop),
      text,
    }
  }

  // Walk track order so editorial order is preserved; overlap-reject per track.
  for (const track of base.tracks) {
    const rawTrack = rawTracks.find((t) => (t as Record<string, unknown>)?.id === track.id) as Record<string, unknown> | undefined
    const orderedIds = Array.isArray(rawTrack?.clipIds) ? (rawTrack!.clipIds as unknown[]) : []
    const placedEnds: Array<{ start: number; end: number }> = []
    for (const rawId of orderedIds) {
      if (typeof rawId !== "string") continue
      const pool = clipPool.get(rawId)
      if (!pool) continue
      const clip = acceptClip(pool)
      if (!clip || clip.trackId !== track.id || clips[clip.id]) continue
      const start = clip.startFrame
      const end = clipEndFrame(clip)
      if (placedEnds.some((s) => start < s.end && end > s.start)) continue // overlap — drop
      placedEnds.push({ start, end })
      clips[clip.id] = clip
      track.clipIds.push(clip.id)
    }
  }

  // Drop links whose peer did not survive, and de-symmetrize one-sided links.
  for (const clip of Object.values(clips)) {
    if (clip.linkedClipId && (!clips[clip.linkedClipId] || clips[clip.linkedClipId].linkedClipId !== clip.id)) {
      clip.linkedClipId = null
    }
  }

  base.clips = clips
  return base
}
