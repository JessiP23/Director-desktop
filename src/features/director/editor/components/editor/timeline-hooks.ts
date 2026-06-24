"use client"

import * as React from "react"
import { TimelinePlayer } from "@/lib/editor-render/player"
import {
  applyCommand,
  createEmptyTimeline,
  isEmptyTimeline,
  migrateLegacyTimeline,
  timelineToLegacy,
  type EditorCommand,
  type LegacyTimelineState,
  type Timeline,
} from "@/lib/editor"
import { scheduleEffectStateSync } from "../../lib/effect-state-sync"
import { TimelineApiError, importTimeline, loadTimeline as loadServerTimeline } from "../../lib/timeline-api"
import {
  AUDIO_LINK_SUFFIX,
  DEFAULT_TIMELINE_CLIP_SECONDS,
  TIMELINE_STORAGE_PREFIX,
  baseClipId,
  loadPersistedTimeline,
  normalizeDuration,
  snapTimeToFrame,
  syncMediaElementTime,
  type ClipLayout,
  type ClipTrim,
  type EditorClip,
  type PersistedTimeline,
  type SequenceFps,
  type Track,
} from "../../lib/editor-view-utils"

type EditorTimelinePersistenceParams = {
  runId: string | null
  isOpen: boolean
  timelineSyncToken: number
  snapshot: Omit<PersistedTimeline, "assigned">
  sourceClips: EditorClip[]
  clipDurations: Record<string, number>
  applyEditorialState: (state: Partial<LegacyTimelineState>) => void
  hydrateFromPersisted: (persisted: PersistedTimeline & { durations?: Record<string, number> }) => void
  resetTimelineDefaults: () => void
  getAssignedIds: () => string[]
  setAssignedIds: (ids: string[]) => void
}

type EditorTimelinePersistenceResult = {
  loadedRunId: string | null
  editorTimeline: Timeline
  persistedRef: React.MutableRefObject<PersistedTimeline | null>
  buildCanonicalTimeline: (persisted: PersistedTimeline) => Timeline
  dispatchCommand: (command: EditorCommand) => boolean
}

type TimelinePreviewState = {
  clip: EditorClip
  start: number
  duration: number
  trim: ClipTrim
  offset: number
} | null

type TimelineGeometryParams = {
  tracks: Track[]
  clipStarts: Record<string, number>
  clipsById: ReadonlyMap<string, EditorClip>
  timelineVisibleSeconds: number
  timelinePlayheadSeconds: number
  getClipSlotDuration: (clipId: string) => number
  getClipTrim: (clipId: string) => ClipTrim
  getClipDuration: (clipId: string) => number
}

type TimelineGeometry = {
  clipLayoutMap: Map<string, ClipLayout>
  addClipPlaceholderDuration: number
  addClipPlaceholderGap: number
  timelineCanvasDuration: number
  timelinePlaybackEnd: number
  preloadAudioClips: { id: string; url: string }[]
  timelinePreview: TimelinePreviewState
  activeTimelineAudio: { id: string; offset: number }[]
  isPlayablePreview: boolean
  playheadPercent: number
  timelineContentWidthPercent: number
  rulerStep: number
  timelineRulerTicks: number[]
  playbackPositionSeconds: number
}

type TimelinePlaybackParams = Omit<TimelineGeometryParams, "timelinePlayheadSeconds"> & {
  isOpen: boolean
  editorTimeline: Timeline
  sequenceFps: SequenceFps
}

type TimelinePlayback = TimelineGeometry & {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  poolAudioCallbackRef: (el: HTMLAudioElement | null) => void
  isPreviewPlaying: boolean
  timelinePlayheadSeconds: number
  setTimelinePlayheadSeconds: React.Dispatch<React.SetStateAction<number>>
  setPlayheadEl0: (el: HTMLDivElement | null) => void
  setPlayheadEl1: (el: HTMLDivElement | null) => void
  setPlayheadEl2: (el: HTMLDivElement | null) => void
  togglePreviewPlay: () => void
  stopPreview: () => void
  restartPreview: () => void
  seekPreview: (value: number) => void
}

export function useEditorTimelinePersistence({
  runId,
  isOpen,
  timelineSyncToken,
  snapshot,
  sourceClips,
  clipDurations,
  applyEditorialState,
  hydrateFromPersisted,
  resetTimelineDefaults,
  getAssignedIds,
  setAssignedIds,
}: EditorTimelinePersistenceParams): EditorTimelinePersistenceResult {
  const [loadedRunId, setLoadedRunId] = React.useState<string | null>(null)
  const [editorTimeline, setEditorTimeline] = React.useState<Timeline>(() => createEmptyTimeline())
  const persistedRef = React.useRef<PersistedTimeline | null>(null)
  const sourceClipsRef = React.useRef(sourceClips)
  const clipDurationsRef = React.useRef(clipDurations)
  const serverLoadedRef = React.useRef(false)
  const serverVersionRef = React.useRef<number | null>(null)
  const serverSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    sourceClipsRef.current = sourceClips
  }, [sourceClips])

  React.useEffect(() => {
    clipDurationsRef.current = clipDurations
  }, [clipDurations])

  const applyServerTimeline = React.useCallback(
    (server: Awaited<ReturnType<typeof loadServerTimeline>>) => {
      serverVersionRef.current = server.version
      if (isEmptyTimeline(server.timeline)) return

      const editorial = timelineToLegacy(server.timeline) as unknown as PersistedTimeline & {
        durations?: Record<string, number>
      }
      applyEditorialState(editorial)
      setAssignedIds(editorial.assigned ?? [])
    },
    [applyEditorialState, setAssignedIds],
  )

  const buildCanonicalTimeline = React.useCallback((persisted: PersistedTimeline) =>
    migrateLegacyTimeline(persisted, {
      sourceClips: sourceClipsRef.current.map((clip) => ({ id: clip.id, url: clip.url, kind: clip.kind })),
      durations: clipDurationsRef.current,
    }),
  [])

  const dispatchCommand = React.useCallback(
    (command: EditorCommand): boolean => {
      const persisted = persistedRef.current
      if (!persisted) {
        if (import.meta.env.DEV) {
          console.warn(`[editor] ${command.type} ignored: timeline not hydrated yet`)
        }
        return false
      }

      const result = applyCommand(buildCanonicalTimeline(persisted), command)
      if (!result.ok || !result.timeline) {
        if (import.meta.env.DEV) {
          console.warn(`[editor] ${command.type} rejected:`, result.error, command)
        }
        return false
      }

      applyEditorialState(timelineToLegacy(result.timeline))
      return true
    },
    [applyEditorialState, buildCanonicalTimeline],
  )

  React.useEffect(() => {
    return scheduleEffectStateSync(() => {
      const persisted = loadPersistedTimeline(runId)
      if (persisted) hydrateFromPersisted(persisted)
      else resetTimelineDefaults()
      setLoadedRunId(runId)
    })
  }, [runId, hydrateFromPersisted, resetTimelineDefaults])

  React.useEffect(() => {
    if (!isOpen || !runId || loadedRunId !== runId) return
    let cancelled = false
    serverLoadedRef.current = false
    serverVersionRef.current = null
    const controller = new AbortController()

    void (async () => {
      try {
        const server = await loadServerTimeline(runId, controller.signal)
        if (!cancelled) {
          applyServerTimeline(server)
          serverLoadedRef.current = true
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return
        // Server unreachable: keep the localStorage-hydrated state.
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isOpen, runId, loadedRunId, timelineSyncToken, applyServerTimeline])

  React.useEffect(() => {
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current)
      serverSaveTimerRef.current = null
    }
  }, [runId])

  React.useEffect(() => {
    if (!runId || loadedRunId !== runId || typeof window === "undefined") return

    const persisted: PersistedTimeline = { ...snapshot, assigned: getAssignedIds() }
    persistedRef.current = persisted
    const canonical = buildCanonicalTimeline(persisted)
    const cancelPreviewSync = scheduleEffectStateSync(() => setEditorTimeline(canonical))

    try {
      window.localStorage.setItem(TIMELINE_STORAGE_PREFIX + runId, JSON.stringify(persisted))
    } catch {
      // Ignore quota/serialization errors — local persistence is best-effort.
    }

    const expectedVersion = serverVersionRef.current
    if (!isOpen || !serverLoadedRef.current || expectedVersion === null) return cancelPreviewSync

    if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current)
    serverSaveTimerRef.current = setTimeout(() => {
      void importTimeline(runId, canonical, { expectedVersion, reason: "Editor change" })
        .then((saved) => {
          serverVersionRef.current = saved.version
        })
        .catch(async (err) => {
          if (err instanceof TimelineApiError && err.isConflict) {
            try {
              applyServerTimeline(await loadServerTimeline(runId))
              serverLoadedRef.current = true
            } catch (reloadErr) {
              if (import.meta.env.DEV) {
                console.warn("[editor] timeline conflict reload failed", reloadErr)
              }
            }
            return
          }
          if (import.meta.env.DEV) {
            console.warn("[editor] timeline save failed", err)
          }
        })
    }, 800)
    return cancelPreviewSync
  }, [runId, loadedRunId, isOpen, snapshot, getAssignedIds, buildCanonicalTimeline, applyServerTimeline])

  return {
    loadedRunId,
    editorTimeline,
    persistedRef,
    buildCanonicalTimeline,
    dispatchCommand,
  }
}

function useTimelineGeometry({
  tracks,
  clipStarts,
  clipsById,
  timelineVisibleSeconds,
  timelinePlayheadSeconds,
  getClipSlotDuration,
  getClipTrim,
  getClipDuration,
}: TimelineGeometryParams): TimelineGeometry {
  const clipLayoutMap = React.useMemo(() => {
    const map = new Map<string, ClipLayout>()

    for (const track of tracks) {
      let cursor = 0
      for (const clipId of track.clipIds) {
        const sourceDuration = getClipSlotDuration(clipId)
        const explicit = clipStarts[clipId]
        const trim = getClipTrim(clipId)
        const duration = getClipDuration(clipId)
        const rawSlot = Number.isFinite(explicit) ? Number(explicit) : cursor
        const visibleStart = Math.max(0, rawSlot + trim.start)
        const slotStart = visibleStart - trim.start

        map.set(clipId, {
          clipId,
          trackId: track.id,
          slotStart,
          sourceDuration,
          duration,
          visibleStart,
          trim,
        })
        cursor = Math.max(cursor, slotStart + sourceDuration)
      }
    }

    // Linked audio companions inherit their video's geometry so old saved cuts
    // stay aligned even if the audio lane has drifted.
    for (const track of tracks) {
      if (track.type !== "audio") continue
      for (const clipId of track.clipIds) {
        if (!clipId.endsWith(AUDIO_LINK_SUFFIX)) continue
        const videoLayout = map.get(baseClipId(clipId))
        if (!videoLayout) continue
        map.set(clipId, {
          ...videoLayout,
          clipId,
          trackId: track.id,
          trim: { ...videoLayout.trim },
        })
      }
    }

    return map
  }, [tracks, clipStarts, getClipSlotDuration, getClipTrim, getClipDuration])

  const trackDurations = React.useMemo(
    () =>
      tracks.map((track) =>
        track.clipIds.reduce((max, clipId) => {
          const layout = clipLayoutMap.get(clipId)
          return layout ? Math.max(max, layout.slotStart + layout.sourceDuration) : max
        }, 0),
      ),
    [clipLayoutMap, tracks],
  )

  const timelineDuration = Math.max(DEFAULT_TIMELINE_CLIP_SECONDS, ...trackDurations)
  const hasTimelineClips = trackDurations.some((duration) => duration > 0)
  const addClipPlaceholderDuration = timelineVisibleSeconds * 0.1
  const addClipPlaceholderGap = timelineVisibleSeconds * 0.015
  const timelineCanvasDuration = Math.max(
    timelineDuration + (hasTimelineClips ? addClipPlaceholderGap + addClipPlaceholderDuration : 0),
    timelineVisibleSeconds,
  )

  const timelinePlaybackEnd = React.useMemo(() => {
    let end = 0
    for (const layout of clipLayoutMap.values()) {
      end = Math.max(end, layout.visibleStart + layout.duration)
    }
    return end
  }, [clipLayoutMap])

  const preloadAudioClips = React.useMemo(() => {
    const placed: { id: string; url: string }[] = []
    for (const track of tracks) {
      if (track.type !== "audio") continue
      for (const clipId of track.clipIds) {
        const clip = clipsById.get(clipId)
        if (clip?.kind === "audio" && clip.url) placed.push({ id: clipId, url: clip.url })
      }
    }
    return placed
  }, [tracks, clipsById])

  const visiblePlayheadSeconds = Math.min(timelinePlayheadSeconds, timelineCanvasDuration)

  const timelinePreview: TimelinePreviewState = (() => {
    for (const track of tracks) {
      if (track.type !== "media") continue
      for (const clipId of track.clipIds) {
        const layout = clipLayoutMap.get(clipId)
        const clip = clipsById.get(clipId)
        if (!layout || !clip) continue
        const isInsideClip =
          visiblePlayheadSeconds >= layout.visibleStart &&
          visiblePlayheadSeconds < layout.visibleStart + layout.duration
        if (isInsideClip && (clip.kind === "video" || clip.kind === "image")) {
          return {
            clip,
            start: layout.visibleStart,
            duration: layout.duration,
            trim: layout.trim,
            offset: layout.trim.start + visiblePlayheadSeconds - layout.visibleStart,
          }
        }
      }
    }
    return null
  })()

  const activeTimelineAudio = React.useMemo(() => {
    const active: { id: string; offset: number }[] = []
    for (const track of tracks) {
      if (track.type !== "audio") continue
      for (const clipId of track.clipIds) {
        const layout = clipLayoutMap.get(clipId)
        if (!layout) continue
        if (visiblePlayheadSeconds >= layout.visibleStart && visiblePlayheadSeconds < layout.visibleStart + layout.duration) {
          active.push({
            id: clipId,
            offset: layout.trim.start + visiblePlayheadSeconds - layout.visibleStart,
          })
        }
      }
    }
    return active
  }, [clipLayoutMap, tracks, visiblePlayheadSeconds])

  const playheadPercent = timelineCanvasDuration > 0
    ? (visiblePlayheadSeconds / timelineCanvasDuration) * 100
    : 0
  const timelineContentWidthPercent = Math.max(
    100,
    (timelineCanvasDuration / timelineVisibleSeconds) * 100,
  )
  const rulerStep = timelineVisibleSeconds <= 10
    ? timelineVisibleSeconds <= 2
      ? 0.25
      : timelineVisibleSeconds <= 5
        ? 0.5
        : 1
    : timelineVisibleSeconds <= 30
      ? 2
      : timelineVisibleSeconds <= 60
        ? 5
        : 10
  const timelineRulerTicks = React.useMemo(() => {
    const ticks: number[] = []
    for (let tick = 0; tick <= timelineCanvasDuration; tick += rulerStep) {
      ticks.push(tick)
    }
    if (ticks[ticks.length - 1] !== timelineCanvasDuration) ticks.push(timelineCanvasDuration)
    return ticks
  }, [rulerStep, timelineCanvasDuration])

  return {
    clipLayoutMap,
    addClipPlaceholderDuration,
    addClipPlaceholderGap,
    timelineCanvasDuration,
    timelinePlaybackEnd,
    preloadAudioClips,
    timelinePreview,
    activeTimelineAudio,
    isPlayablePreview: timelinePlaybackEnd > 0,
    playheadPercent,
    timelineContentWidthPercent,
    rulerStep,
    timelineRulerTicks,
    playbackPositionSeconds: Math.min(timelinePlayheadSeconds, timelinePlaybackEnd),
  }
}

export function useMediaDurations(
  clips: EditorClip[],
): [Record<string, number>, React.Dispatch<React.SetStateAction<Record<string, number>>>] {
  const [clipDurations, setClipDurations] = React.useState<Record<string, number>>({})
  const durationsRef = React.useRef(clipDurations)

  React.useEffect(() => {
    durationsRef.current = clipDurations
  }, [clipDurations])

  React.useEffect(() => {
    const controller = new AbortController()
    const mediaClipsToMeasure = clips.filter(
      (clip) =>
        (clip.kind === "video" || clip.kind === "audio") &&
        !durationsRef.current[clip.id],
    )

    mediaClipsToMeasure.forEach((clip) => {
      void loadMediaDuration(clip.url, clip.kind as "video" | "audio", controller.signal).then((duration) => {
        if (controller.signal.aborted) return
        setClipDurations((current) => {
          if (current[clip.id]) return current
          return { ...current, [clip.id]: normalizeDuration(duration) }
        })
      })
    })

    return () => controller.abort()
  }, [clips])

  return [clipDurations, setClipDurations]
}

export function useTimelinePlayback({
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
}: TimelinePlaybackParams): TimelinePlayback {
  const [isPreviewPlaying, setIsPreviewPlaying] = React.useState(false)
  const [timelinePlayheadSeconds, setTimelinePlayheadSeconds] = React.useState(0)
  const geometry = useTimelineGeometry({
    tracks,
    clipStarts,
    clipsById,
    timelineVisibleSeconds,
    timelinePlayheadSeconds,
    getClipSlotDuration,
    getClipTrim,
    getClipDuration,
  })
  const {
    activeTimelineAudio,
    preloadAudioClips,
    timelineCanvasDuration,
    timelinePlaybackEnd,
  } = geometry

  const editorTimelineRef = React.useRef(editorTimeline)
  React.useEffect(() => {
    editorTimelineRef.current = editorTimeline
  }, [editorTimeline])

  const poolAudioRefs = React.useRef<Map<string, HTMLAudioElement>>(new Map())
  const poolAudioCallbackRef = React.useCallback((el: HTMLAudioElement | null) => {
    if (el?.dataset.clipId) poolAudioRefs.current.set(el.dataset.clipId, el)
  }, [])

  // Stop the transport whenever the panel is hidden so audio/video never keeps
  // running off-screen.
  React.useEffect(() => {
    if (isOpen) return
    for (const audio of poolAudioRefs.current.values()) audio.pause()
    return scheduleEffectStateSync(() => setIsPreviewPlaying(false))
  }, [isOpen])

  const playheadElsRef = React.useRef<Array<HTMLDivElement | null>>([])
  const setPlayheadEl0 = React.useCallback((el: HTMLDivElement | null) => {
    playheadElsRef.current[0] = el
  }, [])
  const setPlayheadEl1 = React.useCallback((el: HTMLDivElement | null) => {
    playheadElsRef.current[1] = el
  }, [])
  const setPlayheadEl2 = React.useCallback((el: HTMLDivElement | null) => {
    playheadElsRef.current[2] = el
  }, [])
  const movePlayheadEls = React.useCallback((percent: number) => {
    for (const el of playheadElsRef.current) {
      if (el) el.style.setProperty("left", `${percent}%`)
    }
  }, [])

  const playheadSecondsRef = React.useRef(timelinePlayheadSeconds)
  React.useEffect(() => {
    playheadSecondsRef.current = timelinePlayheadSeconds
  }, [timelinePlayheadSeconds])

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const playerRef = React.useRef<TimelinePlayer | null>(null)
  const fpsRef = React.useRef(sequenceFps)
  const canvasDurationRef = React.useRef(timelineCanvasDuration)
  React.useEffect(() => {
    fpsRef.current = sequenceFps
    canvasDurationRef.current = timelineCanvasDuration
  }, [sequenceFps, timelineCanvasDuration])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!isOpen || !canvas) return
    const player = new TimelinePlayer(canvas, editorTimelineRef.current)
    playerRef.current = player
    player.onState = ({ frame, total, playing }) => {
      const seconds = frame / Math.max(1, fpsRef.current)
      playheadSecondsRef.current = seconds
      const canvasDuration = canvasDurationRef.current
      const percent =
        canvasDuration > 0 ? Math.min(100, (Math.min(seconds, canvasDuration) / canvasDuration) * 100) : 0
      movePlayheadEls(percent)
      setTimelinePlayheadSeconds(seconds)
      if (!playing && frame >= total) setIsPreviewPlaying(false)
    }
    void player.load()
    return () => {
      player.destroy()
      playerRef.current = null
    }
  }, [isOpen, movePlayheadEls])

  React.useEffect(() => {
    void playerRef.current?.updateTimeline(editorTimeline)
  }, [editorTimeline])

  React.useEffect(() => {
    const activeById = new Map(activeTimelineAudio.map((entry) => [entry.id, entry.offset]))
    for (const [clipId, audio] of poolAudioRefs.current) {
      const offset = activeById.get(clipId)
      if (offset === undefined) {
        if (!audio.paused) audio.pause()
        continue
      }
      if (isPreviewPlaying) {
        if (audio.paused) {
          syncMediaElementTime(audio, offset)
          audio.play().catch(() => {})
        }
      } else {
        if (!audio.paused) audio.pause()
        syncMediaElementTime(audio, offset)
      }
    }
  }, [activeTimelineAudio, isPreviewPlaying])

  React.useEffect(() => {
    const live = new Set(preloadAudioClips.map((clip) => clip.id))
    for (const clipId of [...poolAudioRefs.current.keys()]) {
      if (!live.has(clipId)) poolAudioRefs.current.delete(clipId)
    }
  }, [preloadAudioClips])

  React.useEffect(() => {
    if (isPreviewPlaying) return
    playerRef.current?.seek(Math.round(timelinePlayheadSeconds * Math.max(1, fpsRef.current)))
  }, [timelinePlayheadSeconds, isPreviewPlaying])

  const togglePreviewPlay = React.useCallback(() => {
    const player = playerRef.current
    if (isPreviewPlaying) {
      player?.pause()
      setTimelinePlayheadSeconds(playheadSecondsRef.current)
      setIsPreviewPlaying(false)
      return
    }
    if (timelinePlaybackEnd <= 0) return
    if (timelinePlayheadSeconds >= timelinePlaybackEnd - 0.001) {
      setTimelinePlayheadSeconds(0)
      player?.seek(0)
    }
    for (const entry of activeTimelineAudio) {
      const audio = poolAudioRefs.current.get(entry.id)
      if (!audio) continue
      syncMediaElementTime(audio, entry.offset)
      audio.play().catch(() => {})
    }
    player?.play()
    setIsPreviewPlaying(true)
  }, [activeTimelineAudio, isPreviewPlaying, timelinePlaybackEnd, timelinePlayheadSeconds])

  const stopPreview = React.useCallback(() => {
    playerRef.current?.seek(0)
    setIsPreviewPlaying(false)
    setTimelinePlayheadSeconds(0)
  }, [])

  const restartPreview = React.useCallback(() => {
    const player = playerRef.current
    player?.seek(0)
    setTimelinePlayheadSeconds(0)
    player?.play()
    setIsPreviewPlaying(true)
  }, [])

  const seekPreview = React.useCallback(
    (value: number) => {
      setIsPreviewPlaying(false)
      setTimelinePlayheadSeconds(snapTimeToFrame(value, sequenceFps))
    },
    [sequenceFps],
  )

  return {
    ...geometry,
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
  }
}

function loadMediaDuration(
  url: string,
  kind: "video" | "audio",
  signal: AbortSignal,
): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || signal.aborted) {
      resolve(null)
      return
    }

    const media = document.createElement(kind)
    media.preload = "metadata"
    media.muted = true

    const cleanup = () => {
      media.removeAttribute("src")
      media.load()
    }

    const finish = (duration: number | null) => {
      cleanup()
      signal.removeEventListener("abort", onAbort)
      resolve(duration)
    }

    const onAbort = () => finish(null)
    signal.addEventListener("abort", onAbort, { once: true })

    media.addEventListener(
      "loadedmetadata",
      () => {
        if (signal.aborted) return
        finish(Number.isFinite(media.duration) ? media.duration : null)
      },
      { once: true },
    )

    media.addEventListener(
      "error",
      () => {
        if (signal.aborted) return
        finish(null)
      },
      { once: true },
    )

    media.src = url
    media.load()
  })
}
