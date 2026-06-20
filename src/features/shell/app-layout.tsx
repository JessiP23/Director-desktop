import * as React from "react";
import { SplitPane } from "@/components/ui";
import { useLayout } from "@/lib/layout/use-layout";

/**
 * The presentational shell: navigation sidebar · center workspace · optional
 * docked right inspector, with full-height overlays mounted above. Pure
 * arrangement — it owns no business state and hosts whatever nodes the
 * controller passes. The dock only claims layout space (a resizable split)
 * while a docked panel is open, so the center reflows instead of being covered.
 */
export function AppLayout({
  sidebar,
  center,
  dock,
  overlays,
}: {
  sidebar: React.ReactNode;
  center: React.ReactNode;
  dock: React.ReactNode;
  overlays?: React.ReactNode;
}) {
  const { dock: dockPanel } = useLayout();
  // Split only when a docked panel is open AND the controller supplied dock
  // content (e.g. a run is selected). A persisted dock never claims an empty
  // pane on the start screen.
  const dockOpen = dockPanel !== null && dock != null;

  return (
    <div className="flex h-full min-h-0">
      {sidebar}
      {dockOpen ? (
        <SplitPane
          direction="horizontal"
          defaultSize={68}
          minFirst={460}
          minSecond={300}
          storageKey="director.dock.split"
          className="flex-1"
        >
          {center}
          {dock}
        </SplitPane>
      ) : (
        <div className="flex min-w-0 flex-1">{center}</div>
      )}
      {overlays}
    </div>
  );
}
