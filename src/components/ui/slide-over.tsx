import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Generic right-edge slide-over, extracted so every panel (Timeline, Library, …)
 * shares one chrome and one transition. Children render inside a scrollable
 * body; `header` slots extra controls (tabs, actions) next to the title.
 */
export function SlideOver({
  title,
  isOpen,
  onClose,
  header,
  width = "w-[clamp(520px,46vw,860px)]",
  children,
}: {
  title: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  // Close on Escape while open — matches native panel behavior.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "material fixed inset-y-3 right-0 z-50 flex max-w-[96vw] flex-col overflow-hidden rounded-l-xl bg-material-popover text-text shadow-[var(--shadow-pop)] transition-transform duration-[250ms] ease-out will-change-transform",
        width,
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-4 shadow-[inset_0_-0.5px_0_var(--separator)]">
        <h2 className="shrink-0 text-sm font-semibold text-text">{title}</h2>
        <div className="flex min-w-0 items-center gap-2">
          {header}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-fill hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
