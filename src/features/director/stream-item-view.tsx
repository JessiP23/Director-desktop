import * as React from "react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { StreamItem } from "@/lib/director/stream";
import { GenerationMedia } from "./media-view";

import { conversationMessages, type Locale } from "@/lib/i18n";

/**
 * Localized label for an internal Director delegation/activity tool, reusing
 * wmstudio's `director.conversation.activity` strings (copied into the desktop).
 */
function activityLabel(toolName: string, locale: Locale): string {
  const activity = conversationMessages(locale).activity as Record<
    string,
    { running?: string } | string
  >;
  const entry = activity[toolName];
  if (entry && typeof entry === "object" && entry.running) return entry.running;
  return toolName.replace(/_/g, " ");
}

/**
 * `buildStream` returns fresh item objects on every render, so a naive map
 * would re-render every bubble (and re-parse every Markdown block) on each
 * streamed token. Compare items by value instead: only the row whose content
 * actually changed — typically the single bubble currently receiving deltas —
 * re-renders. Nested objects (a generation's `args`/url arrays) get new
 * references each build, so those rows still re-render, but there are few of
 * them and they don't carry the hot streaming path.
 */
function itemsEqual(a: StreamItem, b: StreamItem): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind || a.id !== b.id) return false;
  const ka = Object.keys(a) as (keyof StreamItem)[];
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

export const StreamItemView = React.memo(StreamItemViewImpl, (prev, next) =>
  prev.onSend === next.onSend && prev.locale === next.locale && itemsEqual(prev.item, next.item),
);

function StreamItemViewImpl({
  item,
  onSend,
  locale,
}: {
  item: StreamItem;
  onSend: (text: string) => void;
  locale: Locale;
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
            {activityLabel(item.toolName, locale)}
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
        const c = conversationMessages(locale).confirmation;
        return (
          <div className="rounded-2xl border border-accent/30 bg-ink-850 p-4">
            <Markdown>{item.previewMessage ?? c.defaultQuestion}</Markdown>
            {typeof item.previewCredits === "number" && (
              <p className="mt-1 text-xs text-fg-muted">
                {c.credits.replace("{count}", String(item.previewCredits))}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => onSend(c.confirm.toLowerCase())}>
                {c.confirm}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSend(c.cancel.toLowerCase())}>
                {c.cancel}
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
