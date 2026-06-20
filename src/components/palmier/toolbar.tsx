import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Palmier toolbar (ToolbarView.swift): height 38, grouped icon buttons
 * separated by vertical dividers (height 20). Sits on --bg-raised.
 */
export function PalmierToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex h-[38px] shrink-0 items-center gap-1 px-2", className)}
      style={{ background: "var(--pm-bg-raised)", borderBottom: "1px solid var(--pm-border-primary)" }}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-0.5", className)}>{children}</div>;
}

/** Vertical divider between toolbar groups (height 20). */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--pm-border-subtle)" }} />;
}

export function ToolbarSpacer() {
  return <span className="flex-1" />;
}
