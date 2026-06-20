import { Button, ContextMenu, EmptyState, Icon, IconButton, Spinner, Tooltip, type MenuItem } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { DirectorRun, DirectorRunStatus } from "@/lib/director/contract/director";

const statusDot: Record<DirectorRunStatus, string> = {
  queued: "bg-accent animate-pulse",
  running: "bg-accent animate-pulse",
  completed: "bg-success",
  failed: "bg-danger",
  cancelled: "bg-text-quaternary",
};

export function RunSidebar({
  runs,
  loading,
  error,
  selectedRunId,
  onSelect,
  onNew,
  onOpenLibrary,
  openIds,
  onOpenToSide,
  onCloseTab,
}: {
  runs: DirectorRun[];
  loading: boolean;
  error?: string | null;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  onNew: () => void;
  onOpenLibrary: () => void;
  openIds?: string[];
  onOpenToSide?: (runId: string) => void;
  onCloseTab?: (runId: string) => void;
}) {
  const open = new Set(openIds);
  const menuItems = (run: DirectorRun): MenuItem[] => [
    { label: "Open", icon: "references", onSelect: () => onSelect(run.id) },
    ...(onOpenToSide ? [{ label: "Open to the side", icon: "split", onSelect: () => onOpenToSide(run.id) } as MenuItem] : []),
    ...(onCloseTab && open.has(run.id)
      ? [{ type: "separator" } as MenuItem, { label: "Close tab", icon: "close", onSelect: () => onCloseTab(run.id) } as MenuItem]
      : []),
  ];
  return (
    <aside className="material flex w-64 shrink-0 flex-col bg-material-sidebar shadow-[inset_-0.5px_0_0_var(--separator)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Productions</span>
        <Tooltip label="New production" side="bottom">
          <IconButton name="add" label="New production" size="sm" onClick={onNew} />
        </Tooltip>
      </header>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex justify-center py-10 text-text-tertiary">
            <Spinner />
          </div>
        ) : error ? (
          <p className="px-2 py-8 text-center text-xs text-danger">{error}</p>
        ) : runs.length === 0 ? (
          <EmptyState
            name="timeline"
            title="No productions yet"
            description="Start one to plan, develop, and generate a video with Director."
            action={
              <Button size="sm" variant="secondary" onClick={onNew}>
                <Icon name="add" size={14} /> New production
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {runs.map((run) => {
              const active = run.id === selectedRunId;
              return (
                <li key={run.id}>
                  <ContextMenu items={menuItems(run)}>
                    <button
                      onClick={() => onSelect(run.id)}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
                        active ? "bg-fill text-text" : "text-text-secondary hover:bg-fill/60 hover:text-text",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Icon name="timeline" size={14} className={active ? "text-accent" : "text-text-quaternary"} />
                      <span className="min-w-0 flex-1 truncate">{run.title || "Untitled production"}</span>
                      {open.has(run.id) && !active && (
                        <span className="size-1 shrink-0 rounded-full bg-text-quaternary" aria-label="Open in a tab" />
                      )}
                      <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[run.status])} />
                    </button>
                  </ContextMenu>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <footer className="shrink-0 border-t border-separator/60 p-2">
        <button
          onClick={onOpenLibrary}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-fill hover:text-text focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Icon name="library" size={15} />
          Library
        </button>
      </footer>
    </aside>
  );
}
