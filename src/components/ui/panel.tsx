import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";
import { IconButton } from "./icon-button";

/**
 * Titled container: a fixed header (icon + title + actions, optional close)
 * over a scrollable body. The single chrome every panel/inspector reuses, so
 * headers never drift. Fills its parent (height comes from the layout region).
 */
export function Panel({
  title,
  icon,
  actions,
  onClose,
  toolbar,
  footer,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: IconName;
  /** Right-aligned header controls (before the close button). */
  actions?: React.ReactNode;
  onClose?: () => void;
  /** Secondary row under the header (tabs, filters, segmented controls). */
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0 text-text", className)}>
      {(title || actions || onClose) && (
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 px-3 shadow-[inset_0_-0.5px_0_var(--separator)]">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <Icon name={icon} size={15} className="text-text-tertiary" />}
            {title && <h2 className="truncate text-sm font-semibold text-text">{title}</h2>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {onClose && <IconButton name="close" label="Close" size="sm" onClick={onClose} />}
          </div>
        </header>
      )}
      {toolbar && (
        <div className="flex h-10 shrink-0 items-center gap-2 px-3 shadow-[inset_0_-0.5px_0_var(--separator)]">
          {toolbar}
        </div>
      )}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
      {footer && (
        <div className="shrink-0 px-3 py-2 shadow-[inset_0_0.5px_0_var(--separator)]">{footer}</div>
      )}
    </section>
  );
}
