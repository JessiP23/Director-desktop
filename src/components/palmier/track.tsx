import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type TrackKind = "video" | "audio" | "image" | "text" | "lottie";

const TINT: Record<TrackKind, string> = {
  video: "var(--pm-track-video)",
  audio: "var(--pm-track-audio)",
  image: "var(--pm-track-image)",
  text: "var(--pm-track-text)",
  lottie: "var(--pm-track-lottie)",
};

/**
 * Palmier timeline primitives. A Track is a 50px-tall lane with a 100px header;
 * a Clip is a tinted-by-type block with a 3px corner radius. Presentational —
 * positioning/duration come from the caller (existing timeline data).
 */
export function Track({ label, kind, children }: { label: string; kind: TrackKind; children?: React.ReactNode }) {
  return (
    <div className="flex h-[50px] shrink-0" style={{ borderBottom: "0.5px solid var(--pm-border-subtle)" }}>
      <div
        className="flex w-[100px] shrink-0 items-center gap-1.5 px-2"
        style={{ background: "var(--pm-bg-raised)", borderRight: "0.5px solid var(--pm-border-primary)" }}
      >
        <span className="size-2 shrink-0 rounded-[2px]" style={{ background: TINT[kind] }} />
        <span className="truncate text-[10px] font-medium" style={{ color: "var(--pm-text-tertiary)" }}>{label}</span>
      </div>
      <div className="relative min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Clip({
  kind,
  label,
  selected,
  style,
  onClick,
}: {
  kind: TrackKind;
  label?: string;
  selected?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, background: TINT[kind], borderRadius: "var(--pm-r-xs)" }}
      className={cn(
        "absolute top-1.5 bottom-1.5 flex items-center overflow-hidden px-1.5 text-left outline-none transition-[box-shadow] duration-150",
        selected ? "ring-1 ring-white/80" : "ring-0",
      )}
    >
      {label && <span className="truncate text-[10px] font-medium text-white/90">{label}</span>}
    </button>
  );
}
