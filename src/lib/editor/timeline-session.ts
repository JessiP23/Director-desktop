/**
 * Undo/redo controller around the command engine.
 *
 * A session holds the authoritative `present` timeline plus snapshot stacks.
 * Snapshot (not inverse-command) undo is used deliberately: because every
 * command already produces a brand-new, fully-validated timeline (see
 * ./commands), pushing the prior snapshot is correct by construction for ALL
 * commands — including split and remove, where computing a correct inverse
 * command is fiddly. This is the same trade-off the brief store makes (store
 * the whole document, keep an audit log of patches).
 *
 * The session is the bridge that lets the React UI and the Editor agent share
 * one mutation + history model: both call `apply` / `undo` / `redo`.
 *
 * Pure module — safe on client and server.
 */

import {
  type ApplyOptions,
  type CommandResult,
  type EditorCommand,
  applyCommand,
  applyCommands,
} from "./commands"
import { type Timeline } from "./timeline-model"

const DEFAULT_HISTORY_LIMIT = 100

export type TimelineSessionOptions = ApplyOptions & {
  /** Max undo depth kept in memory. Default 100. */
  historyLimit?: number
}

export class TimelineSession {
  private past: Timeline[] = []
  private present: Timeline
  private future: Timeline[] = []
  private readonly options: ApplyOptions
  private readonly historyLimit: number

  constructor(initial: Timeline, options: TimelineSessionOptions = {}) {
    this.present = initial
    this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
    this.options = options.newId ? { newId: options.newId } : {}
  }

  /** The current authoritative timeline. */
  get timeline(): Timeline {
    return this.present
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  /** Number of undo steps currently available. */
  get historyDepth(): number {
    return this.past.length
  }

  private commit(timeline: Timeline): void {
    this.past.push(this.present)
    if (this.past.length > this.historyLimit) this.past.shift()
    this.present = timeline
    this.future = [] // a new edit invalidates the redo branch
  }

  /**
   * Apply one command. On success the previous state becomes undoable; on
   * failure the session is unchanged and the structured error is returned.
   */
  apply(command: EditorCommand): CommandResult {
    const result = applyCommand(this.present, command, this.options)
    if (result.ok) this.commit(result.timeline!)
    return result
  }

  /** Apply a batch atomically as a SINGLE undo step. */
  applyBatch(commands: EditorCommand[]): CommandResult {
    const result = applyCommands(this.present, commands, this.options)
    if (result.ok) this.commit(result.timeline!)
    return result
  }

  /** Step back one edit. Returns false when there is nothing to undo. */
  undo(): boolean {
    const previous = this.past.pop()
    if (!previous) return false
    this.future.push(this.present)
    this.present = previous
    return true
  }

  /** Re-apply the most recently undone edit. */
  redo(): boolean {
    const next = this.future.pop()
    if (!next) return false
    this.past.push(this.present)
    this.present = next
    return true
  }

  /** Replace the timeline and clear history (e.g. after loading another run). */
  reset(timeline: Timeline): void {
    this.present = timeline
    this.past = []
    this.future = []
  }
}
