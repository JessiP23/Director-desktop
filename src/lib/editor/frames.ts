/**
 * Frame ↔ seconds conversion for the canonical editor timeline.
 *
 * The timeline stores time exclusively as integer frame counts so editorial
 * state never drifts on floating-point seconds. Seconds are an I/O concern:
 * they come in from media metadata (measured durations) and the legacy
 * localStorage format, and go out to the player. These helpers are the only
 * sanctioned crossing between the two worlds.
 *
 * Pure module — safe to import from both the React client and the server.
 */

/** Smallest fps we will honour; guards against divide-by-zero and bad input. */
export const MIN_FPS = 1
/** Largest fps we model (matches the editor's 60fps ceiling). */
export const MAX_FPS = 240
/** A clip must keep at least this many frames of visible content. */
export const MIN_CLIP_FRAMES = 1

/** Coerce an arbitrary value to a usable, integer fps. */
export function normalizeFps(value: unknown, fallback = 24): number {
  const fps = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback
  return clampFps(fps)
}

export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return MIN_FPS
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)))
}

/**
 * Convert seconds to whole frames at the given fps. Rounds to the nearest
 * frame so a measured 4.98s clip at 25fps lands on 125 frames, not 124.5.
 */
export function secondsToFrames(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.max(0, Math.round(seconds * clampFps(fps)))
}

/** Convert whole frames back to seconds (exact for integer frames). */
export function framesToSeconds(frames: number, fps: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 0
  return frames / clampFps(fps)
}

/**
 * Snap a seconds value onto the nearest frame boundary and return seconds.
 * Used when seconds must be preserved at the edge (e.g. player scrubbing)
 * but still align to the frame grid.
 */
export function snapSecondsToFrame(seconds: number, fps: number): number {
  return framesToSeconds(secondsToFrames(seconds, fps), fps)
}

/** Clamp a frame count to a non-negative integer. */
export function clampFrames(frames: number): number {
  if (!Number.isFinite(frames)) return 0
  return Math.max(0, Math.round(frames))
}

/**
 * Rescale a frame count from one fps to another, preserving wall-clock time.
 * Used when the sequence fps changes so existing clips keep their duration.
 */
export function rescaleFrames(frames: number, fromFps: number, toFps: number): number {
  if (fromFps === toFps) return clampFrames(frames)
  return clampFrames((clampFrames(frames) * clampFps(toFps)) / clampFps(fromFps))
}
