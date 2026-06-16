import * as React from "react";
import { Button } from "@/components/ui/button";
import { BriefPanel } from "./brief-panel";
import { Composer } from "./composer";
import { ConversationView } from "./conversation-view";
import { RunSidebar } from "./run-sidebar";
import { TimelineView } from "./timeline-view";
import { useBrief } from "./use-brief";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";

type SidePanel = "references" | "timeline";

/**
 * The Director cockpit: run list (left), active conversation (center), and a
 * toggleable references/brief panel (right). A "new production" is started by
 * sending a first prompt with no run selected.
 */
export function DirectorWorkspace() {
  const { runs, loading, error: runsError, createRun, patchRun } = useRuns();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<SidePanel | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);

  const togglePanel = (panel: SidePanel) =>
    setActivePanel((current) => (current === panel ? null : panel));

  // Stable callback so the run stream isn't re-subscribed on every render.
  const onBriefUpdated = React.useCallback(() => setBriefKey((k) => k + 1), []);
  const { items, send, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
  });
  const { brief, loading: briefLoading } = useBrief(selectedRunId, briefKey);

  async function startNewProduction(prompt: string) {
    setCreating(true);
    try {
      const created = await createRun({ prompt });
      setSelectedRunId(created.id);
    } finally {
      setCreating(false);
    }
  }

  const composerDisabled = isRunning || sendState === "sending" || creating;

  return (
    <div className="flex h-full min-h-0">
      <RunSidebar
        runs={runs}
        loading={loading}
        error={runsError}
        selectedRunId={selectedRunId}
        onSelect={setSelectedRunId}
        onNew={() => setSelectedRunId(null)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedRunId ? (
          <>
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
              <span className="min-w-0 truncate text-sm font-medium text-fg">{run?.title ?? "Production"}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant={activePanel === "references" ? "secondary" : "ghost"}
                  onClick={() => togglePanel("references")}
                >
                  References
                </Button>
                <Button
                  size="sm"
                  variant={activePanel === "timeline" ? "secondary" : "ghost"}
                  onClick={() => togglePanel("timeline")}
                >
                  Timeline
                </Button>
              </div>
            </div>
            {error && (
              <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">{error}</div>
            )}
            <ConversationView items={items} onSend={send} />
            <Composer
              onSend={send}
              disabled={composerDisabled}
              busy={isRunning || sendState === "sending"}
              placeholder={isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`}
            />
          </>
        ) : (
          <EmptyState onStart={startNewProduction} busy={creating} />
        )}
      </main>

      {selectedRunId && activePanel && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-ink-900/40">
          <div className="flex h-12 shrink-0 items-center border-b border-line px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            {activePanel}
          </div>
          <div className="min-h-0 flex-1">
            {activePanel === "references" ? (
              <BriefPanel brief={brief} loading={briefLoading} />
            ) : (
              <TimelineView brief={brief} />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function EmptyState({ onStart, busy }: { onStart: (prompt: string) => void; busy: boolean }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-fg-subtle">
          WM Studio · Director
        </p>
        <h2 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-fg">
          What are we making today?
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-muted">
          Describe a video, a campaign, or a scene. Director plans the production, develops the
          world, and generates it with you — one shot at a time.
        </p>
      </div>
      <Composer onSend={onStart} disabled={busy} busy={busy} />
    </div>
  );
}
