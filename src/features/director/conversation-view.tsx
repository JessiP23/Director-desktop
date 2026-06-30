import * as React from "react";
import type { StreamItem } from "@/lib/director/stream";
import { StreamItemView } from "./stream-item-view";

/**
 * Scrollable transcript that sticks to the bottom as new items arrive — but
 * only while the user is already near the bottom, so scrolling up to re-read
 * isn't yanked back down mid-stream. During a live turn the scroll is snapped
 * instantly (not animated) so dozens of token updates per second don't restart
 * a smooth-scroll animation that never gets to finish.
 */
export function ConversationView({
  items,
  onSend,
}: {
  items: StreamItem[];
  onSend: (text: string) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // Whether the viewport is pinned to the bottom; updated as the user scrolls.
  const stickRef = React.useRef(true);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distanceFromBottom < 80;
  }, []);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0, transparent 48px, black 64px, black calc(100% - 58px), transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0, transparent 48px, black 64px, black calc(100% - 58px), transparent 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pb-6 pt-20">
        {items.map((item) => (
          <StreamItemView key={item.id} item={item} onSend={onSend} />
        ))}
      </div>
    </div>
  );
}
