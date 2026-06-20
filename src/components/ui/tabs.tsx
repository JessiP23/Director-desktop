import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";
import { IconButton } from "./icon-button";

export type TabItem = {
  id: string;
  label: string;
  icon?: IconName;
  /** Hide the close affordance for pinned/permanent tabs. */
  closable?: boolean;
};

export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onAdd,
  className,
}: {
  tabs: TabItem[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex h-10 shrink-0 items-stretch gap-0.5 overflow-x-auto px-1.5 [scrollbar-width:none]",
        "shadow-[inset_0_-0.5px_0_var(--separator)]",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onActivate(tab.id))}
            className={cn(
              "group relative my-1 flex min-w-0 max-w-52 cursor-default items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
              active ? "bg-fill text-text" : "text-text-tertiary hover:bg-fill/60 hover:text-text-secondary",
            )}
          >
            {tab.icon && <Icon name={tab.icon} size={14} className={active ? "text-accent" : undefined} />}
            <span className="truncate py-1.5">{tab.label}</span>
            {(tab.closable ?? true) && onClose && (
              <button
                type="button"
                aria-label={`Close ${tab.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded text-text-tertiary transition-colors hover:bg-fill-secondary hover:text-text",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        );
      })}
      {onAdd && (
        <div className="sticky right-0 ml-0.5 flex items-center self-center bg-surface-0/80 backdrop-blur">
          <IconButton name="add" label="New tab" size="sm" onClick={onAdd} />
        </div>
      )}
    </div>
  );
}

/** Shows the panel whose id is active; others unmount to free memory. */
export function TabPanels({
  activeId,
  children,
}: {
  activeId: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-0 flex-1" data-active-tab={activeId ?? undefined}>
      {children}
    </div>
  );
}
