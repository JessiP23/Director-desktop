import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "@/components/ui";

/**
 * Palmier agent empty-state starter card (AgentPanelView.swift): SF Symbol +
 * title + prefill text, on a raised plate with a hairline; fills on hover.
 * Selecting prefills the composer (caller wires the existing action).
 */
export function StarterPromptCard({
  icon,
  title,
  prompt,
  onSelect,
  className,
}: {
  icon: IconName;
  title: string;
  prompt: string;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-[var(--pm-r-md)] p-3 text-left outline-none transition-colors duration-150 ease-out hover:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/40",
        className,
      )}
      style={{ background: "var(--pm-bg-raised)", border: "0.5px solid var(--pm-border-primary)" }}
    >
      <Icon name={icon} size={16} className="text-pm-text-tertiary" />
      <span className="text-[12px] font-semibold" style={{ color: "var(--pm-text-primary)" }}>{title}</span>
      <span className="line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--pm-text-muted)" }}>{prompt}</span>
    </button>
  );
}
