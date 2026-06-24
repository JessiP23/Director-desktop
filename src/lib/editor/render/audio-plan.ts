import type { Timeline } from "../timeline-model"
import { visibleDurationFrames } from "../timeline-model"

export type AudioSegment = {
  /** Source media URL to decode. */
  url: string
  /** Where in the source to start playing (seconds) — the trimmed-off head. */
  sourceStartSec: number
  /** How long to play (seconds) — the clip's visible (post-trim) span. */
  durationSec: number
  /** When on the output timeline the segment begins (seconds). */
  timelineStartSec: number
}

/**
 * Every audible segment of the timeline, in timeline order. Overlaps are kept
 * separate (the renderer mixes them); gaps simply produce no segment (silence).
 */
export function planTimelineAudio(timeline: Timeline): AudioSegment[] {
  const fps = timeline.sequence.fps
  const segments: AudioSegment[] = []
  for (const clip of Object.values(timeline.clips)) {
    if (clip.kind !== "audio" || !clip.mediaId) continue
    const media = timeline.media[clip.mediaId]
    if (!media?.url) continue
    const visibleFrames = visibleDurationFrames(clip)
    if (visibleFrames <= 0) continue
    segments.push({
      url: media.url,
      sourceStartSec: clip.trimStartFrame / fps,
      durationSec: visibleFrames / fps,
      timelineStartSec: clip.startFrame / fps,
    })
  }
  return segments.sort((a, b) => a.timelineStartSec - b.timelineStartSec)
}
