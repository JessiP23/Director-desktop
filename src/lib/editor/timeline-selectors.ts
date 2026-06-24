/**
 * Read-side selectors: canonical timeline → the seconds-based view-model the
 * editor UI renders from.
 *
 * The canonical model stores integer frames; the player, the timeline ruler and
 * the drag math work in seconds. These pure selectors are the single crossing
 * for reads (the command engine is the single crossing for writes), so the React
 * component never recomputes layout ad hoc and a clip's on-screen extent always
 * matches its stored frames.
 *
 * Pure module — safe on client and server.
 */

import { framesToSeconds } from "./frames"
import {
  type Clip,
  type ClipCrop,
  type ClipText,
  type ClipTransform,
  type Timeline,
  type TrackKind,
  clipsOnTrack,
  timelineDurationFrames,
  visibleDurationFrames,
} from "./timeline-model"

/** A clip's placement and look, resolved to seconds for rendering. */
export type ClipView = {
  clipId: string
  trackId: string
  kind: Clip["kind"]
  /** Absolute start of the visible (trimmed) portion, in seconds. */
  visibleStartSeconds: number
  /** Visible (trimmed) length, in seconds. */
  durationSeconds: number
  /** Untrimmed slot length, in seconds. */
  sourceDurationSeconds: number
  /** Start of the untrimmed slot (visibleStart − trim.start), in seconds. */
  slotStartSeconds: number
  trimSeconds: { start: number; end: number }
  /** Source asset (null for text clips). */
  mediaUrl: string | null
  mediaKind: Clip["kind"] | null
  transform: ClipTransform | null
  crop: ClipCrop | null
  text: ClipText | null
  linkedClipId: string | null
}

export type TrackView = {
  id: string
  kind: TrackKind
  clips: ClipView[]
}

export function selectClipView(timeline: Timeline, clip: Clip): ClipView {
  const fps = timeline.sequence.fps
  const media = clip.mediaId ? timeline.media[clip.mediaId] : undefined
  const visibleFrames = visibleDurationFrames(clip)
  return {
    clipId: clip.id,
    trackId: clip.trackId,
    kind: clip.kind,
    visibleStartSeconds: framesToSeconds(clip.startFrame, fps),
    durationSeconds: framesToSeconds(visibleFrames, fps),
    sourceDurationSeconds: framesToSeconds(clip.durationFrames, fps),
    slotStartSeconds: framesToSeconds(clip.startFrame - clip.trimStartFrame, fps),
    trimSeconds: {
      start: framesToSeconds(clip.trimStartFrame, fps),
      end: framesToSeconds(clip.trimEndFrame, fps),
    },
    mediaUrl: media?.url ?? null,
    mediaKind: media?.kind ?? null,
    transform: clip.transform,
    crop: clip.crop,
    text: clip.text,
    linkedClipId: clip.linkedClipId,
  }
}

/** Tracks with their clips in editorial order, resolved to seconds. */
export function selectTrackViews(timeline: Timeline): TrackView[] {
  return timeline.tracks.map((track) => ({
    id: track.id,
    kind: track.kind,
    clips: clipsOnTrack(timeline, track.id).map((clip) => selectClipView(timeline, clip)),
  }))
}

/** Total timeline length in seconds (max visible clip end). */
export function selectTimelineDurationSeconds(timeline: Timeline): number {
  return framesToSeconds(timelineDurationFrames(timeline), timeline.sequence.fps)
}

/** Sequence settings the UI shows (resolution string + fps). */
export function selectSequenceView(timeline: Timeline): { resolution: string; fps: number; width: number; height: number } {
  const { width, height, fps } = timeline.sequence
  return { resolution: `${width}x${height}`, fps, width, height }
}
