import { PanelHeaderBar, PanelShell } from "@/components/palmier";
import type { DirectorBrief } from "@/lib/director/contract/brief";
import type { StreamItem } from "@/lib/director/stream";
import { TimelineContent } from "./timeline-content";

/** Palmier bottom dock: the production timeline (existing clip logic). */
export function TimelineDock({ brief, items }: { brief: DirectorBrief | null; items: StreamItem[] }) {
  return (
    <PanelShell>
      <PanelHeaderBar title="Timeline" />
      <TimelineContent brief={brief} items={items} />
    </PanelShell>
  );
}
