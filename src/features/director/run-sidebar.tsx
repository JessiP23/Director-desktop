import { Library } from "lucide-react";
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
  error,
  selectedRunId,
  onSelect,
  onNew,
  onOpenLibrary,
}: {
  runs: DirectorRun[];
  loading: boolean;
  error?: string | null;
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  onNew: () => void;
  onOpenLibrary: () => void;
}) {
  return (
    <aside className="material flex w-64 shrink-0 flex-col bg-material-sidebar shadow-[inset_-0.5px_0_0_var(--separator)]">
      <div className="px-3 pb-3 pt-3">
        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={onNew}>
          + New production
        </Button>
      </div>

      <div className="px-4 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
        Productions
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="flex justify-center py-8 text-fg-subtle">
            <Spinner />
          </div>
        ) : error ? (
          <p className="px-2 py-8 text-center text-xs text-danger">{error}</p>
        ) : runs.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-fg-subtle">No productions yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {runs.map((run) => {
              const active = run.id === selectedRunId;
              return (
                <li key={run.id}>
                  <button
                    onClick={() => onSelect(run.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-3 pr-2.5 text-left text-sm transition-colors",
                      active ? "bg-ink-700 text-fg" : "text-fg-muted hover:bg-ink-800 hover:text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[run.status])} />
                    <span className="truncate">{run.title || "Untitled production"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-separator/60 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-fg-muted"
          onClick={onOpenLibrary}
        >
          <Library className="size-4" /> Library
        </Button>
      </div>
    </aside>
  );
}
