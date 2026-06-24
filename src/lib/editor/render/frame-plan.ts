/**
 * Pure frame-compositing planner for the WebGL editor renderer.
 *
 * Given the canonical {@link Timeline} and an absolute timeline frame, it
 * computes the ordered list of visual layers to draw for that frame — fully
 * independent of any renderer. The same plan drives the in-app preview (a
 * PixiJS/WebGL painter) and the export (frame-by-frame capture), so preview and
 * export match BY CONSTRUCTION: there is one source of truth for "what the frame
 * looks like".
 *
 * This module owns the frame-accurate compositing logic — which clips are
 * visible at a frame, the timeline-frame → source-media-frame mapping (trims),
 * z-order (media below, text on top), and entrance-motion easing — while the
 * painter is a dumb executor of the plan.
 *
 * Pure module: no React, no WebGL, no DOM. Client + server safe (the export
 * worker can plan frames the same way the browser does).
 */

import {
  type Clip,
  type ClipCrop,
  type ClipText,
  type ClipTransform,
  type Timeline,
  type Track,
  DEFAULT_CROP,
  DEFAULT_TRANSFORM,
  clipEndFrame,
  clipsOnTrack,
} from "../timeline-model"

/** Frames an entrance motion (fade/rise/scale) plays over before it settles. */
export const MOTION_FRAMES = 12
/** Pixels a "rise" motion lifts the text up into place (at progress 0). */
export const RISE_DISTANCE_PX = 24
/** Starting scale for a "scale" motion (grows to 1 at progress 1). */
export const SCALE_MOTION_FROM = 0.8

/** A visual media layer (video frame or still image) to paint. */
export type MediaCompositeLayer = {
  kind: "video" | "image"
  clipId: string
  mediaId: string
  url: string
  /** Source frame to sample for video (0 for images). >= 0. */
  sourceFrame: number
  crop: ClipCrop
  transform: ClipTransform
  opacity: number
}

/** A text overlay layer to paint. */
export type TextCompositeLayer = {
  kind: "text"
  clipId: string
  text: ClipText
  transform: ClipTransform
  opacity: number
  /** Vertical offset in px from "rise" motion; 0 once settled. */
  riseOffsetPx: number
  /** Multiplicative scale from "scale" motion; 1 once settled. */
  motionScale: number
}

export type CompositeLayer = MediaCompositeLayer | TextCompositeLayer

/** Everything needed to paint one frame, back-to-front (layers[0] is bottom). */
export type CompositeFrame = {
  width: number
  height: number
  fps: number
  frame: number
  layers: CompositeLayer[]
}

/** Z-order weight by track kind: media at the bottom, text on top. */
const TRACK_Z: Record<Track["kind"], number> = { media: 0, audio: 1, text: 2 }

/** Is `frame` inside the clip's visible (post-trim) span [start, end)? */
function clipVisibleAt(clip: Clip, frame: number): boolean {
  return frame >= clip.startFrame && frame < clipEndFrame(clip)
}

/** Eased 0→1 progress of a clip's entrance motion at the given frame. */
function motionProgress(clip: Clip, frame: number): number {
  if (MOTION_FRAMES <= 0) return 1
  const elapsed = frame - clip.startFrame
  if (elapsed >= MOTION_FRAMES) return 1
  if (elapsed <= 0) return 0
  // easeOutCubic — matches a typical CSS ease-out entrance closely enough.
  const t = elapsed / MOTION_FRAMES
  return 1 - Math.pow(1 - t, 3)
}

function mediaLayer(timeline: Timeline, clip: Clip, frame: number): MediaCompositeLayer | null {
  if (!clip.mediaId) return null
  const media = timeline.media[clip.mediaId]
  if (!media) return null
  // Timeline frame → source frame: skip the trimmed-off head, then advance with
  // the playhead. Images ignore this (single still), so clamp to 0.
  const sourceFrame = clip.kind === "video" ? clip.trimStartFrame + (frame - clip.startFrame) : 0
  return {
    kind: clip.kind === "image" ? "image" : "video",
    clipId: clip.id,
    mediaId: clip.mediaId,
    url: media.url,
    sourceFrame: Math.max(0, sourceFrame),
    crop: clip.crop ?? DEFAULT_CROP,
    transform: clip.transform ?? DEFAULT_TRANSFORM,
    opacity: 1,
  }
}

function textLayer(clip: Clip, frame: number): TextCompositeLayer | null {
  if (!clip.text) return null
  const motion = clip.text.motion ?? "none"
  const progress = motion === "none" ? 1 : motionProgress(clip, frame)
  return {
    kind: "text",
    clipId: clip.id,
    text: clip.text,
    transform: clip.transform ?? DEFAULT_TRANSFORM,
    opacity: motion === "none" ? 1 : progress,
    riseOffsetPx: motion === "rise" ? (1 - progress) * RISE_DISTANCE_PX : 0,
    motionScale: motion === "scale" ? SCALE_MOTION_FROM + (1 - SCALE_MOTION_FROM) * progress : 1,
  }
}

/**
 * Build the paint plan for one absolute timeline frame. Layers are returned
 * back-to-front (media tracks first, text tracks last). Audio tracks contribute
 * no visual layer. Clips on a track never overlap, so at most one clip per track
 * is visible at a given frame.
 */
export function composeFrame(timeline: Timeline, frame: number): CompositeFrame {
  const tracks = [...timeline.tracks].sort((a, b) => TRACK_Z[a.kind] - TRACK_Z[b.kind])
  const layers: CompositeLayer[] = []

  for (const track of tracks) {
    if (track.kind === "audio") continue
    for (const clip of clipsOnTrack(timeline, track.id)) {
      if (!clipVisibleAt(clip, frame)) continue
      const layer = track.kind === "text" ? textLayer(clip, frame) : mediaLayer(timeline, clip, frame)
      if (layer) layers.push(layer)
    }
  }

  return {
    width: timeline.sequence.width,
    height: timeline.sequence.height,
    fps: timeline.sequence.fps,
    frame,
    layers,
  }
}
