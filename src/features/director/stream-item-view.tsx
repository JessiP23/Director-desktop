import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { StreamItem } from "@/lib/director/stream";
import { GenerationMedia } from "./media-view";

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
        <div className="flex justify-start gap-3">
          <Brand showWordmark={false} className="mt-1 shrink-0" />
          <Markdown className="max-w-[85%]">{item.text}</Markdown>
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
            <Markdown>{item.previewMessage ?? "Ready to generate this?"}</Markdown>
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
          {item.resultUrl && (
            <GenerationMedia url={item.resultUrl} kind={item.resultKind} aspectRatio={item.aspectRatio} />
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
