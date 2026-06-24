/**
 * Granular Editor-agent tool contract.
 *
 * This is the AI-native replacement for the "regenerate the whole plan" model:
 * the agent reads the live timeline, mutates it incrementally through the SAME
 * command engine the UI uses, verifies, and corrects. It addresses clips,
 * tracks and media by STABLE IDS only — never by inventing URLs. The catalogue
 * (`get_media`) is the single source of placeable assets.
 *
 * `dispatchEditorTool` runs a tool call against a {@link TimelineSession}, so
 * the agent gets undo for free and every edit is atomic + validated.
 *
 * Pure module — safe on client and server. Runtime wiring (turning these specs
 * into LangChain tools, persisting the result) lives in the agent runtime.
 */

import { type EditorCommand } from "./commands"
import {
  type Clip,
  type Timeline,
  clipsOnTrack,
  timelineDurationFrames,
  visibleDurationFrames,
} from "./timeline-model"
import { type TimelineSession } from "./timeline-session"

export const EDITOR_AGENT_TOOL_NAMES = [
  "get_timeline",
  "get_media",
  "add_clips",
  "move_clip",
  "trim_clip",
  "split_clip",
  "remove_clips",
  "reorder_track",
  "undo",
] as const

export type EditorAgentToolName = (typeof EDITOR_AGENT_TOOL_NAMES)[number]

export type EditorToolSpec = {
  name: EditorAgentToolName
  description: string
  /** JSON-schema-ish parameter description, for runtime tool registration. */
  parameters: Record<string, unknown>
}

/** Flat (not a union) for the same `strict: false` reason as CommandResult. */
export type EditorToolResult = {
  ok: boolean
  summary?: string
  data?: unknown
  error?: string
}

// ============================================================
// Compact, agent-facing views
// ============================================================

type ClipView = {
  id: string
  trackId: string
  kind: Clip["kind"]
  mediaId: string | null
  label?: string
  startFrame: number
  durationFrames: number
  trimStartFrame: number
  trimEndFrame: number
  visibleFrames: number
  linkedClipId: string | null
}

function clipView(timeline: Timeline, clip: Clip): ClipView {
  const label = clip.mediaId ? timeline.media[clip.mediaId]?.label : clip.text?.text
  return {
    id: clip.id,
    trackId: clip.trackId,
    kind: clip.kind,
    mediaId: clip.mediaId,
    ...(label ? { label: label.slice(0, 120) } : {}),
    startFrame: clip.startFrame,
    durationFrames: clip.durationFrames,
    trimStartFrame: clip.trimStartFrame,
    trimEndFrame: clip.trimEndFrame,
    visibleFrames: visibleDurationFrames(clip),
    linkedClipId: clip.linkedClipId,
  }
}

/** A compact, ordered snapshot of the timeline for the agent to read. */
export function timelineView(timeline: Timeline) {
  return {
    fps: timeline.sequence.fps,
    resolution: `${timeline.sequence.width}x${timeline.sequence.height}`,
    durationFrames: timelineDurationFrames(timeline),
    tracks: timeline.tracks.map((track) => ({
      id: track.id,
      kind: track.kind,
      clips: clipsOnTrack(timeline, track.id).map((clip) => clipView(timeline, clip)),
    })),
  }
}

/** The catalogue of placeable assets (the only things the agent may add). */
export function mediaView(timeline: Timeline) {
  return Object.values(timeline.media).map((media) => ({
    id: media.id,
    kind: media.kind,
    url: media.url,
    ...(media.label ? { label: media.label } : {}),
    ...(media.durationFrames ? { durationFrames: media.durationFrames } : {}),
  }))
}

// ============================================================
// Tool specs (for runtime registration / system-prompt docs)
// ============================================================

export const EDITOR_AGENT_TOOLS: EditorToolSpec[] = [
  {
    name: "get_timeline",
    description: "Read the current timeline: sequence settings, tracks, and every clip with its stable id and frame positions. Call this first and after edits to verify.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_media",
    description: "List the available source assets (id, kind, url, label). You may ONLY place clips whose mediaId appears here. Never invent urls.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_clips",
    description: "Append or place one or more clips, each referencing an existing mediaId. Adding a video to a media track also drops its linked audio.",
    parameters: {
      type: "object",
      properties: {
        clips: {
          type: "array",
          items: {
            type: "object",
            properties: {
              mediaId: { type: "string", description: "Asset id from get_media." },
              trackId: { type: "string", description: "Target track id from get_timeline." },
              startFrame: { type: "integer", description: "Optional; defaults to after the last clip on the track." },
              trimStartFrame: { type: "integer" },
              trimEndFrame: { type: "integer" },
            },
            required: ["mediaId", "trackId"],
          },
        },
      },
      required: ["clips"],
    },
  },
  {
    name: "move_clip",
    description: "Move a clip to a new startFrame, optionally onto another track. Fails if it would overlap a clip on that track.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        startFrame: { type: "integer" },
        trackId: { type: "string", description: "Optional target track." },
      },
      required: ["clipId", "startFrame"],
    },
  },
  {
    name: "trim_clip",
    description: "Set a clip's head/tail trim in frames. Leaves the clip's timeline start where it is.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        trimStartFrame: { type: "integer" },
        trimEndFrame: { type: "integer" },
      },
      required: ["clipId"],
    },
  },
  {
    name: "split_clip",
    description: "Split a clip into two at an absolute timeline frame. A linked A/V pair splits together.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        atFrame: { type: "integer", description: "Absolute timeline frame inside the clip." },
      },
      required: ["clipId", "atFrame"],
    },
  },
  {
    name: "remove_clips",
    description: "Remove clips by id. A clip's linked companion is removed with it.",
    parameters: {
      type: "object",
      properties: { clipIds: { type: "array", items: { type: "string" } } },
      required: ["clipIds"],
    },
  },
  {
    name: "reorder_track",
    description: "Reorder a track's clips and pack them left-to-right with no gaps. clipIds must be a permutation of that track's current clips.",
    parameters: {
      type: "object",
      properties: {
        trackId: { type: "string" },
        clipIds: { type: "array", items: { type: "string" } },
      },
      required: ["trackId", "clipIds"],
    },
  },
  {
    name: "undo",
    description: "Undo the last edit you made in this session.",
    parameters: { type: "object", properties: {}, required: [] },
  },
]

// ============================================================
// Dispatch
// ============================================================

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null
}
function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out = value.filter((v): v is string => typeof v === "string")
  return out.length === value.length ? out : null
}

/** Translate a (validated-enough) tool call into a command, or an error. */
function toCommand(name: EditorAgentToolName, args: Record<string, unknown>): EditorCommand | { error: string } {
  switch (name) {
    case "add_clips": {
      const rawClips = Array.isArray(args.clips) ? args.clips : null
      if (!rawClips || rawClips.length === 0) return { error: "add_clips needs a non-empty clips array" }
      const clips = []
      for (const raw of rawClips) {
        if (!raw || typeof raw !== "object") return { error: "Each clip must be an object" }
        const item = raw as Record<string, unknown>
        if ("url" in item || "media" in item) return { error: "Place clips by mediaId from get_media, not by url" }
        const mediaId = asString(item.mediaId)
        const trackId = asString(item.trackId)
        if (!mediaId) return { error: "Each clip needs a mediaId from get_media" }
        if (!trackId) return { error: "Each clip needs a trackId from get_timeline" }
        clips.push({
          mediaId,
          trackId,
          ...(asInt(item.startFrame) !== null ? { startFrame: asInt(item.startFrame)! } : {}),
          ...(asInt(item.trimStartFrame) !== null ? { trimStartFrame: asInt(item.trimStartFrame)! } : {}),
          ...(asInt(item.trimEndFrame) !== null ? { trimEndFrame: asInt(item.trimEndFrame)! } : {}),
        })
      }
      return { type: "add_clips", clips }
    }
    case "move_clip": {
      const clipId = asString(args.clipId)
      const startFrame = asInt(args.startFrame)
      if (!clipId) return { error: "move_clip needs a clipId" }
      if (startFrame === null) return { error: "move_clip needs an integer startFrame" }
      const trackId = asString(args.trackId)
      return { type: "move_clip", clipId, startFrame, ...(trackId ? { trackId } : {}) }
    }
    case "trim_clip": {
      const clipId = asString(args.clipId)
      if (!clipId) return { error: "trim_clip needs a clipId" }
      const trimStartFrame = asInt(args.trimStartFrame)
      const trimEndFrame = asInt(args.trimEndFrame)
      if (trimStartFrame === null && trimEndFrame === null) return { error: "trim_clip needs trimStartFrame and/or trimEndFrame" }
      return {
        type: "set_clip_properties",
        clipId,
        patch: {
          ...(trimStartFrame !== null ? { trimStartFrame } : {}),
          ...(trimEndFrame !== null ? { trimEndFrame } : {}),
        },
      }
    }
    case "split_clip": {
      const clipId = asString(args.clipId)
      const atFrame = asInt(args.atFrame)
      if (!clipId) return { error: "split_clip needs a clipId" }
      if (atFrame === null) return { error: "split_clip needs an integer atFrame" }
      return { type: "split_clip", clipId, atFrame }
    }
    case "remove_clips": {
      const clipIds = asStringArray(args.clipIds)
      if (!clipIds || clipIds.length === 0) return { error: "remove_clips needs a clipIds array" }
      return { type: "remove_clips", clipIds }
    }
    case "reorder_track": {
      const trackId = asString(args.trackId)
      const clipIds = asStringArray(args.clipIds)
      if (!trackId) return { error: "reorder_track needs a trackId" }
      if (!clipIds) return { error: "reorder_track needs a clipIds array" }
      return { type: "reorder_track", trackId, clipIds }
    }
    default:
      return { error: `${name} is not a mutating tool` }
  }
}

/**
 * Execute one Editor-agent tool call against a session. Read tools return a
 * view; mutating tools apply through the command engine and return the updated
 * view so the agent can verify; `undo` reverts the last edit.
 */
export function dispatchEditorTool(
  session: TimelineSession,
  name: string,
  args: Record<string, unknown> = {},
): EditorToolResult {
  if (!EDITOR_AGENT_TOOL_NAMES.includes(name as EditorAgentToolName)) {
    return { ok: false, error: `Unknown tool ${name}` }
  }
  const tool = name as EditorAgentToolName

  if (tool === "get_timeline") {
    return { ok: true, summary: "Current timeline", data: timelineView(session.timeline) }
  }
  if (tool === "get_media") {
    const media = mediaView(session.timeline)
    return { ok: true, summary: `${media.length} asset${media.length === 1 ? "" : "s"} available`, data: media }
  }
  if (tool === "undo") {
    const undone = session.undo()
    return undone
      ? { ok: true, summary: "Reverted the last edit", data: timelineView(session.timeline) }
      : { ok: false, error: "Nothing to undo" }
  }

  const command = toCommand(tool, args)
  if ("error" in command) return { ok: false, error: command.error }

  const result = session.apply(command)
  if (!result.ok) return { ok: false, error: `${result.error!.code}: ${result.error!.message}` }

  const createdNote = result.created!.clipIds.length ? ` New clip ids: ${result.created!.clipIds.join(", ")}.` : ""
  return {
    ok: true,
    summary: `${result.description}.${createdNote}`,
    data: timelineView(session.timeline),
  }
}
