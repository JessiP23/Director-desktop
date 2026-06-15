import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { DirectorRun, DirectorRunStatus } from "@/lib/director/contract/director";

const statusDot: Record<DirectorRunStatus, string> = {
  queued: "bg-accent animate-pulse",
  running: "bg-accent animate-pulse",
  completed: "bg-success",
  failed: "bg-danger",
  cancelled: "bg-fg-subtle",
};

export function RunSidebar({
  runs,
  loading,
  selectedRunId,
  onSelect,
  onNew,
}: {
  runs: DirectorRun[];
  loading: boolean;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-ink-900/40">
      <div className="px-3 pb-2 pt-2">
        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={onNew}>
          + New production
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="flex justify-center py-8 text-fg-subtle">
            <Spinner />
          </div>
        ) : runs.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-fg-subtle">No productions yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  onClick={() => onSelect(run.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    run.id === selectedRunId ? "bg-ink-700 text-fg" : "text-fg-muted hover:bg-ink-800",
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[run.status])} />
                  <span className="truncate">{run.title || "Untitled production"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
