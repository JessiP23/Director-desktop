import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Palmier panel (makeHosting()): content on --bg-surface, clipped to a 6px
 * continuous-corner rounded rect, with 2.5px padding (panelGap/2) around it so
 * panels read as rounded cards floating on near-black, separated by 5px gaps.
 * When `focused`, a 6px rounded rect is stroked with --accent-primary at 1.5px,
 * opacity 0.6, animated ease-out 0.2s (the focus ring).
 */
export function PanelShell({
  focused = false,
  className,
  children,
}: {
  focused?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 p-[2.5px]">
      <div
        className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
        style={{ background: "var(--pm-bg-surface)", borderRadius: "var(--pm-r-sm)" }}
      >
        {children}
      </div>
      {/* Focus ring — overlaid, non-interactive, animated. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[2.5px] transition-opacity duration-200 ease-out"
        style={{
          borderRadius: "var(--pm-r-sm)",
          boxShadow: "inset 0 0 0 1.5px var(--pm-accent-primary)",
          opacity: focused ? 0.6 : 0,
        }}
      />
    </div>
  );
}
