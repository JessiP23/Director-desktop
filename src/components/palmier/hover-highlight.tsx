import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Palmier's universal interaction primitive (HoverHighlight.swift): a rounded
 * rect (radius sm=6, continuous) behind any control that fills on hover/active.
 * Fill by (active, hover): active+hover → white .15 · active → .10 · hover → .08
 * · neither → transparent. ease-out 0.15s. Wrap every small interactive control.
 */
export function HoverHighlight({
  active = false,
  radius = "var(--pm-r-sm)",
  className,
  children,
}: {
  active?: boolean;
  radius?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ borderRadius: radius }}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-150 ease-out",
        active ? "bg-white/10 hover:bg-white/[0.15]" : "hover:bg-white/[0.08]",
        className,
      )}
    >
      {children}
    </span>
  );
}
