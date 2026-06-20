import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Palmier panelHeaderBar(): full width, height 28, background --bg-raised, with
 * a 1px --border-primary line along the BOTTOM only. Title is 12px medium
 * --text-secondary; trailing slot holds controls.
 */
export function PanelHeaderBar({
  title,
  leading,
  trailing,
  className,
}: {
  title?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-7 shrink-0 items-center gap-1.5 px-2", className)}
      style={{ background: "var(--pm-bg-raised)", borderBottom: "1px solid var(--pm-border-primary)" }}
    >
      {leading}
      {title && (
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: "var(--pm-text-secondary)" }}>
          {title}
        </span>
      )}
      {!title && <span className="flex-1" />}
      {trailing}
    </div>
  );
}
