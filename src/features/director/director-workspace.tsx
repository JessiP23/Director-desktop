import * as React from "react";
import type { TabItem } from "@/components/ui";
import type { DirectorRun } from "@/lib/director/contract/director";
import type { StreamItem } from "@/lib/director/stream";
import { LayoutProvider, useLayout } from "@/lib/layout/use-layout";
import { AppLayout } from "@/features/shell/app-layout";
import { CenterHost } from "./center-host";
import { InspectorDock } from "./inspector-dock";
import { RunSidebar } from "./run-sidebar";
import { WorkspaceOverlays } from "./workspace-overlays";
import { WorkspacePane } from "./workspace-pane";
import { useBrief } from "./use-brief";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";

/**
 * The Director cockpit. Business state (runs/stream/brief) lives in
 * WorkspaceInner; the Cursor-style arrangement (sidebar · tabbed center ·
 * docked inspector · overlays) is composed via AppLayout + the layout manager.
 * The active tab selects the single live stream — opening a run "to the side"
 * mounts a second, self-contained compare pane.
 */
export function DirectorWorkspace() {
  return (
    <LayoutProvider>
      <WorkspaceInner />
    </LayoutProvider>
  );
}

function WorkspaceInner() {
  const layout = useLayout();
  const { runs, loading, error: runsError, createRun, patchRun } = useRuns();
  // The center's active tab is the selected run — the single live stream.
  const selectedRunId = layout.activeTab;
  const [creating, setCreating] = React.useState(false);
  // The first prompt of a new production, shown optimistically while the run is
  // being created (before its id — and therefore its stream — exists).
  const [pendingFirstPrompt, setPendingFirstPrompt] = React.useState<string | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);

  // Stable callback so the run stream isn't re-subscribed on every render.
  const onBriefUpdated = React.useCallback(() => setBriefKey((k) => k + 1), []);
  const { items, send, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
    initialPendingPrompt: pendingFirstPrompt,
  });
  const { brief, loading: briefLoading } = useBrief(selectedRunId, briefKey);

  // Once the run exists, useRun owns the optimistic bubble; clear our copy.
  React.useEffect(() => {
    if (selectedRunId) setPendingFirstPrompt(null);
  }, [selectedRunId]);

  async function startNewProduction(prompt: string) {
    setPendingFirstPrompt(prompt);
    setCreating(true);
    try {
      const created = await createRun({ prompt });
      layout.openTab(created.id);
    } catch (err) {
      setPendingFirstPrompt(null);
      throw err;
    } finally {
      setCreating(false);
    }
  }

  const inConversation = Boolean(selectedRunId || pendingFirstPrompt);
  const LOADING_ITEM: StreamItem = {
    kind: "activity",
    id: "__director_loading__",
    toolCallId: "__director_loading__",
    toolName: "director",
    status: "running",
    timestamp: new Date().toISOString(),
  };

  const agentIsWorking =
    creating ||
    (isRunning && !items.some((i) => i.kind === "message" || i.kind === "tool-generation" || i.kind === "activity"));

  const conversationItems: StreamItem[] = selectedRunId
    ? agentIsWorking
      ? [...items, LOADING_ITEM]
      : items
    : pendingFirstPrompt
      ? [
          { kind: "user", id: "__pending_first__", text: pendingFirstPrompt, timestamp: new Date().toISOString() },
          ...(agentIsWorking ? [LOADING_ITEM] : []),
        ]
      : [];

  const composerBusy = isRunning || sendState === "sending" || creating;

  // Open runs → tab descriptors (skipping any ids whose run has since vanished).
  const tabItems: TabItem[] = layout.tabs
    .map((id) => runs.find((r) => r.id === id))
    .filter((r): r is DirectorRun => Boolean(r))
    .map((r) => ({ id: r.id, label: r.title || "Untitled production", icon: "timeline" }));
  const compareRunId = layout.split && runs.some((r) => r.id === layout.split) ? layout.split : null;

  return (
    <AppLayout
      sidebar={
        <RunSidebar
          runs={runs}
          loading={loading}
          error={runsError}
          selectedRunId={selectedRunId}
          onSelect={layout.openTab}
          onNew={layout.newTab}
          onOpenLibrary={() => layout.toggle("library")}
          openIds={layout.tabs}
          onOpenToSide={layout.openToSide}
          onCloseTab={layout.closeTab}
        />
      }
      center={
        <CenterHost
          tabs={tabItems}
          activeId={selectedRunId}
          onActivate={layout.activateTab}
          onClose={layout.closeTab}
          onNew={layout.newTab}
          compareRunId={compareRunId}
          onCloseCompare={layout.closeSplit}
          onComparePatch={patchRun}
          primary={
            <WorkspacePane
              inConversation={inConversation}
              hasRun={Boolean(selectedRunId)}
              runTitle={run?.title}
              items={conversationItems}
              onSend={send}
              onStart={startNewProduction}
              starting={creating}
              composerDisabled={composerBusy}
              composerBusy={composerBusy}
              placeholder={creating || isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`}
              error={error}
            />
          }
        />
      }
      dock={selectedRunId ? <InspectorDock brief={brief} loading={briefLoading} /> : null}
      overlays={<WorkspaceOverlays runId={selectedRunId} brief={brief} items={items} />}
    />
  );
}
