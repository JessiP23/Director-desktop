import * as React from "react";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { compareScriptReference } from "@/lib/director/production-timeline";
import { GenerationMedia } from "./media-view";

/**
 * The production timeline: the brief's user-confirmed clips (`scriptClips`)
 * laid out in screenplay scene/shot order — the assembled edit. Read/play view;
 * the arrangement comes from the agent's confirmed clips (+ Editor plans).
 * Full manual trimming/reordering is a later step.
 */
export function TimelineView({ brief }: { brief: DirectorBrief | null }) {
  const clips = React.useMemo(() => {
    const list = brief?.sections?.scriptClips ?? [];
    return [...list].sort((a, b) => compareScriptReference(a.scriptReference, b.scriptReference));
  }, [brief]);

  if (clips.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-fg-subtle">
        Confirmed clips land here in scene order, building your edit as you approve each shot.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ol className="flex flex-col">
        {clips.map((clip, index) => (
          <li key={`${clip.scriptReference}-${clip.url}`} className="border-b border-line p-3 last:border-b-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
              <span className="flex size-5 items-center justify-center rounded bg-ink-700 text-fg-muted tabular-nums">
                {index + 1}
              </span>
              <span className="truncate">{clip.scriptReference}</span>
            </div>
            <GenerationMedia url={clip.url} kind="video" />
            {clip.prompt && <p className="mt-1.5 line-clamp-2 text-[11px] text-fg-subtle">{clip.prompt}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
