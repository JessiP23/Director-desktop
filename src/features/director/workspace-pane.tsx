import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui";
import type { StreamItem } from "@/lib/director/stream";
import { useLayout } from "@/lib/layout/use-layout";
import { RUN_TOOLBAR_PANELS } from "@/lib/layout/panels";
import { Composer } from "./composer";
import { ConversationView } from "./conversation-view";

export type WorkspacePaneProps = {
  inConversation: boolean;
  hasRun: boolean;
  runTitle?: string;
  items: StreamItem[];
  onSend: (text: string) => void;
  onStart: (text: string) => void;
  starting: boolean;
  composerDisabled: boolean;
  composerBusy: boolean;
  placeholder: string;
  error?: string | null;
};

/**
 * The center workspace: a run's conversation + composer under a toolbar whose
 * panel toggles are derived from the registry (RUN_TOOLBAR_PANELS) — add a
 * run-scoped panel and its button appears here automatically. Hosts the
 * existing Composer/ConversationView unchanged; all run data arrives as props.
 */
export function WorkspacePane(props: WorkspacePaneProps) {
  if (!props.inConversation) return <StartScreen onStart={props.onStart} busy={props.starting} />;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0">
      <RunToolbar title={props.runTitle} hasRun={props.hasRun} />
      {props.error && (
        <div className="bg-danger/10 px-4 py-2 text-center text-xs text-danger">{props.error}</div>
      )}
      <ConversationView items={props.items} onSend={props.onSend} />
      <Composer
        onSend={props.onSend}
        disabled={props.composerDisabled}
        busy={props.composerBusy}
        placeholder={props.placeholder}
      />
    </section>
  );
}

function RunToolbar({ title, hasRun }: { title?: string; hasRun: boolean }) {
  const layout = useLayout();
  return (
    <div
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-between gap-2 bg-material-toolbar px-4 shadow-[inset_0_-0.5px_0_var(--separator)]"
    >
      <span className="min-w-0 truncate text-sm font-medium text-text">{title ?? "Production"}</span>
      <div className="no-drag flex shrink-0 gap-1">
        {RUN_TOOLBAR_PANELS.map((panel) => (
          <Button
            key={panel.id}
            size="sm"
            variant={layout.isOpen(panel.id) ? "secondary" : "ghost"}
            onClick={() => layout.toggle(panel.id)}
            disabled={!hasRun}
          >
            <Icon name={panel.icon} size={14} />
            {panel.title}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** First-run hero + composer (no run selected yet). */
function StartScreen({ onStart, busy }: { onStart: (prompt: string) => void; busy: boolean }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0">
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
