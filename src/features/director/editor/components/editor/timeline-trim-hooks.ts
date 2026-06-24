"use client"

import * as React from "react"
import {
  secondsToFrames,
  type EditorCommand,
} from "@/lib/editor"
import {
  AUDIO_LINK_SUFFIX,
  MAX_TEXT_OVERLAY_SECONDS,
  MIN_TIMELINE_CLIP_SECONDS,
  baseClipId,
  clampSeconds,
  snapTimeToFrame,
  type ClipLayout,
  type ClipTrim,
  type EditorClip,
  type SequenceFps,
  type TextOverlay,
  type Track,
} from "../../lib/editor-view-utils"

type UseTimelineTrimEditingParams = {
  timelineScrubberRef: React.RefObject<HTMLDivElement | null>
  timelineCanvasDuration: number
  sequenceFps: SequenceFps
  clipsById: ReadonlyMap<string, EditorClip>
  clipLayoutMap: Map<string, ClipLayout>
  tracks: Track[]
  getClipSlotDuration: (clipId: string) => number
  getClipTrim: (clipId: string) => ClipTrim
  setClipStarts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setClipTrims: React.Dispatch<React.SetStateAction<Record<string, ClipTrim>>>
  setTextOverlays: React.Dispatch<React.SetStateAction<Record<string, TextOverlay>>>
  dispatchCommand: (command: EditorCommand) => boolean
}

type TrimDragState = {
  clipId: string
  edge: "start" | "end"
  pointerId: number
  startX: number
  initialTrim: ClipTrim
  sourceDuration: number
  partnerId: string | null
  // Text overlays resize instead of trimming media, so we track their visible
  // slot and the room left by neighbouring text clips.
  isText: boolean
  initialStart: number
  initialDuration: number
  leftBound: number
  rightBound: number
}

export function useTimelineTrimEditing({
  timelineScrubberRef,
  timelineCanvasDuration,
  sequenceFps,
  clipsById,
  clipLayoutMap,
  tracks,
  getClipSlotDuration,
  getClipTrim,
  setClipStarts,
  setClipTrims,
  setTextOverlays,
  dispatchCommand,
}: UseTimelineTrimEditingParams) {
  const trimDragRef = React.useRef<TrimDragState | null>(null)

  const onTrimPointerDown = React.useCallback(
    (clipId: string, edge: "start" | "end", event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const sourceDuration = getClipSlotDuration(clipId)
      const isText = clipsById.get(clipId)?.kind === "text"
      const layout = clipLayoutMap.get(clipId)
      const partnerId = clipId.endsWith(AUDIO_LINK_SUFFIX)
        ? (clipLayoutMap.has(baseClipId(clipId)) ? baseClipId(clipId) : null)
        : (clipLayoutMap.has(clipId + AUDIO_LINK_SUFFIX) ? clipId + AUDIO_LINK_SUFFIX : null)

      let leftBound = 0
      let rightBound = MAX_TEXT_OVERLAY_SECONDS
      if (isText && layout) {
        const left = layout.visibleStart
        const right = layout.visibleStart + layout.duration
        const track = tracks.find((trackItem) => trackItem.clipIds.includes(clipId))
        for (const siblingId of track?.clipIds ?? []) {
          if (siblingId === clipId) continue
          const sibling = clipLayoutMap.get(siblingId)
          if (!sibling) continue
          const siblingStart = sibling.visibleStart
          const siblingEnd = sibling.visibleStart + sibling.duration
          if (siblingEnd <= left + 1e-4) leftBound = Math.max(leftBound, siblingEnd)
          if (siblingStart >= right - 1e-4) rightBound = Math.min(rightBound, siblingStart)
        }
      }

      trimDragRef.current = {
        clipId,
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        initialTrim: getClipTrim(clipId),
        sourceDuration,
        partnerId,
        isText,
        initialStart: layout?.visibleStart ?? 0,
        initialDuration: layout?.duration ?? sourceDuration,
        leftBound,
        rightBound,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [getClipSlotDuration, getClipTrim, clipsById, clipLayoutMap, tracks],
  )

  const resolveTrimSeconds = React.useCallback(
    (drag: TrimDragState, clientX: number): ClipTrim => {
      const bounds = timelineScrubberRef.current?.getBoundingClientRect()
      const width = bounds && bounds.width > 0 ? bounds.width : 0
      const deltaSeconds = width > 0 ? ((clientX - drag.startX) / width) * timelineCanvasDuration : 0
      const maxTrimmedStart = Math.max(0, drag.sourceDuration - drag.initialTrim.end - MIN_TIMELINE_CLIP_SECONDS)
      const maxTrimmedEnd = Math.max(0, drag.sourceDuration - drag.initialTrim.start - MIN_TIMELINE_CLIP_SECONDS)
      return drag.edge === "start"
        ? {
            ...drag.initialTrim,
            start: clampSeconds(
              snapTimeToFrame(drag.initialTrim.start + deltaSeconds, sequenceFps),
              0,
              maxTrimmedStart,
            ),
          }
        : {
            ...drag.initialTrim,
            end: clampSeconds(
              snapTimeToFrame(drag.initialTrim.end - deltaSeconds, sequenceFps),
              0,
              maxTrimmedEnd,
            ),
          }
    },
    [sequenceFps, timelineCanvasDuration, timelineScrubberRef],
  )

  const onTrimPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      const drag = trimDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopPropagation()

      const bounds = timelineScrubberRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return
      const deltaSeconds = ((event.clientX - drag.startX) / bounds.width) * timelineCanvasDuration

      if (drag.isText) {
        const right = drag.initialStart + drag.initialDuration
        if (drag.edge === "end") {
          const maxRight = Math.min(drag.rightBound, drag.initialStart + MAX_TEXT_OVERLAY_SECONDS)
          const nextRight = clampSeconds(
            snapTimeToFrame(right + deltaSeconds, sequenceFps),
            drag.initialStart + MIN_TIMELINE_CLIP_SECONDS,
            maxRight,
          )
          setTextOverlays((current) => {
            const existing = current[drag.clipId]
            if (!existing) return current
            return { ...current, [drag.clipId]: { ...existing, duration: nextRight - drag.initialStart } }
          })
        } else {
          const minLeft = Math.max(drag.leftBound, right - MAX_TEXT_OVERLAY_SECONDS)
          const nextLeft = clampSeconds(
            snapTimeToFrame(drag.initialStart + deltaSeconds, sequenceFps),
            minLeft,
            right - MIN_TIMELINE_CLIP_SECONDS,
          )
          setClipStarts((current) => ({ ...current, [drag.clipId]: nextLeft }))
          setTextOverlays((current) => {
            const existing = current[drag.clipId]
            if (!existing) return current
            return { ...current, [drag.clipId]: { ...existing, duration: right - nextLeft } }
          })
        }
        return
      }

      const nextTrim = resolveTrimSeconds(drag, event.clientX)
      setClipTrims((current) => ({
        ...current,
        [drag.clipId]: nextTrim,
        ...(drag.partnerId ? { [drag.partnerId]: nextTrim } : {}),
      }))
    },
    [
      sequenceFps,
      timelineCanvasDuration,
      timelineScrubberRef,
      resolveTrimSeconds,
      setClipStarts,
      setClipTrims,
      setTextOverlays,
    ],
  )

  const onTrimPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      const drag = trimDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      trimDragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      // Text overlays resize live; media trims commit through the same command
      // engine used by the agent, which keeps linked audio in lockstep.
      if (drag.isText) return

      const nextTrim = resolveTrimSeconds(drag, event.clientX)
      if (nextTrim.start === drag.initialTrim.start && nextTrim.end === drag.initialTrim.end) return
      dispatchCommand({
        type: "set_clip_properties",
        clipId: baseClipId(drag.clipId),
        patch: {
          trimStartFrame: secondsToFrames(nextTrim.start, sequenceFps),
          trimEndFrame: secondsToFrames(nextTrim.end, sequenceFps),
        },
      })
    },
    [resolveTrimSeconds, dispatchCommand, sequenceFps],
  )

  return { onTrimPointerDown, onTrimPointerMove, onTrimPointerUp }
}
