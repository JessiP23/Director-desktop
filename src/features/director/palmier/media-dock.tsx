import * as React from "react";
import { IconRail, PanelHeaderBar, PanelShell, type RailTab } from "@/components/palmier";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import { BriefPanel } from "../brief-panel";
import { ReferencesContent } from "./references-content";
import { LibraryContent } from "./library-content";

const TABS: RailTab[] = [
  { id: "references", label: "References", icon: "references" },
  { id: "library", label: "Library", icon: "library" },
  { id: "brief", label: "Brief", icon: "notes" },
];

/** The Palmier media dock: a 38px icon rail (References / Library / Brief) with
 *  the active tab's content beside it. Hosts the existing surfaces unchanged. */
export function MediaDock({ runId, brief, briefLoading }: { runId: string | null; brief: DirectorBrief | null; briefLoading: boolean }) {
  const [tab, setTab] = React.useState("references");
  return (
    <PanelShell>
      <PanelHeaderBar title={TABS.find((t) => t.id === tab)?.label} />
      <div className="flex min-h-0 flex-1">
        <IconRail tabs={TABS} activeId={tab} onSelect={setTab} />
        <div className="flex min-h-0 flex-1 flex-col">
          {tab === "references" && <ReferencesContent runId={runId} brief={brief} />}
          {tab === "library" && <LibraryContent />}
          {tab === "brief" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BriefPanel brief={brief} loading={briefLoading} />
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
