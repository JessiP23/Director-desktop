/**
 * Timeline bootstrap: decide which timeline to start an editing session from.
 *
 * During the transition off localStorage there are two possible sources: the
 * authoritative server timeline (canonical, versioned) and the legacy
 * localStorage blob. This pure decision picks one and flags whether a one-time
 * import to the server is needed — keeping the network/React glue (the hook)
 * trivial and the policy unit-testable.
 *
 * Policy: the server wins as soon as it holds real content; otherwise a legacy
 * blob is migrated and marked for import; otherwise we start empty. So existing
 * timelines are never lost, and the migration runs exactly once per run.
 *
 * Pure module — safe on client and server.
 */

import { type Timeline, createEmptyTimeline } from "./timeline-model"
import {
  type LegacyMigrationContext,
  type LegacyPersistedTimeline,
  migrateLegacyTimeline,
} from "./migrate-legacy"

export function isEmptyTimeline(timeline: Timeline): boolean {
  return Object.keys(timeline.clips).length === 0
}

export type TimelineBootstrap = {
  timeline: Timeline
  /** True when `timeline` came from legacy migration and must be pushed to the server. */
  needsImport: boolean
  source: "server" | "legacy" | "empty"
}

export function resolveInitialTimeline(args: {
  /** The server's current timeline, or null if it could not be loaded. */
  server: Timeline | null
  /** The legacy localStorage blob, if any. */
  legacy?: LegacyPersistedTimeline | null
  /** Stream context needed to resolve legacy generated-clip urls/durations. */
  legacyContext?: LegacyMigrationContext
}): TimelineBootstrap {
  if (args.server && !isEmptyTimeline(args.server)) {
    return { timeline: args.server, needsImport: false, source: "server" }
  }

  if (args.legacy) {
    const migrated = migrateLegacyTimeline(args.legacy, args.legacyContext ?? {})
    if (!isEmptyTimeline(migrated)) {
      return { timeline: migrated, needsImport: true, source: "legacy" }
    }
  }

  return { timeline: args.server ?? createEmptyTimeline(), needsImport: false, source: "empty" }
}
