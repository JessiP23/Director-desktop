import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Side = "top" | "bottom" | "left" | "right";

const sidePos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/**
 * Lightweight hover/focus tooltip — CSS-positioned relative to its trigger, no
 * portal or external dep. Opens after a short delay; closes instantly. Honors
 * reduced-motion via the global transition tokens.
 */
export function Tooltip({
  label,
  side = "top",
  delay = 350,
  children,
  className,
}: {
  label: React.ReactNode;
  side?: Side;
  delay?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[200] whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium",
            "material bg-material-popover text-text shadow-[var(--shadow-pop)]",
            sidePos[side],
            className,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
