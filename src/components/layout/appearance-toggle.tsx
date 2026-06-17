import { useAppearance, type AppearanceMode } from "@/lib/appearance/use-appearance";
import { cn } from "@/lib/utils/cn";

/**
 * Compact segmented control for the appearance preference (auto / light / dark).
 * Reads and writes the presentational appearance store only.
 */
const OPTIONS: { mode: AppearanceMode; label: string; glyph: string }[] = [
  { mode: "auto", label: "Match System", glyph: "◐" },
  { mode: "light", label: "Light", glyph: "☀" },
  { mode: "dark", label: "Dark", glyph: "☾" },
];

export function AppearanceToggle() {
  const { mode, setMode } = useAppearance();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="no-drag flex items-center gap-0.5 rounded-md bg-fill-secondary p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.mode;
        return (
          <button
            key={option.mode}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setMode(option.mode)}
            className={cn(
              "grid size-6 place-items-center rounded text-[12px] leading-none transition-colors",
              active
                ? "bg-surface-0 text-text shadow-[var(--shadow-hairline)]"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {option.glyph}
          </button>
        );
      })}
    </div>
  );
}
