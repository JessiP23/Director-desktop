import * as React from "react";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import type { StreamItem } from "@/lib/director/stream";
import { useLayout } from "@/lib/layout/use-layout";
import type { PanelId } from "@/lib/layout/layout-types";
import { TimelinePanel } from "./timeline-view";

// Overlays load on demand so they stay out of first paint. References is now a
// lightweight Canvas of tiles (no React Flow); Library is a separate surface.
const ReferencesCanvas = React.lazy(() =>
  import("./references-canvas").then((m) => ({ default: m.ReferencesCanvas })),
);
const LibraryPanel = React.lazy(() =>
  import("@/features/library/library-panel").then((m) => ({ default: m.LibraryPanel })),
);

/**
 * Full-height overlay surfaces (References canvas, Timeline, Library), driven by
 * the layout's `overlay` slot. Mounted lazily on first open then kept alive so
 * reopening is instant and the slide animation stays smooth. Hosts the existing
 * panel components unchanged — only their open/close is centralized here.
 */
export function WorkspaceOverlays({
  runId,
  brief,
  items,
}: {
  runId: string | null;
  brief: DirectorBrief | null;
  items: StreamItem[];
}) {
  const { overlay, close } = useLayout();
  const [mounted, setMounted] = React.useState<Set<PanelId>>(() => new Set());

  React.useEffect(() => {
    if (overlay && !mounted.has(overlay)) {
      setMounted((prev) => new Set(prev).add(overlay));
    }
  }, [overlay, mounted]);

  return (
    <>
      {runId && mounted.has("references") && (
        <React.Suspense fallback={null}>
          <ReferencesCanvas runId={runId} isOpen={overlay === "references"} onClose={() => close("overlay")} brief={brief} />
        </React.Suspense>
      )}

      {/* Timeline is light enough to mount whenever a run exists; open toggles it. */}
      {runId && (
        <TimelinePanel brief={brief} items={items} isOpen={overlay === "timeline"} onClose={() => close("overlay")} />
      )}

      {mounted.has("library") && (
        <React.Suspense fallback={null}>
          <LibraryPanel isOpen={overlay === "library"} onClose={() => close("overlay")} />
        </React.Suspense>
      )}
    </>
  );
}
