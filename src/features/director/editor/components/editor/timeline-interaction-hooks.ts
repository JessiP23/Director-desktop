"use client"

import * as React from "react"
import {
  normalizeVisibleSeconds,
  snapTimeToFrame,
  type SequenceFps,
} from "../../lib/editor-view-utils"

type UseTimelinePanelInteractionsParams = {
  timelineHeight: number
  setTimelineHeight: React.Dispatch<React.SetStateAction<number>>
  setTimelineVisibleSeconds: React.Dispatch<React.SetStateAction<number>>
  sequenceFps: SequenceFps
  timelineCanvasDuration: number
  setTimelinePlayheadSeconds: React.Dispatch<React.SetStateAction<number>>
}

export function useTimelinePanelInteractions({
  timelineHeight,
  setTimelineHeight,
  setTimelineVisibleSeconds,
  sequenceFps,
  timelineCanvasDuration,
  setTimelinePlayheadSeconds,
}: UseTimelinePanelInteractionsParams) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const timelineScrubberRef = React.useRef<HTMLDivElement | null>(null)
  const timelinePointerRef = React.useRef<number | null>(null)
  const resizeDragRef = React.useRef<{ startY: number; startHeight: number } | null>(null)

  const zoomTimeline = React.useCallback(
    (direction: "in" | "out") => {
      setTimelineVisibleSeconds((current) => {
        const next = direction === "in" ? current / 1.5 : current * 1.5
        return normalizeVisibleSeconds(Number(next.toFixed(2)))
      })
    },
    [setTimelineVisibleSeconds],
  )

  const scrubTimeline = React.useCallback(
    (clientX: number) => {
      const bounds = timelineScrubberRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return
      const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1)
      const nextSeconds = ratio * timelineCanvasDuration
      setTimelinePlayheadSeconds(snapTimeToFrame(nextSeconds, sequenceFps))
    },
    [sequenceFps, setTimelinePlayheadSeconds, timelineCanvasDuration],
  )

  const onTimelinePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest("[data-timeline-interactive='true']")) return
      timelinePointerRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      scrubTimeline(event.clientX)
    },
    [scrubTimeline],
  )

  const onTimelinePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (timelinePointerRef.current !== event.pointerId) return
      scrubTimeline(event.clientX)
    },
    [scrubTimeline],
  )

  const onTimelinePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (timelinePointerRef.current !== event.pointerId) return
    timelinePointerRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const onHandlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      resizeDragRef.current = { startY: event.clientY, startHeight: timelineHeight }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [timelineHeight],
  )

  const onHandlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeDragRef.current) return
      // Dragging up grows the timeline, dragging down shrinks it.
      const delta = resizeDragRef.current.startY - event.clientY
      const containerHeight = containerRef.current?.clientHeight ?? 0
      const max = containerHeight > 0 ? containerHeight - 240 : 640
      const next = Math.min(
        Math.max(resizeDragRef.current.startHeight + delta, 140),
        Math.max(max, 140),
      )
      setTimelineHeight(next)
    },
    [setTimelineHeight],
  )

  const onHandlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeDragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return {
    containerRef,
    timelineScrubberRef,
    zoomTimeline,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
  }
}
