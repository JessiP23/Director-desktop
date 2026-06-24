"use client"

import * as React from "react"
import { useTranslations } from "@/lib/i18n"
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ArrowsPointingOutIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  FilmIcon,
  MinusIcon,
  MusicalNoteIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ScissorsIcon,
  SparklesIcon,
  StopIcon,
  TrashIcon,
  ViewfinderCircleIcon,
  XMarkIcon,
} from "@/features/director/editor/icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { enqueueThumbnailExtraction } from "@/lib/thumbnail-queue"
import { cn } from "@/lib/utils/cn"
import {
  MAX_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE,
  TEXT_FONT_FAMILIES,
  formatTime,
  prettyToolName,
  syncMediaElementTime,
  videoPreviewUrl,
  type ClipCrop,
  type ClipLayout,
  type ClipTransform,
  type EditorClip,
  type GuideX,
  type GuideY,
  type PreviewEditMode,
  type TextOverlay,
  type Track,
  type TrackType,
} from "../../lib/editor-view-utils"

// Decorative waveform used as the audio "preview". Heights are fixed so the
// shape is stable across renders (a real PCM analysis would be overkill here).
const WAVEFORM_BARS = [
  0.35, 0.6, 0.45, 0.8, 0.55, 0.95, 0.4, 0.7, 0.5, 0.85, 0.3, 0.65, 0.5, 0.9, 0.45,
  0.75, 0.4, 0.6, 0.55, 0.8, 0.35, 0.7, 0.5, 0.6,
]

export function Waveform({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center gap-[2px] px-1", className)}>
      {WAVEFORM_BARS.map((height, index) => (
        <span
          key={index}
          style={{ height: `${Math.round(height * 100)}%` }}
          className="w-[2px] shrink-0 rounded-full bg-emerald-300/70"
        />
      ))}
    </div>
  )
}

export function TimelineClip({
  layout,
  clip,
  overlay,
  isActive,
  timelineCanvasDuration,
  timePrecision,
  onSelect,
  onRemove,
  onClipPointerDown,
  onClipPointerMove,
  onClipPointerUp,
  onTrimPointerDown,
  onTrimPointerMove,
  onTrimPointerUp,
}: {
  layout: ClipLayout
  clip: EditorClip
  overlay?: TextOverlay
  isActive: boolean
  timelineCanvasDuration: number
  timePrecision: number
  onSelect: (clipId: string, visibleStart: number) => void
  onRemove: (clipId: string) => void
  onClipPointerDown: (clipId: string, event: React.PointerEvent<HTMLButtonElement>) => void
  onClipPointerMove: React.PointerEventHandler<HTMLButtonElement>
  onClipPointerUp: React.PointerEventHandler<HTMLButtonElement>
  onTrimPointerDown: (
    clipId: string,
    edge: "start" | "end",
    event: React.PointerEvent<HTMLSpanElement>,
  ) => void
  onTrimPointerMove: React.PointerEventHandler<HTMLSpanElement>
  onTrimPointerUp: React.PointerEventHandler<HTMLSpanElement>
}) {
  const t = useTranslations("director.editor")
  const { duration, visibleStart, trim, sourceDuration } = layout
  const isVideo = clip.kind === "video"
  const isAudio = clip.kind === "audio"
  const isText = clip.kind === "text"
  const hasTrim = trim.start > 0.05 || trim.end > 0.05
  const leftPercent = timelineCanvasDuration > 0 ? (visibleStart / timelineCanvasDuration) * 100 : 0
  const widthPercent = timelineCanvasDuration > 0 ? (duration / timelineCanvasDuration) * 100 : 100
  const title = hasTrim
    ? `${prettyToolName(clip.toolName)} · ${formatTime(duration, timePrecision)} / ${formatTime(sourceDuration, timePrecision)}`
    : `${prettyToolName(clip.toolName)} · ${formatTime(duration, timePrecision)}`

  const renderTrimHandle = (edge: "start" | "end") => (
    <span
      data-timeline-interactive="true"
      onPointerDown={(event) => onTrimPointerDown(clip.id, edge, event)}
      onPointerMove={onTrimPointerMove}
      onPointerUp={onTrimPointerUp}
      onPointerCancel={onTrimPointerUp}
      className={cn(
        "absolute top-0 z-20 h-full w-3 cursor-ew-resize touch-none bg-[#f4f4f5]/0 transition-colors group-hover:bg-[#f4f4f5]/10",
        edge === "start" ? "left-0" : "right-0",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-[#f4f4f5]/55 opacity-0 transition-opacity group-hover:opacity-100",
          edge === "start" ? "left-1" : "right-1",
        )}
      />
    </span>
  )

  return (
    <button
      type="button"
      title={title}
      aria-label={prettyToolName(clip.toolName)}
      data-timeline-interactive="true"
      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
      onPointerDown={(event) => onClipPointerDown(clip.id, event)}
      onPointerMove={onClipPointerMove}
      onPointerUp={onClipPointerUp}
      onPointerCancel={onClipPointerUp}
      onClick={() => onSelect(clip.id, visibleStart)}
      className={cn(
        // No min-width: the clip's width stays strictly proportional to duration,
        // so flush clips render edge-to-edge and never visually overlap.
        "group absolute top-0 z-10 h-16 cursor-grab touch-none overflow-hidden rounded-lg border transition-colors active:cursor-grabbing",
        isText ? "bg-sky-500/20" : isAudio ? "bg-emerald-500/15" : "bg-black/50",
        isActive
          ? "border-[#f4f4f5]/80 ring-2 ring-[#f4f4f5]/30"
          : "border-[#f4f4f5]/10 hover:border-[#f4f4f5]/40",
      )}
    >
      {isVideo ? (
        <VideoTrackThumbnail url={clip.url} />
      ) : isAudio ? (
        <div className="h-full w-full py-2">
          <Waveform />
        </div>
      ) : isText ? (
        <div className="flex h-full w-full items-center gap-1.5 px-2">
          <ChatBubbleBottomCenterTextIcon className="h-3.5 w-3.5 shrink-0 text-sky-200/80" />
          <span className="truncate text-[11px] font-medium text-[#f4f4f5]/90">
            {overlay?.text || t("textDefault")}
          </span>
        </div>
      ) : (
        <ImageTrackThumbnail url={clip.url} />
      )}

      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 font-mono text-[9px] text-[#f4f4f5]/70">
        {formatTime(duration, timePrecision)}
      </span>
      <span
        role="button"
        tabIndex={-1}
        data-timeline-interactive="true"
        aria-label={t("removeClip")}
        title={t("removeClip")}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onRemove(clip.id)
        }}
        className="absolute right-1 top-1 z-30 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-black/60 text-[#f4f4f5]/80 opacity-0 transition hover:bg-black/80 hover:text-white group-hover:opacity-100"
      >
        <XMarkIcon className="h-2.5 w-2.5" />
      </span>
      {renderTrimHandle("start")}
      {renderTrimHandle("end")}
    </button>
  )
}

type PreviewRect = { left: number; top: number; width: number; height: number }
type ActiveTextOverlay = { overlay: TextOverlay; transform: ClipTransform }

export function PreviewStage({
  isOpen,
  aspectRatio,
  previewBoxRef,
  canvasRef,
  onTogglePlay,
  preloadAudioClips,
  poolAudioCallbackRef,
  previewClip,
  previewRect,
  previewCrop,
  isResizing,
  isCropping,
  previewClipIsTransformed,
  previewClipIsCropped,
  activeTextOverlays,
  selectedClipId,
  isPreviewPlaying,
  alignGuides,
  onTransformPointerDown,
  onTransformPointerMove,
  onTransformPointerUp,
  resetClipTransform,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
  resetClipCrop,
  onOpenTextEditor,
}: {
  isOpen: boolean
  aspectRatio: number
  previewBoxRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onTogglePlay: () => void
  preloadAudioClips: { id: string; url: string }[]
  poolAudioCallbackRef: (el: HTMLAudioElement | null) => void
  previewClip: EditorClip | null
  previewRect: PreviewRect
  previewCrop: ClipCrop
  isResizing: boolean
  isCropping: boolean
  previewClipIsTransformed: boolean
  previewClipIsCropped: boolean
  activeTextOverlays: ActiveTextOverlay[]
  selectedClipId: string | null
  isPreviewPlaying: boolean
  alignGuides: { x: GuideX | null; y: GuideY | null }
  onTransformPointerDown: (
    clipId: string,
    mode: "move" | "resize",
    event: React.PointerEvent<HTMLElement>,
  ) => void
  onTransformPointerMove: React.PointerEventHandler<HTMLElement>
  onTransformPointerUp: React.PointerEventHandler<HTMLElement>
  resetClipTransform: (clipId: string) => void
  onCropPointerDown: (
    clipId: string,
    edge: "top" | "right" | "bottom" | "left",
    event: React.PointerEvent<HTMLElement>,
  ) => void
  onCropPointerMove: React.PointerEventHandler<HTMLElement>
  onCropPointerUp: React.PointerEventHandler<HTMLElement>
  resetClipCrop: (clipId: string) => void
  onOpenTextEditor: () => void
}) {
  const t = useTranslations("director.editor")

  return (
    <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 self-stretch">
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <div
          ref={previewBoxRef}
          style={{ aspectRatio, containerType: "size" }}
          className="relative inline-flex h-full max-h-full max-w-full items-center justify-center overflow-hidden bg-black/60"
        >
          <canvas
            ref={canvasRef}
            onClick={onTogglePlay}
            className="absolute inset-0 h-full w-full"
          />

          {isOpen
            ? preloadAudioClips.map((clip) => (
                <audio
                  key={clip.id}
                  ref={poolAudioCallbackRef}
                  data-clip-id={clip.id}
                  src={clip.url}
                  preload="auto"
                />
              ))
            : null}

          {previewClip ? (
            <>
              {isResizing && (
                <div
                  className="absolute"
                  style={{
                    left: `${previewRect.left}%`,
                    top: `${previewRect.top}%`,
                    width: `${previewRect.width}%`,
                    height: `${previewRect.height}%`,
                  }}
                >
                  <div
                    onPointerDown={(event) => onTransformPointerDown(previewClip.id, "move", event)}
                    onPointerMove={onTransformPointerMove}
                    onPointerUp={onTransformPointerUp}
                    onPointerCancel={onTransformPointerUp}
                    onDoubleClick={() => resetClipTransform(previewClip.id)}
                    title={t("transformHint")}
                    className="absolute inset-0 cursor-move touch-none border border-[#f4f4f5]/80 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  />
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <span
                      key={corner}
                      onPointerDown={(event) => onTransformPointerDown(previewClip.id, "resize", event)}
                      onPointerMove={onTransformPointerMove}
                      onPointerUp={onTransformPointerUp}
                      onPointerCancel={onTransformPointerUp}
                      className={cn(
                        "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 touch-none rounded-sm border border-[#09090b] bg-[#f4f4f5]",
                        corner === "nw" && "left-0 top-0 cursor-nwse-resize",
                        corner === "ne" && "left-full top-0 cursor-nesw-resize",
                        corner === "sw" && "left-0 top-full cursor-nesw-resize",
                        corner === "se" && "left-full top-full cursor-nwse-resize",
                      )}
                    />
                  ))}
                </div>
              )}

              {isCropping && (
                <div
                  className="absolute"
                  style={{
                    left: `${previewRect.left}%`,
                    top: `${previewRect.top}%`,
                    width: `${previewRect.width}%`,
                    height: `${previewRect.height}%`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute border border-dashed border-[#f4f4f5]/80"
                    style={{
                      left: `${previewCrop.left}%`,
                      top: `${previewCrop.top}%`,
                      right: `${previewCrop.right}%`,
                      bottom: `${previewCrop.bottom}%`,
                    }}
                  />
                  {(["top", "right", "bottom", "left"] as const).map((edge) => {
                    const horizontal = edge === "top" || edge === "bottom"
                    const style: React.CSSProperties =
                      edge === "top"
                        ? { top: `${previewCrop.top}%`, left: `${previewCrop.left}%`, right: `${previewCrop.right}%` }
                        : edge === "bottom"
                          ? { bottom: `${previewCrop.bottom}%`, left: `${previewCrop.left}%`, right: `${previewCrop.right}%` }
                          : edge === "left"
                            ? { left: `${previewCrop.left}%`, top: `${previewCrop.top}%`, bottom: `${previewCrop.bottom}%` }
                            : { right: `${previewCrop.right}%`, top: `${previewCrop.top}%`, bottom: `${previewCrop.bottom}%` }
                    return (
                      <span
                        key={edge}
                        onPointerDown={(event) => onCropPointerDown(previewClip.id, edge, event)}
                        onPointerMove={onCropPointerMove}
                        onPointerUp={onCropPointerUp}
                        onPointerCancel={onCropPointerUp}
                        title={t("cropHint")}
                        style={style}
                        className={cn(
                          "absolute touch-none bg-[#f4f4f5]/0",
                          horizontal
                            ? "h-3 -translate-y-1/2 cursor-ns-resize"
                            : "w-3 -translate-x-1/2 cursor-ew-resize",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute rounded-full bg-[#f4f4f5]",
                            horizontal
                              ? "left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2"
                              : "left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2",
                          )}
                        />
                      </span>
                    )
                  })}
                </div>
              )}

              {isResizing && previewClipIsTransformed && (
                <button
                  type="button"
                  onClick={() => resetClipTransform(previewClip.id)}
                  title={t("resetTransform")}
                  aria-label={t("resetTransform")}
                  className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-[#f4f4f5]/80 transition-colors hover:bg-black/75 hover:text-[#f4f4f5]"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                </button>
              )}

              {isCropping && previewClipIsCropped && (
                <button
                  type="button"
                  onClick={() => resetClipCrop(previewClip.id)}
                  title={t("resetCrop")}
                  aria-label={t("resetCrop")}
                  className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-[#f4f4f5]/80 transition-colors hover:bg-black/75 hover:text-[#f4f4f5]"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="h-full w-full bg-black" />
          )}

          {activeTextOverlays.map(({ overlay, transform }) => {
            const isSelected = overlay.id === selectedClipId
            const draggable = isSelected && !isPreviewPlaying
            const motionClass =
              overlay.motion === "fade"
                ? "editor-text-motion-fade"
                : overlay.motion === "rise"
                  ? "editor-text-motion-rise"
                  : overlay.motion === "scale"
                    ? "editor-text-motion-scale"
                    : undefined
            return (
              <div
                key={overlay.id}
                onPointerDown={
                  draggable ? (event) => onTransformPointerDown(overlay.id, "move", event) : undefined
                }
                onPointerMove={draggable ? onTransformPointerMove : undefined}
                onPointerUp={draggable ? onTransformPointerUp : undefined}
                onPointerCancel={draggable ? onTransformPointerUp : undefined}
                style={{
                  left: `${50 + transform.x}%`,
                  top: `${50 + transform.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: `${overlay.fontSize}cqh`,
                  color: overlay.color,
                  fontFamily: TEXT_FONT_FAMILIES[overlay.fontFamily],
                  fontWeight: overlay.fontWeight,
                  fontStyle: overlay.italic ? "italic" : "normal",
                  textAlign: overlay.textAlign,
                  textShadow: overlay.shadow ? "0 2px 8px rgba(0,0,0,0.65)" : "none",
                }}
                className={cn(
                  "absolute z-20 max-w-[92%] whitespace-pre-wrap leading-tight",
                  draggable ? "cursor-move touch-none" : "pointer-events-none",
                  isSelected && "outline outline-1 outline-[#f4f4f5]/70 outline-offset-4",
                )}
              >
                <span className={cn("block", motionClass)}>{overlay.text || t("textDefault")}</span>
                {isSelected && !isPreviewPlaying && (
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenTextEditor()
                    }}
                    className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f4f4f5] px-2.5 py-1 font-sans text-[10px] font-medium not-italic leading-none text-[#09090b] shadow-lg [text-shadow:none] transition-transform hover:scale-105"
                  >
                    {t("textEdit")}
                  </button>
                )}
              </div>
            )
          })}

          {alignGuides.x && (
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 z-30 w-px bg-[#ff2d78]",
                alignGuides.x === "center" && "left-1/2 -translate-x-1/2",
                alignGuides.x === "left" && "left-0",
                alignGuides.x === "right" && "right-0",
              )}
            />
          )}
          {alignGuides.y && (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 z-30 h-px bg-[#ff2d78]",
                alignGuides.y === "center" && "top-1/2 -translate-y-1/2",
                alignGuides.y === "top" && "top-0",
                alignGuides.y === "bottom" && "bottom-0",
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function TransportControls({
  isPlayablePreview,
  isPreviewPlaying,
  playbackPositionSeconds,
  timelinePlaybackEnd,
  frameStepSeconds,
  timePrecision,
  onTogglePlay,
  onStop,
  onRestart,
  onSeek,
}: {
  isPlayablePreview: boolean
  isPreviewPlaying: boolean
  playbackPositionSeconds: number
  timelinePlaybackEnd: number
  frameStepSeconds: number
  timePrecision: number
  onTogglePlay: () => void
  onStop: () => void
  onRestart: () => void
  onSeek: (value: number) => void
}) {
  const t = useTranslations("director.editor")

  return (
    <div
      className={cn(
        "flex w-full max-w-3xl items-center gap-3 px-1 transition-opacity",
        !isPlayablePreview && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!isPlayablePreview}
        aria-label={isPreviewPlaying ? t("pause") : t("play")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-[#09090b] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isPreviewPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!isPlayablePreview}
        aria-label={t("stop")}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#f4f4f5]/70 transition-colors hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <StopIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRestart}
        disabled={!isPlayablePreview}
        aria-label={t("restart")}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#f4f4f5]/70 transition-colors hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ArrowPathIcon className="h-4 w-4" />
      </button>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#f4f4f5]/55">
        {formatTime(playbackPositionSeconds, timePrecision)}
      </span>
      <input
        type="range"
        min={0}
        max={timelinePlaybackEnd || 0}
        step={frameStepSeconds}
        value={playbackPositionSeconds}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={!isPlayablePreview}
        aria-label={t("seek")}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[#f4f4f5]/20 accent-[#f4f4f5] disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f4f4f5]"
      />
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#f4f4f5]/55">
        {formatTime(timelinePlaybackEnd, timePrecision)}
      </span>
    </div>
  )
}

export function TimelineToolbar({
  timelineVisibleSeconds,
  canSplitSelected,
  previewEditMode,
  hasPreviewClip,
  onZoom,
  onSplit,
  onToggleResizeMode,
  onToggleCropMode,
  onAddTrack,
}: {
  timelineVisibleSeconds: number
  canSplitSelected: boolean
  previewEditMode: PreviewEditMode
  hasPreviewClip: boolean
  onZoom: (direction: "in" | "out") => void
  onSplit: () => void
  onToggleResizeMode: () => void
  onToggleCropMode: () => void
  onAddTrack: (type: TrackType) => void
}) {
  const t = useTranslations("director.editor")

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onZoom("out")}
        aria-label="Zoom out timeline"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#f4f4f5]/50 transition-colors hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5]"
      >
        <MinusIcon className="h-3.5 w-3.5" />
      </button>
      <span className="w-12 text-center font-mono text-[10px] tabular-nums text-[#f4f4f5]/40">
        {timelineVisibleSeconds < 10
          ? `${timelineVisibleSeconds.toFixed(2)}s`
          : `${Math.round(timelineVisibleSeconds)}s`}
      </span>
      <button
        type="button"
        onClick={() => onZoom("in")}
        aria-label="Zoom in timeline"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#f4f4f5]/50 transition-colors hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5]"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
      <span className="mx-0.5 h-4 w-px bg-[#f4f4f5]/10" />
      <button
        type="button"
        onClick={onSplit}
        disabled={!canSplitSelected}
        aria-label={t("split")}
        title={t("split")}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#f4f4f5]/50 transition-colors hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#f4f4f5]/50"
      >
        <ScissorsIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleResizeMode}
        disabled={!hasPreviewClip}
        aria-pressed={previewEditMode === "resize"}
        aria-label={t("resizeMode")}
        title={t("resizeMode")}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          previewEditMode === "resize"
            ? "bg-[#f4f4f5] text-[#09090b]"
            : "text-[#f4f4f5]/50 hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5]",
        )}
      >
        <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleCropMode}
        disabled={!hasPreviewClip}
        aria-pressed={previewEditMode === "crop"}
        aria-label={t("cropMode")}
        title={t("cropMode")}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          previewEditMode === "crop"
            ? "bg-[#f4f4f5] text-[#09090b]"
            : "text-[#f4f4f5]/50 hover:bg-[#f4f4f5]/10 hover:text-[#f4f4f5]",
        )}
      >
        <ViewfinderCircleIcon className="h-3.5 w-3.5" />
      </button>
      <span className="mx-0.5 h-4 w-px bg-[#f4f4f5]/10" />
      <button
        type="button"
        onClick={() => onAddTrack("media")}
        className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5]/10 px-2.5 py-1 text-[11px] font-medium text-[#f4f4f5]/80 transition-colors hover:bg-[#f4f4f5]/20 hover:text-[#f4f4f5]"
      >
        <PlusIcon className="h-3 w-3" />
        <FilmIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onAddTrack("audio")}
        className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5]/10 px-2.5 py-1 text-[11px] font-medium text-[#f4f4f5]/80 transition-colors hover:bg-[#f4f4f5]/20 hover:text-[#f4f4f5]"
      >
        <PlusIcon className="h-3 w-3" />
        <MusicalNoteIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onAddTrack("text")}
        aria-label={t("addTextTrack")}
        title={t("addTextTrack")}
        className="inline-flex items-center gap-1 rounded-full bg-[#f4f4f5]/10 px-2.5 py-1 text-[11px] font-medium text-[#f4f4f5]/80 transition-colors hover:bg-[#f4f4f5]/20 hover:text-[#f4f4f5]"
      >
        <PlusIcon className="h-3 w-3" />
        <ChatBubbleBottomCenterTextIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

export function TimelineTrackLanes({
  timelineContentWidthPercent,
  timelineCanvasDuration,
  timelineRulerTicks,
  rulerStep,
  timePrecision,
  playheadPercent,
  timelineSnapGuideSeconds,
  orderedTracks,
  clipLayoutMap,
  addClipPlaceholderGap,
  addClipPlaceholderDuration,
  timelineScrubberRef,
  setPlayheadEl0,
  setPlayheadEl1,
  setPlayheadEl2,
  onTimelinePointerDown,
  onTimelinePointerMove,
  onTimelinePointerUp,
  renderClip,
  onAddText,
  onOpenAddClip,
  onRemoveTrack,
}: {
  timelineContentWidthPercent: number
  timelineCanvasDuration: number
  timelineRulerTicks: number[]
  rulerStep: number
  timePrecision: number
  playheadPercent: number
  timelineSnapGuideSeconds: number | null
  orderedTracks: Track[]
  clipLayoutMap: Map<string, ClipLayout>
  addClipPlaceholderGap: number
  addClipPlaceholderDuration: number
  timelineScrubberRef: React.RefObject<HTMLDivElement | null>
  setPlayheadEl0: (el: HTMLDivElement | null) => void
  setPlayheadEl1: (el: HTMLDivElement | null) => void
  setPlayheadEl2: (el: HTMLDivElement | null) => void
  onTimelinePointerDown: React.PointerEventHandler<HTMLDivElement>
  onTimelinePointerMove: React.PointerEventHandler<HTMLDivElement>
  onTimelinePointerUp: React.PointerEventHandler<HTMLDivElement>
  renderClip: (layout: ClipLayout) => React.ReactNode
  onAddText: (trackId: string) => void
  onOpenAddClip: (track: Track) => void
  onRemoveTrack: (trackId: string) => void
}) {
  const t = useTranslations("director.editor")

  return (
    <div
      onPointerDown={onTimelinePointerDown}
      onPointerMove={onTimelinePointerMove}
      onPointerUp={onTimelinePointerUp}
      onPointerCancel={onTimelinePointerUp}
      className="relative min-h-0 flex-1 select-none overflow-auto overscroll-contain"
    >
      <div
        style={{ width: `${timelineContentWidthPercent}%` }}
        className="relative min-h-full"
      >
        <div className="relative px-10">
          <div ref={timelineScrubberRef} className="relative h-6 px-2">
            <div
              ref={setPlayheadEl0}
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#f4f4f5]/70"
              style={{ left: `${playheadPercent}%` }}
            />
            <div
              ref={setPlayheadEl1}
              className="pointer-events-none absolute top-0 h-3 w-3 -translate-x-1/2 rounded-b-[4px] bg-[#f4f4f5]"
              style={{ left: `${playheadPercent}%` }}
            />
            {timelineRulerTicks.map((tick) => (
              <div
                key={tick.toFixed(3)}
                className="absolute top-1 flex -translate-x-1/2 flex-col items-center gap-1"
                style={{ left: `${timelineCanvasDuration ? (tick / timelineCanvasDuration) * 100 : 0}%` }}
              >
                <span className="h-1.5 w-px bg-[#f4f4f5]/25" />
                <span className="font-mono text-[9px] tabular-nums text-[#f4f4f5]/35">
                  {formatTime(tick, rulerStep < 1 ? timePrecision : 0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-20 px-10">
          <div className="relative h-full">
            <div
              ref={setPlayheadEl2}
              className="absolute bottom-0 top-0 w-px bg-[#f4f4f5]/65"
              style={{ left: `${playheadPercent}%` }}
            />
          </div>
        </div>

        {timelineSnapGuideSeconds != null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-30 px-10">
            <div className="relative h-full">
              <div
                className="absolute bottom-0 top-0 w-px bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]"
                style={{
                  left: `${timelineCanvasDuration ? (timelineSnapGuideSeconds / timelineCanvasDuration) * 100 : 0}%`,
                }}
              >
                <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b bg-amber-300 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-black">
                  {formatTime(timelineSnapGuideSeconds, timePrecision)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 mt-2 space-y-2 pb-2">
          {orderedTracks.map((track) => {
            const isTextTrack = track.type === "text"
            const trackLayouts = track.clipIds
              .map((id) => clipLayoutMap.get(id))
              .filter((layout): layout is ClipLayout => Boolean(layout))
            const trackEnd = trackLayouts.reduce(
              (end, layout) => Math.max(end, layout.slotStart + layout.sourceDuration),
              0,
            )
            const addCardLeft = timelineCanvasDuration > 0
              ? ((trackEnd + addClipPlaceholderGap) / timelineCanvasDuration) * 100
              : 0
            const addCardWidth = timelineCanvasDuration > 0
              ? (addClipPlaceholderDuration / timelineCanvasDuration) * 100
              : 10
            const TrackIcon =
              track.type === "media"
                ? FilmIcon
                : track.type === "audio"
                  ? MusicalNoteIcon
                  : ChatBubbleBottomCenterTextIcon

            return (
              <div
                key={track.id}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 rounded-xl bg-black/20 p-2"
              >
                <TrackIcon className="mx-auto h-3.5 w-3.5 text-[#f4f4f5]/40" />

                {/* Clips are positioned absolutely so they can be dragged anywhere
                    along the timeline. Empty lanes still render as drop targets. */}
                <div
                  data-clip-track={track.id}
                  data-clip-track-type={track.type}
                  className="relative h-16 w-full overflow-hidden rounded-lg bg-black/20"
                >
                  {trackLayouts.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        type="button"
                        data-timeline-interactive="true"
                        onClick={() => (isTextTrack ? onAddText(track.id) : onOpenAddClip(track))}
                        aria-label={isTextTrack ? t("addText") : t("addClip")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f5]/10 text-[#f4f4f5]/70 transition-colors hover:bg-[#f4f4f5]/20 hover:text-[#f4f4f5]"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {trackLayouts.map((layout) => renderClip(layout))}
                      <button
                        type="button"
                        data-timeline-interactive="true"
                        onClick={() => (isTextTrack ? onAddText(track.id) : onOpenAddClip(track))}
                        aria-label={isTextTrack ? t("addText") : t("addClip")}
                        title={isTextTrack ? t("addText") : t("addClip")}
                        style={{ left: `${addCardLeft}%`, width: `${addCardWidth}%` }}
                        className="absolute top-0 z-10 flex h-16 min-w-14 items-center justify-center rounded-lg bg-[#f4f4f5]/[0.055] text-[#f4f4f5]/45 transition-colors hover:bg-[#f4f4f5]/[0.1] hover:text-[#f4f4f5]/80"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  data-timeline-interactive="true"
                  onClick={() => onRemoveTrack(track.id)}
                  aria-label={t("removeTrack")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#f4f4f5]/40 transition-colors hover:bg-[#f4f4f5]/10 hover:text-red-300"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TimelineClipShimmer() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#202024]" aria-hidden="true">
      <div className="animate-shimmer absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
    </div>
  )
}

export function ImageTrackThumbnail({ url }: { url: string }) {
  const [isLoaded, setIsLoaded] = React.useState(false)

  return (
    <div className="relative h-full w-full">
      {!isLoaded && <TimelineClipShimmer />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "relative h-full w-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  )
}

export function VideoTrackThumbnail({ url }: { url: string }) {
  const [thumbnail, setThumbnail] = React.useState<{
    url: string
    dataUrl: string | null
    canUseVideoFallback: boolean
    status: "loading" | "ready" | "failed"
  }>({ url, dataUrl: null, canUseVideoFallback: false, status: "loading" })

  React.useEffect(() => {
    const abortController = new AbortController()

    void enqueueThumbnailExtraction(url, abortController).then((result) => {
      if (abortController.signal.aborted) return
      setThumbnail({
        url,
        dataUrl: result.dataUrl,
        canUseVideoFallback: result.success,
        status: result.success ? "ready" : "failed",
      })
    })

    return () => abortController.abort()
  }, [url])

  const isCurrentThumbnail = thumbnail.url === url

  if (!isCurrentThumbnail || thumbnail.status === "loading") {
    return <TimelineClipShimmer />
  }

  if (thumbnail.dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumbnail.dataUrl} alt="" className="h-full w-full object-cover" />
  }

  if (thumbnail.canUseVideoFallback) {
    return (
      <video
        src={videoPreviewUrl(url)}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black/35 text-[#f4f4f5]/30">
      <FilmIcon className="h-5 w-5" />
    </div>
  )
}

export function TextEditorDialog({
  open,
  overlay,
  background,
  textTransform,
  aspectRatio,
  onOpenChange,
  onChange,
  onDelete,
}: {
  open: boolean
  overlay: TextOverlay | null
  background: { url: string; kind: "image" | "video"; offset: number } | null
  textTransform: ClipTransform
  aspectRatio: number
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<Omit<TextOverlay, "id">>) => void
  onDelete: () => void
}) {
  const t = useTranslations("director.editor")
  if (!overlay) return null

  const fieldClass =
    "h-9 w-full rounded-lg bg-black/25 px-3 text-[12px] text-[#f4f4f5] outline-none ring-1 ring-white/[0.07] transition focus:ring-white/[0.18]"
  const motionClass =
    overlay.motion === "fade"
      ? "editor-text-motion-fade"
      : overlay.motion === "rise"
        ? "editor-text-motion-rise"
        : overlay.motion === "scale"
          ? "editor-text-motion-scale"
          : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-[20px] border-0 bg-[rgba(24,24,27,0.96)] p-0 text-[#f4f4f5] backdrop-blur-[72px] sm:max-w-4xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold">
            <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-sky-200/80" />
            {t("textEditorTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-6 p-6">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">
                {t("textPreview")}
              </span>
              <div
                style={{ aspectRatio, containerType: "size" }}
                className="relative mx-auto h-60 max-h-full max-w-full overflow-hidden bg-black/60"
              >
                {background?.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={background.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                )}
                {background?.kind === "video" && (
                  <video
                    key={`${background.url}-${background.offset}`}
                    src={background.url}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(event) => syncMediaElementTime(event.currentTarget, background.offset)}
                    onLoadedData={(event) => syncMediaElementTime(event.currentTarget, background.offset)}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
                <div
                  style={{
                    left: `${50 + textTransform.x}%`,
                    top: `${50 + textTransform.y}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${overlay.fontSize}cqh`,
                    color: overlay.color,
                    fontFamily: TEXT_FONT_FAMILIES[overlay.fontFamily],
                    fontWeight: overlay.fontWeight,
                    fontStyle: overlay.italic ? "italic" : "normal",
                    textAlign: overlay.textAlign,
                    textShadow: overlay.shadow ? "0 2px 8px rgba(0,0,0,0.65)" : "none",
                  }}
                  className="absolute z-10 max-w-[92%] whitespace-pre-wrap leading-tight"
                >
                  <span className={cn("block", motionClass)}>{overlay.text || t("textDefault")}</span>
                </div>
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">
                {t("textContent")}
              </span>
              <textarea
                value={overlay.text}
                onChange={(event) => onChange({ text: event.target.value })}
                placeholder={t("textPlaceholder")}
                rows={3}
                className="min-h-24 resize-none rounded-xl bg-black/25 px-4 py-3 text-[13px] leading-5 text-[#f4f4f5] outline-none ring-1 ring-white/[0.07] transition focus:ring-white/[0.18] placeholder:text-[#f4f4f5]/30"
              />
            </label>
          </div>

          <div className="grid content-start grid-cols-2 gap-x-4 gap-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textFont")}</span>
              <select value={overlay.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value as TextOverlay["fontFamily"] })} className={fieldClass}>
                <option value="sans">{t("textFontSans")}</option>
                <option value="serif">{t("textFontSerif")}</option>
                <option value="mono">{t("textFontMono")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textWeight")}</span>
              <select value={overlay.fontWeight} onChange={(event) => onChange({ fontWeight: Number(event.target.value) as TextOverlay["fontWeight"] })} className={fieldClass}>
                <option value={400}>{t("textWeightRegular")}</option>
                <option value={600}>{t("textWeightSemibold")}</option>
                <option value={700}>{t("textWeightBold")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">
                {t("textSize")}
                <span className="font-mono font-normal normal-case text-[#f4f4f5]/65">{overlay.fontSize}%</span>
              </span>
              <input type="range" min={MIN_TEXT_FONT_SIZE} max={MAX_TEXT_FONT_SIZE} step={0.5} value={overlay.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} className="h-9 w-full accent-[#f4f4f5]" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textColor")}</span>
              <span className="flex h-9 items-center gap-2 rounded-lg bg-black/25 px-2.5 ring-1 ring-white/[0.07]">
                <input type="color" value={overlay.color} onChange={(event) => onChange({ color: event.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="font-mono text-[11px] uppercase text-[#f4f4f5]/70">{overlay.color}</span>
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textStyle")}</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t("textItalic"), active: overlay.italic, patch: { italic: !overlay.italic }, italic: true },
                  { label: t("textShadow"), active: overlay.shadow, patch: { shadow: !overlay.shadow }, italic: false },
                ].map((item) => (
                  <button key={item.label} type="button" aria-pressed={item.active} onClick={() => onChange(item.patch)} className={cn("h-9 rounded-lg text-[11px] font-medium transition-colors", item.italic && "italic", item.active ? "bg-[#f4f4f5] text-[#09090b]" : "bg-white/[0.06] text-[#f4f4f5]/65 hover:bg-white/[0.1]")}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textAlign")}</span>
              <div className="grid grid-cols-3 gap-2">
                {(["left", "center", "right"] as const).map((alignment) => (
                  <button key={alignment} type="button" aria-label={t(`textAlign${alignment[0].toUpperCase()}${alignment.slice(1)}`)} aria-pressed={overlay.textAlign === alignment} onClick={() => onChange({ textAlign: alignment })} className={cn("h-9 rounded-lg text-[11px] font-medium transition-colors", overlay.textAlign === alignment ? "bg-[#f4f4f5] text-[#09090b]" : "bg-white/[0.06] text-[#f4f4f5]/65 hover:bg-white/[0.1]")}>{alignment === "left" ? "L" : alignment === "center" ? "C" : "R"}</button>
                ))}
              </div>
            </div>

            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">{t("textMotion")}</span>
              <select value={overlay.motion} onChange={(event) => onChange({ motion: event.target.value as TextOverlay["motion"] })} className={fieldClass}>
                <option value="none">{t("textMotionNone")}</option>
                <option value="fade">{t("textMotionFade")}</option>
                <option value="rise">{t("textMotionRise")}</option>
                <option value="scale">{t("textMotionScale")}</option>
              </select>
            </label>

            <div className="col-span-2 border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-500/[0.08] px-4 text-[11px] font-medium text-red-300/80 transition-colors hover:bg-red-500/[0.14] hover:text-red-200"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {t("textDelete")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Custom dropdown used by the preview's resolution / fps pickers, so they match
// the editor's styling instead of the browser's native <select>.
export function PreviewSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { label: string; value: T }[]
  onChange: (value: T) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  const active = options.find((option) => option.value === value)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
          isOpen ? "bg-black/30" : "bg-black/15 hover:bg-black/25",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">
          {label}
        </span>
        <span className="text-[11px] font-medium text-[#f4f4f5]/85">{active?.label ?? value}</span>
        <ChevronDownIcon
          className={cn("h-3 w-3 text-[#f4f4f5]/45 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-full overflow-hidden rounded-[12px] border border-white/[0.06] bg-[#27272a]">
          <ul className="max-h-64 overflow-y-auto p-1 scrollbar-hide">
            {options.map((option) => {
              const isActive = option.value === value
              return (
                <li key={String(option.value)}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-left text-[12px] transition-colors",
                      isActive
                        ? "bg-[#f4f4f5]/[0.1] text-[#f4f4f5]"
                        : "text-[#f4f4f5]/70 hover:bg-[#f4f4f5]/[0.06] hover:text-[#f4f4f5]",
                    )}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

type AddClipTab = "agent" | "upload"

export function AddClipDialog({
  target,
  trackClipIds,
  pool,
  tab,
  isUploading,
  onClose,
  onTabChange,
  onAddClip,
  onUploadFiles,
}: {
  target: Track | null
  trackClipIds: readonly string[]
  pool: EditorClip[]
  tab: AddClipTab
  isUploading: boolean
  onClose: () => void
  onTabChange: (tab: AddClipTab) => void
  onAddClip: React.MouseEventHandler<HTMLButtonElement>
  onUploadFiles: (files: FileList | null) => void
}) {
  const t = useTranslations("director.editor")

  if (!target) return null

  const accept = target.type === "audio" ? "audio/*" : "image/*,video/*"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="gap-0 overflow-hidden rounded-[20px] border-0 bg-[rgba(24,24,27,0.92)] p-0 text-[#f4f4f5] backdrop-blur-[72px] sm:max-w-md">
        <DialogHeader className="px-4 pb-2 pt-3">
          <DialogTitle className="text-[15px] font-semibold text-[#f4f4f5]">
            {t("addClipTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-[#f4f4f5]/10">
          <button
            type="button"
            onClick={() => onTabChange("agent")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
              tab === "agent"
                ? "border-b-2 border-[#f4f4f5] text-[#f4f4f5]"
                : "text-[#f4f4f5]/60 hover:text-[#f4f4f5]/80",
            )}
          >
            <SparklesIcon className="h-4 w-4" />
            {t("addClipFromAgent")}
          </button>
          <button
            type="button"
            onClick={() => onTabChange("upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
              tab === "upload"
                ? "border-b-2 border-[#f4f4f5] text-[#f4f4f5]"
                : "text-[#f4f4f5]/60 hover:text-[#f4f4f5]/80",
            )}
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {t("addClipFromDevice")}
          </button>
        </div>

        <div className="p-3">
          {tab === "agent" ? (
            pool.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-[14px] bg-[#f4f4f5]/[0.04] text-[13px] text-[#f4f4f5]/40">
                {t("addClipEmpty")}
              </div>
            ) : (
              <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto pr-1">
                {pool.map((clip) => {
                  const added = trackClipIds.includes(clip.id)
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      disabled={added}
                      data-track-id={target.id}
                      data-clip-id={clip.id}
                      onClick={onAddClip}
                      title={prettyToolName(clip.toolName)}
                      className={cn(
                        "relative flex aspect-video items-center justify-center overflow-hidden rounded-[10px] border bg-black/30 transition-all",
                        added
                          ? "border-[#f4f4f5]/60 opacity-50"
                          : "border-[#f4f4f5]/10 hover:border-[#f4f4f5]/50",
                      )}
                    >
                      {clip.kind === "video" ? (
                        <video src={clip.url} muted preload="metadata" className="h-full w-full object-cover" />
                      ) : clip.kind === "audio" ? (
                        <MusicalNoteIcon className="h-6 w-6 text-[#f4f4f5]/40" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={clip.url} alt="" className="h-full w-full object-cover" />
                      )}
                      {added && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold text-[#f4f4f5]">
                          {t("addClipAdded")}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <label
              className={cn(
                "flex h-40 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#f4f4f5]/15 bg-[#f4f4f5]/[0.04] text-[#f4f4f5]/60 transition-colors",
                isUploading
                  ? "cursor-wait"
                  : "cursor-pointer hover:border-[#f4f4f5]/40 hover:text-[#f4f4f5]",
              )}
            >
              {isUploading ? (
                <ArrowPathIcon className="h-7 w-7 animate-spin" />
              ) : (
                <ArrowUpTrayIcon className="h-7 w-7" />
              )}
              <span className="text-[13px] font-medium">
                {isUploading ? t("addClipUploading") : t("addClipUpload")}
              </span>
              <input
                type="file"
                multiple
                accept={accept}
                disabled={isUploading}
                className="hidden"
                onChange={(event) => onUploadFiles(event.target.files)}
              />
            </label>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
