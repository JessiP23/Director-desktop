import * as React from "react";
import type { StreamItem } from "@/lib/director/stream";
import { cn } from "@/lib/utils/cn";
import { AgentColumn } from "./palmier/agent-column";
import { InspectorPanel } from "./palmier/inspector-panel";
import { MediaDock } from "./palmier/media-dock";
import { PalmierShell, type RightPanelTab } from "./palmier/palmier-shell";
import { PreviewPanel } from "./palmier/preview-panel";
import { ProductionsHome } from "./palmier/productions-home";
import { TimelineDock } from "./palmier/timeline-dock";
import { useBrief } from "./use-brief";
import { useRun } from "./use-run";
import { useRuns } from "./use-runs";
import type { DirectorQuality } from "@/lib/director/contract/director";
import { EditorPanel, collectEditorClips } from "./editor/components/editor-view";
import { latestEditorPlan, latestTimelineSyncVersion } from "./editor/lib/editor-plan-apply";
import { uploadAttachments } from "./editor/lib/upload-attachments";
import { DirectorSidebar } from "./components/sidebar";

/**
 * The Director cockpit, in Palmier's spatial model: a productions home that
 * loads one production into the editor — AGENT column (chat) on the left, then
 * MEDIA (References/Library/Brief rail) · PREVIEW · INSPECTOR over a TIMELINE.
 * All business state (runs/stream/brief) lives here; the shell only arranges
 * the existing feature components.
 */
export function DirectorWorkspace() {
  const { runs, loading, createRun, patchRun, deleteRun } = useRuns();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingFirstPrompt, setPendingFirstPrompt] = React.useState<string | null>(null);
  const [briefKey, setBriefKey] = React.useState(0);
  const [agentOpen, setAgentOpen] = React.useState(true);
  const [quality, setQuality] = React.useState<DirectorQuality>("premium");
  const [loadingRunId, setLoadingRunId] = React.useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = React.useState<string | null>(null);
  const [renamingRunId, setRenamingRunId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  // The whole right side starts closed → just the chatbot. Toggled from the
  // agent header. `view` swaps the preview pane between the preview and the editor.
  const [rightOpen, setRightOpen] = React.useState(false);
  const [view, setView] = React.useState<"preview" | "editor">("preview");
  const [rightPanelTab, setRightPanelTab] = React.useState<RightPanelTab>("preview");

  const onBriefUpdated = React.useCallback(() => setBriefKey((k) => k + 1), []);
  const { items, events, send, sendState, isRunning, run, error } = useRun(selectedRunId, {
    onRunPatch: patchRun,
    onBriefUpdated,
    initialPendingPrompt: pendingFirstPrompt,
  });
  const { brief, loading: briefLoading } = useBrief(selectedRunId, briefKey);

  React.useEffect(() => {
    if (selectedRunId) setPendingFirstPrompt(null);
  }, [selectedRunId]);

  // Auto-close sidebar when right panel opens, reopen when right panel closes
  React.useEffect(() => {
    if (rightOpen) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [rightOpen]);

  async function startNewProduction(prompt: string) {
    setPendingFirstPrompt(prompt);
    setCreating(true);
    try {
      const created = await createRun({ prompt, quality });
      setSelectedRunId(created.id);
    } catch (err) {
      setPendingFirstPrompt(null);
      throw err;
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    setDeletingRunId(runId);
    try {
      await deleteRun(runId);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
    } finally {
      setDeletingRunId(null);
    }
  }

  async function handleRenameRun(title: string) {
    if (!selectedRunId) return;
    setRenamingRunId(selectedRunId);
    try {
      await patchRun(selectedRunId, { title });
    } finally {
      setRenamingRunId(null);
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

  // Estimated context-window usage (chars/4 vs the agent's 30k history budget),
  // matching the web app's indicator. Computed from the real transcript.
  const usedTokens = React.useMemo(
    () =>
      items.reduce((sum, item) => {
        const text = (item.kind === "user" || item.kind === "message") ? item.text : "";
        return sum + (text ? Math.ceil(text.length / 4) : 0);
      }, 0),
    [items],
  );

  // Editor wiring: clips from the stream, the agent's latest montage plan + sync
  // token from the raw events (drives the live agent-montage refetch).
  const editorClips = React.useMemo(() => collectEditorClips(items), [items]);
  const editorPlan = React.useMemo(() => latestEditorPlan(events), [events]);
  const timelineSyncToken = React.useMemo(() => latestTimelineSyncVersion(events), [events]);

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-[14rem] opacity-100" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <DirectorSidebar
          recentRuns={runs}
          isLoadingRuns={loading}
          loadingRunId={loadingRunId}
          deletingRunId={deletingRunId}
          selectedRunId={selectedRunId || undefined}
          onSelectRun={(runId) => {
            setLoadingRunId(runId);
            setSelectedRunId(runId);
            setLoadingRunId(null);
          }}
          onDeleteRun={handleDeleteRun}
          onNewProduction={() => setSelectedRunId(null)}
        />
      </div>
      <div className="flex-1">
        <PalmierShell
          inEditor={inEditor}
          rightOpen={rightOpen}
          agentOpen={agentOpen}
          editorActive={view === "editor"}
          onToggleAgent={() => setAgentOpen((v) => !v)}
          onToggleEditor={() => setView((v) => (v === "editor" ? "preview" : "editor"))}
          onCloseRight={() => setRightOpen(false)}
          rightPanelTab={rightPanelTab}
          onRightPanelTabChange={setRightPanelTab}
          home={
            <ProductionsHome
              creating={creating}
              onStart={startNewProduction}
              quality={quality}
              onQualityChange={setQuality}
            />
          }
          agent={
            <AgentColumn
              runTitle={run?.title}
              runId={selectedRunId || undefined}
              items={conversationItems}
              onSend={(text) => send(text, { quality })}
              composerDisabled={composerBusy}
              composerBusy={composerBusy}
              placeholder={creating || isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`}
              error={error}
              onBack={() => setSelectedRunId(null)}
              contextUsage={{ usedTokens, budgetTokens: 30_000 }}
              quality={quality}
              onQualityChange={setQuality}
              rightOpen={rightOpen}
              onToggleRight={() => setRightOpen((v) => !v)}
              onRenameRun={handleRenameRun}
              isSavingTitle={renamingRunId === selectedRunId}
            />
          }
          media={<MediaDock runId={selectedRunId} brief={brief} briefLoading={briefLoading} onOpenEditor={() => setView("editor")} />}
          preview={<PreviewPanel items={items} />}
          editor={
            <EditorPanel
              isOpen={view === "editor"}
              onClose={() => setView("preview")}
              runId={selectedRunId}
              clips={editorClips}
              onUploadFiles={uploadAttachments}
              agentPlan={editorPlan}
              timelineSyncToken={timelineSyncToken}
            />
          }
          inspector={<InspectorPanel run={run} brief={brief} />}
          timeline={<TimelineDock brief={brief} items={items} />}
        />
      </div>
    </div>
  );
}
