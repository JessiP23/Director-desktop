import * as React from "react";
import { Button } from "@/components/ui/button";
import type { StreamItem } from "@/lib/director/stream";
import { AssetsPanel } from "./assets-panel";
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
  // The first prompt of a new production, shown optimistically while the run is
  // being created (before its id — and therefore its stream — exists).
  const [pendingFirstPrompt, setPendingFirstPrompt] = React.useState<string | null>(null);
  const [activePanel, setActivePanel] = React.useState<SidePanel | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);

  const togglePanel = (panel: SidePanel) =>
    setActivePanel((current) => (current === panel ? null : panel));

  // Stable callback so the run stream isn't re-subscribed on every render.
  const onBriefUpdated = React.useCallback(() => setBriefKey((k) => k + 1), []);
  const { items, send, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
    initialPendingPrompt: pendingFirstPrompt,
  });
  const { brief } = useBrief(selectedRunId, briefKey);

  // Once the run exists, useRun owns the optimistic bubble (seeded from the
  // prompt above); clear the workspace copy so it doesn't double-render.
  React.useEffect(() => {
    if (selectedRunId) setPendingFirstPrompt(null);
  }, [selectedRunId]);

  async function startNewProduction(prompt: string) {
    // Show the prompt instantly — don't wait on the create round-trip.
    setPendingFirstPrompt(prompt);
    setCreating(true);
    try {
      const created = await createRun({ prompt });
      setSelectedRunId(created.id);
    } catch (err) {
      setPendingFirstPrompt(null);
      throw err;
    } finally {
      setCreating(false);
    }
  }

  // While a brand-new run is still being created we have no run id (and no
  // stream) yet — render the prompt the user just sent so the screen reacts
  // immediately instead of sitting on the empty state.
  const inConversation = Boolean(selectedRunId || pendingFirstPrompt);
  const conversationItems: StreamItem[] = selectedRunId
    ? items
    : pendingFirstPrompt
      ? [{ kind: "user", id: "__pending_first__", text: pendingFirstPrompt, timestamp: new Date().toISOString() }]
      : [];

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

      <main className="flex min-w-0 flex-1 flex-col bg-surface-0">
        {inConversation ? (
          <>
            <div
              data-tauri-drag-region
              className="flex h-12 shrink-0 items-center justify-between gap-2 bg-material-toolbar px-4 shadow-[inset_0_-0.5px_0_var(--separator)]"
            >
              <span className="min-w-0 truncate text-sm font-medium text-text">{run?.title ?? "Production"}</span>
              <div className="no-drag flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant={activePanel === "references" ? "secondary" : "ghost"}
                  onClick={() => togglePanel("references")}
                  disabled={!selectedRunId}
                >
                  References
                </Button>
                <Button
                  size="sm"
                  variant={activePanel === "timeline" ? "secondary" : "ghost"}
                  onClick={() => togglePanel("timeline")}
                  disabled={!selectedRunId}
                >
                  Timeline
                </Button>
              </div>
            </div>
            {error && (
              <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">{error}</div>
            )}
            <ConversationView items={conversationItems} onSend={send} />
            <Composer
              onSend={send}
              disabled={composerDisabled}
              busy={isRunning || sendState === "sending" || creating}
              placeholder={
                creating || isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`
              }
            />
          </>
        ) : (
          <EmptyState onStart={startNewProduction} busy={creating} />
        )}
      </main>

      {selectedRunId && activePanel === "timeline" && (
        <aside className="flex w-80 shrink-0 flex-col bg-surface-1 shadow-[inset_0.5px_0_0_var(--separator)]">
          <div
            data-tauri-drag-region
            className="flex h-12 shrink-0 items-center px-4 text-xs font-medium capitalize text-text-secondary shadow-[inset_0_-0.5px_0_var(--separator)]"
          >
            {activePanel}
          </div>
          <div className="min-h-0 flex-1">
            <TimelineView brief={brief} />
          </div>
        </aside>
      )}

      {/* References open as the React Flow brief canvas (ported from the web),
          a slide-over overlay rather than the narrow side panel. */}
      {selectedRunId && (
        <AssetsPanel
          runId={selectedRunId}
          isOpen={activePanel === "references"}
          onClose={() => setActivePanel(null)}
          brief={brief}
        />
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
