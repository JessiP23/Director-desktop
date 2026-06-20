import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName, type LucideIcon } from "./icon";

/**
 * Centered empty/zero state: optional icon, title, supporting line, optional
 * action slot. Replaces the hand-rolled "centered grey text" blocks so every
 * empty surface reads the same.
 */
export function EmptyState({
  name,
  icon,
  title,
  description,
  action,
  className,
}: {
  name?: IconName;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center", className)}>
      {(name || icon) && (
        <div className="grid size-11 place-items-center rounded-2xl bg-fill text-text-tertiary">
          <Icon name={name} icon={icon} size={20} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {description && <p className="max-w-xs text-xs leading-relaxed text-text-tertiary">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
