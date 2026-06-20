import { InspectorRow, InspectorSection, PanelHeaderBar, PanelShell } from "@/components/palmier";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import type { DirectorRun } from "@/lib/director/contract/director";

const count = (r?: Record<string, unknown> | unknown[]) => (Array.isArray(r) ? r.length : Object.keys(r ?? {}).length);

/** Palmier inspector (right dock): metadata for the active production/brief. */
export function InspectorPanel({ run, brief }: { run: DirectorRun | null; brief: DirectorBrief | null }) {
  const s = brief?.sections;
  return (
    <PanelShell>
      <PanelHeaderBar title="Inspector" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorSection title="Production">
          <InspectorRow label="Title" value={run?.title ?? "Untitled"} />
          <InspectorRow label="Status" value={run?.status ?? "—"} />
          <InspectorRow label="Brief" value={brief ? `v${brief.version}` : "—"} />
        </InspectorSection>
        {s && (
          <InspectorSection title="World">
            <InspectorRow label="Characters" value={count(s.characters)} />
            <InspectorRow label="Locations" value={count(s.locations)} />
            <InspectorRow label="Props" value={count(s.props)} />
            <InspectorRow label="References" value={count(s.referenceImages)} />
          </InspectorSection>
        )}
        {s && (
          <InspectorSection title="Edit">
            <InspectorRow label="Keyframes" value={count(s.scriptImages)} />
            <InspectorRow label="Clips" value={count(s.scriptClips)} />
          </InspectorSection>
        )}
      </div>
    </PanelShell>
  );
}
