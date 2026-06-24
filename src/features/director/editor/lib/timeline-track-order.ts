export type TimelineTrackFamily = "media" | "audio" | "text"

const TRACK_LAYER_ORDER: Record<TimelineTrackFamily, number> = {
  text: 0,
  media: 1,
  audio: 2,
}

/** Overlay lanes render above video lanes; audio lanes always render below. */
export function orderTimelineTracks<T extends { type: TimelineTrackFamily }>(tracks: T[]): T[] {
  return tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => TRACK_LAYER_ORDER[a.track.type] - TRACK_LAYER_ORDER[b.track.type] || a.index - b.index)
    .map(({ track }) => track)
}
