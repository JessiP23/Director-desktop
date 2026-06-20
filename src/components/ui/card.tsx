import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Generic surface container. Interactive when `onClick` is set (renders a
 * button-grade affordance: hover lift + focus ring). No feature logic.
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  selected?: boolean;
}>(({ interactive, selected, className, ...props }, ref) => {
  const clickable = interactive ?? Boolean(props.onClick);
  return (
    <div
      ref={ref}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={cn(
        "rounded-xl border bg-surface-1 transition-[box-shadow,border-color,transform] duration-150",
        selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-separator",
        clickable &&
          "cursor-pointer outline-none hover:border-border hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-[0.997]",
        className,
      )}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).click();
              }
            }
          : undefined
      }
      {...props}
    />
  );
});
Card.displayName = "Card";
