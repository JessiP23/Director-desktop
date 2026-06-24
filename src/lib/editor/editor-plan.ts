/**
 * Editor timeline plan — the structured edit decision list produced by the
 * Editor specialist and applied by the editor panel timeline.
 *
 * Shared between server (agent output validation) and client (timeline
 * application), so it must stay free of runtime-only imports.
 */

export type EditorPlanTrack = "media" | "audio"

export type EditorPlanItem = {
  /** Source clip URL — must reference an already generated clip. */
  url: string
  track: EditorPlanTrack
  /** Seconds cut from the head of the clip. */
  trimStart?: number
  /** Seconds cut from the tail of the clip. */
  trimEnd?: number
}

export type EditorTimelinePlan = {
  version: 1
  /** Sequence resolution like "1920x1080"; the client validates against its options. */
  resolution?: string
  fps?: number
  /** Ordered clips: media items pack left → right on the media track. */
  items: EditorPlanItem[]
}

const MAX_PLAN_ITEMS = 60
const MAX_TRIM_SECONDS = 600

function isValidUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value) && value.length <= 2000
}

function normalizeTrim(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined
  return Math.min(value, MAX_TRIM_SECONDS)
}

/**
 * Validate an untrusted plan payload (model output or persisted event data).
 * Throws with a precise reason so the agent can observe and correct it.
 */
export function parseEditorTimelinePlan(raw: unknown): EditorTimelinePlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Editor plan must be a JSON object")
  }
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("Editor plan must contain a non-empty items array")
  }
  if (data.items.length > MAX_PLAN_ITEMS) {
    throw new Error(`Editor plan exceeds ${MAX_PLAN_ITEMS} items`)
  }

  const items: EditorPlanItem[] = data.items.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Editor plan item ${index + 1} must be an object`)
    }
    const item = entry as Record<string, unknown>
    if (!isValidUrl(item.url)) {
      throw new Error(`Editor plan item ${index + 1} is missing a valid clip url`)
    }
    if (item.track !== "media" && item.track !== "audio") {
      throw new Error(`Editor plan item ${index + 1} must target the "media" or "audio" track`)
    }
    return {
      url: item.url,
      track: item.track,
      trimStart: normalizeTrim(item.trimStart),
      trimEnd: normalizeTrim(item.trimEnd),
    }
  })

  return {
    version: 1,
    resolution: typeof data.resolution === "string" ? data.resolution : undefined,
    fps: typeof data.fps === "number" && Number.isFinite(data.fps) ? data.fps : undefined,
    items,
  }
}

/**
 * Pull the plan JSON out of the specialist's reply (fenced ```json block, or
 * the last bare top-level object). Returns the surrounding prose as the
 * editorial rationale for chat.
 */
export function extractEditorPlanFromText(text: string): { raw: unknown; rationale: string } {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i)
  if (fenced) {
    const rationale = text.replace(fenced[0], "").trim()
    return { raw: JSON.parse(fenced[1]), rationale }
  }
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const rationale = `${text.slice(0, start)}\n${text.slice(end + 1)}`.trim()
    return { raw: JSON.parse(text.slice(start, end + 1)), rationale }
  }
  throw new Error("No JSON plan found in the editor reply")
}
