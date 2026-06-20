import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName, type LucideIcon } from "@/components/ui";
import { HoverHighlight } from "./hover-highlight";

/**
 * Palmier icon button: an icon inside a HoverHighlight (radius 6, ease-out
 * 0.15s). Active state uses the active fill. Glyph defaults to 13–14px on an
 * iconLg(26) frame. Label is required for accessibility.
 */
export function PalmierIconButton({
  label,
  name,
  icon,
  active = false,
  size = 26,
  glyph = 14,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  name?: IconName;
  icon?: LucideIcon;
  active?: boolean;
  size?: number;
  glyph?: number;
}) {
  return (
    <HoverHighlight active={active}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn("grid place-items-center outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-40", className)}
        style={{ width: size, height: size, color: active ? "var(--pm-text-primary)" : "var(--pm-text-tertiary)" }}
        {...props}
      >
        <Icon name={name} icon={icon} size={glyph} />
      </button>
    </HoverHighlight>
  );
}
