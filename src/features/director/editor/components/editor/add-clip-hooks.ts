"use client"

import * as React from "react"
import type { EditorCommand } from "@/lib/editor"
import {
  AUDIO_LINK_SUFFIX,
  type EditorClip,
  type Track,
  type TrackType,
} from "../../lib/editor-view-utils"

type UploadedReference = { id: string; type: string; url?: string; name?: string }

type UseAddClipDialogParams = {
  tracks: Track[]
  clipsById: ReadonlyMap<string, EditorClip>
  poolForType: (type: TrackType) => EditorClip[]
  onUploadFiles: (files: File[]) => Promise<UploadedReference[]>
  setLocalClips: React.Dispatch<React.SetStateAction<EditorClip[]>>
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>
  dispatchCommand: (command: EditorCommand) => boolean
}

export function useAddClipDialog({
  tracks,
  clipsById,
  poolForType,
  onUploadFiles,
  setLocalClips,
  setTracks,
  dispatchCommand,
}: UseAddClipDialogParams) {
  const [addClipTarget, setAddClipTarget] = React.useState<Track | null>(null)
  const [addClipTab, setAddClipTab] = React.useState<"agent" | "upload">("agent")
  const [isUploading, setIsUploading] = React.useState(false)

  const addClipToTrack = React.useCallback(
    (trackId: string, clipId: string) => {
      const clip = clipsById.get(clipId)
      if (clip?.kind !== "video" && clip?.kind !== "image" && clip?.kind !== "audio") return
      // Route manual adds through the canonical engine, the same path the agent
      // uses. Video clips added to media tracks get linked audio there.
      dispatchCommand({
        type: "add_clips",
        clips: [{ id: clipId, media: { url: clip.url, kind: clip.kind }, trackId }],
      })
    },
    [clipsById, dispatchCommand],
  )

  const handleAddClipFromModal = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { trackId, clipId } = event.currentTarget.dataset
      if (trackId && clipId) addClipToTrack(trackId, clipId)
    },
    [addClipToTrack],
  )

  const openAddClip = React.useCallback((track: Track) => {
    setAddClipTab("agent")
    setAddClipTarget(track)
  }, [])

  const closeAddClipDialog = React.useCallback(() => setAddClipTarget(null), [])

  const handleUploadFiles = React.useCallback(
    async (files: FileList | null) => {
      const target = addClipTarget
      console.info("[editor upload] picked", files?.length ?? 0, "file(s); target track:", target?.type)
      if (!files || files.length === 0 || !target) {
        console.warn("[editor upload] aborted — no files selected or no target track")
        return
      }

      const accepted = Array.from(files)
      setIsUploading(true)
      try {
        console.info("[editor upload] uploading", accepted.length, "file(s)")
        const references = await onUploadFiles(accepted)
        console.info("[editor upload] uploaded -> got", references.length, "reference(s)")
        const created: EditorClip[] = references
          .filter((ref) => Boolean(ref.url))
          .map((ref) => ({
            id: ref.id,
            url: ref.url as string,
            // A video dropped on an audio track is treated as audio-only: the
            // browser can play its audio stream, and the engine sees a valid
            // audio clip that can be removed and moved like any other.
            kind:
              target.type === "audio"
                ? "audio"
                : ref.type === "video"
                  ? "video"
                  : ref.type === "audio"
                    ? "audio"
                    : "image",
            toolName: ref.name || "upload",
            timestamp: new Date().toISOString(),
          }))
        if (created.length === 0) {
          console.warn("[editor upload] upload returned no usable references")
          return
        }

        setLocalClips((current) => [...current, ...created])
        const linkedAudioIds =
          target.type === "media"
            ? created.filter((clip) => clip.kind === "video").map((clip) => clip.id + AUDIO_LINK_SUFFIX)
            : []
        setTracks((current) => {
          const firstAudio = current.findIndex((track) => track.type === "audio")
          return current.map((track, index) => {
            if (track.id === target.id) {
              return { ...track, clipIds: [...track.clipIds, ...created.map((clip) => clip.id)] }
            }
            if (linkedAudioIds.length && index === firstAudio) {
              return { ...track, clipIds: [...track.clipIds, ...linkedAudioIds] }
            }
            return track
          })
        })
        console.info("[editor upload] placed", created.length, "clip(s) on track", target.id)
        setAddClipTarget(null)
      } catch (err) {
        console.error("[editor upload] FAILED:", err)
      } finally {
        setIsUploading(false)
      }
    },
    [addClipTarget, onUploadFiles, setLocalClips, setTracks],
  )

  const addClipTrackIds = addClipTarget
    ? (tracks.find((track) => track.id === addClipTarget.id)?.clipIds ?? [])
    : []
  const addClipPool = addClipTarget ? poolForType(addClipTarget.type) : []

  return {
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
  }
}
