/*
 * ─────────────────────────────────────────────────────────────────────────
 *  Stream folding — copied from wmstudio
 *  `src/app/[locale]/dashboard/director/lib/stream.ts`.
 *
 *  Pure, framework-agnostic: folds the persisted Director event log into the
 *  ordered `StreamItem`s the conversation renders (user/agent messages,
 *  ephemeral activity rows, generation + confirmation cards). Only the import
 *  path was changed for this repo. Keep behaviour identical to the backend's.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { DIRECTOR_DELEGATION_TOOL_NAMES, type DirectorEvent } from "@/lib/director/contract/director";

export type GenerationToolStatus = "running" | "completed" | "failed" | "awaiting-confirmation";
export type GenerationResultKind = "image" | "video" | "audio" | "other";
export type ActivityStatus = "running" | "completed" | "failed";

export type StreamItem =
  | { kind: "user"; id: string; text: string; timestamp: string; references?: Array<{ type: string; url?: string; name?: string }> }
  | { kind: "message"; id: string; text: string; timestamp: string }
  | { kind: "system"; id: string; tone: "error" | "success" | "info"; text: string; timestamp: string }
  | {
      kind: "tool-generation";
      id: string;
      toolCallId: string;
      toolName: string;
      status: GenerationToolStatus;
      args?: Record<string, unknown>;
      aspectRatio?: string;
      referenceImageUrls?: string[];
      resultUrl?: string;
      resultKind?: GenerationResultKind;
      errorMessage?: string;
      previewMessage?: string;
      previewCredits?: number;
      confirmed?: boolean;
      timestamp: string;
    }
  | {
      kind: "activity";
      id: string;
      toolCallId: string;
      toolName: string;
      status: ActivityStatus;
      args?: Record<string, unknown>;
      errorMessage?: string;
      timestamp: string;
    };

export function isGenerativeTool(name: string | undefined | null): boolean {
  return !!name;
}

// Internal Director steps rendered as collapsible activity rows.
const ACTIVITY_TOOLS = new Set<string>([...DIRECTOR_DELEGATION_TOOL_NAMES, "write_todos"]);

// Composio connector tools arrive in SCREAMING_SNAKE_CASE; render as activity.
export function isConnectorTool(name: string | undefined | null): boolean {
  return !!name && /^[A-Z][A-Z0-9_]*$/.test(name);
}

export function isActivityTool(name: string | undefined | null): boolean {
  return !!name && (ACTIVITY_TOOLS.has(name) || isConnectorTool(name));
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(?:\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(?:\?.*)?$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)(?:\?.*)?$/i;

function classifyUrl(url: string): GenerationResultKind {
  if (IMAGE_EXT.test(url)) return "image";
  if (VIDEO_EXT.test(url)) return "video";
  if (AUDIO_EXT.test(url)) return "audio";
  return "other";
}

function pickAspectRatioFromObject(obj: Record<string, unknown>): string | undefined {
  for (const key of ["aspectRatio", "aspect_ratio", "ratio", "outputAspectRatio", "output_aspect_ratio"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickReferenceImageUrlsFromObject(obj: Record<string, unknown>): string[] | undefined {
  const urls: string[] = [];
  for (const key of ["referenceImageUrls", "reference_image_urls"]) {
    const value = obj[key];
    if (!Array.isArray(value)) continue;
    for (const candidate of value) {
      if (typeof candidate !== "string") continue;
      const url = candidate.trim();
      if (/^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url);
    }
  }
  return urls.length > 0 ? urls : undefined;
}

function pickUrlFromObject(obj: Record<string, unknown>): {
  url: string;
  kind: GenerationResultKind;
  aspectRatio?: string;
  referenceImageUrls?: string[];
} | null {
  const candidateKeys = ["videoUrl", "audioUrl", "imageUrl", "url", "output_url", "outputUrl", "mediaUrl"];
  for (const key of candidateKeys) {
    const value = obj[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      const kind = classifyUrl(value);
      const referenceImageUrls = pickReferenceImageUrlsFromObject(obj) ?? [];
      const sourceImage = obj.imageUrl;
      if (
        (key === "videoUrl" || kind === "video") &&
        typeof sourceImage === "string" &&
        /^https?:\/\//i.test(sourceImage) &&
        sourceImage !== value &&
        !referenceImageUrls.includes(sourceImage)
      ) {
        referenceImageUrls.push(sourceImage);
      }
      return {
        url: value,
        kind,
        aspectRatio: pickAspectRatioFromObject(obj),
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      };
    }
  }
  return null;
}

function inferKindFromToolName(toolName: string | undefined | null): GenerationResultKind | null {
  if (!toolName) return null;
  if (/(generate_video|video_enhance|ugc_room|extend_video)/i.test(toolName)) return "video";
  if (/(generate_image|upscale_image|brandshot|camera_angles|casting|digital_twin|storyboard_frames)/i.test(toolName)) return "image";
  if (/(generate_music|music|voiceover|voice_over|tts|sound|audio|speech)/i.test(toolName)) return "audio";
  return null;
}

export function parsePreviewResult(
  raw: string | undefined | null,
): { message?: string; credits?: number } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stringMatch = trimmed.match(/^preview\s*:\s*([\s\S]+?)(?:\s*\(cost:\s*(\d+)\s*credits?\))?\s*$/i);
  if (stringMatch) {
    return {
      message: stringMatch[1].trim(),
      credits: stringMatch[2] ? Number(stringMatch[2]) : undefined,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const isPreview = obj.preview === true || obj.requiresConfirmation === true || obj.requires_confirmation === true;
      if (!isPreview) return null;
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.description === "string"
            ? obj.description
            : undefined;
      const credits =
        typeof obj.estimatedCredits === "number"
          ? obj.estimatedCredits
          : typeof obj.credits === "number"
            ? obj.credits
            : typeof obj.cost === "number"
              ? obj.cost
              : undefined;
      return { message, credits };
    }
  } catch {
    // Not JSON.
  }

  return null;
}

export function isPreviewResult(raw: string | Record<string, unknown> | undefined | null): boolean {
  if (!raw) return false;

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return obj.preview === true || obj.requiresConfirmation === true || obj.requires_confirmation === true;
  }

  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^preview\s*:/i.test(trimmed)) return true;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (obj.preview === true || obj.requiresConfirmation === true || obj.requires_confirmation === true) {
        return true;
      }
    }
  } catch {
    // Not JSON.
  }
  return false;
}

export function extractGenerationResult(
  raw: string | undefined | null,
  toolName?: string | undefined | null,
): { url: string; kind: GenerationResultKind; aspectRatio?: string; referenceImageUrls?: string[] } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fallbackKind = inferKindFromToolName(toolName);
  const resolveKind = (url: string): GenerationResultKind => {
    const fromUrl = classifyUrl(url);
    if (fromUrl !== "other") return fromUrl;
    return fallbackKind ?? "other";
  };

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, kind: resolveKind(trimmed) };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const picked = pickUrlFromObject(parsed as Record<string, unknown>);
      if (picked) {
        return {
          url: picked.url,
          kind: picked.kind !== "other" ? picked.kind : resolveKind(picked.url),
          aspectRatio: picked.aspectRatio,
          referenceImageUrls: picked.referenceImageUrls,
        };
      }
    }
  } catch {
    // Not JSON — try to find a URL in the text.
  }

  const urlMatch = trimmed.match(/https?:\/\/[^\s"')]+/i);
  if (urlMatch) {
    return { url: urlMatch[0], kind: resolveKind(urlMatch[0]) };
  }

  return null;
}

export function isTerminalEvent(event: DirectorEvent): boolean {
  return (
    event.type === "run.completed" ||
    event.type === "run.failed" ||
    event.type === "run.cancelled"
  );
}

export function parseDirectorEventData(data: string): DirectorEvent | null {
  try {
    const parsed = JSON.parse(data) as DirectorEvent;
    if (!parsed || typeof parsed !== "object" || !parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getToolCallId(event: DirectorEvent): string | null {
  const data = event.data;
  if (!data) return null;
  const id = (data as Record<string, unknown>).toolCallId;
  return typeof id === "string" && id ? id : null;
}

// Injected silently before a prompt when a generation is deleted; strip it.
const SYSTEM_NOTE_RE = /^\[System note:[^\]]*\]\n\n/;

export function stripDirectorSystemNote(text: string): string {
  return text.replace(SYSTEM_NOTE_RE, "");
}

export function buildStream(events: DirectorEvent[]): StreamItem[] {
  const items: StreamItem[] = [];
  let activeMessage: Extract<StreamItem, { kind: "message" }> | null = null;
  const toolItemsByCallId = new Map<string, Extract<StreamItem, { kind: "tool-generation" }>>();
  const activityByCallId = new Map<string, Extract<StreamItem, { kind: "activity" }>>();

  const removeActivity = (item: Extract<StreamItem, { kind: "activity" }>) => {
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);
    activityByCallId.delete(item.toolCallId);
  };

  const finalizeActivities = (status: ActivityStatus) => {
    for (const item of [...activityByCallId.values()]) {
      if (item.status !== "running") continue;
      if (status === "completed") removeActivity(item);
      else item.status = status;
    }
  };

  const appendMessage = (event: DirectorEvent) => {
    if (!event.message) return;
    if (activeMessage) {
      activeMessage.text += event.message;
      activeMessage.timestamp = event.timestamp;
      return;
    }

    activeMessage = {
      kind: "message",
      id: event.id,
      text: event.message,
      timestamp: event.timestamp,
    };
    items.push(activeMessage);
  };

  const closeMessage = () => {
    activeMessage = null;
  };

  for (const event of events) {
    if (event.type === "run.completed" || event.type === "run.cancelled" || event.type === "run.failed") {
      closeMessage();
    }

    switch (event.type) {
      case "user.message":
        closeMessage();
        for (const item of items) {
          if (item.kind === "tool-generation" && item.status === "awaiting-confirmation" && !item.confirmed) {
            item.confirmed = true;
          }
        }
        if (event.message) {
          const refs = (event.data as { references?: Array<{ type: string; url?: string; name?: string }> } | undefined)?.references;
          items.push({
            kind: "user",
            id: event.id,
            text: stripDirectorSystemNote(event.message),
            timestamp: event.timestamp,
            references: refs && refs.length > 0 ? refs : undefined,
          });
        }
        break;

      case "message.delta":
        appendMessage(event);
        break;

      case "tool.started": {
        const toolName = event.message || "";
        if (!isGenerativeTool(toolName)) break;

        closeMessage();
        const callId = getToolCallId(event) || event.id;
        const args = (event.data && (event.data as Record<string, unknown>).args) as
          | Record<string, unknown>
          | undefined;

        if (isActivityTool(toolName)) {
          const item: Extract<StreamItem, { kind: "activity" }> = {
            kind: "activity",
            id: event.id,
            toolCallId: callId,
            toolName,
            status: "running",
            args,
            timestamp: event.timestamp,
          };
          activityByCallId.set(callId, item);
          items.push(item);
          break;
        }

        const item: Extract<StreamItem, { kind: "tool-generation" }> = {
          kind: "tool-generation",
          id: event.id,
          toolCallId: callId,
          toolName,
          status: "running",
          args,
          timestamp: event.timestamp,
        };
        toolItemsByCallId.set(callId, item);
        items.push(item);
        break;
      }

      case "tool.completed": {
        const toolName = event.message || "";
        if (!isGenerativeTool(toolName)) break;

        const callId = getToolCallId(event);
        if (!callId) break;

        if (isActivityTool(toolName)) {
          const existing = activityByCallId.get(callId);
          if (existing) removeActivity(existing);
          break;
        }

        const rawResult = (event.data && (event.data as Record<string, unknown>).result) as
          | string
          | undefined;

        if (isPreviewResult(rawResult)) {
          const preview = parsePreviewResult(rawResult);
          const existing = toolItemsByCallId.get(callId);
          if (existing) {
            existing.status = "awaiting-confirmation";
            existing.previewMessage = preview?.message;
            existing.previewCredits = preview?.credits;
            existing.timestamp = event.timestamp;
          } else {
            const item: Extract<StreamItem, { kind: "tool-generation" }> = {
              kind: "tool-generation",
              id: event.id,
              toolCallId: callId,
              toolName,
              status: "awaiting-confirmation",
              previewMessage: preview?.message,
              previewCredits: preview?.credits,
              timestamp: event.timestamp,
            };
            toolItemsByCallId.set(callId, item);
            items.push(item);
          }
          break;
        }

        const existing = toolItemsByCallId.get(callId);
        const parsedResult = extractGenerationResult(rawResult, toolName);

        if (existing) {
          existing.status = "completed";
          existing.resultUrl = parsedResult?.url;
          existing.resultKind = parsedResult?.kind;
          existing.aspectRatio = parsedResult?.aspectRatio;
          existing.referenceImageUrls = parsedResult?.referenceImageUrls;
          existing.timestamp = event.timestamp;
        } else {
          const item: Extract<StreamItem, { kind: "tool-generation" }> = {
            kind: "tool-generation",
            id: event.id,
            toolCallId: callId,
            toolName,
            status: "completed",
            resultUrl: parsedResult?.url,
            resultKind: parsedResult?.kind,
            aspectRatio: parsedResult?.aspectRatio,
            referenceImageUrls: parsedResult?.referenceImageUrls,
            timestamp: event.timestamp,
          };
          toolItemsByCallId.set(callId, item);
          items.push(item);
        }
        break;
      }

      case "tool.failed": {
        const data = (event.data || {}) as Record<string, unknown>;
        const toolName = typeof data.toolName === "string" ? data.toolName : "";
        if (!isGenerativeTool(toolName)) break;

        const callId = typeof data.toolCallId === "string" ? data.toolCallId : null;
        if (!callId) break;

        if (isActivityTool(toolName)) {
          const existing = activityByCallId.get(callId);
          if (existing) {
            existing.status = "failed";
            existing.errorMessage = event.message;
            existing.timestamp = event.timestamp;
          } else {
            const item: Extract<StreamItem, { kind: "activity" }> = {
              kind: "activity",
              id: event.id,
              toolCallId: callId,
              toolName,
              status: "failed",
              errorMessage: event.message,
              timestamp: event.timestamp,
            };
            activityByCallId.set(callId, item);
            items.push(item);
          }
          break;
        }

        const existing = toolItemsByCallId.get(callId);
        if (existing) {
          existing.status = "failed";
          existing.errorMessage = event.message;
          existing.timestamp = event.timestamp;
        } else {
          const item: Extract<StreamItem, { kind: "tool-generation" }> = {
            kind: "tool-generation",
            id: event.id,
            toolCallId: callId,
            toolName,
            status: "failed",
            errorMessage: event.message,
            timestamp: event.timestamp,
          };
          toolItemsByCallId.set(callId, item);
          items.push(item);
        }
        break;
      }

      case "run.completed":
        closeMessage();
        finalizeActivities("completed");
        break;

      case "run.cancelled":
        closeMessage();
        finalizeActivities("failed");
        break;

      case "run.failed":
        closeMessage();
        finalizeActivities("failed");
        items.push({
          kind: "system",
          id: event.id,
          tone: "error",
          text: event.message || "Run failed.",
          timestamp: event.timestamp,
        });
        break;

      case "run.started":
      default:
        break;
    }
  }

  return items;
}

export function collectGenerationResultUrls(items: StreamItem[]): Set<string> {
  const urls = new Set<string>();
  for (const item of items) {
    if (item.kind === "tool-generation" && item.resultUrl) {
      urls.add(item.resultUrl);
    }
  }
  return urls;
}
