import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Toolbar } from "./toolbar";
import { IconButton } from "./icon-button";

type Transform = { x: number; y: number; scale: number };

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const clampScale = (s: number) => Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);

/**
 * Generic pannable / zoomable surface. Hosts arbitrary children in a single
 * transformed layer (GPU translate+scale only — never re-layouts on pan/zoom),
 * over a dotted board. Drag empty space to pan, ⌘/ctrl-wheel or the controls to
 * zoom. No asset/feature logic: References and any future board compose on top.
 */
export function Canvas({
  children,
  className,
  controls = true,
}: {
  children: React.ReactNode;
  className?: string;
  controls?: boolean;
}) {
  const [t, setT] = React.useState<Transform>({ x: 0, y: 0, scale: 1 });
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Pan only from the background, not from a tile that handled the press.
    if (e.target !== e.currentTarget) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setT((cur) => ({ ...cur, x: drag.current!.ox + (e.clientX - drag.current!.x), y: drag.current!.oy + (e.clientY - drag.current!.y) }));
  };
  const endPan = () => {
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setT((cur) => {
      const next = clampScale(cur.scale * (1 - e.deltaY * 0.0015));
      return { ...cur, scale: next };
    });
  };

  const zoomBy = (factor: number) => setT((cur) => ({ ...cur, scale: clampScale(cur.scale * factor) }));
  const reset = () => setT({ x: 0, y: 0, scale: 1 });

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden bg-surface-0", className)}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
        className={cn("absolute inset-0 touch-none", drag.current ? "cursor-grabbing" : "cursor-grab")}
        style={{
          backgroundImage: "radial-gradient(circle, var(--separator) 1px, transparent 1px)",
          backgroundSize: `${22 * t.scale}px ${22 * t.scale}px`,
          backgroundPosition: `${t.x}px ${t.y}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})` }}
        >
          {children}
        </div>
      </div>

      {controls && (
        <div className="pointer-events-none absolute bottom-3 right-3">
          <Toolbar floating className="pointer-events-auto">
            <IconButton name="zoomOut" label="Zoom out" size="sm" onClick={() => zoomBy(1 / 1.2)} />
            <button
              type="button"
              onClick={reset}
              className="min-w-11 rounded-md px-1 text-center text-[11px] tabular-nums text-text-tertiary hover:text-text"
            >
              {Math.round(t.scale * 100)}%
            </button>
            <IconButton name="zoomIn" label="Zoom in" size="sm" onClick={() => zoomBy(1.2)} />
            <IconButton name="fit" label="Reset view" size="sm" onClick={reset} />
          </Toolbar>
        </div>
      )}
    </div>
  );
}
