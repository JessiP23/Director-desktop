import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, Icon } from "@/components/ui";
import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import type { StreamItem } from "@/lib/director/stream";
import { GenerationMedia } from "./media-view";

import { appLocale, conversationMessages } from "@/lib/i18n";

// The backend emits these confirmation lines hardcoded in Italian. Exactly like
// wmstudio's conversation.tsx, we swap them for the localized strings before
// rendering, so an English/Spanish chat doesn't show Italian.
const MEDIA_CONFIRMATION_MESSAGE_IT =
  "La generazione è pronta: controlla l'anteprima e rispondi \"procedi\" per avviarla, oppure dimmi cosa vuoi modificare.";
const CASTING_CONFIRMATION_TAIL_IT =
  "Confermi questa proposta? Dopo la conferma verrà salvata nel brief di produzione.";

/** Apply wmstudio's confirmation-string localization to an agent message. */
function localizeAgentMessage(text: string): string {
  const confirmation = conversationMessages(appLocale()).confirmation;
  const trimmed = text.trim();
  if (trimmed === MEDIA_CONFIRMATION_MESSAGE_IT) return confirmation.ready;
  if (trimmed.endsWith(CASTING_CONFIRMATION_TAIL_IT)) {
    return `${trimmed.slice(0, -CASTING_CONFIRMATION_TAIL_IT.length).trimEnd()}\n\n${confirmation.castingReady}`;
  }
  return text;
}

/**
 * Localized label for an internal Director delegation/activity tool, reusing
 * wmstudio's `director.conversation.activity` strings (copied into the desktop).
 */
function activityLabel(toolName: string): string {
  const activity = conversationMessages(appLocale()).activity as Record<
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
  prev.onSend === next.onSend && itemsEqual(prev.item, next.item),
);

function StreamItemViewImpl({
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
          <div className="max-w-[80%] whitespace-pre-wrap rounded-[22px] rounded-br-[8px] bg-[#27272a] px-4 py-2.5 text-[14px] leading-6 text-[#f4f4f5]">
            {item.text}
          </div>
        </div>
      );

    case "message":
      return (
        <div className="flex justify-start gap-3">
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.06]">
            <img src="/brand/wm-symbol-white.svg" alt="" className="h-5 w-5 object-contain opacity-80" draggable={false} />
          </span>
          <Markdown className="max-w-[85%] text-[14px] leading-6 text-[#d4d4d8] [&_a]:text-[#f4f4f5] [&_blockquote]:border-[#3f3f46] [&_code]:bg-[#27272a] [&_h1]:text-[#f4f4f5] [&_h2]:text-[#f4f4f5] [&_h3]:text-[#f4f4f5] [&_strong]:text-[#f4f4f5]">
            {localizeAgentMessage(item.text)}
          </Markdown>
        </div>
      );

    case "system":
      return (
        <div
          className={cn(
            "rounded-[14px] px-3.5 py-2 text-[12px]",
            item.tone === "error" && "bg-red-500/10 text-red-300",
            item.tone === "success" && "bg-emerald-500/10 text-emerald-300",
            item.tone === "info" && "bg-white/[0.05] text-[#a1a1aa]",
          )}
        >
          {item.text}
        </div>
      );

    case "activity":
      return (
        <div className="flex items-center gap-2.5 text-[12px] text-[#71717a]">
          {item.status === "running" ? (
            <Spinner className="size-3.5 text-[#a1a1aa]" />
          ) : (
            <span className={cn("size-1.5 rounded-full", item.status === "failed" ? "bg-red-400" : "bg-[#52525b]")} />
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
          <Card className="flex items-center gap-2.5 border-white/[0.06] bg-[#1f1f22] px-4 py-3 text-[12px] text-[#a1a1aa]">
            <Spinner className="size-3.5 text-[#a1a1aa]" />
            Rendering…
          </Card>
        );
      }

      if (item.status === "awaiting-confirmation" && !item.confirmed) {
        const c = conversationMessages(appLocale()).confirmation;
        return (
          <Card className="border-white/[0.08] bg-[#1f1f22] p-4 text-[#d4d4d8]">
            <Markdown>{item.previewMessage ?? c.defaultQuestion}</Markdown>
            {typeof item.previewCredits === "number" && (
              <p className="mt-1 text-xs text-[#71717a]">
                {c.credits.replace("{count}", String(item.previewCredits))}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => onSend("proceed")}>
                {c.confirm}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSend("cancel")}>
                {c.cancel}
              </Button>
            </div>
          </Card>
        );
      }

      if (item.status === "failed") {
        return (
          <div className="flex items-center gap-2 rounded-[14px] bg-red-500/10 px-3.5 py-2 text-xs text-red-300">
            <Icon name="close" size={13} />
            Generation failed{item.errorMessage ? `: ${item.errorMessage}` : "."}
          </div>
        );
      }

      // completed (or a confirmed preview that has since produced media)
      return (
        <Card className="overflow-hidden border-white/[0.06] bg-[#1f1f22]">
          {item.resultUrl && (
            <GenerationMedia url={item.resultUrl} kind={item.resultKind} aspectRatio={item.aspectRatio} />
          )}
        </Card>
      );
    }

    default:
      return null;
  }
}
