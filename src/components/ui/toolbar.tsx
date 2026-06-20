import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Horizontal control strip used as a panel header's action row or a canvas
 * overlay cluster. `ToolbarGroup` clusters related controls; `ToolbarSeparator`
 * draws a hairline between groups.
 */
export function Toolbar({
  children,
  className,
  floating,
}: {
  children: React.ReactNode;
  className?: string;
  /** Floating variant: a rounded, elevated capsule (e.g. canvas controls). */
  floating?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        floating &&
          "material rounded-xl bg-material-popover px-1 py-1 shadow-[var(--shadow-pop)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-0.5", className)}>{children}</div>;
}

export function ToolbarSeparator() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-separator" aria-hidden />;
}
