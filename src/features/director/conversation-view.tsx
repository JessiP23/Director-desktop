import * as React from "react";
import type { StreamItem } from "@/lib/director/stream";
import { StreamItemView } from "./stream-item-view";

/** Scrollable transcript that auto-sticks to the bottom as new items arrive. */
export function ConversationView({
  items,
  onSend,
}: {
  items: StreamItem[];
  onSend: (text: string) => void;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
        {items.map((item) => (
          <StreamItemView key={item.id} item={item} onSend={onSend} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
