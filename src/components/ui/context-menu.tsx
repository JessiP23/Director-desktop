import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

export type MenuItem =
  | { type: "separator" }
  | {
      type?: "item";
      label: string;
      icon?: IconName;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
    };

/**
 * Right-click context menu. Wraps a trigger; opens a floating, token-themed menu
 * at the pointer, closes on select / outside-press / Escape / scroll. Generic —
 * the items array carries all behavior, no feature logic here.
 */
export function ContextMenu({ items, children }: { items: MenuItem[]; children: React.ReactNode }) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  return (
    <>
      <div
        className="contents"
        onContextMenu={(e) => {
          e.preventDefault();
          // Clamp so the menu never overflows the viewport edge.
          setPos({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 320) });
        }}
      >
        {children}
      </div>
      {pos && (
        <div
          role="menu"
          style={{ left: pos.x, top: pos.y }}
          onPointerDown={(e) => e.stopPropagation()}
          className="material fixed z-[300] min-w-[200px] rounded-xl bg-material-popover p-1 text-text shadow-[var(--shadow-pop)]"
        >
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} className="my-1 h-px bg-separator" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setPos(null);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors disabled:opacity-40",
                  item.danger
                    ? "text-danger hover:bg-danger/10"
                    : "text-text-secondary hover:bg-fill hover:text-text",
                )}
              >
                {item.icon && <Icon name={item.icon} size={15} />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
