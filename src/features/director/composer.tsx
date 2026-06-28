import * as React from "react";
import { Icon, IconButton, Spinner, Tooltip } from "@/components/ui";
import type { DirectorQuality } from "@/lib/director/contract/director";
import { cn } from "@/lib/utils/cn";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n)));

/** Context-window usage ring (estimated tokens vs the agent's history budget),
 *  mirroring the web app. Turns amber near the limit, red when full. */
function ContextRing({ used, budget }: { used: number; budget: number }) {
  const frac = Math.min(used / Math.max(budget, 1), 1);
  const r = 7;
  const c = 2 * Math.PI * r;
  const color = frac >= 1 ? "var(--danger)" : frac >= 0.8 ? "var(--accent)" : "var(--text-tertiary)";
  return (
    <Tooltip label={`Context: ${fmt(used)} / ${fmt(budget)} tokens — older turns roll into the production summary`}>
      <span className="flex items-center gap-1.5 pr-0.5 text-[11px] tabular-nums" style={{ color }}>
        <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90">
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--separator)" strokeWidth="2" />
          <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
        </svg>
        {fmt(used)}
      </span>
    </Tooltip>
  );
}

function AutoQualityLabel({ quality }: { quality: DirectorQuality }) {
  if (quality !== "premium") {
    return <span className="font-semibold text-text-tertiary">Auto</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <span className="text-text-tertiary">Auto</span>
      <span
        className={cn(
          "inline-block bg-clip-text text-transparent motion-reduce:animate-none",
          "animate-[director-max-label-shimmer_7s_ease-in-out_infinite] bg-[length:300%_100%]",
          "bg-[linear-gradient(90deg,var(--text-tertiary),var(--text),var(--text-tertiary))]",
        )}
      >
        Max
      </span>
    </span>
  );
}

function AutoQualitySelect({
  quality,
  onChange,
  disabled,
}: {
  quality: DirectorQuality;
  onChange: (value: DirectorQuality) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const options = [
    { value: "economic", label: "Auto", description: "Fast default generation" },
    { value: "premium", label: "Auto Max", description: "Higher-quality generation" },
  ] as const;

  return (
    <div ref={wrapperRef} className="relative">
      <Tooltip label="Auto mode">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs transition-colors duration-150 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            isOpen ? "bg-fill text-text" : "text-text-secondary hover:bg-fill hover:text-text",
          )}
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <AutoQualityLabel quality={quality} />
          <Icon name="chevronDown" size={13} className="text-text-quaternary" />
        </button>
      </Tooltip>
      {isOpen && (
        <div
          className="absolute bottom-full left-0 z-[100] mb-1.5 w-64 overflow-hidden rounded-[14px] border border-separator bg-surface-1 shadow-[var(--shadow-pop)]"
          role="menu"
          aria-label="Auto mode"
        >
          <ul className="px-1.5 py-1">
            {options.map((option) => {
              const isActive = option.value === quality;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 ease-out",
                      isActive ? "bg-fill text-text" : "text-text-tertiary hover:bg-fill hover:text-text-secondary",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-text-quaternary">
                        {option.description}
                      </span>
                    </span>
                    {isActive && <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The prompt input. Auto-grows, submits on Enter (Shift+Enter for newline),
 * and disables while the run is responding. Attachments/drag-drop are a planned
 * enhancement (the backend already accepts references via the API).
 */
export function Composer({
  onSend,
  disabled,
  busy,
  placeholder = "Describe the production you want to create…",
  contextUsage,
  quality = "premium",
  onQualityChange,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  contextUsage?: { usedTokens: number; budgetTokens: number };
  quality?: DirectorQuality;
  onQualityChange?: (value: DirectorQuality) => void;
}) {
  const [value, setValue] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(resize);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="shrink-0 px-4 py-3.5 shadow-[inset_0_0.5px_0_var(--separator)]">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[30px] border border-separator bg-surface-1 px-3 py-2 shadow-sm transition-colors focus-within:border-accent/60">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm text-text outline-none placeholder:text-text-quaternary"
        />
        {contextUsage && contextUsage.usedTokens > 0 && (
          <span className="mb-1 self-center">
            <ContextRing used={contextUsage.usedTokens} budget={contextUsage.budgetTokens} />
          </span>
        )}
        {onQualityChange && (
          <span className="mb-0.5 self-center">
            <AutoQualitySelect quality={quality} onChange={onQualityChange} disabled={disabled || busy} />
          </span>
        )}
        {busy ? (
          <span className="grid size-8 place-items-center">
            <Spinner className="size-4 text-text-tertiary" />
          </span>
        ) : (
          <IconButton
            name="send"
            label="Send"
            variant="secondary"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-fill disabled:text-text-quaternary"
          />
        )}
      </div>
    </div>
  );
}
