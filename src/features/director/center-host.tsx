import * as React from "react";
import { SplitPane, TabBar, type TabItem } from "@/components/ui";
import type { DirectorRun } from "@/lib/director/contract/director";
import { CompareRunView } from "./compare-run-view";

/**
 * The center pane host: a Cursor-style tab strip over the active run's
 * workspace, with an optional side-by-side comparison pane. The `primary` node
 * (the active run's WorkspacePane) is passed in unchanged; the compare pane
 * mounts its own stream only while `compareRunId` is set. Pure arrangement.
 */
export function CenterHost({
  tabs,
  activeId,
  onActivate,
  onClose,
  onNew,
  primary,
  compareRunId,
  onCloseCompare,
  onComparePatch,
}: {
  tabs: TabItem[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  primary: React.ReactNode;
  compareRunId: string | null;
  onCloseCompare: () => void;
  onComparePatch?: (id: string, patch: Partial<DirectorRun>) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0">
      {tabs.length > 0 && (
        <TabBar tabs={tabs} activeId={activeId} onActivate={onActivate} onClose={onClose} onAdd={onNew} />
      )}
      {compareRunId ? (
        <SplitPane direction="horizontal" defaultSize={50} minFirst={360} minSecond={360} storageKey="director.compare.split" className="flex-1">
          <div className="flex min-w-0 flex-1">{primary}</div>
          <CompareRunView runId={compareRunId} onClose={onCloseCompare} onRunPatch={onComparePatch} />
        </SplitPane>
      ) : (
        primary
      )}
    </div>
  );
}
