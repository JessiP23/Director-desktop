import * as React from "react";
import { IconButton, Spinner, Tooltip } from "@/components/ui";

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
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  contextUsage?: { usedTokens: number; budgetTokens: number };
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
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-separator bg-surface-1 px-3 py-2 shadow-sm transition-colors focus-within:border-accent/60">
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
