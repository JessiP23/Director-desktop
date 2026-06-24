"use client"

import * as React from "react"
import { useTranslations } from "@/lib/i18n"
import {
  ArrowDownTrayIcon,
  FilmIcon,
  XMarkIcon,
} from "@/features/director/editor/icons"
import { cn } from "@/lib/utils/cn"
import { resolveEditorPlanItems, type AgentTimelinePlan } from "../lib/editor-plan-apply"
import { confirmedClipInsertIndex, type ConfirmedClip } from "../lib/production-timeline"
import { orderTimelineTracks } from "../lib/timeline-track-order"
import { scheduleEffectStateSync } from "../lib/effect-state-sync"
import {
  isEmptyTimeline,
  secondsToFrames,
  type LegacyTimelineState,
} from "@/lib/editor"
import {
  AUDIO_LINK_SUFFIX,
  DEFAULT_CLIP_CROP,
  DEFAULT_CLIP_TRANSFORM,
  DEFAULT_FPS,
  DEFAULT_RESOLUTION,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_FONT_WEIGHT,
  DEFAULT_TEXT_OVERLAY_SECONDS,
  DEFAULT_TIMELINE_CLIP_SECONDS,
  DEFAULT_TIMELINE_VISIBLE_SECONDS,
  FPS_SELECT_OPTIONS,
  MIN_TIMELINE_CLIP_SECONDS,
  RESOLUTION_OPTIONS,
  aspectRatioFromResolution,
  baseClipId,
  defaultTracks,
  frameStepForFps,
  normalizeCrop,
  normalizeDuration,
  normalizeFps,
  normalizeResolution,
  normalizeTextOverlay,
  normalizeTransform,
  normalizeTrim,
  normalizeVisibleSeconds,
  precisionForFps,
  snapTimeToFrame,
  startMapWithoutAgentPlanSlots,
  tracksWithAgentPlan,
  trimMapWithAgentPlan,
} from "../lib/editor-view-utils"
import type {
  ClipCrop,
  ClipLayout,
  ClipTransform,
  ClipTrim,
  EditorClip,
  PersistedTimeline,
  PreviewEditMode,
  SequenceFps,
  SequenceResolution,
  TextOverlay,
  Track,
  TrackType,
} from "../lib/editor-view-utils"
import {
  AddClipDialog,
  PreviewStage,
  PreviewSelect,
  TextEditorDialog,
  TimelineClip,
  TimelineTrackLanes,
  TimelineToolbar,
  TransportControls,
} from "./editor/view-parts"
import { useAddClipDialog } from "./editor/add-clip-hooks"
import {
  useEditorTimelinePersistence,
  useMediaDurations,
  useTimelinePlayback,
} from "./editor/timeline-hooks"
import { usePreviewEditing } from "./editor/preview-hooks"
import { useTimelineClipDragging } from "./editor/timeline-drag-hooks"
import { useTimelinePanelInteractions } from "./editor/timeline-interaction-hooks"
import { useTimelineTrimEditing } from "./editor/timeline-trim-hooks"

export { collectEditorClips } from "../lib/editor-view-utils"
export type { EditorClip } from "../lib/editor-view-utils"

export type UploadedReference = { id: string; type: string; url?: string; name?: string }

type EditorPanelProps = {
  clips: EditorClip[]
  isOpen: boolean
  onClose: () => void
  /** Active conversation id — scopes the persisted timeline. */
  runId: string | null
  /** Uploads local files to R2 (reuses the platform attachments pipeline). */
  onUploadFiles: (files: File[]) => Promise<UploadedReference[]>
  /** Latest timeline plan produced by the Editor specialist, if any. */
  agentPlan?: AgentTimelinePlan | null
  /**
   * Bumps whenever the Editor agent persists a new canonical revision (derived
   * from the SSE timeline-synced event). A change re-pulls authoritative state.
   */
  timelineSyncToken?: number
  /**
   * User-confirmed clips from the brief's production timeline, already in
   * scene/shot order. Only these video clips auto-populate the media track.
   */
  confirmedClips?: ConfirmedClip[]
}

/**
 * Wide editor surface that docks on the right (mirrors `AssetsPanel`, but much
 * larger). Shows a media preview with the timeline of generated clips. The chat
 * stays in the main column, so this panel slides in over the reserved space.
 */
export function EditorPanel({ clips, isOpen, onClose, runId, onUploadFiles, agentPlan, timelineSyncToken = 0, confirmedClips }: EditorPanelProps) {
  const t = useTranslations("director.editor")
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null)
  const [isTextEditorOpen, setIsTextEditorOpen] = React.useState(false)
  const userPickedRef = React.useRef(false)

  // Agent-generated clips split into the two timeline families (modal pool).
  const mediaClips = React.useMemo(
    () => clips.filter((clip) => clip.kind === "video" || clip.kind === "image"),
    [clips],
  )
  const audioClips = React.useMemo(
    () => clips.filter((clip) => clip.kind === "audio"),
    [clips],
  )
  const poolForType = React.useCallback(
    (type: TrackType) => (type === "media" ? mediaClips : audioClips),
    [mediaClips, audioClips],
  )

  // Clips uploaded from the local device (mirrored to R2) live in the editor session.
  const [localClips, setLocalClips] = React.useState<EditorClip[]>([])
  // Derived clips created by splitting an existing clip (they point at the same
  // source url; trims/positions make them the right-hand portion).
  const [splitClips, setSplitClips] = React.useState<EditorClip[]>([])
  const [timelineHeight, setTimelineHeight] = React.useState(260)
  const [timelineVisibleSeconds, setTimelineVisibleSeconds] = React.useState(DEFAULT_TIMELINE_VISIBLE_SECONDS)
  const [clipTrims, setClipTrims] = React.useState<Record<string, ClipTrim>>({})
  // Explicit timeline start (seconds) per clip slot. Clips without an entry fall
  // back to sequential packing; dragging a clip writes its absolute position.
  const [clipStarts, setClipStarts] = React.useState<Record<string, number>>({})
  // Size/position of each clip inside the preview frame (resize/reposition).
  const [clipTransforms, setClipTransforms] = React.useState<Record<string, ClipTransform>>({})
  // Per-edge crop of each clip.
  const [clipCrops, setClipCrops] = React.useState<Record<string, ClipCrop>>({})
  // Text overlays keyed by clip id (their position lives in `clipTransforms`).
  const [textOverlays, setTextOverlays] = React.useState<Record<string, TextOverlay>>({})
  // Which preview edit mode (if any) exposes its handles — off by default.
  const [previewEditMode, setPreviewEditMode] = React.useState<PreviewEditMode>("none")
  const [timelineSnapGuideSeconds, setTimelineSnapGuideSeconds] = React.useState<number | null>(null)
  const [sequenceResolution, setSequenceResolution] =
    React.useState<SequenceResolution>(DEFAULT_RESOLUTION)
  const [sequenceFps, setSequenceFps] = React.useState<SequenceFps>(DEFAULT_FPS)
  const frameStepSeconds = React.useMemo(() => frameStepForFps(sequenceFps), [sequenceFps])
  const timelineTimePrecision = React.useMemo(() => precisionForFps(sequenceFps), [sequenceFps])
  const sequenceAspectRatio = React.useMemo(
    () => aspectRatioFromResolution(sequenceResolution),
    [sequenceResolution],
  )

  // Text overlays surfaced as clips so they flow through the timeline layout,
  // selection and drag systems just like media.
  const textClips = React.useMemo<EditorClip[]>(
    () =>
      Object.values(textOverlays).map((overlay) => ({
        id: overlay.id,
        url: "",
        kind: "text" as const,
        toolName: "text",
        timestamp: "",
      })),
    [textOverlays],
  )
  // Everything that can be previewed = generated + uploaded + split + text clips.
  const allClips = React.useMemo(
    () => [...clips, ...localClips, ...splitClips, ...textClips],
    [clips, localClips, splitClips, textClips],
  )
  // Linked audio for every video clip — same source, rendered as audio.
  const companionAudioClips = React.useMemo(
    () =>
      allClips
        .filter((clip) => clip.kind === "video")
        .map((clip) => ({ ...clip, id: clip.id + AUDIO_LINK_SUFFIX, kind: "audio" as const })),
    [allClips],
  )
  const clipsById = React.useMemo(
    () => new Map([...allClips, ...companionAudioClips].map((clip) => [clip.id, clip])),
    [allClips, companionAudioClips],
  )
  const [clipDurations, setClipDurations] = useMediaDurations(allClips)

  const getClipTrim = React.useCallback(
    (clipId: string): ClipTrim => normalizeTrim(clipTrims[clipId]),
    [clipTrims],
  )

  const getClipTransform = React.useCallback(
    (clipId: string): ClipTransform => clipTransforms[clipId] ?? DEFAULT_CLIP_TRANSFORM,
    [clipTransforms],
  )

  const getClipCrop = React.useCallback(
    (clipId: string): ClipCrop => clipCrops[clipId] ?? DEFAULT_CLIP_CROP,
    [clipCrops],
  )

  const getSourceClipDuration = React.useCallback(
    (clipId: string): number => {
      const sourceId = baseClipId(clipId)
      const clip = clipsById.get(sourceId) ?? clipsById.get(clipId)
      if (clip?.kind === "text") return textOverlays[sourceId]?.duration ?? DEFAULT_TEXT_OVERLAY_SECONDS
      if (clip?.kind === "image") return DEFAULT_TIMELINE_CLIP_SECONDS
      return normalizeDuration(clipDurations[sourceId] ?? clipDurations[clipId])
    },
    [clipDurations, clipsById, textOverlays],
  )

  const getClipSlotDuration = React.useCallback(
    (clipId: string): number =>
      Math.max(MIN_TIMELINE_CLIP_SECONDS, snapTimeToFrame(getSourceClipDuration(clipId), sequenceFps)),
    [getSourceClipDuration, sequenceFps],
  )

  const getClipDuration = React.useCallback(
    (clipId: string): number => {
      const sourceDuration = getClipSlotDuration(clipId)
      const trim = getClipTrim(clipId)
      return Math.max(
        MIN_TIMELINE_CLIP_SECONDS,
        snapTimeToFrame(sourceDuration - trim.start - trim.end, sequenceFps),
      )
    },
    [getClipSlotDuration, getClipTrim, sequenceFps],
  )

  // Default the preview to the most recent clip, and follow new clips as they
  // arrive unless the user has explicitly picked another one.
  React.useEffect(() => {
    return scheduleEffectStateSync(() => {
      if (allClips.length === 0) {
        setSelectedClipId(null)
        userPickedRef.current = false
        return
      }
      if (!userPickedRef.current) {
        setSelectedClipId(allClips[allClips.length - 1].id)
      } else if (!allClips.some((clip) => clip.id === selectedClipId)) {
        setSelectedClipId(allClips[allClips.length - 1].id)
      }
    })
  }, [allClips, selectedClipId])

  // User-managed timeline tracks. Defaults: one media + one audio track.
  const newTrackId = React.useCallback(
    () =>
      `track-${
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10)
      }`,
    [],
  )
  const [tracks, setTracks] = React.useState<Track[]>(defaultTracks)
  const orderedTracks = React.useMemo(() => orderTimelineTracks(tracks), [tracks])
  // `assignedRef` makes auto-assignment one-shot per clip, so removing a clip
  // won't re-add it.
  const assignedRef = React.useRef<Set<string>>(new Set())
  const getAssignedIds = React.useCallback(() => Array.from(assignedRef.current), [])
  const setAssignedIds = React.useCallback((ids: string[]) => {
    assignedRef.current = new Set(ids)
  }, [])
  // Editor-agent plans are applied once each; the id survives reloads.
  const [appliedAgentPlanId, setAppliedAgentPlanId] = React.useState<string | null>(null)

  // Apply the EDITORIAL state (tracks, clips, trims, positions, look, sequence)
  // from a legacy-shaped object. Server hydration and command results use this
  // path so UI-only state (pane height, zoom, selection, applied-plan guard) is
  // never overwritten by a canonical timeline refresh.
  const applyEditorialState = React.useCallback((state: Partial<LegacyTimelineState>) => {
    setTracks(orderTimelineTracks(state.tracks?.length ? (state.tracks as Track[]) : defaultTracks()))
    setLocalClips((state.localClips ?? []) as EditorClip[])
    setSplitClips((state.splitClips ?? []) as EditorClip[])
    setClipTrims(
      Object.fromEntries(Object.entries(state.clipTrims ?? {}).map(([clipId, trim]) => [clipId, normalizeTrim(trim)])),
    )
    setClipStarts(
      Object.fromEntries(
        Object.entries(state.clipStarts ?? {})
          .filter(([, start]) => Number.isFinite(start))
          // Keep negative slot starts: a trimmed clip dragged to the origin has a
          // slot start of -trim.start (the visible portion is clamped to 0 in the
          // layout). Clamping here would snap it back and re-add the gap.
          .map(([clipId, start]) => [clipId, Number(start)]),
      ),
    )
    setClipTransforms(
      Object.fromEntries(
        Object.entries(state.clipTransforms ?? {}).map(([clipId, transform]) => [clipId, normalizeTransform(transform)]),
      ),
    )
    setClipCrops(
      Object.fromEntries(Object.entries(state.clipCrops ?? {}).map(([clipId, crop]) => [clipId, normalizeCrop(crop)])),
    )
    setTextOverlays(
      Object.fromEntries(
        Object.entries(state.textOverlays ?? {}).map(([id, overlay]) => [id, normalizeTextOverlay(id, overlay)]),
      ),
    )
    setSequenceResolution(normalizeResolution(state.resolution))
    setSequenceFps(normalizeFps(state.fps))
    // Server/canonical state carries measured source durations; seed them so the
    // layout is correct immediately (any already-measured value wins).
    if (state.durations) {
      setClipDurations((current) => ({ ...state.durations, ...current }))
    }
  }, [setClipDurations])

  // Local persistence owns editor UI preferences in addition to editorial
  // state. In particular, both expanded and reduced timeline heights restore
  // per run before the server timeline is fetched.
  const hydrateFromPersisted = React.useCallback(
    (persisted: PersistedTimeline & { durations?: Record<string, number> }) => {
      applyEditorialState(persisted as Partial<LegacyTimelineState>)
      setTimelineHeight(persisted.timelineHeight ?? 260)
      setTimelineVisibleSeconds(normalizeVisibleSeconds(persisted.visibleSeconds))
      setAppliedAgentPlanId(persisted.appliedAgentPlanId ?? null)
      assignedRef.current = new Set(persisted.assigned ?? [])
    },
    [applyEditorialState],
  )

  const resetTimelineDefaults = React.useCallback(() => {
    setTracks(defaultTracks())
    setLocalClips([])
    setSplitClips([])
    setTimelineHeight(260)
    setTimelineVisibleSeconds(DEFAULT_TIMELINE_VISIBLE_SECONDS)
    setClipTrims({})
    setClipStarts({})
    setClipTransforms({})
    setClipCrops({})
    setTextOverlays({})
    setSequenceResolution(DEFAULT_RESOLUTION)
    setSequenceFps(DEFAULT_FPS)
    setAppliedAgentPlanId(null)
    assignedRef.current = new Set()
  }, [])

  // Generated, uploaded and split clips seed the canonical media catalogue used
  // by manual commands, preview/export, and the server mirror.
  const sourceClips = React.useMemo(
    () => [...clips, ...localClips, ...splitClips],
    [clips, localClips, splitClips],
  )

  const timelineSnapshot = React.useMemo<Omit<PersistedTimeline, "assigned">>(
    () => ({
      tracks,
      localClips,
      splitClips,
      timelineHeight,
      visibleSeconds: timelineVisibleSeconds,
      clipTrims,
      clipStarts,
      clipTransforms,
      clipCrops,
      textOverlays,
      resolution: sequenceResolution,
      fps: sequenceFps,
      appliedAgentPlanId: appliedAgentPlanId ?? undefined,
    }),
    [tracks, localClips, splitClips, timelineHeight, timelineVisibleSeconds, clipTrims, clipStarts, clipTransforms, clipCrops, textOverlays, sequenceResolution, sequenceFps, appliedAgentPlanId],
  )

  const {
    loadedRunId,
    editorTimeline,
    persistedRef,
    buildCanonicalTimeline,
    dispatchCommand,
  } = useEditorTimelinePersistence({
    runId,
    isOpen,
    timelineSyncToken,
    snapshot: timelineSnapshot,
    sourceClips,
    clipDurations,
    applyEditorialState,
    hydrateFromPersisted,
    resetTimelineDefaults,
    getAssignedIds,
    setAssignedIds,
  })

  // ── Export: render the canonical timeline to an MP4 entirely in the browser ──
  // Reuses the SAME canonical derivation as dispatchCommand, so the exported file
  // matches exactly what the editor shows. The encoder (mediabunny/WebCodecs) is
  // imported lazily at click time to keep it out of the page bundle.
  const [exportProgress, setExportProgress] = React.useState<{ frame: number; total: number } | null>(null)
  const [exportError, setExportError] = React.useState<string | null>(null)
  const [exportDownload, setExportDownload] = React.useState<{ filename: string; path?: string } | null>(null)
  const exportAbortRef = React.useRef<AbortController | null>(null)
  const isExporting = exportProgress !== null

  const handleExport = React.useCallback(async () => {
    // A click while exporting cancels the in-flight render.
    if (exportAbortRef.current) {
      exportAbortRef.current.abort()
      return
    }
    const persisted = persistedRef.current
    if (!persisted) return
    const timeline = buildCanonicalTimeline(persisted)
    if (isEmptyTimeline(timeline)) {
      setExportError("Add at least one clip to the timeline before exporting.")
      return
    }
    const controller = new AbortController()
    exportAbortRef.current = controller
    setExportError(null)
    setExportDownload(null)
    setExportProgress({ frame: 0, total: 1 })
    try {
      const { exportTimelineToMp4 } = await import("@/lib/editor-render/export")
      const blob = await exportTimelineToMp4(timeline, {
        signal: controller.signal,
        onProgress: (progress) => setExportProgress(progress),
      })
      const filename = `timeline-${runId ?? "export"}.mp4`
      try {
        const { invoke } = await import("@tauri-apps/api/core")
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
        const path = await invoke<string>("save_export_to_downloads", { filename, bytes })
        setExportDownload({ filename: path.split(/[\\/]/).pop() || filename, path })
      } catch {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = filename
        anchor.rel = "noopener"
        anchor.style.display = "none"
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
        setExportDownload({ filename })
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setExportError(err instanceof Error ? err.message : "Export failed")
      }
    } finally {
      setExportProgress(null)
      exportAbortRef.current = null
    }
  }, [buildCanonicalTimeline, persistedRef, runId])

  const revealDownload = React.useCallback(async () => {
    if (!exportDownload?.path) return
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener")
      await revealItemInDir(exportDownload.path)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not show downloaded file")
    }
  }, [exportDownload])

  // Generated images are source material (keyframes, storyboards, casting), not
  // automatic edits. Keep them in the clip picker and auto-place only native
  // audio; videos enter through confirmation below. Waiting for local hydration
  // also prevents stream arrival from racing the saved timeline.
  React.useEffect(() => {
    if (loadedRunId !== runId) return
    const freshAudio = clips.filter(
      (clip) => clip.kind === "audio" && !assignedRef.current.has(clip.id),
    )
    if (freshAudio.length === 0) return
    freshAudio.forEach((clip) => assignedRef.current.add(clip.id))
    setTracks((current) => {
      const firstAudio = current.findIndex((track) => track.type === "audio")
      return current.map((track, index) => {
        if (track.type === "audio" && index === firstAudio) {
          const additions = freshAudio.map((clip) => clip.id)
          return additions.length ? { ...track, clipIds: [...track.clipIds, ...additions] } : track
        }
        return track
      })
    })
  }, [clips, loadedRunId, runId])

  // Production timeline: a video clip reaches the media track only once the
  // user confirms it (it shows up in the brief's scriptClips). `confirmedClips`
  // arrives in scene/shot order; each new one is spliced into the first media
  // track at its scene/shot position — together with its linked audio — so the
  // edit reads in screenplay order even when clips are confirmed out of order.
  // `assignedRef` (persisted) is the one-shot guard, so a confirmed clip the
  // user later removed is not re-added after a reload.
  React.useEffect(() => {
    if (!confirmedClips?.length || loadedRunId !== runId) return
    const idByUrl = new Map(
      clips.filter((clip) => clip.kind === "video").map((clip) => [clip.url, clip.id]),
    )
    const ordered = confirmedClips
      .map((entry) => idByUrl.get(entry.url))
      .filter((id): id is string => Boolean(id))
    const pending = ordered.filter((id) => !assignedRef.current.has(id))
    if (pending.length === 0) return
    pending.forEach((id) => assignedRef.current.add(id))

    setTracks((current) => {
      const firstMedia = current.findIndex((track) => track.type === "media")
      const firstAudio = current.findIndex((track) => track.type === "audio")
      return current.map((track, index) => {
        if (index === firstMedia) {
          let clipIds = [...track.clipIds]
          for (const id of pending) {
            if (clipIds.includes(id)) continue
            const insertAt = confirmedClipInsertIndex(clipIds, id, ordered)
            clipIds = [...clipIds.slice(0, insertAt), id, ...clipIds.slice(insertAt)]
          }
          return clipIds.length === track.clipIds.length ? track : { ...track, clipIds }
        }
        if (index === firstAudio) {
          let clipIds = [...track.clipIds]
          for (const id of pending) {
            const companion = id + AUDIO_LINK_SUFFIX
            if (clipIds.includes(companion)) continue
            const insertAt = confirmedClipInsertIndex(clipIds.map(baseClipId), id, ordered)
            clipIds = [...clipIds.slice(0, insertAt), companion, ...clipIds.slice(insertAt)]
          }
          return clipIds.length === track.clipIds.length ? track : { ...track, clipIds }
        }
        return track
      })
    })
  }, [confirmedClips, clips, loadedRunId, runId])

  // Apply the Editor specialist's timeline plan once per plan id: the first
  // media/audio tracks take the plan's clip order, trims come from the plan,
  // and explicit starts are cleared so items pack sequentially. Clips left
  // out by the plan stay available in the pool; manual edits after the apply
  // are never overwritten (the id is persisted as applied).
  React.useEffect(() => {
    if (!agentPlan || !runId || loadedRunId !== runId) return
    if (agentPlan.id === appliedAgentPlanId) return

    const resolved = resolveEditorPlanItems(agentPlan.plan, [...clips, ...localClips])
    if (resolved.length === 0) {
      // None of the plan's clips are loaded yet (stream still catching up):
      // retry on the next clips change instead of consuming the plan id.
      return
    }

    const mediaItems = resolved.filter((item) => item.track === "media")
    const audioItems = resolved.filter((item) => item.track === "audio")
    const placedIds = new Set(resolved.map((item) => item.clipId))
    const companionIds = mediaItems
      .filter((item) => item.kind === "video")
      .map((item) => item.clipId + AUDIO_LINK_SUFFIX)

    return scheduleEffectStateSync(() => {
      for (const item of resolved) assignedRef.current.add(item.clipId)

      setTracks((current) => tracksWithAgentPlan({
        tracks: current,
        mediaItems,
        audioItems,
        placedIds,
        companionIds,
      }))
      setClipTrims((current) => trimMapWithAgentPlan(current, resolved))
      setClipStarts((current) => startMapWithoutAgentPlanSlots(current, resolved, companionIds))
      if (agentPlan.plan.resolution) setSequenceResolution(normalizeResolution(agentPlan.plan.resolution))
      if (agentPlan.plan.fps) setSequenceFps(normalizeFps(agentPlan.plan.fps))
      setAppliedAgentPlanId(agentPlan.id)
    })
  }, [agentPlan, appliedAgentPlanId, clips, localClips, loadedRunId, runId])

  const addTrack = React.useCallback(
    (type: TrackType) =>
      setTracks((current) =>
        orderTimelineTracks([...current, { id: newTrackId(), type, clipIds: [] }]),
      ),
    [newTrackId],
  )
  const removeTrack = React.useCallback(
    (id: string) =>
      setTracks((current) => {
        const removed = current.find((track) => track.id === id)
        // Drop any text overlays that lived on the removed track.
        if (removed?.type === "text" && removed.clipIds.length) {
          setTextOverlays((overlays) => {
            const next = { ...overlays }
            for (const clipId of removed.clipIds) delete next[clipId]
            return next
          })
        }
        return current.filter((track) => track.id !== id)
      }),
    [],
  )
  const {
    addClipTarget,
    addClipTab,
    setAddClipTab,
    isUploading,
    addClipTrackIds,
    addClipPool,
    openAddClip,
    closeAddClipDialog,
    handleAddClipFromModal,
    handleUploadFiles,
  } = useAddClipDialog({
    tracks,
    clipsById,
    poolForType,
    onUploadFiles,
    setLocalClips,
    setTracks,
    dispatchCommand,
  })

  const {
    clipLayoutMap,
    addClipPlaceholderDuration,
    addClipPlaceholderGap,
    timelineCanvasDuration,
    timelinePlaybackEnd,
    preloadAudioClips,
    timelinePreview,
    isPlayablePreview,
    playheadPercent,
    timelineContentWidthPercent,
    rulerStep,
    timelineRulerTicks,
    playbackPositionSeconds,
    canvasRef,
    poolAudioCallbackRef,
    isPreviewPlaying,
    timelinePlayheadSeconds,
    setTimelinePlayheadSeconds,
    setPlayheadEl0,
    setPlayheadEl1,
    setPlayheadEl2,
    togglePreviewPlay,
    stopPreview,
    restartPreview,
    seekPreview,
  } = useTimelinePlayback({
    isOpen,
    editorTimeline,
    sequenceFps,
    tracks,
    clipStarts,
    clipsById,
    timelineVisibleSeconds,
    getClipSlotDuration,
    getClipTrim,
    getClipDuration,
  })
  const timelinePreviewClip = timelinePreview?.clip ?? null
  const timelinePreviewOffset = timelinePreview?.offset ?? 0

  const {
    containerRef,
    timelineScrubberRef,
    zoomTimeline,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
  } = useTimelinePanelInteractions({
    timelineHeight,
    setTimelineHeight,
    setTimelineVisibleSeconds,
    sequenceFps,
    timelineCanvasDuration,
    setTimelinePlayheadSeconds,
  })

  const {
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
  } = usePreviewEditing({
    getClipTransform,
    getClipCrop,
    setClipTransforms,
    setClipCrops,
    dispatchCommand,
  })

  // ── Text overlays ─────────────────────────────────────────────────────────
  // Add a new text block to an overlay track at the current playhead and select
  // it so its editor opens.
  const addTextOverlay = React.useCallback(
    (trackId: string) => {
      const id = `text-${
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10)
      }`
      // Place at the playhead, but the canonical engine forbids two clips
      // overlapping on one track — the legacy model allowed stacked text, the
      // engine does not. So if the playhead lands on an existing clip on this
      // track, append after the track's last clip instead (the add would
      // otherwise be rejected and nothing would appear).
      const durationSeconds = DEFAULT_TEXT_OVERLAY_SECONDS
      const trackClips = (tracks.find((tr) => tr.id === trackId)?.clipIds ?? [])
        .map((cid) => clipLayoutMap.get(cid))
        .filter((l): l is ClipLayout => Boolean(l))
      const desired = Math.max(0, snapTimeToFrame(timelinePlayheadSeconds, sequenceFps))
      const overlapsExisting = trackClips.some(
        (l) => desired < l.visibleStart + l.duration && desired + durationSeconds > l.visibleStart,
      )
      const start = overlapsExisting
        ? snapTimeToFrame(
            trackClips.reduce((max, l) => Math.max(max, l.visibleStart + l.duration), 0),
            sequenceFps,
          )
        : desired
      // Create the text clip through the SAME command engine the agent uses
      // (add_clips with an inline text payload), so manual and agent adds share
      // one path. The round-trip back to legacy state rebuilds the overlay.
      const ok = dispatchCommand({
        type: "add_clips",
        clips: [
          {
            id,
            trackId,
            startFrame: secondsToFrames(start, sequenceFps),
            durationFrames: secondsToFrames(durationSeconds, sequenceFps),
            text: {
              text: t("textDefault"),
              fontSize: DEFAULT_TEXT_FONT_SIZE,
              color: DEFAULT_TEXT_COLOR,
              fontFamily: DEFAULT_TEXT_FONT_FAMILY,
              fontWeight: DEFAULT_TEXT_FONT_WEIGHT,
              italic: false,
              textAlign: DEFAULT_TEXT_ALIGN,
              shadow: true,
              motion: "none",
            },
          },
        ],
      })
      if (!ok) return
      userPickedRef.current = true
      setSelectedClipId(id)
    },
    [timelinePlayheadSeconds, sequenceFps, t, dispatchCommand, tracks, clipLayoutMap],
  )

  const updateTextOverlay = React.useCallback(
    (id: string, patch: Partial<Omit<TextOverlay, "id">>) => {
      setTextOverlays((current) => {
        const existing = current[id]
        if (!existing) return current
        return { ...current, [id]: { ...existing, ...patch } }
      })
    },
    [],
  )

  // Remove a clip from whatever track holds it, pruning all its per-clip state
  // (and its linked audio companion / text overlay). The underlying generated
  // clip stays in the pool, so it can be re-added later.
  const removeClip = React.useCallback(
    (clipId: string) => {
      // Removing a video's LINKED audio companion drops ONLY the audio — the
      // video stays (now silent). The companion is implicit in legacy state, so
      // remove it from the audio track directly; routing through the command
      // engine would cascade to (and delete) the linked video.
      if (clipId.endsWith(AUDIO_LINK_SUFFIX)) {
        setTracks((current) =>
          current.map((track) =>
            track.type === "audio"
              ? { ...track, clipIds: track.clipIds.filter((id) => id !== clipId) }
              : track,
          ),
        )
        const dropKey = <T,>(record: Record<string, T>): Record<string, T> => {
          if (!(clipId in record)) return record
          const next = { ...record }
          delete next[clipId]
          return next
        }
        setClipTrims(dropKey)
        setClipStarts(dropKey)
        setClipTransforms(dropKey)
        setClipCrops(dropKey)
        setSelectedClipId((current) => (current === clipId ? null : current))
        return
      }
      // Media or native-audio clip: the command engine removes it and cascades to
      // a video's linked audio companion (removing a video drops its audio too).
      const base = baseClipId(clipId)
      if (dispatchCommand({ type: "remove_clips", clipIds: [base] })) {
        const ids = new Set([base, base + AUDIO_LINK_SUFFIX])
        setSelectedClipId((current) => (current && ids.has(current) ? null : current))
      }
    },
    [dispatchCommand],
  )

  // Delete / Backspace removes the selected clip (unless typing in a field).
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      if (!selectedClipId) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return
      }
      event.preventDefault()
      removeClip(selectedClipId)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, selectedClipId, removeClip])

  const { onTrimPointerDown, onTrimPointerMove, onTrimPointerUp } = useTimelineTrimEditing({
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
  })

  const {
    clipJustDraggedRef,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
  } = useTimelineClipDragging({
    clipLayoutMap,
    timelineCanvasDuration,
    sequenceFps,
    tracks,
    setClipStarts,
    setTimelineSnapGuideSeconds,
    dispatchCommand,
  })

  // ── Split a clip in two at the playhead (blade tool) ──────────────────────
  // Enabled only when the playhead falls strictly inside the selected clip,
  // leaving at least the minimum length on each side.
  const canSplitSelected = (() => {
    if (!selectedClipId) return false
    const layout = clipLayoutMap.get(selectedClipId)
    if (!layout) return false
    const offset = timelinePlayheadSeconds - layout.visibleStart
    return offset >= MIN_TIMELINE_CLIP_SECONDS && layout.duration - offset >= MIN_TIMELINE_CLIP_SECONDS
  })()

  const splitSelectedClip = React.useCallback(() => {
    if (!selectedClipId) return
    // Manual edit through the command engine: split_clip cleaves the clip — and,
    // in lockstep, its linked audio companion — at the playhead. Frames are the
    // engine's unit, so convert the playhead once. A split too close to an edge
    // is rejected by the engine (dispatchCommand returns false) → no-op.
    const atFrame = secondsToFrames(timelinePlayheadSeconds, sequenceFps)
    dispatchCommand({ type: "split_clip", clipId: baseClipId(selectedClipId), atFrame })
  }, [selectedClipId, timelinePlayheadSeconds, sequenceFps, dispatchCommand])

  const selectTimelineClip = React.useCallback(
    (clipId: string, visibleStart: number) => {
      // Suppress the click the browser fires right after a drag.
      if (clipJustDraggedRef.current) {
        clipJustDraggedRef.current = false
        return
      }
      userPickedRef.current = true
      setSelectedClipId(clipId)
      setTimelinePlayheadSeconds(visibleStart)
    },
    [clipJustDraggedRef, setTimelinePlayheadSeconds],
  )

  const renderClip = (layout: ClipLayout) => {
    const clip = clipsById.get(layout.clipId)
    if (!clip) return null
    return (
      <TimelineClip
        key={clip.id}
        layout={layout}
        clip={clip}
        overlay={clip.kind === "text" ? textOverlays[clip.id] : undefined}
        isActive={clip.id === selectedClipId}
        timelineCanvasDuration={timelineCanvasDuration}
        timePrecision={timelineTimePrecision}
        onSelect={selectTimelineClip}
        onRemove={removeClip}
        onClipPointerDown={onClipPointerDown}
        onClipPointerMove={onClipPointerMove}
        onClipPointerUp={onClipPointerUp}
        onTrimPointerDown={onTrimPointerDown}
        onTrimPointerMove={onTrimPointerMove}
        onTrimPointerUp={onTrimPointerUp}
      />
    )
  }

  // Size/position of the clip currently shown in the preview, expressed as a
  // rectangle (in % of the frame) so the media and its edit handles line up.
  const previewTransform = timelinePreviewClip
    ? getClipTransform(timelinePreviewClip.id)
    : DEFAULT_CLIP_TRANSFORM
  const previewCrop = timelinePreviewClip ? getClipCrop(timelinePreviewClip.id) : DEFAULT_CLIP_CROP
  const previewRect = {
    left: 50 + previewTransform.x - 50 * previewTransform.scale,
    top: 50 + previewTransform.y - 50 * previewTransform.scale,
    width: 100 * previewTransform.scale,
    height: 100 * previewTransform.scale,
  }
  // Handles for the active edit mode show only while paused (they'd be in the
  // way mid-playback) and when there's a clip to edit.
  const canEditPreview = Boolean(timelinePreviewClip) && !isPreviewPlaying
  const isResizing = canEditPreview && previewEditMode === "resize"
  const isCropping = canEditPreview && previewEditMode === "crop"
  const previewClipIsTransformed =
    previewTransform.scale !== 1 || previewTransform.x !== 0 || previewTransform.y !== 0
  const previewClipIsCropped =
    previewCrop.top !== 0 || previewCrop.right !== 0 || previewCrop.bottom !== 0 || previewCrop.left !== 0

  // Text overlays whose slot contains the playhead — drawn over the media.
  const activeTextOverlays = React.useMemo(() => {
    const playhead = Math.min(timelinePlayheadSeconds, timelineCanvasDuration)
    const result: { overlay: TextOverlay; transform: ClipTransform }[] = []
    for (const track of tracks) {
      if (track.type !== "text") continue
      for (const clipId of track.clipIds) {
        const layout = clipLayoutMap.get(clipId)
        const overlay = textOverlays[clipId]
        if (!layout || !overlay) continue
        if (playhead >= layout.visibleStart && playhead < layout.visibleStart + layout.duration) {
          result.push({ overlay, transform: getClipTransform(clipId) })
        }
      }
    }
    return result
  }, [tracks, clipLayoutMap, textOverlays, timelinePlayheadSeconds, timelineCanvasDuration, getClipTransform])

  const selectedTextOverlay = selectedClipId ? textOverlays[selectedClipId] ?? null : null
  const toggleResizeMode = React.useCallback(() => {
    setPreviewEditMode((mode) => (mode === "resize" ? "none" : "resize"))
  }, [])
  const toggleCropMode = React.useCallback(() => {
    setPreviewEditMode((mode) => (mode === "crop" ? "none" : "crop"))
  }, [])
  const openTextEditor = React.useCallback(() => setIsTextEditorOpen(true), [])

  return (
    <div
      ref={containerRef}
      aria-hidden={!isOpen}
      className={cn(
        // Desktop port: fills its pane (the preview slot) instead of the web's
        // fixed right-docked slide-in overlay.
        "relative flex h-full w-full flex-col overflow-hidden bg-[rgba(24,24,27,0.92)] text-[#f4f4f5]",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-1 pt-3">
        <div className="flex items-center gap-2">
          <FilmIcon className="h-4 w-4 text-[#f4f4f5]/70" />
          <h2 className="text-[15px] font-semibold text-[#f4f4f5]">{t("title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          {exportError && (
            <span className="max-w-[280px] truncate text-[11px] text-red-400" title={exportError}>
              {exportError}
            </span>
          )}
          <button
            type="button"
            onClick={handleExport}
            aria-label={isExporting ? "Cancel export" : "Export MP4"}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f4f4f5] px-3 text-[12px] font-medium text-[#09090b] transition-colors hover:bg-white"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {isExporting
              ? `${Math.round((exportProgress.frame / Math.max(1, exportProgress.total)) * 100)}%`
              : "Export"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#27272a]/60 text-[#f4f4f5]/70 transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {exportDownload && (
        <div className="mx-5 mb-2 flex shrink-0 items-center gap-2 rounded-[12px] border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100">
          <ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-emerald-200" />
          <span className="min-w-0 flex-1 truncate">
            Downloaded <span className="font-medium text-emerald-50">{exportDownload.filename}</span>
          </span>
          {exportDownload.path && (
            <button
              type="button"
              onClick={revealDownload}
              className="shrink-0 rounded-full bg-emerald-300/15 px-2.5 py-1 text-[11px] font-medium text-emerald-50 transition-colors hover:bg-emerald-300/25"
            >
              Show
            </button>
          )}
          <button
            type="button"
            onClick={() => setExportDownload(null)}
            aria-label="Dismiss downloaded item"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-emerald-100/70 transition-colors hover:bg-emerald-300/15 hover:text-emerald-50"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Preview — fills the space above the timeline; tracks scroll internally
          so adding/removing them never resizes the preview. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-3 px-5 pb-3 pt-1">
        <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-2 p-1">
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
            <PreviewSelect
              label={t("resolution")}
              value={sequenceResolution}
              options={RESOLUTION_OPTIONS}
              onChange={(value) => setSequenceResolution(normalizeResolution(value))}
            />
            <PreviewSelect
              label={t("fps")}
              value={sequenceFps}
              options={FPS_SELECT_OPTIONS}
              onChange={(value) => setSequenceFps(normalizeFps(value))}
            />
          </div>

          <PreviewStage
            isOpen={isOpen}
            aspectRatio={sequenceAspectRatio}
            previewBoxRef={previewBoxRef}
            canvasRef={canvasRef}
            onTogglePlay={togglePreviewPlay}
            preloadAudioClips={preloadAudioClips}
            poolAudioCallbackRef={poolAudioCallbackRef}
            previewClip={timelinePreviewClip}
            previewRect={previewRect}
            previewCrop={previewCrop}
            isResizing={isResizing}
            isCropping={isCropping}
            previewClipIsTransformed={previewClipIsTransformed}
            previewClipIsCropped={previewClipIsCropped}
            activeTextOverlays={activeTextOverlays}
            selectedClipId={selectedClipId}
            isPreviewPlaying={isPreviewPlaying}
            alignGuides={alignGuides}
            onTransformPointerDown={onTransformPointerDown}
            onTransformPointerMove={onTransformPointerMove}
            onTransformPointerUp={onTransformPointerUp}
            resetClipTransform={resetClipTransform}
            onCropPointerDown={onCropPointerDown}
            onCropPointerMove={onCropPointerMove}
            onCropPointerUp={onCropPointerUp}
            resetClipCrop={resetClipCrop}
            onOpenTextEditor={openTextEditor}
          />
        </div>

        <TransportControls
          isPlayablePreview={isPlayablePreview}
          isPreviewPlaying={isPreviewPlaying}
          playbackPositionSeconds={playbackPositionSeconds}
          timelinePlaybackEnd={timelinePlaybackEnd}
          frameStepSeconds={frameStepSeconds}
          timePrecision={timelineTimePrecision}
          onTogglePlay={togglePreviewPlay}
          onStop={stopPreview}
          onRestart={restartPreview}
          onSeek={seekPreview}
        />
      </div>

      {/* Resize handle — drag to grow/shrink the timeline pane. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        className="group flex shrink-0 cursor-row-resize items-center justify-center py-1.5"
      >
        <div className="h-1 w-12 rounded-full bg-[#f4f4f5]/15 transition-colors group-hover:bg-[#f4f4f5]/35" />
      </div>

      {/* Timeline tracks */}
      <div
        style={{ height: timelineHeight }}
        className="mx-3 mb-3 flex shrink-0 flex-col gap-2 rounded-2xl bg-black/20 px-4 py-3"
      >
        <div className="flex shrink-0 items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#f4f4f5]/45">
            {t("timeline")}
          </span>
          <TimelineToolbar
            timelineVisibleSeconds={timelineVisibleSeconds}
            canSplitSelected={canSplitSelected}
            previewEditMode={previewEditMode}
            hasPreviewClip={Boolean(timelinePreviewClip)}
            onZoom={zoomTimeline}
            onSplit={splitSelectedClip}
            onToggleResizeMode={toggleResizeMode}
            onToggleCropMode={toggleCropMode}
            onAddTrack={addTrack}
          />
        </div>

        <TimelineTrackLanes
          timelineContentWidthPercent={timelineContentWidthPercent}
          timelineCanvasDuration={timelineCanvasDuration}
          timelineRulerTicks={timelineRulerTicks}
          rulerStep={rulerStep}
          timePrecision={timelineTimePrecision}
          playheadPercent={playheadPercent}
          timelineSnapGuideSeconds={timelineSnapGuideSeconds}
          orderedTracks={orderedTracks}
          clipLayoutMap={clipLayoutMap}
          addClipPlaceholderGap={addClipPlaceholderGap}
          addClipPlaceholderDuration={addClipPlaceholderDuration}
          timelineScrubberRef={timelineScrubberRef}
          setPlayheadEl0={setPlayheadEl0}
          setPlayheadEl1={setPlayheadEl1}
          setPlayheadEl2={setPlayheadEl2}
          onTimelinePointerDown={onTimelinePointerDown}
          onTimelinePointerMove={onTimelinePointerMove}
          onTimelinePointerUp={onTimelinePointerUp}
          renderClip={renderClip}
          onAddText={addTextOverlay}
          onOpenAddClip={openAddClip}
          onRemoveTrack={removeTrack}
        />
      </div>

      <p className="mx-5 mb-3 shrink-0 text-center text-[10px] leading-4 text-[#f4f4f5]/38">
        <span className="font-medium text-[#f4f4f5]/60">{t("betaNoticeLabel")}</span>
        <span className="mx-1 text-[#f4f4f5]/25">·</span>
        {t("betaNotice")}
      </p>

      <TextEditorDialog
        open={isTextEditorOpen && Boolean(selectedTextOverlay)}
        overlay={selectedTextOverlay}
        background={
          timelinePreviewClip?.kind === "image" || timelinePreviewClip?.kind === "video"
            ? {
                url: timelinePreviewClip.url,
                kind: timelinePreviewClip.kind,
                offset: timelinePreviewOffset,
              }
            : null
        }
        textTransform={selectedTextOverlay ? getClipTransform(selectedTextOverlay.id) : DEFAULT_CLIP_TRANSFORM}
        aspectRatio={sequenceAspectRatio}
        onOpenChange={(open) => {
          setIsTextEditorOpen(open)
          // Live edits stay in local state (onChange → updateTextOverlay) so typing
          // is responsive; commit the final text through the engine on close, the
          // same set_clip_properties path the agent uses.
          if (!open && selectedTextOverlay) {
            const o = selectedTextOverlay
            dispatchCommand({
              type: "set_clip_properties",
              clipId: o.id,
              patch: {
                text: {
                  text: o.text,
                  fontSize: o.fontSize,
                  color: o.color,
                  fontFamily: o.fontFamily,
                  fontWeight: o.fontWeight,
                  italic: o.italic,
                  textAlign: o.textAlign,
                  shadow: o.shadow,
                  motion: o.motion,
                },
              },
            })
          }
        }}
        onChange={(patch) => {
          if (selectedTextOverlay) updateTextOverlay(selectedTextOverlay.id, patch)
        }}
        onDelete={() => {
          if (!selectedTextOverlay) return
          setIsTextEditorOpen(false)
          removeClip(selectedTextOverlay.id)
        }}
      />

      <AddClipDialog
        target={addClipTarget}
        trackClipIds={addClipTrackIds}
        pool={addClipPool}
        tab={addClipTab}
        isUploading={isUploading}
        onClose={closeAddClipDialog}
        onTabChange={setAddClipTab}
        onAddClip={handleAddClipFromModal}
        onUploadFiles={handleUploadFiles}
      />

    </div>
  )
}
