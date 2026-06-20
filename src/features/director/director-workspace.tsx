import * as React from "react";
import type { StreamItem } from "@/lib/director/stream";
import { AgentColumn } from "./palmier/agent-column";
import { InspectorPanel } from "./palmier/inspector-panel";
import { MediaDock } from "./palmier/media-dock";
import { PalmierShell } from "./palmier/palmier-shell";
import { PreviewPanel } from "./palmier/preview-panel";
import { ProductionsHome } from "./palmier/productions-home";
import { TimelineDock } from "./palmier/timeline-dock";
import { useBrief } from "./use-brief";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";

/**
 * The Director cockpit, in Palmier's spatial model: a productions home that
 * loads one production into the editor — AGENT column (chat) on the left, then
 * MEDIA (References/Library/Brief rail) · PREVIEW · INSPECTOR over a TIMELINE.
 * All business state (runs/stream/brief) lives here; the shell only arranges
 * the existing feature components.
 */
export function DirectorWorkspace() {
  const { runs, loading, error: runsError, createRun, patchRun } = useRuns();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingFirstPrompt, setPendingFirstPrompt] = React.useState<string | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);
  const agentOpen = true; // title-bar toggle lands in Phase C

  const onBriefUpdated = React.useCallback(() => setBriefKey((k) => k + 1), []);
  const { items, send, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
    initialPendingPrompt: pendingFirstPrompt,
  });
  const { brief, loading: briefLoading } = useBrief(selectedRunId, briefKey);

  React.useEffect(() => {
    if (selectedRunId) setPendingFirstPrompt(null);
  }, [selectedRunId]);

  async function startNewProduction(prompt: string) {
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

  const inEditor = Boolean(selectedRunId || pendingFirstPrompt);
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

  return (
    <PalmierShell
      inEditor={inEditor}
      agentOpen={agentOpen}
      home={
        <ProductionsHome
          runs={runs}
          loading={loading}
          error={runsError}
          creating={creating}
          onStart={startNewProduction}
          onSelect={setSelectedRunId}
        />
      }
      agent={
        <AgentColumn
          runTitle={run?.title}
          items={conversationItems}
          onSend={send}
          composerDisabled={composerBusy}
          composerBusy={composerBusy}
          placeholder={creating || isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`}
          error={error}
          onBack={() => setSelectedRunId(null)}
        />
      }
      media={<MediaDock runId={selectedRunId} brief={brief} briefLoading={briefLoading} />}
      preview={<PreviewPanel items={items} />}
      inspector={<InspectorPanel run={run} brief={brief} />}
      timeline={<TimelineDock brief={brief} items={items} />}
    />
  );
}
