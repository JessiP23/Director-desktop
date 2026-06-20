import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "@/components/ui";

export type RailTab = { id: string; label: string; icon: IconName };

/**
 * Palmier's 38px vertical icon tab rail (MediaPanelView.swift). On --bg-raised
 * with a 0.5px --border-primary hairline on its RIGHT edge. Icon buttons stack
 * top-aligned (spacing xs=4, pad sm=6). The selected tab: semibold + primary
 * text, with a 2px capsule (height iconSm=18) in --border-primary pinned to the
 * icon's LEADING edge. Hovering shows a floating label capsule to the right.
 */
export function IconRail({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: RailTab[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  return (
    <div
      className="relative flex w-[38px] shrink-0 flex-col items-center gap-1 py-1.5"
      style={{ background: "var(--pm-bg-raised)", borderRight: "0.5px solid var(--pm-border-primary)" }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div key={tab.id} className="relative" onPointerEnter={() => setHovered(tab.id)} onPointerLeave={() => setHovered(null)}>
            {/* leading selection capsule */}
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-full transition-opacity"
              style={{ background: "var(--pm-border-divider)", opacity: active ? 1 : 0 }}
            />
            <button
              type="button"
              aria-label={tab.label}
              aria-pressed={active}
              onClick={() => onSelect(tab.id)}
              className="grid size-[26px] place-items-center rounded-[var(--pm-r-sm)] outline-none transition-colors duration-150 ease-out hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-white/40"
              style={{ color: active ? "var(--pm-text-primary)" : "var(--pm-text-tertiary)" }}
            >
              <Icon name={tab.icon} size={14} strokeWidth={active ? 2.25 : 1.75} />
            </button>
            {/* floating hover label capsule */}
            {hovered === tab.id && (
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute left-full top-1/2 z-50 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-[var(--pm-r-sm)] px-2 py-1 text-[10px] font-medium",
                )}
                style={{
                  background: "var(--pm-bg-prominent)",
                  color: "var(--pm-text-primary)",
                  border: "1px solid var(--pm-border-primary)",
                  boxShadow: "var(--pm-shadow-sm)",
                }}
              >
                {tab.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
