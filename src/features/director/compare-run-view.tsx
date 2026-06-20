import { Icon, IconButton } from "@/components/ui";
import type { DirectorRun } from "@/lib/director/contract/director";
import type { StreamItem } from "@/lib/director/stream";
import { Composer } from "./composer";
import { ConversationView } from "./conversation-view";
import { useRun } from "./use-run";

export function CompareRunView({
  runId,
  onClose,
  onRunPatch,
}: {
  runId: string;
  onClose: () => void;
  onRunPatch?: (id: string, patch: Partial<DirectorRun>) => void;
}) {
  const { items, send, sendState, isRunning, run, error } = useRun(runId, { onRunPatch });

  const busy = isRunning || sendState === "sending";
  const conversationItems: StreamItem[] =
    busy && !items.some((i) => i.kind === "message" || i.kind === "tool-generation" || i.kind === "activity")
      ? [...items, LOADING_ITEM]
      : items;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface-0 shadow-[inset_0.5px_0_0_var(--separator)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 bg-material-toolbar px-4 shadow-[inset_0_-0.5px_0_var(--separator)]">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="split" size={14} className="text-accent" />
          <span className="min-w-0 truncate text-sm font-medium text-text">{run?.title ?? "Comparing…"}</span>
        </div>
        <IconButton name="close" label="Close comparison" size="sm" onClick={onClose} />
      </header>
      {error && <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">{error}</div>}
      <ConversationView items={conversationItems} onSend={send} />
      <Composer
        onSend={send}
        disabled={busy}
        busy={busy}
        placeholder={isRunning ? "Director is working…" : `Reply to ${run?.title ?? "Director"}…`}
      />
    </section>
  );
}

const LOADING_ITEM: StreamItem = {
  kind: "activity",
  id: "__compare_loading__",
  toolCallId: "__compare_loading__",
  toolName: "director",
  status: "running",
  timestamp: new Date().toISOString(),
};