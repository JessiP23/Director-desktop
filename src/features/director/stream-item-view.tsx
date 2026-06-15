import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { StreamItem } from "@/lib/director/stream";

/** Human-readable label for an internal Director delegation/activity tool. */
function activityLabel(toolName: string): string {
  const map: Record<string, string> = {
    delegate_media_generation: "Generating media",
    delegate_screenwriter: "Writing the script",
    delegate_research: "Researching",
    delegate_caster: "Developing characters",
    delegate_editor: "Editing the timeline",
    write_todos: "Planning",
  };
  return map[toolName] ?? toolName.replace(/_/g, " ");
}

function GenerationMedia({ url, kind }: { url: string; kind?: string }) {
  if (kind === "video") {
    return <video src={url} controls className="max-h-96 w-full rounded-xl bg-black" />;
  }
  if (kind === "audio") {
    return <audio src={url} controls className="w-full" />;
  }
  return <img src={url} alt="Generated frame" className="max-h-96 w-full rounded-xl object-contain bg-black/40" />;
}

export function StreamItemView({
  item,
  onSend,
}: {
  item: StreamItem;
  onSend: (text: string) => void;
}) {
  switch (item.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-sm text-fg">
            {item.text}
          </div>
        </div>
      );

    case "message":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-fg">
            {item.text}
          </div>
        </div>
      );

    case "system":
      return (
        <div
          className={cn(
            "rounded-xl px-3.5 py-2 text-xs",
            item.tone === "error" && "bg-danger/10 text-danger",
            item.tone === "success" && "bg-success/10 text-success",
            item.tone === "info" && "bg-ink-800 text-fg-muted",
          )}
        >
          {item.text}
        </div>
      );

    case "activity":
      return (
        <div className="flex items-center gap-2.5 text-xs text-fg-muted">
          {item.status === "running" ? (
            <Spinner className="size-3.5 text-accent" />
          ) : (
            <span className={cn("size-1.5 rounded-full", item.status === "failed" ? "bg-danger" : "bg-fg-subtle")} />
          )}
          <span>
            {activityLabel(item.toolName)}
            {item.status === "failed" && item.errorMessage ? ` — ${item.errorMessage}` : "…"}
          </span>
        </div>
      );

    case "tool-generation": {
      if (item.status === "running") {
        return (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-850 px-4 py-3 text-xs text-fg-muted">
            <Spinner className="size-3.5 text-accent" />
            Rendering…
          </div>
        );
      }

      if (item.status === "awaiting-confirmation" && !item.confirmed) {
        return (
          <div className="rounded-2xl border border-accent/30 bg-ink-850 p-4">
            <p className="text-sm text-fg">{item.previewMessage ?? "Ready to generate this?"}</p>
            {typeof item.previewCredits === "number" && (
              <p className="mt-1 text-xs text-fg-muted">Estimated cost: {item.previewCredits} credits</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => onSend("procedi")}>
                Generate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSend("annulla")}>
                Cancel
              </Button>
            </div>
          </div>
        );
      }

      if (item.status === "failed") {
        return (
          <div className="rounded-xl bg-danger/10 px-3.5 py-2 text-xs text-danger">
            Generation failed{item.errorMessage ? `: ${item.errorMessage}` : "."}
          </div>
        );
      }

      // completed (or a confirmed preview that has since produced media)
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-ink-850">
          {item.resultUrl && <GenerationMedia url={item.resultUrl} kind={item.resultKind} />}
        </div>
      );
    }

    default:
      return null;
  }
}
