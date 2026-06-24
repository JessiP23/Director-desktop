export type TimelineSnapResult = {
  visibleStart: number
  guideTime: number | null
}

/**
 * Snap either edge of a dragged clip to the nearest edit point on another
 * track. The caller remains responsible for same-track overlap constraints.
 */
export function resolveCrossTrackSnap(
  visibleStart: number,
  duration: number,
  targets: number[],
  snapSeconds: number,
): TimelineSnapResult {
  if (!Number.isFinite(visibleStart) || !Number.isFinite(duration) || duration < 0) {
    return { visibleStart, guideTime: null }
  }

  let bestStart = visibleStart
  let bestGuide: number | null = null
  let bestDistance = Math.max(0, snapSeconds)

  for (const target of targets) {
    if (!Number.isFinite(target) || target < 0) continue
    for (const edgeOffset of [0, duration]) {
      const candidateStart = target - edgeOffset
      if (candidateStart < 0) continue
      const distance = Math.abs(candidateStart - visibleStart)
      const isFirstMatchAtBoundary = bestGuide === null && distance <= bestDistance
      if (distance < bestDistance || isFirstMatchAtBoundary) {
        bestDistance = distance
        bestStart = candidateStart
        bestGuide = target
      }
    }
  }

  return { visibleStart: bestStart, guideTime: bestGuide }
}
