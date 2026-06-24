"use client"

import * as React from "react"
import {
  secondsToFrames,
  type EditorCommand,
} from "@/lib/editor"
import { resolveCrossTrackSnap } from "../../lib/timeline-snapping"
import {
  AUDIO_LINK_SUFFIX,
  baseClipId,
  resolveClipPlacement,
  snapTimeToFrame,
  type ClipLayout,
  type SequenceFps,
  type Track,
  type TrackType,
} from "../../lib/editor-view-utils"

// A clip's slot is only treated as "moved" once it is dragged this many pixels,
// so a plain tap selects the clip instead of nudging it.
const CLIP_DRAG_THRESHOLD_PX = 4
// How close (in px) a dragged clip edge must get to a neighbour before it snaps
// flush against it.
const CLIP_SNAP_PX = 8
// Cross-track edit points get a slightly wider magnetic range so the alignment
// feels deliberate even when lanes are visually separated.
const CROSS_TRACK_SNAP_PX = 10

type UseTimelineClipDraggingParams = {
  clipLayoutMap: Map<string, ClipLayout>
  timelineCanvasDuration: number
  sequenceFps: SequenceFps
  tracks: Track[]
  setClipStarts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setTimelineSnapGuideSeconds: React.Dispatch<React.SetStateAction<number | null>>
  dispatchCommand: (command: EditorCommand) => boolean
}

type ClipDragState = {
  clipId: string
  pointerId: number
  startX: number
  startY: number
  initialStart: number
  /** Lowest allowed slot start (= -trim.start) so the visible clip stops at 0. */
  minStart: number
  pxPerSecond: number
  sourceTrackType: TrackType
  /** Trim offset of the dragged clip (slotStart + trimStart = visibleStart). */
  trimStart: number
  /** Visible (on-screen) length of the dragged clip. */
  dragDuration: number
  /** Visible extents of the other clips on the dragged clip's track. */
  siblings: { start: number; end: number }[]
  /** In/out points from every other track, used for magnetic alignment. */
  crossTrackSnapTargets: number[]
  partnerId: string | null
  partnerInitialStart: number
  partnerMinStart: number
  moved: boolean
}

export function useTimelineClipDragging({
  clipLayoutMap,
  timelineCanvasDuration,
  sequenceFps,
  tracks,
  setClipStarts,
  setTimelineSnapGuideSeconds,
  dispatchCommand,
}: UseTimelineClipDraggingParams) {
  const clipDragRef = React.useRef<ClipDragState | null>(null)
  // Set while a real drag (not a tap) just finished, so the trailing click the
  // browser fires does not get treated as "select clip".
  const clipJustDraggedRef = React.useRef(false)

  const clipPartnerId = React.useCallback(
    (clipId: string): string | null => {
      if (clipId.endsWith(AUDIO_LINK_SUFFIX)) {
        const base = baseClipId(clipId)
        return clipLayoutMap.has(base) ? base : null
      }
      const companion = clipId + AUDIO_LINK_SUFFIX
      return clipLayoutMap.has(companion) ? companion : null
    },
    [clipLayoutMap],
  )

  const onClipPointerDown = React.useCallback(
    (clipId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      const container = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-clip-track]")
      const rect = container?.getBoundingClientRect()
      if (!container || !rect || rect.width <= 0 || timelineCanvasDuration <= 0) return

      const layout = clipLayoutMap.get(clipId)
      const partnerId = clipPartnerId(clipId)
      const partnerLayout = partnerId ? clipLayoutMap.get(partnerId) : null
      const sourceTrack = tracks.find((track) => track.clipIds.includes(clipId))
      const siblings = (sourceTrack?.clipIds ?? [])
        .filter((id) => id !== clipId)
        .map((id) => clipLayoutMap.get(id))
        .filter((layoutItem): layoutItem is ClipLayout => Boolean(layoutItem))
        .map((layoutItem) => ({
          start: layoutItem.visibleStart,
          end: layoutItem.visibleStart + layoutItem.duration,
        }))

      const excludedIds = new Set([clipId, ...(partnerId ? [partnerId] : [])])
      const crossTrackSnapTargets = new Set<number>()
      for (const track of tracks) {
        if (track.id === sourceTrack?.id) continue
        for (const otherId of track.clipIds) {
          if (excludedIds.has(otherId)) continue
          const other = clipLayoutMap.get(otherId)
          if (!other) continue
          crossTrackSnapTargets.add(other.visibleStart)
          crossTrackSnapTargets.add(other.visibleStart + other.duration)
        }
      }

      setTimelineSnapGuideSeconds(null)
      clipDragRef.current = {
        clipId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initialStart: layout?.slotStart ?? 0,
        minStart: -(layout?.trim.start ?? 0),
        pxPerSecond: rect.width / timelineCanvasDuration,
        sourceTrackType: (container.dataset.clipTrackType as TrackType) ?? "media",
        trimStart: layout?.trim.start ?? 0,
        dragDuration: layout?.duration ?? 0,
        siblings,
        crossTrackSnapTargets: [...crossTrackSnapTargets],
        partnerId,
        partnerInitialStart: partnerLayout?.slotStart ?? 0,
        partnerMinStart: -(partnerLayout?.trim.start ?? 0),
        moved: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      clipLayoutMap,
      clipPartnerId,
      setTimelineSnapGuideSeconds,
      timelineCanvasDuration,
      tracks,
    ],
  )

  const resolveDraggedStart = React.useCallback(
    (drag: ClipDragState, deltaX: number) => {
      const deltaSeconds = deltaX / drag.pxPerSecond
      const proposedSlot = snapTimeToFrame(drag.initialStart + deltaSeconds, sequenceFps)
      const sameTrackVisible = resolveClipPlacement(
        proposedSlot + drag.trimStart,
        drag.dragDuration,
        drag.siblings,
        CLIP_SNAP_PX / drag.pxPerSecond,
      )
      const crossTrackSnap = resolveCrossTrackSnap(
        sameTrackVisible,
        drag.dragDuration,
        drag.crossTrackSnapTargets,
        CROSS_TRACK_SNAP_PX / drag.pxPerSecond,
      )
      const resolvedVisible = resolveClipPlacement(
        crossTrackSnap.visibleStart,
        drag.dragDuration,
        drag.siblings,
        0,
      )
      const guideTime =
        crossTrackSnap.guideTime != null && Math.abs(resolvedVisible - crossTrackSnap.visibleStart) < 1e-4
          ? crossTrackSnap.guideTime
          : null
      const clipStart = Math.max(drag.minStart, resolvedVisible - drag.trimStart)
      const effectiveDelta = clipStart - drag.initialStart
      const partnerStart =
        drag.partnerId != null
          ? Math.max(
              drag.partnerMinStart,
              snapTimeToFrame(drag.partnerInitialStart + effectiveDelta, sequenceFps),
            )
          : null
      return { clipStart, partnerStart, guideTime }
    },
    [sequenceFps],
  )

  const onClipPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = clipDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      if (!drag.moved && Math.hypot(deltaX, deltaY) < CLIP_DRAG_THRESHOLD_PX) return
      drag.moved = true
      event.preventDefault()

      const { clipStart, partnerStart, guideTime } = resolveDraggedStart(drag, deltaX)
      setTimelineSnapGuideSeconds((current) => (current === guideTime ? current : guideTime))
      setClipStarts((current) => {
        const next = { ...current, [drag.clipId]: clipStart }
        if (drag.partnerId && partnerStart != null) next[drag.partnerId] = partnerStart
        return next
      })
    },
    [resolveDraggedStart, setClipStarts, setTimelineSnapGuideSeconds],
  )

  const onClipPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = clipDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      clipDragRef.current = null
      setTimelineSnapGuideSeconds(null)
      if (!drag.moved) return
      clipJustDraggedRef.current = true

      const { clipStart } = resolveDraggedStart(drag, event.clientX - drag.startX)
      const visibleStartSeconds = clipStart + drag.trimStart
      const dropContainer = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-clip-track]")
      const targetTrackId = dropContainer?.dataset.clipTrack
      const targetTrackType = dropContainer?.dataset.clipTrackType as TrackType | undefined
      const sourceTrack = tracks.find((track) => track.clipIds.includes(drag.clipId))
      const crossTrack =
        Boolean(targetTrackId) &&
        targetTrackId !== sourceTrack?.id &&
        targetTrackType === drag.sourceTrackType

      dispatchCommand({
        type: "move_clip",
        clipId: drag.clipId,
        startFrame: secondsToFrames(visibleStartSeconds, sequenceFps),
        ...(crossTrack && targetTrackId ? { trackId: targetTrackId } : {}),
      })
    },
    [resolveDraggedStart, tracks, sequenceFps, dispatchCommand, setTimelineSnapGuideSeconds],
  )

  return {
    clipJustDraggedRef,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
  }
}
