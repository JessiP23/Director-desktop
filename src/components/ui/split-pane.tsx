import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** A flex region that clamps its content and lets it scroll. */
export function Pane({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>{children}</div>;
}

function usePersistentSize(storageKey: string | undefined, fallback: number) {
  const [size, setSize] = React.useState(() => {
    if (!storageKey) return fallback;
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  });
  const set = React.useCallback(
    (next: number) => {
      setSize(next);
      if (storageKey) localStorage.setItem(storageKey, String(next));
    },
    [storageKey],
  );
  return [size, set] as const;
}

/**
 * Two resizable panes with a draggable divider. `direction="horizontal"` splits
 * side-by-side (Cursor-style compare); `"vertical"` stacks. The first pane's
 * size is a clamped percentage persisted to localStorage so the layout restores.
 * Resize is flex-basis only (no transforms on content) and pointer-captured for
 * a smooth drag.
 */
export function SplitPane({
  direction = "horizontal",
  defaultSize = 50,
  minFirst = 160,
  minSecond = 160,
  storageKey,
  className,
  children,
}: {
  direction?: "horizontal" | "vertical";
  defaultSize?: number;
  minFirst?: number;
  minSecond?: number;
  storageKey?: string;
  className?: string;
  children: [React.ReactNode, React.ReactNode];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = usePersistentSize(storageKey, defaultSize);
  const [dragging, setDragging] = React.useState(false);
  const horizontal = direction === "horizontal";

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const total = horizontal ? rect.width : rect.height;
    const pos = horizontal ? e.clientX - rect.left : e.clientY - rect.top;
    const minPct = (minFirst / total) * 100;
    const maxPct = 100 - (minSecond / total) * 100;
    setSize(Math.min(Math.max((pos / total) * 100, minPct), maxPct));
  };

  const stop = (e: React.PointerEvent) => {
    if (!dragging) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  return (
    <div ref={ref} className={cn("flex min-h-0 min-w-0", horizontal ? "flex-row" : "flex-col", className)}>
      <div style={{ flexBasis: `${size}%` }} className="flex min-h-0 min-w-0 overflow-hidden">
        {children[0]}
      </div>
      <div
        role="separator"
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        className={cn(
          "group relative z-10 shrink-0 touch-none",
          horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
          "bg-separator",
        )}
      >
        {/* Wider invisible hit area + accent on hover/drag. */}
        <span
          className={cn(
            "absolute transition-colors",
            horizontal ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1",
            dragging ? "bg-accent/40" : "group-hover:bg-accent/25",
          )}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children[1]}</div>
    </div>
  );
}
