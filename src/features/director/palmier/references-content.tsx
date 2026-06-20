import * as React from "react";
import { Lightbox } from "@/components/ui";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { buildBriefBlocks } from "../brief-blocks";
import { BriefTree } from "../brief-tree";
import { BriefMarkdown, ScriptFrameCard } from "../brief-markdown";
import { useFrameRemoval } from "../use-frame-removal";

/**
 * Docked References: the lightweight brief tree (BriefTree on the transform-only
 * Canvas), expanding to markdown detail with inline images + deletable
 * keyframes. Same content the overlay used, minus the slide-over chrome — built
 * to fill a media-dock panel. Reuses every existing piece; no logic change.
 */
export function ReferencesContent({ runId, brief }: { runId: string | null; brief: DirectorBrief | null }) {
  const { brief: working, removeFrame, removing } = useFrameRemoval(runId, brief);
  const blocks = React.useMemo(() => buildBriefBlocks(working), [working]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const selected = blocks.find((b) => b.key === selectedKey) ?? null;

  if (blocks.length === 0) {
    return <div className="grid flex-1 place-items-center px-8 text-center text-[12px]" style={{ color: "var(--pm-text-muted)" }}>Logline, cast, script, and references appear here as Director develops the production.</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selected ? (
        <>
          <button
            type="button"
            onClick={() => setSelectedKey(null)}
            className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-left text-[11px] font-medium transition-colors hover:text-white"
            style={{ color: "var(--pm-text-tertiary)", borderBottom: "0.5px solid var(--pm-border-subtle)" }}
          >
            ← {selected.label}
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {selected.key === "script" ? (
              <div className="flex flex-col gap-4">
                {working?.sections.script?.trim() && <BriefMarkdown text={working.sections.script} onImageClick={setLightbox} />}
                {(working?.sections.scriptImages ?? []).map((image) => (
                  <ScriptFrameCard key={image.url} image={image} deleting={removing === image.url} onDelete={() => removeFrame(image.url)} onOpen={setLightbox} />
                ))}
              </div>
            ) : (
              <BriefMarkdown text={selected.md} onImageClick={setLightbox} />
            )}
          </div>
        </>
      ) : (
        <BriefTree blocks={blocks} title="Production" selectedKey={selectedKey} onSelect={setSelectedKey} />
      )}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
