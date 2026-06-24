/**
 * Resolution of an Editor timeline plan against the clips available in the
 * editor panel. Pure logic, extracted from the panel for testability.
 */

import type { EditorTimelinePlan } from "@/lib/editor/editor-plan"
import type { DirectorEvent } from "@/lib/director/contract/director"
import { parseEditorTimelinePlan } from "@/lib/editor/editor-plan"

/** Minimal clip shape needed to resolve a plan (subset of EditorClip). */
type ResolvableClip = {
  id: string
  url: string
  kind: string
}

export type ResolvedPlanItem = {
  clipId: string
  kind: "image" | "video" | "audio"
  track: "media" | "audio"
  trim?: { start: number; end: number }
}

/**
 * Match plan items to concrete clips by URL, in plan order. Items whose URL
 * has no matching clip are skipped (the clip may not have streamed in yet);
 * a clip is placed at most once.
 */
export function resolveEditorPlanItems(
  plan: EditorTimelinePlan,
  clips: ResolvableClip[],
): ResolvedPlanItem[] {
  const byUrl = new Map<string, ResolvableClip>()
  for (const clip of clips) {
    if ((clip.kind === "image" || clip.kind === "video" || clip.kind === "audio") && clip.url) {
      if (!byUrl.has(clip.url)) byUrl.set(clip.url, clip)
    }
  }

  const placed = new Set<string>()
  const resolved: ResolvedPlanItem[] = []
  for (const item of plan.items) {
    const clip = byUrl.get(item.url)
    if (!clip || placed.has(clip.id)) continue
    placed.add(clip.id)
    const trimStart = item.trimStart ?? 0
    const trimEnd = item.trimEnd ?? 0
    resolved.push({
      clipId: clip.id,
      kind: clip.kind as ResolvedPlanItem["kind"],
      track: item.track,
      trim: trimStart > 0 || trimEnd > 0 ? { start: trimStart, end: trimEnd } : undefined,
    })
  }
  return resolved
}

export type AgentTimelinePlan = { id: string; plan: EditorTimelinePlan }

/** Latest valid Editor plan persisted in the run events, if any. */
export function latestEditorPlan(events: DirectorEvent[]): AgentTimelinePlan | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== "video.production.timeline.updated") continue
    try {
      const plan = parseEditorTimelinePlan((event.data as { plan?: unknown } | undefined)?.plan)
      return { id: event.id, plan }
    } catch {
      // Malformed historical payload — keep scanning for an older valid plan.
    }
  }
  return null
}

/**
 * Version of the latest canonical-timeline sync the Editor agent signalled
 * (`video.production.timeline.synced`), or 0 if none yet. The editor panel uses
 * this as a refetch token: when it increases, the agent persisted a new
 * revision and the panel re-pulls authoritative server state. Unlike the legacy
 * plan, this carries no payload to apply — just a pointer to "reload the store".
 */
export function latestTimelineSyncVersion(events: DirectorEvent[]): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== "video.production.timeline.synced") continue
    const version = (event.data as { version?: unknown } | undefined)?.version
    return typeof version === "number" && Number.isFinite(version) ? version : 0
  }
  return 0
}
