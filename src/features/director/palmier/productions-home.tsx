import { Spinner } from "@/components/ui";
import { StarterPromptCard } from "@/components/palmier";
import { cn } from "@/lib/utils/cn";
import type { DirectorRun, DirectorRunStatus } from "@/lib/director/contract/director";
import { Composer } from "../composer";

const statusDot: Record<DirectorRunStatus, string> = {
  queued: "var(--pm-accent-timecode)", running: "var(--pm-accent-timecode)",
  completed: "rgb(88,168,34)", failed: "var(--pm-error)", cancelled: "var(--pm-text-muted)",
};

const STARTERS = [
  { icon: "timeline" as const, title: "Cinematic ad", prompt: "A 15-second cinematic ad for a premium product, moody lighting." },
  { icon: "references" as const, title: "Develop a world", prompt: "Help me develop characters, locations and a visual language for a short film." },
  { icon: "image" as const, title: "Social spot", prompt: "A punchy 9:16 social spot with an energetic hook and CTA." },
];

/** Palmier home (HomeView): start a new production or open an existing one. */
export function ProductionsHome({
  runs,
  loading,
  error,
  creating,
  onStart,
  onSelect,
}: {
  runs: DirectorRun[];
  loading: boolean;
  error?: string | null;
  creating: boolean;
  onStart: (prompt: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--pm-bg-base)" }}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 px-6 py-10">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--pm-text-muted)" }}>WM Studio · Director</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight" style={{ color: "var(--pm-text-primary)" }}>What are we making today?</h1>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {STARTERS.map((s) => (
            <StarterPromptCard key={s.title} icon={s.icon} title={s.title} prompt={s.prompt} onSelect={() => onStart(s.prompt)} />
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : error ? (
          <p className="text-center text-[12px]" style={{ color: "var(--pm-error)" }}>{error}</p>
        ) : runs.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--pm-text-muted)" }}>Recent productions</span>
            <div className="grid grid-cols-4 gap-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onSelect(run.id)}
                  className={cn("flex h-[88px] flex-col justify-between rounded-[var(--pm-r-md)] p-3 text-left outline-none transition-colors hover:bg-white/[0.06]")}
                  style={{ background: "var(--pm-bg-surface)", border: "0.5px solid var(--pm-border-primary)" }}
                >
                  <span className="size-2 rounded-full" style={{ background: statusDot[run.status] }} />
                  <span className="line-clamp-2 text-[12px] font-medium" style={{ color: "var(--pm-text-secondary)" }}>{run.title || "Untitled production"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pb-6">
        <Composer onSend={onStart} disabled={creating} busy={creating} placeholder="Describe the production you want to create…" />
      </div>
    </div>
  );
}
