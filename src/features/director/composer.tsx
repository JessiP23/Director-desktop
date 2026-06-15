import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
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
    <div className="border-t border-line bg-ink-900/60 px-4 py-3.5 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line-strong bg-ink-850 px-3 py-2 focus-within:border-accent/60">
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
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <Button
          size="icon"
          variant="primary"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
        >
          {busy ? <Spinner className="size-4" /> : <span className="text-base leading-none">↑</span>}
        </Button>
      </div>
    </div>
  );
}
