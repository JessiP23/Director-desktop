/**
 * Typed client wrappers for the Director timeline HTTP API
 * (/api/director/[runId]/timeline). Thin fetch helpers so the editor UI and the
 * timeline-session hook never hand-build requests or parse responses.
 *
 * Desktop port: requests go through `buildAuthorizedRequest` (absolute backend
 * URL via `config.apiBaseUrl` + the Supabase JWT) instead of relative `/api/...`.
 * Raw `fetch` is kept (not the generic `request()` helper) so we can detect a
 * 409 conflict from the Response before it would throw.
 */

import type { EditorCommand, Timeline } from "@/lib/editor"
import type { DirectorTimeline } from "@/lib/editor/timeline-store"
import { buildAuthorizedRequest } from "@/lib/api/client"

export class TimelineApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "TimelineApiError"
  }
  /** A 409 means the version moved under us — re-read before retrying. */
  get isConflict(): boolean {
    return this.status === 409
  }
}

async function readTimeline(res: Response): Promise<DirectorTimeline> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new TimelineApiError(res.status, body.error ?? res.statusText)
  }
  return ((await res.json()) as { timeline: DirectorTimeline }).timeline
}

export async function loadTimeline(runId: string, signal?: AbortSignal): Promise<DirectorTimeline> {
  const { url, headers } = await buildAuthorizedRequest(`/api/director/${runId}/timeline`)
  return readTimeline(await fetch(url, { method: "GET", headers, signal }))
}

/** Apply a batch of commands atomically; pass `expectedVersion` for concurrency safety. */
export async function applyTimelineCommands(
  runId: string,
  commands: EditorCommand[],
  options: { expectedVersion?: number; reason?: string } = {},
): Promise<DirectorTimeline> {
  const { url, headers } = await buildAuthorizedRequest(`/api/director/${runId}/timeline`)
  return readTimeline(
    await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ commands, expectedVersion: options.expectedVersion, reason: options.reason }),
    }),
  )
}

/**
 * Replace the server timeline with a snapshot (legacy import / restore / UI save).
 * Pass `expectedVersion` to detect a concurrent agent edit (→ 409).
 */
export async function importTimeline(
  runId: string,
  timeline: Timeline,
  options: { expectedVersion?: number; reason?: string } = {},
): Promise<DirectorTimeline> {
  const { url, headers } = await buildAuthorizedRequest(`/api/director/${runId}/timeline`)
  return readTimeline(
    await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ timeline, expectedVersion: options.expectedVersion, reason: options.reason }),
    }),
  )
}
