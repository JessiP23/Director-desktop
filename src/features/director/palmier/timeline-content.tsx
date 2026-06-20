import * as React from "react";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { compareScriptReference } from "@/lib/director/production-timeline";
import type { StreamItem } from "@/lib/director/stream";
import { cn } from "@/lib/utils/cn";
import { GenerationMedia } from "../media-view";

type Clip = { id: string; label: string; url: string; kind: "image" | "video" | "audio" | "other"; prompt?: string; poster?: string };

const kindFromUrl = (url: string): Clip["kind"] =>
  /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url) ? "video" : /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(url) ? "image" : /\.(mp3|wav|m4a|aac|ogg|flac|opus)(\?.*)?$/i.test(url) ? "audio" : "other";

function clipsFromBrief(brief: DirectorBrief | null): Clip[] {
  const scriptClips = brief?.sections?.scriptClips ?? [];
  const poster = new Map<string, string>();
  for (const img of brief?.sections?.scriptImages ?? []) if (!poster.has(img.scriptReference)) poster.set(img.scriptReference, img.url);
  return [...scriptClips]
    .sort((a, b) => compareScriptReference(a.scriptReference, b.scriptReference))
    .map((c, i) => ({ id: `${c.scriptReference}-${c.url}`, label: c.scriptReference || `Shot ${i + 1}`, url: c.url, kind: "video" as const, prompt: c.prompt, poster: poster.get(c.scriptReference) }));
}
function clipsFromStream(items: StreamItem[]): Clip[] {
  return items
    .filter((i): i is Extract<StreamItem, { kind: "tool-generation" }> => i.kind === "tool-generation" && i.status === "completed" && Boolean(i.resultUrl))
    .map((i, idx) => ({ id: i.id, label: i.toolName || `Asset ${idx + 1}`, url: i.resultUrl || "", kind: i.resultKind ?? kindFromUrl(i.resultUrl || ""), prompt: i.previewMessage, poster: i.resultKind === "video" ? i.referenceImageUrls?.[0] : undefined }));
}

/** Timeline content: confirmed clips in screenplay order — a master player +
 *  filmstrip (only the selected clip mounts a <video>). Palmier-tokened. */
export function TimelineContent({ brief, items }: { brief: DirectorBrief | null; items: StreamItem[] }) {
  const clips = React.useMemo(() => {
    const confirmed = clipsFromBrief(brief);
    return confirmed.length > 0 ? confirmed : clipsFromStream(items);
  }, [brief, items]);
  const [selected, setSelected] = React.useState(0);
  React.useEffect(() => {
    if (selected > clips.length - 1) setSelected(Math.max(0, clips.length - 1));
  }, [clips.length, selected]);

  if (clips.length === 0) {
    return <div className="grid flex-1 place-items-center px-8 text-center text-[12px]" style={{ color: "var(--pm-text-muted)" }}>Confirmed clips appear here in screenplay order.</div>;
  }
  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[100px] shrink-0 overflow-y-auto py-2" style={{ borderRight: "0.5px solid var(--pm-border-primary)" }}>
        <ol className="flex flex-col gap-1.5 px-2">
          {clips.map((clip, i) => {
            const poster = clip.poster || (clip.kind === "image" ? clip.url : undefined);
            return (
              <li key={clip.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn("relative block aspect-video w-full overflow-hidden rounded-[var(--pm-r-xs)] text-left", i === selected ? "ring-1 ring-white/80" : "")}
                  style={{ background: "var(--pm-bg-prominent)" }}
                >
                  {poster ? <img src={poster} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-white/40">▶</span>}
                  <span className="absolute left-0.5 top-0.5 grid size-3.5 place-items-center rounded bg-black/55 text-[9px] tabular-nums text-white">{i + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4">
        {clips[selected] && (
          <div className="w-full max-w-2xl overflow-hidden rounded-[var(--pm-r-sm)]">
            <GenerationMedia key={clips[selected].url} url={clips[selected].url} kind={clips[selected].kind} />
          </div>
        )}
        {clips[selected]?.prompt && <p className="line-clamp-2 max-w-2xl text-[11px]" style={{ color: "var(--pm-text-muted)" }}>{clips[selected].prompt}</p>}
      </div>
    </div>
  );
}
