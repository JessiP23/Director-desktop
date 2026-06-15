import * as React from "react";
import { Composer } from "./composer";
import { ConversationView } from "./conversation-view";
import { RunSidebar } from "./run-sidebar";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";

/**
 * The Director cockpit: run list (left) + active conversation (right). A "new
 * production" is started by sending a first prompt with no run selected, which
 * creates the run and immediately streams it.
 */
export function DirectorWorkspace() {
  const { runs, loading, createRun, patchRun } = useRuns();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const { items, send, sendState, isRunning, run, error } = useRun(selectedRunId, patchRun);

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
        selectedRunId={selectedRunId}
        onSelect={setSelectedRunId}
        onNew={() => setSelectedRunId(null)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedRunId ? (
          <>
            {error && (
              <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">{error}</div>
            )}
            <ConversationView items={items} onSend={send} />
            <Composer
              onSend={send}
              disabled={composerDisabled}
              busy={isRunning || sendState === "sending"}
              placeholder={
                isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`
              }
            />
          </>
        ) : (
          <EmptyState onStart={startNewProduction} busy={creating} />
        )}
      </main>
    </div>
  );
}

function EmptyState({ onStart, busy }: { onStart: (prompt: string) => void; busy: boolean }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-fg">What are we making today?</h2>
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          Describe a video, a campaign, or a scene. Director plans the production, develops the
          world, and generates it with you — one shot at a time.
        </p>
      </div>
      <Composer onSend={onStart} disabled={busy} busy={busy} />
    </div>
  );
}
