import * as React from "react";
import { X } from "lucide-react";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { compareScriptReference } from "@/lib/director/production-timeline";
import type { StreamItem } from "@/lib/director/stream";
import { cn } from "@/lib/utils/cn";
import { useTranslations } from "@/lib/i18n";
import { GenerationMedia } from "./media-view";

/**
 * The production timeline as a native slide-over: the brief's user-confirmed
 * clips (`scriptClips`) in screenplay order, with one master player and a
 * lightweight filmstrip below. Only the selected clip mounts a `<video>` — the
 * filmstrip uses approved frame posters (`scriptImages`) — so the panel stays
 * cheap no matter how many shots the edit has. Reuses `GenerationMedia`.
 */
type TimelineClip = {
  id: string;
  label: string;
  url: string;
  kind: "image" | "video" | "audio" | "other";
  prompt?: string;
  poster?: string;
};

function mediaKindFromUrl(url: string): TimelineClip["kind"] {
  if (/\.(mp4|mov|webm|m4v)(?:\?.*)?$/i.test(url)) return "video";
  if (/\.(png|jpe?g|webp|gif|avif)(?:\?.*)?$/i.test(url)) return "image";
  if (/\.(mp3|wav|m4a|aac|ogg|flac|opus)(?:\?.*)?$/i.test(url)) return "audio";
  return "other";
}

function clipsFromStream(items: StreamItem[]): TimelineClip[] {
  return items
    .filter((item): item is Extract<StreamItem, { kind: "tool-generation" }> => item.kind === "tool-generation" && item.status === "completed" && Boolean(item.resultUrl))
    .map((item, index) => ({
      id: item.id,
      label: item.toolName || `Generated asset ${index + 1}`,
      url: item.resultUrl || "",
      kind: item.resultKind ?? mediaKindFromUrl(item.resultUrl || ""),
      prompt: item.previewMessage,
      poster: item.resultKind === "video" ? item.referenceImageUrls?.[0] : undefined,
    }));
}

function clipsFromBrief(brief: DirectorBrief | null): TimelineClip[] {
  const scriptClips = brief?.sections?.scriptClips ?? [];
  const posterByRef = new Map<string, string>();
  for (const image of brief?.sections?.scriptImages ?? []) {
    if (!posterByRef.has(image.scriptReference)) posterByRef.set(image.scriptReference, image.url);
  }
  return [...scriptClips]
    .sort((a, b) => compareScriptReference(a.scriptReference, b.scriptReference))
    .map((clip, index) => ({
      id: `${clip.scriptReference}-${clip.url}`,
      label: clip.scriptReference || `Shot ${index + 1}`,
      url: clip.url,
      kind: "video",
      prompt: clip.prompt,
      poster: posterByRef.get(clip.scriptReference),
    }));
}

export function TimelinePanel({
  brief,
  items,
  isOpen,
  onClose,
}: {
  brief: DirectorBrief | null;
  items: StreamItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("director.references");

  const clips = React.useMemo(() => {
    const confirmed = clipsFromBrief(brief);
    return confirmed.length > 0 ? confirmed : clipsFromStream(items);
  }, [brief, items]);

  const [selected, setSelected] = React.useState(0);
  // Keep the selection valid as the edit grows/shrinks.
  React.useEffect(() => {
    if (selected > clips.length - 1) setSelected(Math.max(0, clips.length - 1));
  }, [clips.length, selected]);

  const active = clips[selected];

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "material fixed inset-y-3 right-0 z-50 flex w-[clamp(560px,52vw,1000px)] max-w-[96vw] flex-col overflow-hidden rounded-l-xl bg-material-popover text-text shadow-[var(--shadow-pop)] transition-transform duration-[250ms] ease-out will-change-transform",
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-between px-4 shadow-[inset_0_-0.5px_0_var(--separator)]">
        <h2 className="text-sm font-semibold text-text">Timeline</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-7 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-fill hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-text-tertiary">
          {t("brief.empty")}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Master player */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-5">
            <div className="flex w-full max-w-3xl items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
              <span className="grid size-5 place-items-center rounded bg-fill tabular-nums text-text-secondary">
                {selected + 1}
              </span>
              <span className="truncate">{active?.label}</span>
            </div>
            {active && (
              <div className="w-full max-w-3xl overflow-hidden rounded-lg">
                <GenerationMedia key={active.url} url={active.url} kind={active.kind} />
              </div>
            )}
            {active?.prompt && (
              <p className="line-clamp-2 w-full max-w-3xl text-xs text-text-tertiary">{active.prompt}</p>
            )}
          </div>

          {/* Filmstrip */}
          <div className="shrink-0 overflow-x-auto px-3 py-3 shadow-[inset_0_0.5px_0_var(--separator)]">
            <ol className="flex items-stretch gap-2">
              {clips.map((clip, index) => {
                const poster = clip.poster || (clip.kind === "image" ? clip.url : undefined);
                const isActive = index === selected;
                return (
                  <li key={clip.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelected(index)}
                      aria-pressed={isActive}
                      className={cn(
                        "relative block h-16 w-28 overflow-hidden rounded-md bg-surface-2 text-left transition-shadow",
                        isActive
                          ? "shadow-[0_0_0_2px_var(--accent)]"
                          : "shadow-[var(--shadow-hairline)] hover:shadow-[0_0_0_1.5px_var(--border-color)]",
                      )}
                    >
                      {poster ? (
                        <img src={poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-text-quaternary">▶</span>
                      )}
                      <span className="absolute left-1 top-1 grid size-4 place-items-center rounded bg-black/55 text-[10px] tabular-nums text-white">
                        {index + 1}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
