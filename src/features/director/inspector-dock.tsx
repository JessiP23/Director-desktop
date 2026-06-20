import { Panel } from "@/components/ui";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { useLayout } from "@/lib/layout/use-layout";
import { PANELS } from "@/lib/layout/panels";
import { BriefPanel } from "./brief-panel";

/**
 * The docked right inspector. Hosts the active docked panel inside shared Panel
 * chrome (registry-titled). Today that's the production Brief — previously a
 * dead, unmounted component, now revived as the first docked surface. New
 * docked panels slot in by adding a registry entry + a branch here.
 */
export function InspectorDock({ brief, loading }: { brief: DirectorBrief | null; loading: boolean }) {
  const { dock, close } = useLayout();
  if (!dock) return null;
  const def = PANELS[dock];

  return (
    <Panel title={def.title} icon={def.icon} onClose={() => close("dock")} bodyClassName="overflow-hidden">
      {dock === "brief" && <BriefPanel brief={brief} loading={loading} />}
    </Panel>
  );
}
