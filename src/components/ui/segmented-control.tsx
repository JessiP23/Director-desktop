import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  /** When true the label is visually hidden (icon-only segment). */
  iconOnly?: boolean;
};

/**
 * Generic segmented control (the appearance toggle is one instance of this).
 * Controlled: caller owns the value. Token-themed, no feature logic.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-fill-secondary p-0.5", className)}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            aria-label={opt.iconOnly ? opt.label : undefined}
            title={opt.iconOnly ? opt.label : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              active ? "bg-surface-0 text-text shadow-[var(--shadow-hairline)]" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {opt.icon && <Icon name={opt.icon} size={size === "sm" ? 13 : 14} />}
            {!opt.iconOnly && opt.label}
          </button>
        );
      })}
    </div>
  );
}
