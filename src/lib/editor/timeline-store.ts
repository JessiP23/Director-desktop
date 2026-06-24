/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Director timeline persistence layer.
 *
 * Mirrors the brief store: a versioned document (`director_timelines`, one row
 * per run) plus an append-only audit log of the commands applied at each version
 * (`director_timeline_revisions`). Optimistic concurrency on `version` keeps
 * concurrent writers (the user editing + the agent editing) from silently
 * clobbering each other. Pure functions over a Supabase client the caller picks
 * (user-scoped for HTTP routes, service-role for the runtime).
 *
 * The authoritative state is the full canonical timeline stored on the row; the
 * revision log records the EditorCommands that produced each version.
 */

import { type EditorCommand, applyCommands } from "./commands"
import { type Timeline, createEmptyTimeline } from "./timeline-model"
import { sanitizeTimeline, validateTimeline } from "./timeline-validate"

type DbClient = any

export type DirectorTimeline = {
  runId: string
  userId: string
  version: number
  timeline: Timeline
  createdAt: string
  updatedAt: string
}

type DirectorTimelineRow = {
  run_id: string
  user_id: string
  version: number
  timeline: unknown
  created_at: string
  updated_at: string
}

export class DirectorTimelineVersionConflictError extends Error {
  constructor(public expected: number, public actual: number) {
    super(`Timeline version conflict: expected ${expected}, found ${actual}`)
    this.name = "DirectorTimelineVersionConflictError"
  }
}

export class DirectorTimelineForbiddenError extends Error {
  constructor() {
    super("Director run not found or not owned by user")
    this.name = "DirectorTimelineForbiddenError"
  }
}

/** A command batch was rejected by the engine (bad input / invariant). */
export class DirectorTimelineCommandError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = "DirectorTimelineCommandError"
  }
}

function mapRow(row: DirectorTimelineRow): DirectorTimeline {
  return {
    runId: row.run_id,
    userId: row.user_id,
    version: row.version,
    // Defense in depth: the DB holds JSONB we still treat as untrusted.
    timeline: sanitizeTimeline(row.timeline),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ============================================================
// Reads
// ============================================================

export async function getDirectorTimeline(db: DbClient, runId: string): Promise<DirectorTimeline | null> {
  const { data, error } = await db
    .from("director_timelines")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRow(data as DirectorTimelineRow)
}

export async function getOrCreateDirectorTimeline(
  db: DbClient,
  params: { runId: string; userId: string },
): Promise<DirectorTimeline> {
  const existing = await getDirectorTimeline(db, params.runId)
  if (existing) return existing

  const empty = createEmptyTimeline()
  const { data, error } = await db
    .from("director_timelines")
    .insert({ run_id: params.runId, user_id: params.userId, version: 1, timeline: empty })
    .select("*")
    .single()

  if (error || !data) {
    // Race: another writer just created it. Re-read.
    const refetched = await getDirectorTimeline(db, params.runId)
    if (refetched) return refetched
    throw error || new Error("Failed to create director timeline")
  }
  return mapRow(data as DirectorTimelineRow)
}

// ============================================================
// Ownership (defense in depth alongside RLS)
// ============================================================

async function assertRunOwnership(db: DbClient, params: { runId: string; userId: string }): Promise<void> {
  const { data, error } = await db
    .from("director_runs")
    .select("id, user_id")
    .eq("id", params.runId)
    .maybeSingle()

  if (error) throw error
  if (!data || (data as any).user_id !== params.userId) throw new DirectorTimelineForbiddenError()
}

// ============================================================
// Apply commands (optimistic concurrency + audit revision)
// ============================================================

export async function applyDirectorTimelineCommands(
  db: DbClient,
  params: {
    runId: string
    userId: string
    commands: EditorCommand[]
    /** If provided and stale, the write is rejected (optimistic concurrency). */
    expectedVersion?: number
    reason?: string
  },
): Promise<DirectorTimeline> {
  await assertRunOwnership(db, { runId: params.runId, userId: params.userId })

  const current = await getOrCreateDirectorTimeline(db, { runId: params.runId, userId: params.userId })

  if (typeof params.expectedVersion === "number" && params.expectedVersion !== current.version) {
    throw new DirectorTimelineVersionConflictError(params.expectedVersion, current.version)
  }

  // Atomic engine application: all commands apply or none do.
  const result = applyCommands(current.timeline, params.commands)
  if (!result.ok) throw new DirectorTimelineCommandError(result.error!.code, result.error!.message)

  const nextVersion = current.version + 1

  // Optimistic update — guarded by version equality.
  const { data: updated, error: updateError } = await db
    .from("director_timelines")
    .update({ timeline: result.timeline, version: nextVersion })
    .eq("run_id", params.runId)
    .eq("version", current.version)
    .select("*")
    .single()

  if (updateError || !updated) {
    const latest = await getDirectorTimeline(db, params.runId)
    throw new DirectorTimelineVersionConflictError(current.version, latest?.version ?? -1)
  }

  // Append revision (best-effort — the timeline row is the source of truth).
  await db.from("director_timeline_revisions").insert({
    run_id: params.runId,
    user_id: params.userId,
    version: nextVersion,
    commands: params.commands,
    reason: params.reason ?? null,
  })

  return mapRow(updated as DirectorTimelineRow)
}

/**
 * Full-replace the timeline with a snapshot (rollback / migration import).
 * Validates the snapshot, bumps the version, records an audit revision.
 */
export async function restoreDirectorTimeline(
  db: DbClient,
  params: {
    runId: string
    userId: string
    timeline: Timeline
    /** If provided and stale, the write is rejected (optimistic concurrency). */
    expectedVersion?: number
    reason?: string
  },
): Promise<DirectorTimeline> {
  await assertRunOwnership(db, { runId: params.runId, userId: params.userId })

  const next = sanitizeTimeline(params.timeline)
  if (!validateTimeline(next).valid) throw new DirectorTimelineCommandError("invariant", "Snapshot failed validation")

  const current = await getOrCreateDirectorTimeline(db, { runId: params.runId, userId: params.userId })

  if (typeof params.expectedVersion === "number" && params.expectedVersion !== current.version) {
    throw new DirectorTimelineVersionConflictError(params.expectedVersion, current.version)
  }

  const nextVersion = current.version + 1

  const { data: updated, error: updateError } = await db
    .from("director_timelines")
    .update({ timeline: next, version: nextVersion })
    .eq("run_id", params.runId)
    .eq("version", current.version)
    .select("*")
    .single()

  if (updateError || !updated) {
    const latest = await getDirectorTimeline(db, params.runId)
    throw new DirectorTimelineVersionConflictError(current.version, latest?.version ?? -1)
  }

  await db.from("director_timeline_revisions").insert({
    run_id: params.runId,
    user_id: params.userId,
    version: nextVersion,
    commands: [{ type: "restore" }],
    reason: params.reason ?? "Timeline restored from snapshot",
  })

  return mapRow(updated as DirectorTimelineRow)
}
