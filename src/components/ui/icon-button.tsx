import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName, type LucideIcon } from "./icon";

type Variant = "ghost" | "secondary" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  ghost: "text-text-tertiary hover:bg-fill hover:text-text",
  secondary: "bg-fill text-text-secondary hover:bg-fill-secondary hover:text-text",
  danger: "text-text-tertiary hover:bg-danger/10 hover:text-danger",
};

const sizes: Record<Size, { box: string; icon: number }> = {
  sm: { box: "size-7 rounded-md", icon: 15 },
  md: { box: "size-8 rounded-lg", icon: 16 },
};

export type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Required — icon-only controls must be labelled for accessibility. */
  label: string;
  name?: IconName;
  icon?: LucideIcon;
  variant?: Variant;
  size?: Size;
  active?: boolean;
};

/**
 * Square icon-only control. The single home for the "grid place-items-center
 * close button" markup that was hand-rolled in every panel.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, name, icon, variant = "ghost", size = "md", active, className, ...props }, ref) => {
    const s = sizes[size];
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn(
          "grid place-items-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40",
          s.box,
          active ? "bg-fill text-text" : variants[variant],
          className,
        )}
        {...props}
      >
        <Icon name={name} icon={icon} size={s.icon} />
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
