import { PanelHeaderBar, PanelShell } from "@/components/palmier";
import type { StreamItem } from "@/lib/director/stream";
import { GenerationMedia } from "../media-view";

/** Palmier preview viewer: a pure-black canvas showing the latest generated
 *  asset from the run. (A click-to-select model is a flagged future add.) */
export function PreviewPanel({ items }: { items: StreamItem[] }) {
  const latest = [...items].reverse().find(
    (i): i is Extract<StreamItem, { kind: "tool-generation" }> => i.kind === "tool-generation" && i.status === "completed" && Boolean(i.resultUrl),
  );
  return (
    <PanelShell>
      <PanelHeaderBar title="Preview" />
      <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-4" style={{ background: "var(--pm-preview-canvas)" }}>
        {latest?.resultUrl ? (
          <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-[var(--pm-r-sm)]">
            <GenerationMedia url={latest.resultUrl} kind={latest.resultKind} aspectRatio={latest.aspectRatio} />
          </div>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--pm-text-muted)" }}>Generated assets preview here.</span>
        )}
      </div>
    </PanelShell>
  );
}
