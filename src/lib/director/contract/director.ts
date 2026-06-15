/*
 * ─────────────────────────────────────────────────────────────────────────
 *  DIRECTOR API CONTRACT — copied from wmstudio `src/lib/production-agent/types.ts`.
 *
 *  This is the shared boundary between the desktop app and the backend. Keep it
 *  in sync with wmstudio; ideally publish it as `@wmstudio/director-contract`
 *  and consume that instead of copying. Do NOT add desktop-only logic here.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const DIRECTOR_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type DirectorRunStatus = (typeof DIRECTOR_RUN_STATUSES)[number];

export const DIRECTOR_RUN_MODES = [
  "commercial",
  "cinematic",
  "ugc",
  "campaign",
  "video-production",
] as const;

export type DirectorRunMode = (typeof DIRECTOR_RUN_MODES)[number];

export type DirectorReference = {
  id: string;
  type: "image" | "video" | "audio" | "document" | "url";
  url?: string;
  name?: string;
  description?: string;
};

export const DIRECTOR_MODEL_IDS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.7",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-5.5",
  "openai/gpt-5.1-mini",
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
] as const;

export type DirectorModelId = (typeof DIRECTOR_MODEL_IDS)[number];

export const DIRECTOR_DEFAULT_MODEL: DirectorModelId = "anthropic/claude-sonnet-4.6";

// Model selection is locked server-side for now: every run uses AUTO_MODEL_ID
// and the UI shows a non-deselectable "Auto" toggle.
export const AUTO_MODEL_ID: DirectorModelId = "google/gemini-3-flash-preview";
export const MODEL_SELECTION_LOCKED: boolean = true;
export const AUTO_MODEL_LABEL = "Auto";

export function directorModelLabel(model: string): string {
  return MODEL_SELECTION_LOCKED ? AUTO_MODEL_LABEL : model;
}

// Names of the Director delegation tools. Single source of truth shared by the
// orchestrator runtime and the chat UI (activity rows + i18n labels).
export const DIRECTOR_DELEGATION_TOOL_NAMES = [
  "delegate_media_generation",
  "delegate_screenwriter",
  "delegate_research",
  "delegate_caster",
  "delegate_editor",
] as const;

export type DirectorDelegationToolName = (typeof DIRECTOR_DELEGATION_TOOL_NAMES)[number];

/** Generation quality tier. */
export type DirectorQuality = "economic" | "premium";

export type DirectorRunInput = {
  prompt: string;
  mode: DirectorRunMode;
  model: DirectorModelId;
  projectId?: string;
  brandContext?: string;
  targetFormat?: string;
  aspectRatio?: string;
  references: DirectorReference[];
  autoProceed?: boolean;
  quality?: DirectorQuality;
};

export type DirectorRun = {
  id: string;
  userId: string;
  orgId?: string | null;
  projectId?: string | null;
  title: string;
  mode: DirectorRunMode;
  status: DirectorRunStatus;
  input: DirectorRunInput;
  metadata: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type DirectorEventType =
  | "user.message"
  | "run.started"
  | "message.delta"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "brief.updated"
  | "video.production.started"
  | "video.production.step"
  | "video.production.asset.generated"
  | "video.production.critique"
  | "video.production.timeline.updated"
  | "video.production.memory.write";

export type DirectorEvent = {
  id: string;
  runId: string;
  type: DirectorEventType;
  timestamp: string;
  message?: string;
  data?: Record<string, unknown>;
  brief?: unknown;
};

export const DIRECTOR_HISTORY_TOKEN_BUDGET_DEFAULT = 30_000;

/** Approximate token count for context budgeting (~4 chars per token). */
export function estimateDirectorTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
