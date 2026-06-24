"use client"

import * as React from "react"
import type { EditorCommand } from "@/lib/editor"
import {
  CLIP_CENTER_SNAP_PERCENT,
  MAX_CLIP_OFFSET,
  MAX_CLIP_SCALE,
  MIN_CLIP_SCALE,
  MIN_CROP_REMAINING,
  baseClipId,
  clampSeconds,
  snapToGuide,
  type ClipCrop,
  type ClipTransform,
  type GuideX,
  type GuideY,
} from "../../lib/editor-view-utils"

type UsePreviewEditingParams = {
  getClipTransform: (clipId: string) => ClipTransform
  getClipCrop: (clipId: string) => ClipCrop
  setClipTransforms: React.Dispatch<React.SetStateAction<Record<string, ClipTransform>>>
  setClipCrops: React.Dispatch<React.SetStateAction<Record<string, ClipCrop>>>
  dispatchCommand: (command: EditorCommand) => boolean
}

type TransformDragState = {
  clipId: string
  mode: "move" | "resize"
  pointerId: number
  startX: number
  startY: number
  boxWidth: number
  boxHeight: number
  centerX: number
  centerY: number
  initialDistance: number
  initial: ClipTransform
  // Live preview updates local state on move; pointer-up commits this final
  // transform through the canonical command engine.
  last: ClipTransform | null
}

type CropDragState = {
  clipId: string
  edge: "top" | "right" | "bottom" | "left"
  pointerId: number
  startX: number
  startY: number
  boxWidth: number
  boxHeight: number
  initial: ClipCrop
  // Live preview updates local state on move; pointer-up commits this final crop.
  last: ClipCrop | null
}

export function usePreviewEditing({
  getClipTransform,
  getClipCrop,
  setClipTransforms,
  setClipCrops,
  dispatchCommand,
}: UsePreviewEditingParams) {
  const previewBoxRef = React.useRef<HTMLDivElement | null>(null)
  const transformDragRef = React.useRef<TransformDragState | null>(null)
  const cropDragRef = React.useRef<CropDragState | null>(null)
  const [alignGuides, setAlignGuides] = React.useState<{ x: GuideX | null; y: GuideY | null }>({
    x: null,
    y: null,
  })

  const onTransformPointerDown = React.useCallback(
    (clipId: string, mode: "move" | "resize", event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const box = previewBoxRef.current?.getBoundingClientRect()
      if (!box || box.width <= 0 || box.height <= 0) return

      const initial = getClipTransform(clipId)
      // Resize keeps the clip's centre fixed, so the pointer's distance from
      // that centre becomes the scale anchor.
      const centerX = box.left + box.width * (0.5 + initial.x / 100)
      const centerY = box.top + box.height * (0.5 + initial.y / 100)
      transformDragRef.current = {
        clipId,
        mode,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        boxWidth: box.width,
        boxHeight: box.height,
        centerX,
        centerY,
        initialDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
        initial,
        last: null,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [getClipTransform],
  )

  const onTransformPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = transformDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()

      if (drag.mode === "move") {
        const dx = ((event.clientX - drag.startX) / drag.boxWidth) * 100
        const dy = ((event.clientY - drag.startY) / drag.boxHeight) * 100
        let nextX = clampSeconds(drag.initial.x + dx, -MAX_CLIP_OFFSET, MAX_CLIP_OFFSET)
        let nextY = clampSeconds(drag.initial.y + dy, -MAX_CLIP_OFFSET, MAX_CLIP_OFFSET)
        // Snap the clip centre or edges to the preview frame centre/edges.
        const half = 50 * drag.initial.scale
        const snapX = snapToGuide<GuideX>(
          nextX,
          [
            { target: 0, guide: "center" },
            { target: half - 50, guide: "left" },
            { target: 50 - half, guide: "right" },
          ],
          CLIP_CENTER_SNAP_PERCENT,
        )
        const snapY = snapToGuide<GuideY>(
          nextY,
          [
            { target: 0, guide: "center" },
            { target: half - 50, guide: "top" },
            { target: 50 - half, guide: "bottom" },
          ],
          CLIP_CENTER_SNAP_PERCENT,
        )
        nextX = snapX.value
        nextY = snapY.value
        setAlignGuides((current) =>
          current.x === snapX.guide && current.y === snapY.guide
            ? current
            : { x: snapX.guide, y: snapY.guide },
        )
        const next: ClipTransform = { scale: drag.initial.scale, x: nextX, y: nextY }
        drag.last = next
        setClipTransforms((current) => ({ ...current, [drag.clipId]: next }))
        return
      }

      const distance = Math.hypot(event.clientX - drag.centerX, event.clientY - drag.centerY)
      const next: ClipTransform = {
        ...drag.initial,
        scale: clampSeconds(
          drag.initial.scale * (distance / drag.initialDistance),
          MIN_CLIP_SCALE,
          MAX_CLIP_SCALE,
        ),
      }
      drag.last = next
      setClipTransforms((current) => ({ ...current, [drag.clipId]: next }))
    },
    [setClipTransforms],
  )

  const onTransformPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = transformDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      transformDragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      setAlignGuides((current) => (current.x || current.y ? { x: null, y: null } : current))

      const next = drag.last
      if (!next) return
      dispatchCommand({
        type: "set_clip_properties",
        clipId: baseClipId(drag.clipId),
        patch: { transform: next },
      })
    },
    [dispatchCommand],
  )

  const resetClipTransform = React.useCallback(
    (clipId: string) => {
      setClipTransforms((current) => {
        if (!current[clipId]) return current
        const next = { ...current }
        delete next[clipId]
        return next
      })
    },
    [setClipTransforms],
  )

  const onCropPointerDown = React.useCallback(
    (
      clipId: string,
      edge: "top" | "right" | "bottom" | "left",
      event: React.PointerEvent<HTMLElement>,
    ) => {
      event.preventDefault()
      event.stopPropagation()
      const box = previewBoxRef.current?.getBoundingClientRect()
      if (!box || box.width <= 0 || box.height <= 0) return
      cropDragRef.current = {
        clipId,
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        boxWidth: box.width,
        boxHeight: box.height,
        initial: getClipCrop(clipId),
        last: null,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [getClipCrop],
  )

  const onCropPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = cropDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      const dxPct = ((event.clientX - drag.startX) / drag.boxWidth) * 100
      const dyPct = ((event.clientY - drag.startY) / drag.boxHeight) * 100
      const next: ClipCrop = { ...drag.initial }

      if (drag.edge === "left") {
        next.left = clampSeconds(drag.initial.left + dxPct, 0, 100 - drag.initial.right - MIN_CROP_REMAINING)
      } else if (drag.edge === "right") {
        next.right = clampSeconds(drag.initial.right - dxPct, 0, 100 - drag.initial.left - MIN_CROP_REMAINING)
      } else if (drag.edge === "top") {
        next.top = clampSeconds(drag.initial.top + dyPct, 0, 100 - drag.initial.bottom - MIN_CROP_REMAINING)
      } else {
        next.bottom = clampSeconds(drag.initial.bottom - dyPct, 0, 100 - drag.initial.top - MIN_CROP_REMAINING)
      }

      drag.last = next
      setClipCrops((current) => ({ ...current, [drag.clipId]: next }))
    },
    [setClipCrops],
  )

  const onCropPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = cropDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      cropDragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)

      const next = drag.last
      if (!next) return
      dispatchCommand({
        type: "set_clip_properties",
        clipId: baseClipId(drag.clipId),
        patch: { crop: next },
      })
    },
    [dispatchCommand],
  )

  const resetClipCrop = React.useCallback(
    (clipId: string) => {
      setClipCrops((current) => {
        if (!current[clipId]) return current
        const next = { ...current }
        delete next[clipId]
        return next
      })
    },
    [setClipCrops],
  )

  return {
    previewBoxRef,
    alignGuides,
    onTransformPointerDown,
    onTransformPointerMove,
    onTransformPointerUp,
    resetClipTransform,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    resetClipCrop,
  }
}
