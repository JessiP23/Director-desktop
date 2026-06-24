/**
 * Canonical, versioned timeline model for the Director editor.
 *
 * This is the authoritative editorial state — deliberately independent of the
 * React editor panel and of any rendering concern. It is the single contract
 * shared by the UI, the command engine, the persistence layer and the Editor
 * agent. Pure module: no React, no server-only imports.
 *
 * Design invariants (enforced by timeline-validate / commands):
 *  - Time is integer FRAMES, never floating seconds (see ./frames).
 *  - Media assets (`media`) are separate entities from their placement
 *    (`clips`): a clip references a media asset by `mediaId`.
 *  - Each clip lives on exactly one track, listed in that track's `clipIds`.
 *  - A clip's on-timeline span is [startFrame, startFrame + visibleDuration),
 *    where visibleDuration = durationFrames - trimStartFrame - trimEndFrame.
 *  - Clips on the same track never overlap.
 */

import { MIN_CLIP_FRAMES, clampFps } from "./frames"

/** Bump when the persisted shape changes in a non-backward-compatible way. */
export const TIMELINE_VERSION = 1 as const
export type TimelineVersion = typeof TIMELINE_VERSION

export type TrackKind = "media" | "audio" | "text"
export type ClipKind = "video" | "image" | "audio" | "text"
/** The clip kinds that draw from a media asset (everything except text). */
export type MediaKind = "video" | "image" | "audio"

export type SequenceSettings = {
  /** Frame width in pixels (> 0). */
  width: number
  /** Frame height in pixels (> 0). */
  height: number
  /** Frames per second (integer, clamped by ./frames). */
  fps: number
}

/**
 * A source asset available to the timeline. Lives independently of where (or
 * whether) it is placed, so the same generated clip can be cut in several
 * times, and an asset can exist in the catalogue without being on the timeline.
 */
export type MediaRef = {
  /** Stable id the agent and UI reference (never a URL). */
  id: string
  url: string
  kind: MediaKind
  /** Human / prompt label so the agent knows what the asset depicts. */
  label?: string
  /**
   * Natural source length in frames at the sequence fps. Optional: video/audio
   * durations are measured asynchronously, so this may be absent until known.
   */
  durationFrames?: number
}

/** How a clip is sized/positioned inside the preview frame. */
export type ClipTransform = { scale: number; x: number; y: number }
/** Per-edge crop as a percentage of the clip (0–100 per edge). */
export type ClipCrop = { top: number; right: number; bottom: number; left: number }
/** Content + look for text clips. Optional styling fields keep old timelines valid. */
export type ClipText = {
  text: string
  fontSize: number
  color: string
  fontFamily?: "sans" | "serif" | "mono"
  fontWeight?: 400 | 600 | 700
  italic?: boolean
  textAlign?: "left" | "center" | "right"
  shadow?: boolean
  motion?: "none" | "fade" | "rise" | "scale"
}

export type Clip = {
  id: string
  trackId: string
  kind: ClipKind
  /** Source asset, or null for text clips (which carry their content inline). */
  mediaId: string | null
  /** Absolute timeline frame of the first VISIBLE (post-trim) frame. >= 0. */
  startFrame: number
  /** Full slot length in frames before trimming. > 0. */
  durationFrames: number
  /** Frames cut from the head. >= 0. */
  trimStartFrame: number
  /** Frames cut from the tail. >= 0. */
  trimEndFrame: number
  /**
   * Companion clip kept in sync (a video and its extracted audio). Operations
   * that affect editorial timing (move, trim, resize, split, reorder, remove)
   * cascade across the link.
   */
  linkedClipId: string | null
  transform: ClipTransform | null
  crop: ClipCrop | null
  /** Present only for text clips. */
  text: ClipText | null
}

export type Track = {
  id: string
  kind: TrackKind
  /** Clip ids on this track. Order is the editorial order (for reorder/repack). */
  clipIds: string[]
}

export type Timeline = {
  version: TimelineVersion
  sequence: SequenceSettings
  tracks: Track[]
  /** All clips, keyed by id. The source of truth; tracks only hold id order. */
  clips: Record<string, Clip>
  /** Media catalogue, keyed by id. */
  media: Record<string, MediaRef>
}

export const DEFAULT_SEQUENCE: SequenceSettings = { width: 1920, height: 1080, fps: 24 }
export const DEFAULT_TRANSFORM: ClipTransform = { scale: 1, x: 0, y: 0 }
export const DEFAULT_CROP: ClipCrop = { top: 0, right: 0, bottom: 0, left: 0 }

/** Stable ids for the two default tracks (mirrors the legacy editor). */
export const MEDIA_TRACK_ID = "track-media"
export const AUDIO_TRACK_ID = "track-audio"

export function defaultTracks(): Track[] {
  return [
    { id: MEDIA_TRACK_ID, kind: "media", clipIds: [] },
    { id: AUDIO_TRACK_ID, kind: "audio", clipIds: [] },
  ]
}

export function createEmptyTimeline(sequence?: Partial<SequenceSettings>): Timeline {
  return {
    version: TIMELINE_VERSION,
    sequence: {
      width: sequence?.width && sequence.width > 0 ? Math.round(sequence.width) : DEFAULT_SEQUENCE.width,
      height: sequence?.height && sequence.height > 0 ? Math.round(sequence.height) : DEFAULT_SEQUENCE.height,
      fps: clampFps(sequence?.fps ?? DEFAULT_SEQUENCE.fps),
    },
    tracks: defaultTracks(),
    clips: {},
    media: {},
  }
}

// ============================================================
// Pure derivations (no mutation)
// ============================================================

/** Visible (post-trim) length of a clip, in frames. Always >= MIN_CLIP_FRAMES. */
export function visibleDurationFrames(clip: Clip): number {
  return Math.max(MIN_CLIP_FRAMES, clip.durationFrames - clip.trimStartFrame - clip.trimEndFrame)
}

/** First frame after the clip's visible span (exclusive end). */
export function clipEndFrame(clip: Clip): number {
  return clip.startFrame + visibleDurationFrames(clip)
}

export function findTrack(timeline: Timeline, trackId: string): Track | undefined {
  return timeline.tracks.find((track) => track.id === trackId)
}

export function findClip(timeline: Timeline, clipId: string): Clip | undefined {
  return timeline.clips[clipId]
}

/** The track a clip currently sits on, by scanning track membership. */
export function trackOfClip(timeline: Timeline, clipId: string): Track | undefined {
  return timeline.tracks.find((track) => track.clipIds.includes(clipId))
}

/** Clips on a track, in editorial (clipIds) order. Skips dangling ids. */
export function clipsOnTrack(timeline: Timeline, trackId: string): Clip[] {
  const track = findTrack(timeline, trackId)
  if (!track) return []
  return track.clipIds.map((id) => timeline.clips[id]).filter((c): c is Clip => Boolean(c))
}

/** Total timeline length in frames (max visible end across all clips). */
export function timelineDurationFrames(timeline: Timeline): number {
  let end = 0
  for (const clip of Object.values(timeline.clips)) end = Math.max(end, clipEndFrame(clip))
  return end
}

/**
 * Structured deep clone used by the command engine so a failed command never
 * leaves the caller's timeline partially mutated. structuredClone is available
 * in Node 17+ and all modern browsers.
 */
export function cloneTimeline(timeline: Timeline): Timeline {
  return structuredClone(timeline)
}
