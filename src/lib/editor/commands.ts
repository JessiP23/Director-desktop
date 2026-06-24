/**
 * Deterministic command engine for the canonical timeline.
 *
 * This is the single mutation path shared by the React UI and the Editor agent:
 * every edit — manual or agentic — is expressed as an {@link EditorCommand} and
 * applied here. Each application is:
 *   - validated (bad input → structured error, never a throw to the caller);
 *   - atomic (mutates a deep clone; on any failure the caller keeps its old
 *     timeline untouched — no partial state);
 *   - deterministic (given the same timeline + command + id generator);
 *   - self-checking (the result is re-validated against model invariants).
 *
 * Undo/redo is layered on top by ./timeline-session (snapshot journal).
 *
 * Pure module — safe on client and server.
 */

import { MIN_CLIP_FRAMES, clampFrames, clampFps, rescaleFrames, secondsToFrames } from "./frames"
import {
  type Clip,
  type ClipCrop,
  type ClipKind,
  type ClipText,
  type ClipTransform,
  type MediaKind,
  type MediaRef,
  type SequenceSettings,
  type Timeline,
  type Track,
  DEFAULT_CROP,
  DEFAULT_TRANSFORM,
  clipEndFrame,
  cloneTimeline,
  findClip,
  findTrack,
  visibleDurationFrames,
} from "./timeline-model"
import { clipKindAllowedOnTrack, validateTimeline } from "./timeline-validate"

const DEFAULT_IMAGE_SECONDS = 5
const DEFAULT_TEXT_SECONDS = 3
const DEFAULT_MEDIA_FALLBACK_SECONDS = 5

// ============================================================
// Command + result types
// ============================================================

/** An inline media definition placed in the same call (UI / migration use). */
export type InlineMedia = {
  url: string
  kind: MediaKind
  label?: string
  durationFrames?: number
}

export type AddClipInput = {
  trackId: string
  /** Reference an existing catalogue asset… */
  mediaId?: string
  /** …or register one inline. Exactly one of mediaId / media / text is used. */
  media?: InlineMedia
  /** Text clip content (for text tracks). */
  text?: ClipText
  /** Default: appended after the last clip on the track. */
  startFrame?: number
  /** Default: media's natural length, or a per-kind fallback. */
  durationFrames?: number
  trimStartFrame?: number
  trimEndFrame?: number
  transform?: ClipTransform | null
  crop?: ClipCrop | null
  /** Place a video's companion audio on the first audio track (default true). */
  linkAudio?: boolean
  /** Explicit id (migration / deterministic placement); else generated. */
  id?: string
}

export type ClipPropertiesPatch = {
  trimStartFrame?: number
  trimEndFrame?: number
  /** Slot length (image/text clips, or extending an asset's used length). */
  durationFrames?: number
  transform?: ClipTransform | null
  crop?: ClipCrop | null
  text?: Partial<ClipText>
}

export type EditorCommand =
  | { type: "add_clips"; clips: AddClipInput[] }
  | { type: "move_clip"; clipId: string; startFrame: number; trackId?: string }
  | { type: "set_clip_properties"; clipId: string; patch: ClipPropertiesPatch }
  | { type: "split_clip"; clipId: string; atFrame: number }
  | { type: "remove_clips"; clipIds: string[] }
  | { type: "reorder_track"; trackId: string; clipIds: string[] }
  | { type: "set_sequence"; patch: Partial<SequenceSettings> }

export type CommandErrorCode = "not_found" | "invalid_args" | "overlap" | "invariant" | "unsupported"
export type CommandError = { code: CommandErrorCode; message: string }

/**
 * Outcome of a command. A flat shape (rather than a discriminated union) because
 * this repo compiles with `strict: false`, where TypeScript does not narrow a
 * boolean discriminant — callers branch on `ok`, then read the relevant fields.
 * On success `timeline`/`created` are set; on failure only `error` is.
 */
export type CommandResult = {
  ok: boolean
  timeline?: Timeline
  description?: string
  created?: { clipIds: string[]; mediaIds: string[] }
  error?: CommandError
}

export type ApplyOptions = {
  /** Injectable id source for deterministic tests. Default: crypto.randomUUID. */
  newId?: () => string
}

/** A failure thrown internally by handlers; converted to a CommandError. */
class CommandFailure extends Error {
  constructor(public code: CommandErrorCode, message: string) {
    super(message)
    this.name = "CommandFailure"
  }
}

function fail(code: CommandErrorCode, message: string): never {
  throw new CommandFailure(code, message)
}

// ============================================================
// Small pure helpers
// ============================================================

function makeIdFactory(options?: ApplyOptions) {
  const gen = options?.newId ?? (() => crypto.randomUUID())
  return {
    clip: () => `clip-${gen()}`,
    media: () => `media-${gen()}`,
  }
}

/** Frame after the last clip on a track (where a new clip appends). */
export function appendStartFrame(timeline: Timeline, trackId: string): number {
  const track = findTrack(timeline, trackId)
  if (!track) return 0
  let end = 0
  for (const id of track.clipIds) {
    const clip = timeline.clips[id]
    if (clip) end = Math.max(end, clipEndFrame(clip))
  }
  return end
}

/** Insert a clip id into a track's id list keeping ascending startFrame order. */
function insertInStartOrder(timeline: Timeline, track: Track, clipId: string): void {
  const start = timeline.clips[clipId].startFrame
  const ids = track.clipIds
  let index = ids.length
  for (let i = 0; i < ids.length; i += 1) {
    const other = timeline.clips[ids[i]]
    if (other && other.startFrame > start) {
      index = i
      break
    }
  }
  ids.splice(index, 0, clipId)
}

function firstTrackOfKind(timeline: Timeline, kind: Track["kind"]): Track | undefined {
  return timeline.tracks.find((t) => t.kind === kind)
}

function defaultDurationFrames(kind: ClipKind, media: MediaRef | null, fps: number): number {
  if (kind === "image") return secondsToFrames(DEFAULT_IMAGE_SECONDS, fps)
  if (kind === "text") return secondsToFrames(DEFAULT_TEXT_SECONDS, fps)
  return media?.durationFrames && media.durationFrames > 0
    ? media.durationFrames
    : secondsToFrames(DEFAULT_MEDIA_FALLBACK_SECONDS, fps)
}

// ============================================================
// Catalogue helpers (media is separate from placement)
// ============================================================

/** Register / update media in the catalogue (pure). Used to seed available assets. */
export function addMediaRefs(timeline: Timeline, refs: MediaRef[]): Timeline {
  if (refs.length === 0) return timeline
  const next = cloneTimeline(timeline)
  for (const ref of refs) next.media[ref.id] = { ...next.media[ref.id], ...ref }
  return next
}

// ============================================================
// Command handlers (operate on a deep clone; throw CommandFailure)
// ============================================================

function applyAddClips(
  draft: Timeline,
  command: Extract<EditorCommand, { type: "add_clips" }>,
  ids: ReturnType<typeof makeIdFactory>,
  created: { clipIds: string[]; mediaIds: string[] },
): void {
  if (!Array.isArray(command.clips) || command.clips.length === 0) fail("invalid_args", "add_clips needs at least one clip")
  const fps = draft.sequence.fps

  for (const input of command.clips) {
    const track = findTrack(draft, input.trackId)
    if (!track) fail("not_found", `Track ${input.trackId} does not exist`)

    // Resolve the media / kind.
    let mediaId: string | null = null
    let kind: ClipKind
    let media: MediaRef | null = null
    let text: ClipText | null = null

    if (input.text || track.kind === "text") {
      if (!input.text || typeof input.text.text !== "string" || !input.text.text.trim()) {
        fail("invalid_args", "Text clip needs non-empty text")
      }
      kind = "text"
      text = {
        text: input.text.text,
        fontSize: Number.isFinite(input.text.fontSize) ? input.text.fontSize : 8,
        color: typeof input.text.color === "string" ? input.text.color : "#ffffff",
        ...(input.text.fontFamily ? { fontFamily: input.text.fontFamily } : {}),
        ...(input.text.fontWeight ? { fontWeight: input.text.fontWeight } : {}),
        ...(input.text.italic !== undefined ? { italic: input.text.italic } : {}),
        ...(input.text.textAlign ? { textAlign: input.text.textAlign } : {}),
        ...(input.text.shadow !== undefined ? { shadow: input.text.shadow } : {}),
        ...(input.text.motion ? { motion: input.text.motion } : {}),
      }
    } else if (input.media) {
      const id = ids.media()
      media = {
        id,
        url: input.media.url,
        kind: input.media.kind,
        ...(input.media.label ? { label: input.media.label } : {}),
        ...(input.media.durationFrames ? { durationFrames: clampFrames(input.media.durationFrames) } : {}),
      }
      if (!media.url || (media.kind !== "video" && media.kind !== "image" && media.kind !== "audio")) {
        fail("invalid_args", "Inline media needs a url and a valid kind")
      }
      draft.media[id] = media
      created.mediaIds.push(id)
      mediaId = id
      kind = media.kind
    } else if (input.mediaId) {
      media = draft.media[input.mediaId] ?? null
      if (!media) fail("not_found", `Media ${input.mediaId} is not in the catalogue`)
      mediaId = media.id
      kind = media.kind
    } else {
      fail("invalid_args", "add_clips item needs mediaId, media, or text")
    }

    if (!clipKindAllowedOnTrack(kind!, track.kind)) {
      fail("invalid_args", `A ${kind!} clip cannot go on a ${track.kind} track`)
    }

    const durationFrames = clampFrames(
      input.durationFrames && input.durationFrames > 0 ? input.durationFrames : defaultDurationFrames(kind!, media, fps),
    )
    const trimStartFrame = clampFrames(input.trimStartFrame ?? 0)
    const trimEndFrame = clampFrames(input.trimEndFrame ?? 0)
    if (durationFrames - trimStartFrame - trimEndFrame < MIN_CLIP_FRAMES) {
      fail("invalid_args", "Clip trims leave no visible content")
    }

    const clipId = input.id ?? ids.clip()
    if (draft.clips[clipId]) fail("invalid_args", `Clip id ${clipId} already exists`)
    const startFrame = clampFrames(input.startFrame ?? appendStartFrame(draft, track.id))

    const clip: Clip = {
      id: clipId,
      trackId: track.id,
      kind: kind!,
      mediaId,
      startFrame,
      durationFrames,
      trimStartFrame,
      trimEndFrame,
      linkedClipId: null,
      transform: input.transform ?? null,
      crop: input.crop ?? null,
      text,
    }
    draft.clips[clipId] = clip
    insertInStartOrder(draft, track, clipId)
    created.clipIds.push(clipId)

    // A video carries audio: drop a linked companion on the first audio track.
    const wantsCompanion = kind === "video" && track.kind === "media" && input.linkAudio !== false
    if (wantsCompanion) {
      const audioTrack = firstTrackOfKind(draft, "audio")
      if (audioTrack) {
        const companionId = input.id ? `${input.id}__audio` : ids.clip()
        if (!draft.clips[companionId]) {
          const companion: Clip = {
            id: companionId,
            trackId: audioTrack.id,
            kind: "audio",
            mediaId,
            startFrame,
            durationFrames,
            trimStartFrame,
            trimEndFrame,
            linkedClipId: clipId,
            transform: null,
            crop: null,
            text: null,
          }
          draft.clips[companionId] = companion
          draft.clips[clipId].linkedClipId = companionId
          insertInStartOrder(draft, audioTrack, companionId)
          created.clipIds.push(companionId)
        }
      }
    }
  }
}

function applyMoveClip(draft: Timeline, command: Extract<EditorCommand, { type: "move_clip" }>): void {
  const clip = findClip(draft, command.clipId)
  if (!clip) fail("not_found", `Clip ${command.clipId} does not exist`)
  const targetTrackId = command.trackId ?? clip.trackId
  const targetTrack = findTrack(draft, targetTrackId)
  if (!targetTrack) fail("not_found", `Track ${targetTrackId} does not exist`)
  if (!clipKindAllowedOnTrack(clip.kind, targetTrack.kind)) {
    fail("invalid_args", `A ${clip.kind} clip cannot move to a ${targetTrack.kind} track`)
  }
  if (!Number.isFinite(command.startFrame) || command.startFrame < 0) {
    fail("invalid_args", "move_clip startFrame must be a non-negative number")
  }

  // Detach from current track, attach to target.
  const currentTrack = findTrack(draft, clip.trackId)
  if (currentTrack) currentTrack.clipIds = currentTrack.clipIds.filter((id) => id !== clip.id)
  clip.trackId = targetTrack.id
  clip.startFrame = clampFrames(command.startFrame)
  insertInStartOrder(draft, targetTrack, clip.id)

  // A linked A/V pair behaves as one editorial unit. The peer remains on its
  // own track, but follows the exact timeline position of the dragged clip.
  const linked = clip.linkedClipId ? findClip(draft, clip.linkedClipId) : undefined
  if (linked) {
    const linkedTrack = findTrack(draft, linked.trackId)
    if (linkedTrack) linkedTrack.clipIds = linkedTrack.clipIds.filter((id) => id !== linked.id)
    linked.startFrame = clip.startFrame
    if (linkedTrack) insertInStartOrder(draft, linkedTrack, linked.id)
  }
}

function applySetProperties(draft: Timeline, command: Extract<EditorCommand, { type: "set_clip_properties" }>): void {
  const clip = findClip(draft, command.clipId)
  if (!clip) fail("not_found", `Clip ${command.clipId} does not exist`)
  const patch = command.patch ?? {}

  if (patch.durationFrames !== undefined) {
    const d = clampFrames(patch.durationFrames)
    if (d < MIN_CLIP_FRAMES) fail("invalid_args", "durationFrames must be positive")
    clip.durationFrames = d
  }
  if (patch.trimStartFrame !== undefined) clip.trimStartFrame = clampFrames(patch.trimStartFrame)
  if (patch.trimEndFrame !== undefined) clip.trimEndFrame = clampFrames(patch.trimEndFrame)
  if (clip.durationFrames - clip.trimStartFrame - clip.trimEndFrame < MIN_CLIP_FRAMES) {
    fail("invalid_args", "Trims leave less than one visible frame")
  }

  // Timing edits are locked across linked video/audio clips. Visual properties
  // intentionally remain exclusive to the video clip.
  const linked = clip.linkedClipId ? findClip(draft, clip.linkedClipId) : undefined
  if (linked) {
    if (patch.durationFrames !== undefined) linked.durationFrames = clip.durationFrames
    if (patch.trimStartFrame !== undefined) linked.trimStartFrame = clip.trimStartFrame
    if (patch.trimEndFrame !== undefined) linked.trimEndFrame = clip.trimEndFrame
    if (linked.durationFrames - linked.trimStartFrame - linked.trimEndFrame < MIN_CLIP_FRAMES) {
      fail("invalid_args", "Linked clip trims leave less than one visible frame")
    }
  }

  if (patch.transform !== undefined) {
    clip.transform = patch.transform === null ? null : { ...DEFAULT_TRANSFORM, ...patch.transform }
  }
  if (patch.crop !== undefined) {
    clip.crop = patch.crop === null ? null : { ...DEFAULT_CROP, ...patch.crop }
  }
  if (patch.text !== undefined) {
    if (clip.kind !== "text") fail("invalid_args", "Only text clips accept a text patch")
    clip.text = {
      text: typeof patch.text.text === "string" ? patch.text.text : clip.text?.text ?? "",
      fontSize: Number.isFinite(patch.text.fontSize) ? (patch.text.fontSize as number) : clip.text?.fontSize ?? 8,
      color: typeof patch.text.color === "string" ? patch.text.color : clip.text?.color ?? "#ffffff",
      fontFamily: patch.text.fontFamily ?? clip.text?.fontFamily,
      fontWeight: patch.text.fontWeight ?? clip.text?.fontWeight,
      italic: patch.text.italic ?? clip.text?.italic,
      textAlign: patch.text.textAlign ?? clip.text?.textAlign,
      shadow: patch.text.shadow ?? clip.text?.shadow,
      motion: patch.text.motion ?? clip.text?.motion,
    }
  }
}

/** Split one clip at an absolute timeline frame; returns the new right-half id. */
function splitOne(draft: Timeline, clipId: string, atFrame: number, newId: () => string): string {
  const clip = draft.clips[clipId]
  const offset = atFrame - clip.startFrame
  const visible = visibleDurationFrames(clip)
  if (offset < MIN_CLIP_FRAMES || visible - offset < MIN_CLIP_FRAMES) {
    fail("invalid_args", `Split point is too close to clip ${clipId}'s edge`)
  }

  const rightId = newId()
  const right: Clip = {
    ...clip,
    id: rightId,
    startFrame: clip.startFrame + offset,
    trimStartFrame: clip.trimStartFrame + offset,
    trimEndFrame: clip.trimEndFrame,
    linkedClipId: null,
    // Deep-copy nested objects so the halves don't share references.
    transform: clip.transform ? { ...clip.transform } : null,
    crop: clip.crop ? { ...clip.crop } : null,
    text: clip.text ? { ...clip.text } : null,
  }
  // Left half ends at the split point.
  clip.trimEndFrame = clip.durationFrames - clip.trimStartFrame - offset

  draft.clips[rightId] = right
  const track = findTrack(draft, clip.trackId)!
  const index = track.clipIds.indexOf(clipId)
  track.clipIds.splice(index + 1, 0, rightId)
  return rightId
}

function applySplitClip(
  draft: Timeline,
  command: Extract<EditorCommand, { type: "split_clip" }>,
  ids: ReturnType<typeof makeIdFactory>,
  created: { clipIds: string[]; mediaIds: string[] },
): void {
  const clip = findClip(draft, command.clipId)
  if (!clip) fail("not_found", `Clip ${command.clipId} does not exist`)
  if (!Number.isFinite(command.atFrame)) fail("invalid_args", "split_clip atFrame must be a number")
  const atFrame = clampFrames(command.atFrame)

  const rightId = splitOne(draft, clip.id, atFrame, ids.clip)
  created.clipIds.push(rightId)

  // Keep A/V aligned: split the linked companion at the same frame if it spans it.
  const linkedId = clip.linkedClipId
  if (linkedId && draft.clips[linkedId]) {
    const peer = draft.clips[linkedId]
    const offset = atFrame - peer.startFrame
    if (offset >= MIN_CLIP_FRAMES && visibleDurationFrames(peer) - offset >= MIN_CLIP_FRAMES) {
      const rightPeerId = splitOne(draft, linkedId, atFrame, ids.clip)
      // Re-link the two right halves to each other.
      draft.clips[rightId].linkedClipId = rightPeerId
      draft.clips[rightPeerId].linkedClipId = rightId
      created.clipIds.push(rightPeerId)
    }
  }
}

function applyRemoveClips(draft: Timeline, command: Extract<EditorCommand, { type: "remove_clips" }>): void {
  if (!Array.isArray(command.clipIds) || command.clipIds.length === 0) fail("invalid_args", "remove_clips needs clip ids")
  // Expand to include linked companions (cascade), keeping A/V consistent.
  const toRemove = new Set<string>()
  for (const id of command.clipIds) {
    const clip = draft.clips[id]
    if (!clip) continue
    toRemove.add(id)
    if (clip.linkedClipId) toRemove.add(clip.linkedClipId)
  }
  if (toRemove.size === 0) fail("invalid_args", "No matching clips to remove")

  for (const id of toRemove) delete draft.clips[id]
  for (const track of draft.tracks) {
    track.clipIds = track.clipIds.filter((id) => !toRemove.has(id))
  }
  // Clear any dangling links pointing at removed clips.
  for (const clip of Object.values(draft.clips)) {
    if (clip.linkedClipId && toRemove.has(clip.linkedClipId)) clip.linkedClipId = null
  }
}

function applyReorderTrack(draft: Timeline, command: Extract<EditorCommand, { type: "reorder_track" }>): void {
  const track = findTrack(draft, command.trackId)
  if (!track) fail("not_found", `Track ${command.trackId} does not exist`)
  if (!Array.isArray(command.clipIds)) fail("invalid_args", "reorder_track needs a clipIds array")

  const current = new Set(track.clipIds)
  const next = command.clipIds
  if (next.length !== current.size || !next.every((id) => current.has(id)) || new Set(next).size !== next.length) {
    fail("invalid_args", "reorder_track clipIds must be a permutation of the track's clips")
  }

  // Ripple-repack in the new order, removing gaps (matches "pack left to right").
  let cursor = 0
  const affectedPeerTrackIds = new Set<string>()
  for (const id of next) {
    const clip = draft.clips[id]
    clip.startFrame = cursor
    cursor += visibleDurationFrames(clip)

    // Keep linked audio/video positioned with the clip being repacked.
    const linked = clip.linkedClipId ? draft.clips[clip.linkedClipId] : undefined
    if (linked) {
      linked.startFrame = clip.startFrame
      affectedPeerTrackIds.add(linked.trackId)
    }
  }
  track.clipIds = [...next]

  // Re-establish chronological order on peer tracks after their linked clips
  // followed the reordered track.
  for (const peerTrackId of affectedPeerTrackIds) {
    const peerTrack = findTrack(draft, peerTrackId)
    if (!peerTrack || peerTrack.id === track.id) continue
    peerTrack.clipIds.sort((a, b) => draft.clips[a].startFrame - draft.clips[b].startFrame)
  }
}

function applySetSequence(draft: Timeline, command: Extract<EditorCommand, { type: "set_sequence" }>): void {
  const patch = command.patch ?? {}
  if (patch.width !== undefined) {
    if (!(patch.width > 0)) fail("invalid_args", "width must be positive")
    draft.sequence.width = Math.round(patch.width)
  }
  if (patch.height !== undefined) {
    if (!(patch.height > 0)) fail("invalid_args", "height must be positive")
    draft.sequence.height = Math.round(patch.height)
  }
  if (patch.fps !== undefined) {
    const from = draft.sequence.fps
    const to = clampFps(patch.fps)
    if (to !== from) {
      // Rescale all frame fields so wall-clock timing is preserved.
      for (const media of Object.values(draft.media)) {
        if (media.durationFrames) media.durationFrames = rescaleFrames(media.durationFrames, from, to)
      }
      for (const clip of Object.values(draft.clips)) {
        clip.startFrame = rescaleFrames(clip.startFrame, from, to)
        clip.durationFrames = Math.max(MIN_CLIP_FRAMES, rescaleFrames(clip.durationFrames, from, to))
        clip.trimStartFrame = rescaleFrames(clip.trimStartFrame, from, to)
        clip.trimEndFrame = rescaleFrames(clip.trimEndFrame, from, to)
        // Rounding can erase the visible margin — clamp trims back if so.
        if (clip.durationFrames - clip.trimStartFrame - clip.trimEndFrame < MIN_CLIP_FRAMES) {
          clip.trimEndFrame = Math.max(0, clip.durationFrames - clip.trimStartFrame - MIN_CLIP_FRAMES)
        }
      }
      // Rounding can also introduce 1-frame overlaps — nudge later clips forward.
      for (const track of draft.tracks) {
        const ordered = track.clipIds
          .map((id) => draft.clips[id])
          .filter(Boolean)
          .sort((a, b) => a.startFrame - b.startFrame)
        let prevEnd = 0
        for (const clip of ordered) {
          if (clip.startFrame < prevEnd) clip.startFrame = prevEnd
          prevEnd = clipEndFrame(clip)
        }
      }
      draft.sequence.fps = to
    }
  }
}

// ============================================================
// Public entry point
// ============================================================

function describe(command: EditorCommand): string {
  switch (command.type) {
    case "add_clips":
      return `Add ${command.clips.length} clip${command.clips.length === 1 ? "" : "s"}`
    case "move_clip":
      return `Move clip ${command.clipId}`
    case "set_clip_properties":
      return `Update clip ${command.clipId}`
    case "split_clip":
      return `Split clip ${command.clipId}`
    case "remove_clips":
      return `Remove ${command.clipIds.length} clip${command.clipIds.length === 1 ? "" : "s"}`
    case "reorder_track":
      return `Reorder track ${command.trackId}`
    case "set_sequence":
      return "Update sequence settings"
  }
}

/**
 * Apply one command to a timeline. Returns a fresh timeline on success; on any
 * failure returns `{ ok: false }` and the input timeline is left untouched.
 */
export function applyCommand(timeline: Timeline, command: EditorCommand, options?: ApplyOptions): CommandResult {
  const ids = makeIdFactory(options)
  const created = { clipIds: [] as string[], mediaIds: [] as string[] }
  const draft = cloneTimeline(timeline)

  try {
    switch (command.type) {
      case "add_clips":
        applyAddClips(draft, command, ids, created)
        break
      case "move_clip":
        applyMoveClip(draft, command)
        break
      case "set_clip_properties":
        applySetProperties(draft, command)
        break
      case "split_clip":
        applySplitClip(draft, command, ids, created)
        break
      case "remove_clips":
        applyRemoveClips(draft, command)
        break
      case "reorder_track":
        applyReorderTrack(draft, command)
        break
      case "set_sequence":
        applySetSequence(draft, command)
        break
      default:
        return { ok: false, error: { code: "unsupported", message: `Unknown command ${(command as { type: string }).type}` } }
    }
  } catch (error) {
    if (error instanceof CommandFailure) return { ok: false, error: { code: error.code, message: error.message } }
    return { ok: false, error: { code: "invalid_args", message: error instanceof Error ? error.message : String(error) } }
  }

  // Self-check: never hand back a timeline that breaks model invariants.
  const validation = validateTimeline(draft)
  if (!validation.valid) {
    const overlap = validation.issues.find((i) => i.code === "track.overlap")
    const issue = overlap ?? validation.issues[0]
    return { ok: false, error: { code: overlap ? "overlap" : "invariant", message: issue.message } }
  }

  return { ok: true, timeline: draft, description: describe(command), created }
}

/**
 * Apply a batch atomically: all commands succeed against the running result, or
 * none are applied. Used by the agent (multi-step turn) and the server store.
 */
export function applyCommands(timeline: Timeline, commands: EditorCommand[], options?: ApplyOptions): CommandResult {
  let current = timeline
  const created = { clipIds: [] as string[], mediaIds: [] as string[] }
  for (let i = 0; i < commands.length; i += 1) {
    const result = applyCommand(current, commands[i], options)
    if (!result.ok) {
      return { ok: false, error: { code: result.error!.code, message: `Command ${i + 1} (${commands[i].type}): ${result.error!.message}` } }
    }
    current = result.timeline!
    created.clipIds.push(...result.created!.clipIds)
    created.mediaIds.push(...result.created!.mediaIds)
  }
  return { ok: true, timeline: current, description: `Applied ${commands.length} command${commands.length === 1 ? "" : "s"}`, created }
}
