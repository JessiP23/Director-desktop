/**
 * Media catalogue: bridge between "what the run has generated" and "what the
 * editor/agent may place".
 *
 * Generated assets live in the Director run's event log (the same source
 * collectEditorSourceClips reads). This turns them into canonical `MediaRef`s
 * with STABLE, url-derived ids, so re-deriving the catalogue across loads always
 * yields the same id for the same asset — which is what lets a stored clip's
 * `mediaId` keep matching the live catalogue, and lets the agent reference
 * assets by id without inventing urls.
 *
 * Pure module — safe on client and server.
 */

import { type MediaRef } from "./timeline-model"
import type { DirectorEvent } from "@/lib/director/contract/director"

/** Production references feed video generation but are not shots in the cut. */
export function isProductionReferenceImage(result: Record<string, unknown>): boolean {
  const scriptReference =
    typeof result.scriptReference === "string" ? result.scriptReference.trim() : ""
  const assetKind = typeof result.assetKind === "string" ? result.assetKind.trim() : ""
  return result.sceneSheet === true || Boolean(scriptReference) || Boolean(assetKind)
}

/**
 * Deterministic, collision-resistant id for an asset url (FNV-1a → base36).
 * The SAME url always maps to the SAME media id, everywhere (catalogue sync,
 * legacy migration), so ids are reproducible rather than positional.
 */
export function mediaIdFromUrl(url: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `media-${(hash >>> 0).toString(36)}`
}

/**
 * Collect the placeable assets generated so far in a run, from its persisted
 * events. Deterministic (never model-provided) — mirrors collectEditorSourceClips
 * so the catalogue only ever contains media that actually exists. Deduped by
 * url, last occurrence wins for the label (a regenerated asset updates it).
 */
export function collectTimelineMedia(events: DirectorEvent[]): MediaRef[] {
  const byUrl = new Map<string, MediaRef>()
  for (const event of events) {
    if (event.type !== "tool.completed") continue
    if (event.message !== "generate_image" && event.message !== "generate_video") continue
    const raw = event.data?.result
    if (typeof raw !== "string") continue
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
    if (!parsed || parsed.success !== true) continue
    if (event.message === "generate_image" && isProductionReferenceImage(parsed)) continue
    const url =
      typeof parsed.imageUrl === "string"
        ? parsed.imageUrl
        : typeof parsed.videoUrl === "string"
          ? parsed.videoUrl
          : typeof parsed.audioUrl === "string"
            ? parsed.audioUrl
            : null
    if (!url) continue
    const kind: MediaRef["kind"] =
      event.message === "generate_video" ? "video" : typeof parsed.audioUrl === "string" ? "audio" : "image"
    byUrl.set(url, {
      id: mediaIdFromUrl(url),
      url,
      kind,
      ...(typeof parsed.prompt === "string" && parsed.prompt.trim() ? { label: parsed.prompt.slice(0, 280) } : {}),
    })
  }
  return [...byUrl.values()]
}

/**
 * Build catalogue refs from already-resolved UI sources (e.g. the editor's
 * EditorClip list: generated + uploaded clips with a url/kind). Same stable,
 * url-derived ids as collectTimelineMedia, deduped by url (last wins).
 */
export function mediaRefsFromSources(
  sources: Array<{ url: string; kind: string; label?: string }>,
): MediaRef[] {
  const byUrl = new Map<string, MediaRef>()
  for (const source of sources) {
    if (!source.url) continue
    if (source.kind !== "video" && source.kind !== "image" && source.kind !== "audio") continue
    byUrl.set(source.url, {
      id: mediaIdFromUrl(source.url),
      url: source.url,
      kind: source.kind,
      ...(source.label && source.label.trim() ? { label: source.label.slice(0, 280) } : {}),
    })
  }
  return [...byUrl.values()]
}
