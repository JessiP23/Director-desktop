/**
 * Production timeline helpers: ordering and placement of user-confirmed clips
 * (the brief's `scriptClips`) on the editor's media track, in screenplay
 * scene/shot order.
 */

/** A confirmed clip in the production timeline (from the brief's scriptClips). */
export type ConfirmedClip = { url: string; scriptReference: string }

/** Natural scene/shot ordering so "Scene 10 / Shot 1" sorts after "Scene 2 / Shot 3". */
export function compareScriptReference(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}


/**
 * Where to splice a confirmed clip into a media track so it lands in scene/shot
 * order relative to the confirmed clips already there: before the first
 * already-placed confirmed clip that ranks later in `orderedConfirmedIds`.
 * Non-confirmed clips (rank -1, e.g. storyboard images) are stepped over, so a
 * confirmed clip inserts among the other confirmed clips regardless of any
 * interleaved stills.
 */
export function confirmedClipInsertIndex(
  clipIds: string[],
  clipId: string,
  orderedConfirmedIds: string[],
): number {
  const myRank = orderedConfirmedIds.indexOf(clipId)
  for (let index = 0; index < clipIds.length; index += 1) {
    const rank = orderedConfirmedIds.indexOf(clipIds[index])
    if (rank !== -1 && rank > myRank) return index
  }
  return clipIds.length
}
